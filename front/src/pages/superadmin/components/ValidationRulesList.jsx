import { Check, X } from "lucide-react";

export default function ValidationRulesList({ form, generatedCode }) {
  const nomOk = form.nom.trim().length >= 2;
  const codeOk = Boolean(generatedCode) && generatedCode.length >= 3;

  const rules = [
    {
      key: "nom",
      label: "Nom : min. 2 caractères",
      ok: nomOk,
      required: true,
    },
    {
      key: "code",
      label: "Le code est généré automatiquement à partir du nom.",
      ok: nomOk && codeOk,
      required: true,
    },
    { key: "email", label: "Email optionnel", ok: true, optional: true },
    { key: "map", label: "Carte : latitude / longitude optionnels", ok: true, optional: true },
  ];

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      {rules.map((rule) => {
        const showOk = rule.optional || rule.ok;
        return (
          <li
            key={rule.key}
            className={`inline-flex items-center gap-1.5 transition-colors duration-200 ${
              showOk
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {showOk ? (
              <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0 text-red-400" strokeWidth={2.5} />
            )}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
