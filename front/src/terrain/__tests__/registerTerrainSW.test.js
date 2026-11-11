import { describe, expect, it } from "vitest";
import { registerTerrainSW } from "../pwa/registerTerrainSW";

describe("registerTerrainSW", () => {
  it("n'enregistre pas le service worker hors production", () => {
    expect(import.meta.env.PROD).toBe(false);
    expect(() => registerTerrainSW({ onNeedRefresh() {} })).not.toThrow();
  });
});
