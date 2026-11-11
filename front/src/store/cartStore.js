import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "../services/api";
import { CLIENT_MAX_QTY, normalizeQty } from "../utils/clientQty";

function stockCapOf(raw) {
  if (raw == null || raw === "") return null;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function effectiveMax(raw) {
  const cap = stockCapOf(raw);
  return cap == null ? CLIENT_MAX_QTY : Math.max(0, cap);
}

function mapServerLigne(l) {
  const a = l.article || {};
  return {
    articleId: Number(l.articleId || a.id),
    code: a.code,
    libelle: a.libelle,
    prixVente: Number(a.prixVente) || 0,
    imageUrl: a.imageUrl,
    stockDisponible: stockCapOf(a.stockTotal ?? a.stockDisponible),
    quantite: normalizeQty(l.quantite, {
      min: 1,
      max: Math.max(1, effectiveMax(a.stockTotal ?? a.stockDisponible)),
    }),
  };
}

function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  const map = new Map();
  for (const raw of items) {
    const articleId = Number(raw?.articleId);
    if (!Number.isFinite(articleId) || articleId <= 0) continue;
    const cap = stockCapOf(raw?.stockDisponible);
    if (cap === 0) continue;
    const maxQty = effectiveMax(raw?.stockDisponible);
    const qty = normalizeQty(raw?.quantite, { min: 1, max: Math.max(1, maxQty) });
    const prev = map.get(articleId);
    if (prev) {
      const existingCap = stockCapOf(prev.stockDisponible);
      const mergedCap =
        existingCap != null && cap != null ? Math.min(existingCap, cap) : existingCap ?? cap;
      const mergedMax = mergedCap == null ? CLIENT_MAX_QTY : Math.max(1, mergedCap);
      map.set(articleId, {
        ...prev,
        stockDisponible: mergedCap,
        quantite: normalizeQty(prev.quantite + qty, { min: 1, max: mergedMax }),
      });
    } else {
      map.set(articleId, {
        articleId,
        code: raw.code,
        libelle: raw.libelle,
        prixVente: Number(raw.prixVente) || 0,
        imageUrl: raw.imageUrl,
        stockDisponible: cap,
        quantite: qty,
      });
    }
  }
  return Array.from(map.values());
}

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      isSyncing: false,
      hydratedFromServer: false,
      lastAddedAt: 0,
      drawerOpen: false,
      checkoutStep: 0,

      openDrawer: (step) =>
        set({
          drawerOpen: true,
          checkoutStep:
            typeof step === "number" && Number.isFinite(step)
              ? Math.max(0, Math.min(3, Math.floor(step)))
              : 0,
        }),
      closeDrawer: () => set({ drawerOpen: false, checkoutStep: 0 }),
      toggleDrawer: () =>
        set((s) => ({ drawerOpen: !s.drawerOpen, checkoutStep: s.drawerOpen ? 0 : s.checkoutStep })),
      setCheckoutStep: (step) =>
        set({
          checkoutStep:
            typeof step === "number" && Number.isFinite(step)
              ? Math.max(0, Math.min(3, Math.floor(step)))
              : 0,
        }),

      /** Charge le panier serveur et fusionne avec le local. */
      syncFromServer: async () => {
        try {
          set({ isSyncing: true });
          const res = await api.get("panier");
          const serverItems = (res.data?.lignes || []).map(mapServerLigne);
          const local = sanitizeItems(get().items);
          // Serveur prioritaire s'il a des lignes ; sinon garder local et pousser
          if (serverItems.length) {
            set({ items: sanitizeItems(serverItems), hydratedFromServer: true, isSyncing: false });
            return get().items;
          }
          if (local.length) {
            for (const item of local) {
              await api.post("panier/items", {
                articleId: item.articleId,
                quantite: item.quantite,
              }).catch(() => null);
            }
            const again = await api.get("panier");
            set({
              items: (again.data?.lignes || []).map(mapServerLigne),
              hydratedFromServer: true,
              isSyncing: false,
            });
          } else {
            set({ hydratedFromServer: true, isSyncing: false });
          }
          return get().items;
        } catch {
          set({ isSyncing: false, hydratedFromServer: true });
          return get().items;
        }
      },

      addItem: (article, qty = 1) => {
        const cap = stockCapOf(article?.stockDisponible);
        const maxQty = effectiveMax(article?.stockDisponible);
        if (cap === 0) {
          return { ok: false, reason: "out_of_stock", stockDisponible: 0, quantite: 0, added: 0 };
        }
        const add = normalizeQty(qty, { min: 1, max: Math.max(1, maxQty) });
        let result = { ok: true, clamped: false, stockDisponible: cap, quantite: add, added: add };

        set((state) => {
          const existing = state.items.find((i) => i.articleId === article.id);
          if (existing) {
            const existingCap = stockCapOf(existing.stockDisponible);
            const mergedCap =
              existingCap != null && cap != null ? Math.min(existingCap, cap) : existingCap ?? cap;
            const mergedMax = mergedCap == null ? CLIENT_MAX_QTY : Math.max(1, mergedCap);
            const desired = Number(existing.quantite) + add;
            const nextQty = normalizeQty(desired, { min: 1, max: mergedMax });
            result = {
              ok: nextQty > Number(existing.quantite),
              clamped: desired > nextQty,
              stockDisponible: mergedCap,
              quantite: nextQty,
              added: Math.max(0, nextQty - Number(existing.quantite)),
            };
            return {
              items: state.items.map((i) =>
                i.articleId === article.id
                  ? { ...i, stockDisponible: mergedCap, quantite: nextQty }
                  : i
              ),
              lastAddedAt: Date.now(),
              drawerOpen: result.ok ? true : state.drawerOpen,
              checkoutStep: result.ok ? 0 : state.checkoutStep,
            };
          }
          const rawDesired = normalizeQty(qty, { min: 1, max: CLIENT_MAX_QTY });
          result = {
            ok: true,
            clamped: add < rawDesired,
            stockDisponible: cap,
            quantite: add,
            added: add,
          };
          return {
            items: [
              ...state.items,
              {
                articleId: article.id,
                code: article.code,
                libelle: article.libelle,
                prixVente: Number(article.prixVente) || 0,
                imageUrl: article.imageUrl,
                stockDisponible: cap,
                quantite: add,
              },
            ],
            lastAddedAt: Date.now(),
            drawerOpen: true,
            checkoutStep: 0,
          };
        });

        // Sync serveur : POST incrémente la quantité ajoutée
        if (result.added > 0) {
          api.post("panier/items", { articleId: article.id, quantite: result.added }).catch(() => null);
        }

        return result;
      },

      updateQty: (articleId, qty) => {
        const item = get().items.find((i) => i.articleId === articleId);
        const maxQty = effectiveMax(item?.stockDisponible);
        const next = normalizeQty(qty, { min: 0, max: Math.max(1, maxQty), allowZero: true });
        if (next <= 0) return get().removeItem(articleId);
        set((state) => ({
          items: state.items.map((i) =>
            i.articleId === articleId ? { ...i, quantite: next } : i
          ),
        }));
        api.patch(`panier/items/${articleId}`, { quantite: next }).catch(() => null);
      },

      removeItem: (articleId) => {
        set((state) => ({ items: state.items.filter((i) => i.articleId !== articleId) }));
        api.delete(`panier/items/${articleId}`).catch(() => null);
      },

      clearCart: () => {
        set({ items: [] });
        api.delete("panier").catch(() => null);
      },

      totalItems: () => get().items.reduce((sum, i) => sum + Number(i.quantite || 0), 0),
      totalTTC: () =>
        get().items.reduce(
          (sum, i) => sum + Number(i.quantite || 0) * Number(i.prixVente || 0),
          0
        ),

      submitOrder: async (checkout = {}) => {
        const items = sanitizeItems(get().items);
        if (!items.length) return null;
        set({ isSyncing: true, items });
        try {
          const res = await api.post("commandes-client", {
            lignes: items.map((i) => ({
              articleId: Number(i.articleId),
              quantite: normalizeQty(i.quantite, {
                min: 1,
                max: Math.max(1, effectiveMax(i.stockDisponible)),
              }),
            })),
            adresseLivraison: checkout.adresseLivraison || undefined,
            notesLivraison: checkout.notesLivraison || undefined,
            modePaiement: checkout.modePaiement || undefined,
          });
          set({ items: [], isSyncing: false });
          return res.data;
        } catch (e) {
          set({ isSyncing: false });
          throw e;
        }
      },
    }),
    {
      name: "stokify-client-cart",
      version: 4,
      partialize: (state) => ({ items: state.items }),
      migrate: (persisted) => {
        const state = persisted?.state ?? persisted;
        return {
          ...state,
          items: sanitizeItems(state?.items),
          hydratedFromServer: false,
          drawerOpen: false,
          checkoutStep: 0,
        };
      },
      merge: (persisted, current) => ({
        ...current,
        ...(persisted || {}),
        items: sanitizeItems(persisted?.items ?? current.items),
        drawerOpen: false,
        checkoutStep: 0,
      }),
    }
  )
);
