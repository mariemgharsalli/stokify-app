import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import StockTableView from "./StockTableView";

const ligneCritique = {
  id: 1,
  quantite: 3,
  articleId: 7,
  article: {
    id: 7,
    code: "ART-7",
    libelle: "Ciment",
    unite: "KG",
    seuilAlerte: 10,
  },
  depot: { libelle: "Tunis" },
  emplacement: { code: "A1", libelle: "Allée 1" },
};

function tableau(pageSlice, totalResults = pageSlice.length) {
  return render(
    <MemoryRouter>
      <StockTableView
        rows={pageSlice}
        pageSlice={pageSlice}
        totalResults={totalResults}
        isLoading={false}
        sortBy="article"
        sortDir="asc"
        onToggleSort={vi.fn()}
        hidePagination
      />
    </MemoryRouter>
  );
}

describe("tableau de stock", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche les lignes, le badge de stock bas et l'état vide", () => {
    tableau([ligneCritique]);

    expect(screen.getByText("ART-7")).toBeInTheDocument();
    expect(screen.getByText("Ciment")).toBeInTheDocument();
    expect(screen.getByText("Tunis")).toBeInTheDocument();
    expect(screen.getByText("Critique")).toBeInTheDocument();

    cleanup();
    tableau([]);

    expect(screen.getByText("Aucune ligne de stock trouvée")).toBeInTheDocument();
    expect(screen.queryByText("Ciment")).not.toBeInTheDocument();
  });
});
