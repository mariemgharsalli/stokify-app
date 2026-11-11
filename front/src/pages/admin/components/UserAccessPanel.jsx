import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  Boxes,
  Brain,
  Calculator,
  Check,
  CheckCircle,
  ClipboardList,
  FolderTree,
  Hash,
  Layers,
  LayoutDashboard,
  Minus,
  Package,
  Receipt,
  Save,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Tag,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Warehouse,
  XCircle,
} from "lucide-react";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../../utils/brandStyles";

export const ALL_MODULES = [
  {
    key: "dashboard",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    color: "#378ADD",
    category: "general",
    description: "KPIs, graphiques, alertes de stock",
    permissions: [
      { key: "view", label: "Voir le tableau de bord" },
      { key: "view_kpi", label: "Voir les KPIs & chiffres clés" },
      { key: "view_charts", label: "Voir les graphiques" },
      { key: "view_alerts", label: "Voir les alertes stock/DLC" },
      { key: "export", label: "Exporter le rapport PDF" },
    ],
  },
  {
    key: "articles",
    label: "Articles",
    icon: Package,
    color: "#378ADD",
    category: "catalogue",
    description: "Catalogue produits — fiche article complète",
    permissions: [
      { key: "view", label: "Voir la liste des articles" },
      { key: "view_detail", label: "Voir la fiche détail article" },
      { key: "create", label: "Créer un nouvel article" },
      { key: "edit", label: "Modifier un article existant" },
      { key: "delete", label: "Supprimer un article" },
      { key: "upload_image", label: "Uploader une image article" },
      { key: "manage_prix", label: "Modifier prix achat / vente" },
      { key: "export", label: "Exporter la liste (PDF/Excel)" },
    ],
  },
  {
    key: "marques",
    label: "Marques",
    icon: Tag,
    color: "#378ADD",
    category: "catalogue",
    description: "Référentiel marques produits",
    permissions: [
      { key: "view", label: "Voir les marques" },
      { key: "create", label: "Créer une marque" },
      { key: "edit", label: "Modifier une marque" },
      { key: "delete", label: "Supprimer une marque" },
    ],
  },
  {
    key: "familles",
    label: "Familles & Sous-familles",
    icon: FolderTree,
    color: "#378ADD",
    category: "catalogue",
    description: "Catégories et sous-catégories produits",
    permissions: [
      { key: "view", label: "Voir les familles" },
      { key: "create_famille", label: "Créer une famille" },
      { key: "edit_famille", label: "Modifier une famille" },
      { key: "delete_famille", label: "Supprimer une famille" },
      { key: "create_sf", label: "Créer une sous-famille" },
      { key: "edit_sf", label: "Modifier une sous-famille" },
      { key: "delete_sf", label: "Supprimer une sous-famille" },
    ],
  },
  {
    key: "stock",
    label: "Stock",
    icon: Boxes,
    color: "#1D9E75",
    category: "stock",
    description: "Niveaux de stock par dépôt et emplacement",
    permissions: [
      { key: "view", label: "Voir le stock global" },
      { key: "view_by_depot", label: "Filtrer par dépôt" },
      { key: "view_by_article", label: "Voir le stock d'un article" },
      { key: "view_valorise", label: "Voir la valeur du stock" },
      { key: "export", label: "Exporter le stock (PDF/Excel)" },
    ],
  },
  {
    key: "mouvements",
    label: "Mouvements de stock",
    icon: ArrowLeftRight,
    color: "#1D9E75",
    category: "stock",
    description: "Historique entrées / sorties / transferts",
    permissions: [
      { key: "view", label: "Voir l'historique des mouvements" },
      { key: "create_entree", label: "Saisir une entrée manuelle" },
      { key: "create_sortie", label: "Saisir une sortie manuelle" },
      { key: "create_transfer", label: "Effectuer un transfert inter-dépôt" },
      { key: "annuler", label: "Annuler un mouvement" },
      { key: "export", label: "Exporter l'historique" },
    ],
  },
  {
    key: "depots",
    label: "Dépôts & Emplacements",
    icon: Warehouse,
    color: "#1D9E75",
    category: "stock",
    description: "Plan 2D/3D, gestion des zones de stockage",
    permissions: [
      { key: "view", label: "Voir la liste des dépôts" },
      { key: "view_plan", label: "Voir le plan 2D / Vue 3D" },
      { key: "view_emplacement", label: "Voir le détail d'un emplacement" },
      { key: "export_plan", label: "Exporter le plan PDF" },
      { key: "scanner", label: "Scanner un emplacement (mobile)" },
    ],
  },
  {
    key: "lots",
    label: "Lots",
    icon: Layers,
    color: "#1D9E75",
    category: "stock",
    description: "Gestion FEFO, dates fabrication / expiration",
    permissions: [
      { key: "view", label: "Voir la liste des lots" },
      { key: "view_detail", label: "Voir le détail d'un lot" },
      { key: "create", label: "Créer un lot" },
      { key: "edit", label: "Modifier un lot" },
      { key: "delete", label: "Supprimer un lot" },
      { key: "recall", label: "Déclencher un rappel produit" },
      { key: "view_recall", label: "Voir les rappels produits" },
      { key: "export", label: "Exporter les lots" },
    ],
  },
  {
    key: "series",
    label: "Numéros de série",
    icon: Hash,
    color: "#1D9E75",
    category: "stock",
    description: "Traçabilité unitaire par numéro de série",
    permissions: [
      { key: "view", label: "Voir les numéros de série" },
      { key: "create", label: "Créer / enregistrer un N° série" },
      { key: "edit", label: "Modifier un N° série" },
      { key: "delete", label: "Supprimer un N° série" },
      { key: "assign", label: "Affecter à un article / lot" },
      { key: "export", label: "Exporter" },
    ],
  },
  {
    key: "inventaire",
    label: "Inventaires",
    icon: ClipboardList,
    color: "#1D9E75",
    category: "stock",
    description: "Comptages physiques et ajustements automatiques",
    permissions: [
      { key: "view", label: "Voir la liste des inventaires" },
      { key: "create", label: "Créer un nouvel inventaire" },
      { key: "saisie_comptage", label: "Saisir les quantités comptées" },
      { key: "validate", label: "Valider et générer les ajustements" },
      { key: "delete", label: "Supprimer un inventaire brouillon" },
      { key: "export", label: "Exporter la feuille d'inventaire" },
    ],
  },
  {
    key: "achats",
    label: "Achats",
    icon: ShoppingCart,
    color: "#BA7517",
    category: "achats",
    description: "Commandes fournisseurs et bons de réception",
    permissions: [
      { key: "view", label: "Voir la liste des commandes" },
      { key: "view_detail", label: "Voir le détail d'une commande" },
      { key: "create", label: "Créer une commande fournisseur" },
      { key: "edit", label: "Modifier une commande brouillon" },
      { key: "validate", label: "Valider / confirmer une commande" },
      { key: "receive", label: "Réceptionner la marchandise" },
      { key: "delete", label: "Supprimer une commande" },
      { key: "compare_fournisseurs", label: "Comparaison fournisseurs" },
      { key: "export", label: "Exporter / imprimer le bon" },
    ],
  },
  {
    key: "fournisseurs",
    label: "Fournisseurs",
    icon: Truck,
    color: "#BA7517",
    category: "achats",
    description: "Répertoire et historique fournisseurs",
    permissions: [
      { key: "view", label: "Voir la liste des fournisseurs" },
      { key: "view_detail", label: "Voir la fiche fournisseur" },
      { key: "view_historique", label: "Voir l'historique des achats" },
      { key: "export", label: "Exporter" },
    ],
  },
  {
    key: "ventes",
    label: "Ventes",
    icon: ShoppingBag,
    color: "#7F77DD",
    category: "ventes",
    description: "Bons de livraison et commandes clients",
    permissions: [
      { key: "view", label: "Voir la liste des ventes" },
      { key: "view_detail", label: "Voir le détail d'une vente" },
      { key: "create", label: "Créer un bon de vente" },
      { key: "edit", label: "Modifier une vente brouillon" },
      { key: "validate", label: "Valider une vente" },
      { key: "cancel", label: "Annuler une vente" },
      { key: "delete", label: "Supprimer une vente" },
      { key: "export", label: "Exporter / imprimer le bon" },
    ],
  },
  {
    key: "factures",
    label: "Facturation",
    icon: Receipt,
    color: "#7F77DD",
    category: "ventes",
    description: "Génération et suivi des factures clients",
    permissions: [
      { key: "view", label: "Voir la liste des factures" },
      { key: "create", label: "Générer une facture" },
      { key: "edit", label: "Modifier une facture brouillon" },
      { key: "cancel", label: "Annuler une facture" },
      { key: "export_pdf", label: "Exporter en PDF" },
      { key: "export_excel", label: "Exporter en Excel" },
      { key: "send_email", label: "Envoyer par email" },
    ],
  },
  {
    key: "clients",
    label: "Clients",
    icon: Users,
    color: "#7F77DD",
    category: "ventes",
    description: "Répertoire clients et historique",
    permissions: [
      { key: "view", label: "Voir la liste des clients" },
      { key: "view_detail", label: "Voir la fiche client" },
      { key: "view_historique", label: "Voir l'historique des ventes" },
      { key: "view_solde", label: "Voir le solde et les impayés" },
      { key: "export", label: "Exporter" },
    ],
  },
  {
    key: "reglements",
    label: "Règlements & Paiements",
    icon: Banknote,
    color: "#7F77DD",
    category: "ventes",
    description: "Encaissements clients, paiements fournisseurs",
    permissions: [
      { key: "view", label: "Voir les règlements" },
      { key: "create_client", label: "Saisir un encaissement client" },
      { key: "create_fourn", label: "Saisir un paiement fournisseur" },
      { key: "edit", label: "Modifier un règlement" },
      { key: "delete", label: "Supprimer un règlement" },
      { key: "relance", label: "Envoyer une relance client" },
      { key: "export", label: "Exporter" },
    ],
  },
  {
    key: "valorisation",
    label: "Valorisation du stock",
    icon: TrendingUp,
    color: "#E24B4A",
    category: "finance",
    description: "CMP, FIFO, LIFO, Prix achat/vente HT",
    permissions: [
      { key: "view", label: "Voir la valorisation globale" },
      { key: "switch_methode", label: "Changer la méthode (CMP/FIFO…)" },
      { key: "view_comparaison", label: "Voir la comparaison des méthodes" },
      { key: "filter_depot", label: "Filtrer par dépôt" },
      { key: "export_pdf", label: "Exporter en PDF" },
      { key: "export_excel", label: "Exporter en Excel" },
    ],
  },
  {
    key: "couts",
    label: "Coûts de stockage",
    icon: Wallet,
    color: "#E24B4A",
    category: "finance",
    description: "Loyer, personnel, énergie, manutention par dépôt",
    permissions: [
      { key: "view", label: "Voir les coûts" },
      { key: "saisie_loyer", label: "Saisir le loyer mensuel" },
      { key: "saisie_personnel", label: "Saisir les coûts personnel" },
      { key: "saisie_energie", label: "Saisir énergie / eau" },
      { key: "saisie_manut", label: "Saisir manutention" },
      { key: "view_repartition", label: "Voir la répartition par article" },
      { key: "view_dormant", label: "Voir le stock dormant" },
      { key: "view_rotation", label: "Voir le taux de rotation" },
      { key: "view_rentabilite", label: "Voir l'onglet rentabilité" },
      { key: "export", label: "Exporter le rapport" },
    ],
  },
  {
    key: "comptabilite",
    label: "Comptabilité",
    icon: Calculator,
    color: "#E24B4A",
    category: "finance",
    description: "Écritures comptables, balance, journaux",
    permissions: [
      { key: "view", label: "Voir les écritures" },
      { key: "validate", label: "Valider les écritures" },
      { key: "view_balance", label: "Voir la balance comptable" },
      { key: "export", label: "Exporter" },
    ],
  },
  {
    key: "rapports",
    label: "Rapports",
    icon: BarChart3,
    color: "#E24B4A",
    category: "finance",
    description: "Tableaux de bord analytiques avancés",
    permissions: [
      { key: "view", label: "Accéder aux rapports" },
      { key: "view_ventes", label: "Rapport ventes" },
      { key: "view_achats", label: "Rapport achats" },
      { key: "view_stock", label: "Rapport stock" },
      { key: "export_pdf", label: "Exporter PDF" },
      { key: "export_excel", label: "Exporter Excel" },
    ],
  },
  {
    key: "ia",
    label: "Intelligence Artificielle",
    icon: Brain,
    color: "#7F77DD",
    category: "ia",
    description: "Prévisions, anomalies, optimisation emplacements",
    permissions: [
      { key: "view_previsions", label: "Voir les prévisions de ventes" },
      { key: "view_anomalies", label: "Voir les anomalies détectées" },
      { key: "view_optimisation", label: "Voir l'optimisation emplacements" },
      { key: "view_chargement", label: "Voir l'optimisation chargements" },
      { key: "run_analyse", label: "Lancer une analyse IA" },
    ],
  },
];

