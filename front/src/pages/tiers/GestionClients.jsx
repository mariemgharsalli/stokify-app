import SimpleEntityCrud from "../../components/admin/SimpleEntityCrud";

const initial = {
  code: "",
  nom: "",
  adresse: "",
  telephone: "",
  email: "",
  plafondCredit: "",
  encours: "",
  tauxRemise: "",
  modePaiement: "",
};

const fields = [
  { name: "code", label: "Code" },
  { name: "nom", label: "Nom" },
  { name: "adresse", label: "Adresse" },
  { name: "telephone", label: "Téléphone" },
  { name: "email", label: "Email" },
  { name: "plafondCredit", label: "Plafond crédit" },
  { name: "encours", label: "Encours" },
  { name: "tauxRemise", label: "Taux remise (%)" },
  { name: "modePaiement", label: "Mode paiement" },
];

export default function GestionClients() {
  return (
    <SimpleEntityCrud
      title="Clients"
      subtitle="Gestion des clients B2B (ventes)."
      path="clients"
      permissionRead="ventes:read"
      permissionWrite="ventes:write"
      columns={[
        { key: "code", label: "Code" },
        { key: "nom", label: "Nom" },
        { key: "encours", label: "Encours" },
        { key: "modePaiement", label: "Paiement" },
      ]}
      formFields={fields}
      initialForm={initial}
      toPayload={(f) => ({
        code: f.code.trim(),
        nom: f.nom.trim(),
        adresse: f.adresse.trim() || null,
        telephone: f.telephone.trim() || null,
        email: f.email.trim() || null,
        plafondCredit: f.plafondCredit === "" ? null : Number(f.plafondCredit),
        encours: f.encours === "" ? 0 : Number(f.encours),
        tauxRemise: f.tauxRemise === "" ? null : Number(f.tauxRemise),
        modePaiement: f.modePaiement.trim() || null,
      })}
    />
  );
}
