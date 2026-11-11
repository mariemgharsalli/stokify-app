import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFormValidation } from "../hooks/useFormValidation";
import { clientSchema } from "./client.schema";

function FormulaireClient({ onValide }) {
  const [values, setValues] = useState({
    nom: "",
    email: "pas-un-email",
    telephone: "",
    tauxRemise: "",
    latitude: "",
    longitude: "",
  });
  const { errors, validate } = useFormValidation(clientSchema, values);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!validate()) return;
        onValide(clientSchema.parse(values));
      }}
    >
      <label htmlFor="nom">Nom</label>
      <input
        id="nom"
        value={values.nom}
        onChange={(e) => setValues((v) => ({ ...v, nom: e.target.value }))}
      />
      <label htmlFor="email">Email</label>
      <input
        id="email"
        value={values.email}
        onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
      />
      <label htmlFor="telephone">Téléphone</label>
      <input
        id="telephone"
        value={values.telephone}
        onChange={(e) => setValues((v) => ({ ...v, telephone: e.target.value }))}
      />
      <label htmlFor="remise">Remise</label>
      <input
        id="remise"
        value={values.tauxRemise}
        onChange={(e) => setValues((v) => ({ ...v, tauxRemise: e.target.value }))}
      />
      {errors.nom ? <p>{errors.nom}</p> : null}
      {errors.email ? <p>{errors.email}</p> : null}
      <button type="submit">Enregistrer</button>
    </form>
  );
}

describe("formulaire client (schéma Zod)", () => {
  it("affiche l'erreur d'un champ invalide puis soumet le payload corrigé", () => {
    const onValide = vi.fn();
    render(<FormulaireClient onValide={onValide} />);

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(screen.getByText("Nom / raison sociale requis")).toBeInTheDocument();
    expect(screen.getByText("Email invalide")).toBeInTheDocument();
    expect(onValide).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Société Atlas" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "atlas@example.com" } });
    fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "22111222" } });
    fireEvent.change(screen.getByLabelText("Remise"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onValide).toHaveBeenCalledTimes(1);
    expect(onValide.mock.calls[0][0]).toMatchObject({
      nom: "Société Atlas",
      email: "atlas@example.com",
      telephone: "22111222",
      tauxRemise: 5,
    });
  });
});