const CATEGORIES = [
  { key: "general", label: "Général", color: "#378ADD", icon: LayoutDashboard },
  { key: "catalogue", label: "Catalogue produits", color: "#378ADD", icon: Package },
  { key: "stock", label: "Stock & Logistique", color: "#1D9E75", icon: Boxes },
  { key: "achats", label: "Achats", color: "#BA7517", icon: ShoppingCart },
  { key: "ventes", label: "Ventes & Finance client", color: "#7F77DD", icon: ShoppingBag },
  { key: "finance", label: "Finance & Comptabilité", color: "#E24B4A", icon: TrendingUp },
  { key: "ia", label: "Intelligence Artificielle", color: "#7F77DD", icon: Brain },
];

const TOTAL_PERMS = ALL_MODULES.reduce((sum, m) => sum + m.permissions.length, 0);

export function derivePermissionsFromRole(role) {
  if (role === "SUPER_ADMIN" || role === "ADMIN") {
    const all = {};
    ALL_MODULES.forEach((m) => {
      all[m.key] = {};
      m.permissions.forEach((p) => { all[m.key][p.key] = true; });
    });
    return all;
  }

  if (role === "MAGASINIER") {
    return {
      dashboard: { view: true, view_kpi: true, view_alerts: true },
      articles: { view: true, view_detail: true },
      stock: { view: true, view_by_depot: true, view_by_article: true },
      mouvements: {
        view: true,
        create_entree: true,
        create_sortie: true,
        create_transfer: true,
      },
      depots: {
        view: true,
        view_plan: true,
        view_emplacement: true,
        scanner: true,
      },
      lots: { view: true, view_detail: true, create: true, edit: true },
      series: { view: true, create: true, assign: true },
      inventaire: { view: true, create: true, saisie_comptage: true },
      achats: { view: true, view_detail: true, receive: true },
    };
  }

  if (role === "COMPTABLE") {
    return {
      dashboard: { view: true, view_kpi: true, view_charts: true },
      ventes: { view: true, view_detail: true },
      factures: { view: true, create: true, export_pdf: true, export_excel: true },
      clients: { view: true, view_detail: true, view_solde: true },
      reglements: {
        view: true,
        create_client: true,
        create_fourn: true,
        relance: true,
        export: true,
      },
      valorisation: {
        view: true,
        switch_methode: true,
        view_comparaison: true,
        export_pdf: true,
        export_excel: true,
      },
      couts: {
        view: true,
        saisie_loyer: true,
        saisie_personnel: true,
        saisie_energie: true,
        saisie_manut: true,
        view_repartition: true,
        view_rentabilite: true,
        export: true,
      },
      comptabilite: { view: true, validate: true, view_balance: true, export: true },
      rapports: {
        view: true,
        view_ventes: true,
        view_achats: true,
        view_stock: true,
        export_pdf: true,
        export_excel: true,
      },
      achats: { view: true, view_detail: true },
      fournisseurs: { view: true, view_historique: true },
    };
  }

  if (role === "CLIENT") {
    return {
      dashboard: { view: true },
      ventes: { view: true, view_detail: true },
      factures: { view: true, export_pdf: true },
      reglements: { view: true },
    };
  }

  return {};
}

