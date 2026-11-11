import axios from "axios";
import { beforeEach, describe, expect, it } from "vitest";
import api from "./api";
import { setAuthPersistence, useAuthStore } from "../store/authStore";

function reponse401(config) {
  const response = {
    data: { message: "Token invalide" },
    status: 401,
    statusText: "Unauthorized",
    headers: {},
    config,
  };
  return new axios.AxiosError("Request failed with status code 401", "ERR_BAD_REQUEST", config, null, response);
}

describe("intercepteur axios", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setAuthPersistence(true);
    useAuthStore.getState().logout();
    api.defaults.adapter = async (config) => {
      throw reponse401(config);
    };
  });

  it("déconnecte sur une erreur 401, sauf sur la route de connexion", async () => {
    useAuthStore.getState().setAuth("jeton-actif", { id: 1, role: "ADMIN", email: "a@b.c" }, true);

    await expect(api.get("articles")).rejects.toBeTruthy();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();

    useAuthStore.getState().setAuth("jeton-actif", { id: 1, role: "ADMIN", email: "a@b.c" }, true);
    await expect(api.post("auth/login", { email: "a@b.c", motDePasse: "x" })).rejects.toBeTruthy();
    expect(useAuthStore.getState().token).toBe("jeton-actif");
  });
});
