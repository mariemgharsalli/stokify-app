import { afterEach, describe, expect, it, vi } from "vitest";

describe("resolveArticleImageUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("préfixe /uploads avec l'origine déduite de VITE_API_BASE_URL", async () => {
    vi.stubEnv("DEV", "");
    vi.stubEnv("VITE_API_URL", "");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.exemple.com/api");
    vi.resetModules();
    const { resolveArticleImageUrl } = await import("./articleImage.js");
    expect(resolveArticleImageUrl("/uploads/articles/a.jpg")).toBe(
      "https://api.exemple.com/uploads/articles/a.jpg"
    );
  });
});
