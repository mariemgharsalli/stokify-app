const {
  emplacementCapaciteUnits,
  parseLocationCode,
  heatFromRate,
  mapEmplacementOccupancy,
  buildWarehouseLayout,
} = require("./warehouseLayout");
const { evaluateCompatibility } = require("./emplacementCompatibility");
const { isActifStatut } = require("./warehouseOps");

describe("warehouseLayout occupancy", () => {
  test("capaciteSlots wins over niveaux", () => {
    expect(emplacementCapaciteUnits({ capaciteSlots: 40, niveaux: 3 })).toBe(40);
  });

  test("niveaux used when slots empty", () => {
    expect(emplacementCapaciteUnits({ capaciteSlots: null, niveaux: 8 })).toBe(8);
  });

  test("default 100 when nothing set", () => {
    expect(emplacementCapaciteUnits({})).toBe(100);
  });

  test("mapEmplacementOccupancy uses unified capacity", () => {
    const mapped = mapEmplacementOccupancy({
      id: 1,
      code: "A-01",
      libelle: "Rack A",
      capaciteSlots: 20,
      stocks: [
        { articleId: 9, quantite: 10, article: { code: "X", libelle: "X" } },
      ],
    });
    expect(mapped.capaciteUnites).toBe(20);
    expect(mapped.remplissagePct).toBe(50);
    expect(mapped.heat).toBe("warning");
    expect(mapped.allee).toBe("A");
    expect(mapped.bay).toBe(1);
  });
});

describe("parseLocationCode", () => {
  test("parses A-01-02", () => {
    expect(parseLocationCode("A-01-02")).toEqual({
      allee: "A",
      bay: 1,
      niveau: 2,
      mode: "parsed",
    });
  });

  test("parses R1-E3", () => {
    expect(parseLocationCode("R1-E3")).toMatchObject({ allee: "R1", bay: 3, mode: "parsed" });
  });

  test("rejects huge numeric codes that are not warehouse bays", () => {
    expect(parseLocationCode("LOT6282").mode).toBe("grid");
    expect(parseLocationCode("A-6282").mode).toBe("grid");
  });
});

describe("buildWarehouseLayout", () => {
  test("parsed codes keep aisle gaps and a dock row", () => {
    const layout = buildWarehouseLayout([
      { id: 1, code: "A-01", capaciteSlots: 10, stocks: [] },
      { id: 2, code: "B-01", capaciteSlots: 10, stocks: [] },
    ]);
    expect(layout.mode).toBe("parsed");
    expect(layout.dock.row).toBe(0);
    expect(layout.aisles.length).toBe(1);
    expect(layout.byId.get(1).col).toBe(0);
    expect(layout.byId.get(2).col).toBe(2);
    expect(Array.isArray(layout.cells)).toBe(true);
    expect(JSON.parse(JSON.stringify(layout.cells))).toHaveLength(2);
  });

  test("huge bay codes fall back to a compact grid", () => {
    const layout = buildWarehouseLayout([
      { id: 1, code: "YAOURT6282", capaciteSlots: 10, stocks: [] },
      { id: 2, code: "YAOURT6283", capaciteSlots: 10, stocks: [] },
      { id: 3, code: "YAOURT6284", capaciteSlots: 10, stocks: [] },
    ]);
    expect(layout.mode).toBe("grid");
    expect(layout.rows).toBeLessThan(20);
    expect(layout.cols).toBeLessThan(20);
  });
});

describe("heatFromRate", () => {
  test("empty / warning / critical", () => {
    expect(heatFromRate(10, 0)).toBe("empty");
    expect(heatFromRate(60, 5)).toBe("warning");
    expect(heatFromRate(90, 5)).toBe("critical");
  });
});

describe("evaluateCompatibility", () => {
  test("chemical article requires dangerous zone", () => {
    const r = evaluateCompatibility({
      article: { dangereuxChimique: true },
      emplacement: { zoneDangereuse: false },
    });
    expect(r.ok).toBe(false);
  });

  test("categorieAutorisee ALIMENTAIRE rejects chemical", () => {
    const r = evaluateCompatibility({
      article: { dangereuxChimique: true },
      emplacement: { zoneDangereuse: true, categorieAutorisee: "ALIMENTAIRE" },
    });
    expect(r.ok).toBe(false);
  });

  test("categorieAutorisee CHIMIQUE rejects standard", () => {
    const r = evaluateCompatibility({
      article: { dangereuxChimique: false },
      emplacement: { zoneDangereuse: false, categorieAutorisee: "CHIMIQUE" },
    });
    expect(r.ok).toBe(false);
  });

  test("MIXTE allows standard on non-dangerous bay", () => {
    const r = evaluateCompatibility({
      article: { dangereuxChimique: false },
      emplacement: { zoneDangereuse: false, categorieAutorisee: "MIXTE" },
    });
    expect(r.ok).toBe(true);
  });
});

describe("isActifStatut", () => {
  test("defaults to actif", () => {
    expect(isActifStatut({})).toBe(true);
    expect(isActifStatut({ statut: "INACTIF" })).toBe(false);
    expect(isActifStatut({ statut: "inactif" })).toBe(false);
    expect(isActifStatut({ statut: "ACTIF" })).toBe(true);
  });
});
