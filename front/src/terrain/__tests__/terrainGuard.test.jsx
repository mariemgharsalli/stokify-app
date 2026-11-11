import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../../store/authStore";
import TerrainGuard from "../TerrainGuard";

function ouvrir(user, activeSocieteId = null) {
  useAuthStore.setState({
    token: user ? "jeton" : null,
    user,
    activeSocieteId,
  });
  return render(
    <MemoryRouter initialEntries={["/terrain"]}>
      <Routes>
        <Route element={<TerrainGuard />}>
          <Route path="/terrain" element={<h1>terrain-ok</h1>} />
        </Route>
        <Route path="/login" element={<h1>login</h1>} />
        <Route path="/dashboard" element={<h1>dashboard</h1>} />
        <Route path="/select-societe" element={<h1>select-societe</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("TerrainGuard", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, user: null, activeSocieteId: null });
  });

  it("renvoie un CLIENT vers le tableau de bord", async () => {
    ouvrir({ id: 1, role: "CLIENT", prenom: "Lina" });
    expect(await screen.findByRole("heading", { name: "dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "terrain-ok" })).not.toBeInTheDocument();
  });

  it("laisse entrer un MAGASINIER", async () => {
    ouvrir({ id: 2, role: "MAGASINIER", prenom: "Nora", societeId: 4 });
    expect(await screen.findByRole("heading", { name: "terrain-ok" })).toBeInTheDocument();
  });

  it("renvoie un SUPER_ADMIN sans société vers le choix de société", async () => {
    ouvrir({ id: 3, role: "SUPER_ADMIN", prenom: "Adam" }, null);
    expect(await screen.findByRole("heading", { name: "select-societe" })).toBeInTheDocument();
  });

  it("renvoie vers le tableau de bord si le mot de passe doit changer", async () => {
    ouvrir({ id: 4, role: "MAGASINIER", prenom: "Nora", mustChangePassword: true, societeId: 4 });
    expect(await screen.findByRole("heading", { name: "dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "terrain-ok" })).not.toBeInTheDocument();
  });
});
