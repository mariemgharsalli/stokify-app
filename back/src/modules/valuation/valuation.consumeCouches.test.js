jest.mock("../../config/database", () => ({}));
jest.mock("../coutStockage/coutStockage.service", () => ({}));

const { consumeCouches, onSortieStock } = require("./valuation.service");

/**
 * Couches où l'ordre d'achat (orderIndex) diverge de l'ordre de péremption :
 * le lot 101 est le plus ancien acheté (10), le lot 202 expire plus tôt (30).
 */
function couchesFefoDivergentes() {
  return [
    {
      id: 11,
      articleId: 1,
      depotId: 2,
      lotId: 101,
      quantiteRestante: 5,
      prixUnitaire: 10,
      orderIndex: 1,
    },
    {
      id: 12,
      articleId: 1,
      depotId: 2,
      lotId: 202,
      quantiteRestante: 4,
      prixUnitaire: 30,
      orderIndex: 2,
    },
    {
      id: 13,
      articleId: 1,
      depotId: 2,
      lotId: 303,
      quantiteRestante: 6,
      prixUnitaire: 99,
      orderIndex: 3,
    },
  ];
}

function createTx(seed) {
  const rows = seed.map((row) => ({ ...row }));
  return {
    rows,
    couchesFifo: {
      async findMany({ where, orderBy }) {
        const matched = rows.filter((row) => {
          if (where.articleId != null && row.articleId !== where.articleId) return false;
          if (where.depotId != null && row.depotId !== where.depotId) return false;
          if (where.lotId != null && row.lotId !== where.lotId) return false;
          if (where.quantiteRestante && !(row.quantiteRestante > where.quantiteRestante.gt)) return false;
          return true;
        });
        const dir = orderBy?.orderIndex === "desc" ? -1 : 1;
        matched.sort((a, b) => (a.orderIndex - b.orderIndex) * dir);
        return matched.map((row) => ({ ...row }));
      },
      async update({ where, data }) {
        const row = rows.find((item) => item.id === where.id);
        if (!row) throw new Error(`couche ${where.id} absente`);
        Object.assign(row, data);
        return { ...row };
      },
    },
  };
}

function qty(tx, id) {
  return tx.rows.find((row) => row.id === id).quantiteRestante;
}

describe("consumeCouches — coût aligné sur le lot sorti", () => {
  test("FEFO : le lot le plus proche de la péremption n'est pas le plus ancien acheté", async () => {
    const tx = createTx(couchesFefoDivergentes());
    const result = await consumeCouches(tx, 1, 2, 4, "FIFO", [{ lotId: 202, quantite: 4 }]);

    expect(result.coutTotal).toBe(120);
    expect(result.coutsDetail.map((line) => line.coucheId)).toEqual([12]);
    expect(qty(tx, 11)).toBe(5);
    expect(qty(tx, 12)).toBe(0);
    expect(qty(tx, 13)).toBe(6);
  });

  test("article non tracé : FIFO par orderIndex, identique avec ou sans lotsConsumed", async () => {
    const sans = createTx(couchesFefoDivergentes());
    const vide = createTx(couchesFefoDivergentes());
    const serie = createTx(couchesFefoDivergentes());

    const a = await consumeCouches(sans, 1, 2, 4, "FIFO");
    const b = await consumeCouches(vide, 1, 2, 4, "FIFO", []);
    const c = await consumeCouches(serie, 1, 2, 4, "FIFO", [
      { numeroSerieId: 7, numero: "SN-1", lotId: null },
    ]);

    for (const result of [a, b, c]) {
      expect(result.coutTotal).toBe(40);
      expect(result.coutsDetail.map((line) => line.coucheId)).toEqual([11]);
    }
    expect(qty(sans, 11)).toBe(1);
    expect(qty(sans, 12)).toBe(4);
    expect(qty(vide, 11)).toBe(1);
    expect(qty(serie, 11)).toBe(1);
  });

  test("LIFO sans lot : la couche la plus récente, pas le lot FEFO", async () => {
    const tx = createTx(couchesFefoDivergentes());
    const result = await consumeCouches(tx, 1, 2, 4, "LIFO");

    expect(result.coutTotal).toBe(396);
    expect(result.coutsDetail.map((line) => line.coucheId)).toEqual([13]);
    expect(qty(tx, 13)).toBe(2);
    expect(qty(tx, 11)).toBe(5);
  });

  test("LIFO avec lot : la couche du lot sorti, même si elle n'est pas la plus récente", async () => {
    const tx = createTx(couchesFefoDivergentes());
    const result = await onSortieStock(tx, {
      articleId: 1,
      depotId: 2,
      quantite: 4,
      methode: "LIFO",
      lotsConsumed: [{ lotId: 101, quantite: 4 }],
    });

    expect(result.coutTotal).toBe(40);
    expect(qty(tx, 11)).toBe(1);
    expect(qty(tx, 12)).toBe(4);
    expect(qty(tx, 13)).toBe(6);
  });

  test("couche du lot trop courte : complément sur la plus ancienne, sans bloquer", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const tx = createTx([
      {
        id: 11,
        articleId: 1,
        depotId: 2,
        lotId: 101,
        quantiteRestante: 10,
        prixUnitaire: 10,
        orderIndex: 1,
      },
      {
        id: 12,
        articleId: 1,
        depotId: 2,
        lotId: 202,
        quantiteRestante: 1,
        prixUnitaire: 30,
        orderIndex: 2,
      },
      {
        id: 13,
        articleId: 1,
        depotId: 2,
        lotId: 303,
        quantiteRestante: 10,
        prixUnitaire: 99,
        orderIndex: 3,
      },
    ]);

    const result = await consumeCouches(tx, 1, 2, 4, "FIFO", [{ lotId: 202, quantite: 4 }]);

    expect(result.coutTotal).toBe(60);
    expect(result.coutsDetail.map((line) => [line.coucheId, line.qteConsommee])).toEqual([
      [12, 1],
      [11, 3],
    ]);
    expect(qty(tx, 12)).toBe(0);
    expect(qty(tx, 11)).toBe(7);
    expect(qty(tx, 13)).toBe(10);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("lot 202");
    expect(String(warn.mock.calls[0][0])).toContain("n'est pas bloquée");
    warn.mockRestore();
  });

  test("aucune couche disponible : la sortie est refusée", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const tx = createTx([
      {
        id: 12,
        articleId: 1,
        depotId: 2,
        lotId: 202,
        quantiteRestante: 1,
        prixUnitaire: 30,
        orderIndex: 2,
      },
    ]);

    await expect(
      consumeCouches(tx, 1, 2, 4, "FIFO", [{ lotId: 202, quantite: 4 }])
    ).rejects.toThrow("Couches FIFO insuffisantes pour la sortie");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