function getPermType(key) {
  if (
    key.includes("delete")
    || key.includes("cancel")
    || key.includes("recall")
    || key.includes("annuler")
  ) {
    return { dot: "#E24B4A", title: "Action destructive" };
  }
  if (
    key.includes("validate")
    || key.includes("receive")
    || key.includes("assign")
  ) {
    return { dot: "#1D9E75", title: "Action de validation" };
  }
  if (key.includes("create") || key.includes("saisie")) {
    return { dot: "#378ADD", title: "Action de création/saisie" };
  }
  if (key.includes("export") || key.includes("print") || key.includes("email")) {
    return { dot: "#7F77DD", title: "Action d'export" };
  }
  if (key.includes("edit") || key.includes("switch") || key.includes("upload")) {
    return { dot: "#BA7517", title: "Action de modification" };
  }
  return { dot: "var(--color-text-tertiary)", title: "Consultation" };
}

function hasStoredPermissions(permissions) {
  return permissions && typeof permissions === "object" && Object.keys(permissions).length > 0;
}

function ModuleCard({ mod, perms, isSuperAdmin, cardIndex, onToggle, onToggleModule, isFullyGranted, isPartial }) {
  const Icon = mod.icon;
  const reduceMotion = useReducedMotion();
  const fullyGranted = isFullyGranted(mod.key);
  const partial = isPartial(mod.key);
  const statusColor = fullyGranted
    ? "var(--accent-success)"
    : partial
      ? "var(--accent-warning)"
      : "var(--text-muted)";
  const statusLabel = fullyGranted ? "Accès complet" : partial ? "Accès partiel" : "Aucun accès";
  const rail = fullyGranted
    ? mod.color
    : partial
      ? "var(--accent-warning)"
      : "var(--border-default)";

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(cardIndex * 0.04, 0.4), duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      className="group overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] transition-shadow hover:shadow-md"
      style={{ borderLeft: `3px solid ${rail}` }}
    >
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
            style={{
              background: fullyGranted
                ? `color-mix(in srgb, ${mod.color} 16%, transparent)`
                : "var(--bg-hover)",
            }}
          >
            <Icon
              className="h-4 w-4"
              style={{ color: fullyGranted || partial ? mod.color : "var(--text-muted)" }}
            />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">{mod.label}</h3>
            <p className="truncate text-[10px] text-[var(--text-muted)]">{mod.description}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleModule(mod.key, !fullyGranted)}
          disabled={isSuperAdmin}
          className="relative ml-2 h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: fullyGranted
              ? mod.color
              : partial
                ? "color-mix(in srgb, var(--accent-warning) 55%, transparent)"
                : "var(--bg-hover)",
          }}
          title={fullyGranted ? "Tout désactiver" : "Tout activer"}
        >
          <span
            className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
            style={{ left: fullyGranted ? "calc(100% - 18px)" : "2px" }}
          />
        </button>
      </div>

      <div className="px-4 pb-3">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
          style={{
            background: fullyGranted
              ? `color-mix(in srgb, ${mod.color} 14%, transparent)`
              : partial
                ? "color-mix(in srgb, var(--accent-warning) 12%, transparent)"
                : "var(--bg-hover)",
            color: statusColor,
          }}
        >
          {fullyGranted ? (
            <CheckCircle className="h-2.5 w-2.5" />
          ) : partial ? (
            <Minus className="h-2.5 w-2.5" />
          ) : (
            <XCircle className="h-2.5 w-2.5" />
          )}
          {statusLabel}
        </span>
      </div>

      <div className="space-y-1 border-t border-[var(--border-default)] px-3 py-3">
        {mod.permissions.map((perm) => {
          const granted = perms[mod.key]?.[perm.key] === true;
          const permType = getPermType(perm.key);
          return (
            <label
              key={perm.key}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--bg-hover)]"
              style={{
                background: granted
                  ? `color-mix(in srgb, ${permType.dot} 8%, transparent)`
                  : "transparent",
              }}
            >
              <div
                role="checkbox"
                aria-checked={granted}
                tabIndex={isSuperAdmin ? -1 : 0}
                onClick={() => onToggle(mod.key, perm.key)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    onToggle(mod.key, perm.key);
                  }
                }}
                className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded transition-all duration-150"
                style={{
                  background: granted ? mod.color : "transparent",
                  border: granted
                    ? `1.5px solid ${mod.color}`
                    : "1.5px solid var(--border-default)",
                  opacity: isSuperAdmin ? 0.5 : 1,
                }}
              >
                {granted && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
              </div>

              <div
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: permType.dot }}
                title={permType.title}
              />

              <span
                onClick={() => onToggle(mod.key, perm.key)}
                className={`flex-1 text-xs ${
                  granted ? "font-medium text-[var(--text-primary)]" : "text-[var(--text-muted)]"
                }`}
              >
                {perm.label}
              </span>
            </label>
          );
        })}
      </div>
    </motion.div>
  );
}

