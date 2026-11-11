import { afterEach, describe, expect, it } from "vitest";
import { postAuthHomePath, terrainScanPath } from "./postAuthRoutes";

const originalMatchMedia = window.matchMedia;

function setMedia({ phone = false, standalone = false } = {}) {
  window.matchMedia = (query) => ({
    matches: String(query).includes("max-width") ? phone : String(query).includes("display-mode") ? standalone : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
}

describe("postAuthHomePath", () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("envoie un MAGASINIER mobile ou installé vers /terrain", () => {
    setMedia({ phone: true });
    expect(postAuthHomePath("MAGASINIER")).toBe("/terrain");

    setMedia({ standalone: true });
    expect(postAuthHomePath("MAGASINIER")).toBe("/terrain");
  });

  it("laisse un MAGASINIER desktop sur le tableau de bord", () => {
    setMedia({ phone: false, standalone: false });
    expect(postAuthHomePath("MAGASINIER")).toBe("/dashboard");
  });

  it("redirige le QR d'un MAGASINIER mobile, pas celui d'un ADMIN ni du desktop", () => {
    setMedia({ phone: true });
    expect(terrainScanPath("MAGASINIER", "stock", 12)).toBe("/terrain/scan/stock/12");
    expect(terrainScanPath("MAGASINIER", "lot", 4)).toBe("/terrain/scan/lot/4");

    setMedia({ phone: false, standalone: false });
    expect(terrainScanPath("MAGASINIER", "stock", 12)).toBeNull();

    setMedia({ phone: true, standalone: true });
    expect(terrainScanPath("ADMIN", "lot", 4)).toBeNull();
    expect(terrainScanPath("RESPONSABLE", "stock", 3)).toBeNull();
  });

  it("ne change pas les autres rôles, même sur téléphone", () => {
    setMedia({ phone: true, standalone: true });
    expect(postAuthHomePath("CLIENT")).toBe("/articles");
    expect(postAuthHomePath("SUPER_ADMIN")).toBe("/select-societe");
    expect(postAuthHomePath("ADMIN")).toBe("/dashboard");
    expect(postAuthHomePath("RESPONSABLE")).toBe("/dashboard");
    expect(postAuthHomePath("COMPTABLE")).toBe("/dashboard");
  });
});
