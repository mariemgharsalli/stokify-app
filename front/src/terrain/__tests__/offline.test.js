import { beforeEach, describe, expect, it } from "vitest";
import { decisionRejeu, peutMettreEnFile } from "../offline/policy";
import { forcerAction, lireFile, mettreEnFile, purgerFile, rejouerElement, rejouerFile, useMemoryQueueForTests } from "../offline/queue";

describe("file hors ligne", () => {
  beforeEach(() => {
    useMemoryQueueForTests();
  });

  it("ne met en file que le comptage, qui remplace une quantité", () => {
    expect(peutMettreEnFile("inventaire.comptage")).toBe(true);
    expect(peutMettreEnFile("inventaire.ajout")).toBe(false);
    expect(peutMettreEnFile("reception.ligne")).toBe(false);
    expect(peutMettreEnFile("transfert")).toBe(false);
  });

  it("décide le rejeu sans écraser un comptage déjà changé", () => {
    expect(decisionRejeu({ qteReelle: 4 }, { qteReelle: 4, qteAvant: 2 }).action).toBe("skip");
    expect(decisionRejeu({ qteReelle: 2 }, { qteReelle: 4, qteAvant: 2 }).action).toBe("send");
    expect(decisionRejeu({ qteReelle: null }, { qteReelle: 4, qteAvant: null }).action).toBe("send");
    expect(decisionRejeu({ qteReelle: 9 }, { qteReelle: 4, qteAvant: 2 })).toMatchObject({
      action: "conflict",
      server: 9,
      wanted: 4,
    });
    expect(decisionRejeu(null, { qteReelle: 4 }).action).toBe("conflict");
    expect(decisionRejeu({ qteReelle: 9 }, { qteReelle: 4, qteAvant: 2, force: true }).action).toBe("send");
  });

  it("renvoie le même corps de comptage, sans identifiant dans la requête", async () => {
    const calls = [];
    const api = {
      get: async () => ({ data: { lignes: [{ id: 3, qteReelle: 1 }] } }),
      patch: async (url, body) => {
        calls.push({ url, body });
      },
    };
    const item = { id: "abc", inventaireId: 8, ligneId: 3, qteReelle: 5, qteAvant: 1, status: "pending" };
    const done = await rejouerElement(item, api);
    expect(done.status).toBe("done");
    expect(calls).toEqual([{ url: "inventaires/8/lignes/3", body: { qteReelle: 5 } }]);
  });

  it("n'envoie rien si le serveur a déjà la quantité, et signale un écart", async () => {
    const api = {
      get: async () => ({ data: { lignes: [{ id: 3, qteReelle: 5 }] } }),
      patch: async () => {
        throw new Error("ne doit pas partir");
      },
    };
    const skip = await rejouerElement({ inventaireId: 8, ligneId: 3, qteReelle: 5, qteAvant: 1 }, api);
    expect(skip.status).toBe("done");

    const conflit = await rejouerElement(
      { inventaireId: 8, ligneId: 3, qteReelle: 5, qteAvant: 1 },
      { get: async () => ({ data: { lignes: [{ id: 3, qteReelle: 7 }] } }), patch: api.patch }
    );
    expect(conflit.status).toBe("failed");
    expect(conflit.conflict).toEqual({ server: 7, wanted: 5 });
  });

  it("rejoue dans l'ordre et se vide au changement de session", async () => {
    await mettreEnFile({ sessionKey: "1:7", inventaireId: 1, ligneId: 1, qteReelle: 2, qteAvant: 0, label: "A" });
    await mettreEnFile({ sessionKey: "1:7", inventaireId: 1, ligneId: 2, qteReelle: 3, qteAvant: 0, label: "B" });
    await mettreEnFile({ sessionKey: "2:9", inventaireId: 4, ligneId: 5, qteReelle: 1, label: "C" });
    const file = await lireFile("1:7");
    expect(file.map((row) => row.label)).toEqual(["A", "B"]);
    expect(file[0].clientRequestId).toBe(file[0].id);
    const sent = [];
    await rejouerFile("1:7", {
      get: async () => ({ data: { lignes: [{ id: 1, qteReelle: 0 }, { id: 2, qteReelle: 0 }] } }),
      patch: async (url, body) => sent.push({ url, body }),
    });
    expect(sent).toEqual([
      { url: "inventaires/1/lignes/1", body: { qteReelle: 2 } },
      { url: "inventaires/1/lignes/2", body: { qteReelle: 3 } },
    ]);
    await purgerFile("1:7");
    expect(await lireFile("1:7")).toEqual([]);
    expect((await lireFile("2:9")).map((row) => row.label)).toEqual(["C"]);
    await purgerFile();
    expect(await lireFile("2:9")).toEqual([]);
  });

  it("n'écrase un écart qu'après confirmation", async () => {
    await mettreEnFile({ sessionKey: "1:7", inventaireId: 1, ligneId: 3, qteReelle: 5, qteAvant: 1, label: "Vis" });
    await rejouerFile("1:7", {
      get: async () => ({ data: { lignes: [{ id: 3, qteReelle: 9 }] } }),
      patch: async () => {
        throw new Error("écrasement silencieux");
      },
    });
    const [kept] = await lireFile("1:7");
    expect(kept.status).toBe("failed");
    expect(kept.conflict).toEqual({ server: 9, wanted: 5 });
    const sent = [];
    await forcerAction(kept.id);
    await rejouerFile("1:7", {
      get: async () => ({ data: { lignes: [{ id: 3, qteReelle: 9 }] } }),
      patch: async (_url, body) => sent.push(body),
    });
    expect(sent).toEqual([{ qteReelle: 5 }]);
  });
});
