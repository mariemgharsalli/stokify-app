const { offlineToolForMessage, suggestToolsFromText } = require("./stoki.tools");
const { classifyDomain } = require("./stoki.guard");

describe("STOKI offline routing", () => {
  test("English stockout chip lists ruptures, not the AI pulse", () => {
    expect(classifyDomain("Which items are out of stock?").inDomain).toBe(true);
    expect(offlineToolForMessage("Which items are out of stock?")).toEqual({
      name: "get_stock_alerts",
      args: { kind: "rupture" },
    });
    expect(suggestToolsFromText("Which items are out of stock?")[0]).toBe("get_stock_alerts");
  });

  test("French rupture chip stays on stock alerts", () => {
    expect(offlineToolForMessage("Quels articles sont en rupture ?")).toEqual({
      name: "get_stock_alerts",
      args: { kind: "rupture" },
    });
  });

  test("threshold questions keep both ruptures and critical lines", () => {
    expect(offlineToolForMessage("Quels articles sont sous le seuil ?")).toEqual({
      name: "get_stock_alerts",
      args: { kind: "all" },
    });
  });

  test("other STOKI chips in English hit the matching tool", () => {
    expect(offlineToolForMessage("Which lots expire soon?").name).toBe("get_expiry_waste_risk");
    expect(offlineToolForMessage("Which products sell the most?").name).toBe("get_top_sales");
    expect(offlineToolForMessage("What is FEFO?").name).toBe("get_stokify_help");
    expect(offlineToolForMessage("Which products risk a stockout, and why?").name).toBe(
      "explain_rupture_risk"
    );
    expect(offlineToolForMessage("Analyse current anomalies").name).toBe("list_anomalies");
  });

  test("locale chips for stockouts and sales", () => {
    expect(offlineToolForMessage("¿Qué artículos están en ruptura?").name).toBe("get_stock_alerts");
    expect(offlineToolForMessage("Welche Artikel sind ausverkauft?").name).toBe("get_stock_alerts");
    expect(offlineToolForMessage("Quali articoli sono in rottura?").name).toBe("get_stock_alerts");
    expect(offlineToolForMessage("ما المواد النافدة؟").name).toBe("get_stock_alerts");
    expect(offlineToolForMessage("Welche Produkte verkaufen sich am besten?").name).toBe("get_top_sales");
  });
});
