import { describe, expect, it } from "vitest";
import { dayProgress, fillTemplate, splitToken } from "../lib/dayProgress";

function query(partial) {
  return { allowed: true, isLoading: false, isSuccess: false, isError: false, data: undefined, ...partial };
}

describe("journée", () => {
  it("compte une mission faite quand son total est à zéro", () => {
    const progress = dayProgress({
      receive: query({ isSuccess: true, data: { count: 6, late: 1 } }),
      prepare: query({ isSuccess: true, data: { count: 0 } }),
      inventory: query({ isSuccess: true, data: { count: 0 } }),
      lots: query({ isSuccess: true, data: { count: 0 } }),
      alerts: query({ isSuccess: true, data: { count: 0 } }),
    });
    expect(progress).toMatchObject({ done: 4, total: 5, loading: false, ratio: 0.8 });
  });

  it("ignore une carte que le rôle ne peut pas voir", () => {
    const progress = dayProgress({
      receive: query({ allowed: false }),
      prepare: query({ isSuccess: true, data: { count: 0 } }),
    });
    expect(progress).toMatchObject({ done: 1, total: 1, ratio: 1 });
  });

  it("reste en chargement tant qu'une carte autorisée n'a pas répondu", () => {
    expect(dayProgress({ receive: query({ isLoading: true }) }).loading).toBe(true);
  });

  it("place le nombre au milieu de la phrase", () => {
    expect(splitToken(fillTemplate("{done} faites sur {total}", { total: 5, done: "{done}" }), "done")).toEqual({
      before: "",
      after: " faites sur 5",
    });
  });
});
