import { MODES_CONFIG, getModeConfig } from "../../constants/modesPaiementConfig";
import { inputClass } from "../forms/formStyles";

export { MODES_CONFIG };

/**
 * Sélecteur de mode de paiement avec cards et champs contextuels.
 */
export default function ModePaiementSelector({ value = "ESPECES", onChange, champsValues = {}, onChampsChange }) {
  const config = getModeConfig(value);

  const setChamp = (key, val) => {
    onChampsChange((prev) => ({ ...(prev || {}), [key]: val }));
  };

  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(MODES_CONFIG).map(([key, m]) => {
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                onChampsChange({});
              }}
              className="flex flex-col items-start gap-1 rounded-[10px] border-[1.5px] p-2.5 text-left transition-all duration-150"
              style={{
                borderColor: selected ? m.border : "var(--border-default)",
                background: selected ? m.bg : "transparent",
                transform: selected ? "translateY(-1px)" : "none",
                boxShadow: selected ? `0 4px 12px ${m.bg}` : "none",
                cursor: "pointer",
              }}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-[7px]"
                  style={{ background: selected ? m.bg : "var(--bg-card-hover)" }}
                >
                  <i
                    className={`ti ${m.icon}`}
                    style={{ fontSize: 15, color: selected ? m.color : "var(--text-muted)" }}
                    aria-hidden="true"
                  />
                </div>
                <span
                  className="text-[13px] font-medium"
                  style={{ color: selected ? m.color : "var(--text-primary)" }}
                >
                  {m.label}
                </span>
              </div>
              <span
                className="pl-[34px] text-[11px]"
                style={{ color: selected ? m.color : "var(--text-muted)", opacity: 0.85 }}
              >
                {m.desc}
              </span>
              <span
                className="ml-[34px] rounded-full px-1.5 py-px text-[10px] font-medium transition-all"
                style={{
                  background: selected ? m.badgeBg : "transparent",
                  color: selected ? m.color : "transparent",
                  border: selected ? `1px solid ${m.border}` : "1px solid transparent",
                }}
              >
                {m.badge}
              </span>
            </button>
          );
        })}
      </div>

      {config.champs.length > 0 ? (
        <div
          className="reglement-champs-sup mt-3 animate-[slideDown_0.25s_ease] rounded-[10px] p-3.5 sm:p-4"
          style={{
            background: config.bg,
            border: `1px solid ${config.border}`,
          }}
        >
          <div className="mb-3 flex items-center gap-1.5">
            <i className={`ti ${config.icon}`} style={{ fontSize: 15, color: config.color }} aria-hidden="true" />
            <span className="text-xs font-medium" style={{ color: config.color }}>
              Informations {config.label.toLowerCase()}
            </span>
          </div>
          <div
            className="grid gap-2.5"
            style={{
              gridTemplateColumns: config.champs.length === 1 ? "1fr" : "repeat(2, minmax(0, 1fr))",
            }}
          >
            {config.champs.map((champ) => (
              <div key={champ.key}>
                <label
                  className="mb-1 block text-[11px] font-medium uppercase tracking-wide"
                  style={{ color: config.color }}
                >
                  {champ.label}
                </label>
                <input
                  type={champ.type}
                  value={champsValues[champ.key] || ""}
                  onChange={(e) => setChamp(champ.key, e.target.value)}
                  placeholder={champ.placeholder}
                  required={champ.required}
                  className={inputClass}
                  style={{ borderColor: config.border }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

