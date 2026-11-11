import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import { asItems } from "../utils/commerceUi";
import { getAxiosErrorMessage } from "../services/api";
import { useCommerceFormReady } from "./useCommerceFormReady";
import { useSocieteQueryScope } from "./useSocieteQueryScope";

/**
 * Donnees de reference pour formulaires achat/vente (depots, tiers, articles).
 * Les articles ne sont charges que si loadArticles est true (etape 2+),
 * pour ne pas bloquer l'ouverture de la fenetre.
 * @param {"fournisseur"|"client"} tier
 * @param {{ loadArticles?: boolean }} options
 */
export function useCommerceReferenceData(tier = "fournisseur", options = {}) {
  const { loadArticles = true } = options;
  const ready = useCommerceFormReady();
  const societeScope = useSocieteQueryScope();
  const tierPath = tier === "client" ? "clients" : "fournisseurs";

  const depotsQuery = useQuery({
    queryKey: ["depots", "commerce-form", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 300, statut: "ACTIF" } }).then((r) => r.data),
    enabled: ready,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const tiersQuery = useQuery({
    queryKey: [tierPath, "commerce-form", societeScope],
    queryFn: () => api.get(tierPath, { params: { limit: 500 } }).then((r) => r.data),
    enabled: ready,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const articlesQuery = useQuery({
    queryKey: ["articles", "commerce-form", societeScope],
    queryFn: () => api.get("articles", { params: { limit: 500 } }).then((r) => r.data),
    enabled: ready && loadArticles,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const isLoadingCore = depotsQuery.isLoading || tiersQuery.isLoading;
  const isFetchingCore = depotsQuery.isFetching || tiersQuery.isFetching;
  const isLoadingArticles = loadArticles && articlesQuery.isLoading;
  const isFetchingArticles = loadArticles && articlesQuery.isFetching;

  const isError =
    depotsQuery.isError ||
    tiersQuery.isError ||
    (loadArticles && articlesQuery.isError);

  const errorMessage =
    (depotsQuery.error && getAxiosErrorMessage(depotsQuery.error, "Dépôts")) ||
    (tiersQuery.error && getAxiosErrorMessage(tiersQuery.error, tier === "client" ? "Clients" : "Fournisseurs")) ||
    (loadArticles && articlesQuery.error && getAxiosErrorMessage(articlesQuery.error, "Articles")) ||
    null;

  return {
    ready,
    depots: asItems(depotsQuery.data),
    tiers: asItems(tiersQuery.data),
    articles: asItems(articlesQuery.data),
    isLoading: isLoadingCore,
    isLoadingCore,
    isLoadingArticles,
    isFetching: isFetchingCore || isFetchingArticles,
    isFetchingCore,
    isError,
    errorMessage,
    refetchAll: () => {
      depotsQuery.refetch();
      tiersQuery.refetch();
      if (loadArticles) articlesQuery.refetch();
    },
  };
}

/** Prefetch des listes legeres (etape 1) depuis la page liste. */
export function prefetchCommerceFormData(queryClient, societeScope, tier = "client") {
  if (societeScope == null || !queryClient) return;
  const tierPath = tier === "client" ? "clients" : "fournisseurs";
  queryClient.prefetchQuery({
    queryKey: ["depots", "commerce-form", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 300, statut: "ACTIF" } }).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  queryClient.prefetchQuery({
    queryKey: [tierPath, "commerce-form", societeScope],
    queryFn: () => api.get(tierPath, { params: { limit: 500 } }).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}