export default function UserAccessPanel({ user, onSave, rolePresetKey }) {
  const reduceMotion = useReducedMotion();
  const defaultPerms = derivePermissionsFromRole(user.role);
  const initialPerms = hasStoredPermissions(user.permissions) ? user.permissions : defaultPerms;

  const [perms, setPerms] = useState(initialPerms);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    const next = hasStoredPermissions(user.permissions)
      ? user.permissions
      : derivePermissionsFromRole(user.role);
    setPerms(next);
    setIsDirty(false);
  }, [user.id, user.role, user.permissions, rolePresetKey]);

  const isSuperAdmin = user.role === "SUPER_ADMIN";

  function toggle(moduleKey, permKey) {
    if (isSuperAdmin) return;
    setPerms((prev) => ({
      ...prev,
      [moduleKey]: {
        ...(prev[moduleKey] ?? {}),
        [permKey]: !(prev[moduleKey]?.[permKey] ?? false),
      },
    }));
    setIsDirty(true);
  }

  function toggleModule(moduleKey, value) {
    if (isSuperAdmin) return;
    const mod = ALL_MODULES.find((m) => m.key === moduleKey);
    const allPerms = {};
    mod.permissions.forEach((p) => { allPerms[p.key] = value; });
    setPerms((prev) => ({ ...prev, [moduleKey]: allPerms }));
    setIsDirty(true);
  }

  function isModuleFullyGranted(moduleKey) {
    const mod = ALL_MODULES.find((m) => m.key === moduleKey);
    return mod.permissions.every((p) => perms[moduleKey]?.[p.key] === true);
  }

  function isModulePartiallyGranted(moduleKey) {
    const mod = ALL_MODULES.find((m) => m.key === moduleKey);
    return (
      mod.permissions.some((p) => perms[moduleKey]?.[p.key] === true)
      && !isModuleFullyGranted(moduleKey)
    );
  }

  function applyRolePreset(role) {
    setPerms(derivePermissionsFromRole(role));
    setIsDirty(true);
  }

  const filteredModules = ALL_MODULES.filter((m) => {
    if (activeFilter === "granted") {
      return isModuleFullyGranted(m.key) || isModulePartiallyGranted(m.key);
    }
    if (activeFilter === "denied") {
      return !isModuleFullyGranted(m.key) && !isModulePartiallyGranted(m.key);
    }
    return true;
  });

  const totalGrantedModules = ALL_MODULES.filter(
    (m) => isModuleFullyGranted(m.key) || isModulePartiallyGranted(m.key)
  ).length;

  const grantedPerms = ALL_MODULES.reduce((sum, m) => {
    return sum + m.permissions.filter((p) => perms[m.key]?.[p.key] === true).length;
  }, 0);

  const groupedByCategory = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        ...cat,
        modules: filteredModules.filter((m) => m.category === cat.key),
      })).filter((c) => c.modules.length > 0),
    [filteredModules]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(perms);
      setIsDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => {
    setPerms(
      hasStoredPermissions(user.permissions)
        ? user.permissions
        : derivePermissionsFromRole(user.role)
    );
    setIsDirty(false);
  };

  let cardIndex = 0;
  const progressPct = TOTAL_PERMS ? (grantedPerms / TOTAL_PERMS) * 100 : 0;

  return (
    <div className="space-y-4">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4"
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-50"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 22%, transparent), transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: "color-mix(in srgb, var(--accent-primary) 14%, transparent)",
                color: "var(--accent-primary)",
              }}
            >
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                Contrôle d&apos;accès par module
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {grantedPerms} / {TOTAL_PERMS} actions · {totalGrantedModules} / {ALL_MODULES.length}{" "}
                modules
              </p>
              <div className="mt-2 h-1.5 w-56 max-w-full overflow-hidden rounded-full bg-[var(--bg-hover)]">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, var(--accent-primary), var(--accent-success))",
                  }}
                  initial={false}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isSuperAdmin && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                  Preset
                </span>
                {["MAGASINIER", "COMPTABLE", "CLIENT"].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => applyRolePreset(role)}
                    className="rounded-lg border border-[var(--border-default)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[color-mix(in_srgb,var(--accent-primary)_45%,transparent)] hover:text-[var(--accent-primary)]"
                  >
                    {role}
                  </button>
                ))}
              </div>
            )}

            {isDirty && !isSuperAdmin && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={PRIMARY_BTN_CLASSES}
                style={primaryButtonStyle}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Enregistrement…" : "Sauvegarder"}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {isSuperAdmin && (
        <p className="rounded-xl border border-[color-mix(in_srgb,var(--accent-primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent-primary)_8%,transparent)] px-4 py-3 text-xs text-[var(--accent-primary)]">
          Super Admin — accès total à tous les modules. Les permissions ne peuvent pas être
          modifiées.
        </p>
      )}

      <div className="flex w-fit gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-1">
        {[
          { key: "all", label: `Tous (${ALL_MODULES.length})` },
          { key: "granted", label: `Accordés (${totalGrantedModules})` },
          { key: "denied", label: `Refusés (${ALL_MODULES.length - totalGrantedModules})` },
        ].map((f) => {
          const active = activeFilter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150"
              style={
                active
                  ? {
                      background: "color-mix(in srgb, var(--accent-primary) 14%, transparent)",
                      color: "var(--accent-primary)",
                    }
                  : { color: "var(--text-secondary)" }
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
          Type d&apos;action
        </span>
        {[
          { dot: "var(--text-muted)", label: "Consultation" },
          { dot: "var(--accent-info, #378ADD)", label: "Création / Saisie" },
          { dot: "var(--accent-warning)", label: "Modification" },
          { dot: "var(--accent-success)", label: "Validation" },
          { dot: "var(--accent-primary)", label: "Export" },
          { dot: "var(--accent-danger)", label: "Suppression / Annulation" },
        ].map((l) => (
          <span
            key={l.label}
            className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]"
          >
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: l.dot }} />
            {l.label}
          </span>
        ))}
      </div>

      <div className="space-y-8">
        {groupedByCategory.map((cat) => {
          const CatIcon = cat.icon;
          return (
            <section key={cat.key}>
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: `color-mix(in srgb, ${cat.color} 14%, transparent)` }}
                >
                  <CatIcon className="h-4 w-4" style={{ color: cat.color }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{cat.label}</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {cat.modules.length} module{cat.modules.length > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="h-px flex-1 bg-[var(--border-default)]" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cat.modules.map((mod) => {
                  const idx = cardIndex;
                  cardIndex += 1;
                  return (
                    <ModuleCard
                      key={mod.key}
                      mod={mod}
                      perms={perms}
                      isSuperAdmin={isSuperAdmin}
                      cardIndex={idx}
                      onToggle={toggle}
                      onToggleModule={toggleModule}
                      isFullyGranted={isModuleFullyGranted}
                      isPartial={isModulePartiallyGranted}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {isDirty && !isSuperAdmin && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky bottom-4 z-30 flex items-center justify-between rounded-2xl border border-[color-mix(in_srgb,var(--accent-primary)_35%,transparent)] bg-[var(--bg-card)]/95 px-5 py-3 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-warning)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Modifications non sauvegardées
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetChanges}
              className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={PRIMARY_BTN_CLASSES}
              style={primaryButtonStyle}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Enregistrement…" : "Sauvegarder"}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
