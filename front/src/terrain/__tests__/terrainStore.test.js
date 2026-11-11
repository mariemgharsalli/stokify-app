import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../../store/authStore";
import { lireFile, mettreEnFile, useMemoryQueueForTests } from "../offline/queue";
import { subscribeTerrainAuthReset, useTerrainStore } from "../store/terrainStore";

describe("terrainStore", () => {
  beforeEach(async () => {
    useMemoryQueueForTests();
    localStorage.removeItem("stokify-terrain");
    if (useTerrainStore.persist?.rehydrate) await useTerrainStore.persist.rehydrate();
    useTerrainStore.setState({
      sessionKey: null,
      depotId: null,
      depotLabel: "",
      soundOn: true,
      hapticsOn: true,
      warehouseMode: false,
    });
    useAuthStore.setState({ token: null, user: null, activeSocieteId: null });
  });

  it("garde le dépôt du même utilisateur et le vide pour un autre, même société", () => {
    useTerrainStore.getState().bindSession("1:7");
    useTerrainStore.getState().setDepot({ id: 8, libelle: "Nord" });

    useTerrainStore.getState().bindSession("1:7");
    expect(useTerrainStore.getState().depotId).toBe(8);
    expect(useTerrainStore.getState().depotLabel).toBe("Nord");

    useTerrainStore.getState().bindSession("1:8");
    expect(useTerrainStore.getState().sessionKey).toBe("1:8");
    expect(useTerrainStore.getState().depotId).toBeNull();
    expect(useTerrainStore.getState().depotLabel).toBe("");
  });

  it("reset au logout, sans effacer les préférences sonores", () => {
    const unsub = subscribeTerrainAuthReset();
    useAuthStore.setState({ token: "jeton", user: { id: 1, role: "MAGASINIER", societeId: 1 }, activeSocieteId: null });
    useTerrainStore.getState().bindSession("1:1");
    useTerrainStore.getState().setDepot({ id: 4, libelle: "Central" });
    useTerrainStore.getState().setSound(false);
    useTerrainStore.getState().setWarehouse(true);

    useAuthStore.getState().logout();

    expect(useTerrainStore.getState().depotId).toBeNull();
    expect(useTerrainStore.getState().depotLabel).toBe("");
    expect(useTerrainStore.getState().sessionKey).toBeNull();
    expect(useTerrainStore.getState().soundOn).toBe(false);
    expect(useTerrainStore.getState().warehouseMode).toBe(true);
    expect(useTerrainStore.getState().recentScans).toEqual([]);
    unsub();
  });

  it("purge le masque d'inventaire et les sessions de comptage au logout", async () => {
    const unsub = subscribeTerrainAuthReset();
    useAuthStore.setState({ token: "jeton", user: { id: 1, role: "MAGASINIER", societeId: 1 }, activeSocieteId: null });
    useTerrainStore.getState().setWarehouse(true);
    localStorage.setItem("stokify-terrain-inventaire-masque", "0");
    sessionStorage.setItem("stokify-terrain-inventaire-session:4", "100");
    sessionStorage.setItem("autre-cle", "oui");
    useTerrainStore.getState().bindSession("1:1");
    await mettreEnFile({ sessionKey: "1:1", inventaireId: 4, ligneId: 2, qteReelle: 6, label: "Vis" });

    useAuthStore.getState().logout();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(localStorage.getItem("stokify-terrain-inventaire-masque")).toBeNull();
    expect(sessionStorage.getItem("stokify-terrain-inventaire-session:4")).toBeNull();
    expect(sessionStorage.getItem("autre-cle")).toBe("oui");
    expect(await lireFile("1:1")).toEqual([]);
    expect(useTerrainStore.getState().warehouseMode).toBe(true);
    unsub();
  });

  it("purge le masque quand un autre utilisateur reprend le téléphone", () => {
    useTerrainStore.getState().bindSession("1:7");
    localStorage.setItem("stokify-terrain-inventaire-masque", "0");
    sessionStorage.setItem("stokify-terrain-inventaire-session:9", "50");

    useTerrainStore.getState().bindSession("1:8");

    expect(localStorage.getItem("stokify-terrain-inventaire-masque")).toBeNull();
    expect(sessionStorage.getItem("stokify-terrain-inventaire-session:9")).toBeNull();
  });

  it("garde dix scans en mémoire et les oublie au reset, sans les persister", () => {
    for (let index = 0; index < 12; index += 1) {
      useTerrainStore.getState().pushScan({ code: `C${index}`, kind: "article", label: `Article ${index}`, at: index });
    }
    expect(useTerrainStore.getState().recentScans).toHaveLength(10);
    expect(useTerrainStore.getState().recentScans[0].code).toBe("C11");
    const saved = JSON.parse(localStorage.getItem("stokify-terrain") || "{}");
    expect(saved.state?.recentScans).toBeUndefined();
    useTerrainStore.getState().reset();
    expect(useTerrainStore.getState().recentScans).toEqual([]);
  });
});
