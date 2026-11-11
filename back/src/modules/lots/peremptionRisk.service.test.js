const prisma = require("../../config/database");
const {
  buildDailyDemand,
  niveauFromProbabilite,
  scoreLotGroup,
  simulateFefo,
} = require("./peremptionRisk.service");
const { sortLotsFefo } = require("./lots.service");

afterAll(async () => {
  await prisma.$disconnect();
});

describe("risque de péremption — épuisement FEFO", () => {
  test("étale une prévision mensuelle en demande journalière", () => {
    const { dailyMean, dailyStd } = buildDailyDemand(
      [{ valeur: 300, p50: 300, p90: 360 }],
      30,
      1
    );
    expect(dailyMean).toHaveLength(30);
    expect(dailyMean[0]).toBeCloseTo(10, 5);
    expect(dailyStd[0]).toBeGreaterThan(0);
  });

  test("une demande prévue qui couvre le lot ne laisse rien à risque", () => {
    const lots = [{ id: 1, qty: 10, jours: 10 }];
    const left = simulateFefo(lots, Array.from({ length: 10 }, () => 2));
    expect(left[0]).toBeCloseTo(0, 5);
    const [score] = scoreLotGroup(lots, Array.from({ length: 10 }, () => 2), Array.from({ length: 10 }, () => 0));
    expect(score.quantiteRisquee).toBe(0);
    expect(score.probabiliteRisque).toBe(0);
  });

  test("la quantité non couverte par la prévision reste à risque", () => {
    const lots = [{ id: 1, qty: 20, jours: 10 }];
    const mean = Array.from({ length: 10 }, () => 1);
    const [score] = scoreLotGroup(lots, mean, mean.map(() => 0));
    expect(score.quantiteRisquee).toBe(10);
    expect(score.probabiliteRisque).toBe(100);
  });

  test("le lot qui expire le plus tôt est consommé avant le suivant", () => {
    const lots = sortLotsFefo([
      { id: 2, qty: 10, jours: 10, dateExpiration: "2026-10-20" },
      { id: 1, qty: 30, jours: 5, dateExpiration: "2026-10-10" },
    ]).map((lot) => ({
      id: lot.id,
      qty: lot.qty,
      jours: lot.jours,
    }));
    expect(lots.map((l) => l.id)).toEqual([1, 2]);
    const mean = Array.from({ length: 10 }, () => 2);
    const scores = scoreLotGroup(lots, mean, mean.map(() => 0));
    const first = scores.find((s) => s.id === 1);
    const second = scores.find((s) => s.id === 2);
    expect(first.quantiteRisquee).toBe(20);
    expect(second.quantiteRisquee).toBe(0);
    expect(first.probabiliteRisque).toBe(100);
    expect(second.probabiliteRisque).toBe(0);
  });

  test("la variance de la prévision fait varier la probabilité autour du seuil", () => {
    const lots = [{ id: 7, qty: 10, jours: 10 }];
    const mean = Array.from({ length: 10 }, () => 1);
    const std = Array.from({ length: 10 }, () => 1.2);
    const [score] = scoreLotGroup(lots, mean, std);
    expect(score.quantiteRisquee).toBe(0);
    expect(score.probabiliteRisque).toBeGreaterThan(15);
    expect(score.probabiliteRisque).toBeLessThan(90);
  });

  test("seuils de niveau", () => {
    expect(niveauFromProbabilite(19)).toBe("faible");
    expect(niveauFromProbabilite(20)).toBe("moyen");
    expect(niveauFromProbabilite(50)).toBe("moyen");
    expect(niveauFromProbabilite(51)).toBe("élevé");
  });
});
