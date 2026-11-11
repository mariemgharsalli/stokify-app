import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useCountUp } from "../../../../hooks/useCountUp";
import { useLandingLang } from "../../../landing/LandingLangContext";
import { IA } from "../../moduleIaTheme";
import api from "../../../../services/api";

function money(n) {
  return `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} TND`;
}

export default function WhatIfPanel({ lotId, baselineProba = 0 }) {
  const { tx } = useLandingLang();
  const reduce = useReducedMotion();
  const [mult, setMult] = useState(1);
  const [days, setDays] = useState(0);
  const [res, setRes] = useState(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const afterProba = res?.after?.probaWaste ?? baselineProba;
  const shown = useCountUp(afterProba * 100, reduce ? 0 : 500, 0);
  const saved = Math.max(0, -(Number(res?.deltaValeurP50) || 0));

  useEffect(() => {
    if (mult === 1 && days === 0) {
      setRes(null);
      setFailed(false);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setPending(true);
      setFailed(false);
      try {
        const response = await api.post("stock/expiry-waste/what-if", {
          lotId,
          velocityMultiplier: mult,
          extraDays: days,
        });
        setRes(response.data);
      } catch {
        setFailed(true);
        setRes(null);
      } finally {
        setPending(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [mult, days, lotId]);

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase" style={{ color: IA.muted }}>{tx("Et si ?")}</p>
      <label className="block text-[12px]" style={{ color: IA.textSecondary }}>
        {tx("Accélération des ventes")} ×{mult.toFixed(1)}
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={mult}
          onChange={(e) => setMult(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
      <label className="block text-[12px]" style={{ color: IA.textSecondary }}>
        {tx("DLC supplémentaire")} +{days} j
        <input
          type="range"
          min="0"
          max="14"
          step="1"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
      <motion.div
        className="rounded-xl px-3 py-2 text-[12px]"
        style={{ background: IA.fill, border: `1px solid ${IA.border}`, color: IA.text }}
        animate={reduce ? undefined : { opacity: pending ? 0.6 : 1 }}
      >
        {failed ? (
          <span>{tx("Simulation indisponible")}</span>
        ) : (
          <>
            <span className="font-mono tabular-nums">{Math.round(shown)} %</span>
            {res ? (
              <span style={{ color: IA.textSecondary }}>
                {" "}· {tx("avant")} {Math.round((res.before?.probaWaste || 0) * 100)} %
                {" "}· {tx("valeur sauvée")} {money(saved)}
              </span>
            ) : (
              <span style={{ color: IA.muted }}> · {tx("déplacez un curseur")}</span>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
