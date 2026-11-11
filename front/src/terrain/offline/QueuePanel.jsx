import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import api from "../../services/api";
import { fillTemplate } from "../lib/dayProgress";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import SheetSpring from "../motion/SheetSpring";
import { fr } from "../strings/fr";
import { forcerAction, lireFile, purgerFile, rejouerFile, retirerAction } from "./queue";

export default function QueuePanel({ sessionKey }) {
  const online = useOnlineStatus();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!sessionKey) {
      setItems([]);
      return;
    }
    try {
      setItems(await lireFile(sessionKey));
    } catch {
      setItems([]);
    }
  }, [sessionKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!online || !sessionKey) return undefined;
    let stop = false;
    (async () => {
      try {
        await rejouerFile(sessionKey, api);
      } catch {
        /* le réseau reviendra */
      }
      if (!stop) await refresh();
    })();
    return () => {
      stop = true;
    };
  }, [online, sessionKey, refresh]);

  if (!items.length && !open) return null;

  return (
    <>
      {items.length ? (
        <button type="button" className="terrain-queue-banner" onClick={() => setOpen(true)}>
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{fillTemplate(fr.queueCount, { n: items.length })}</span>
        </button>
      ) : null}
      {open ? (
        <SheetSpring title={fr.queueTitle} onClose={() => setOpen(false)}>
          <p className="text-sm text-text-sub">{fr.queueBlocked}</p>
          <ul className="mt-3 flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-2xl border border-border bg-app-bg p-3">
                <p className="font-semibold">{item.label || fr.navInventory}</p>
                <p className="terrain-mono">{item.qteReelle}</p>
                <p className="text-sm">{fr.queueStatus[item.status] || item.status}</p>
                {item.conflict ? (
                  <p className="text-sm">
                    {fillTemplate(fr.queueConflict, {
                      server: item.conflict.server ?? fr.inventoryUncounted,
                      wanted: item.conflict.wanted,
                    })}
                  </p>
                ) : null}
                <div className="mt-2 flex gap-2">
                  {item.conflict ? (
                    <button
                      type="button"
                      className="inline-flex min-h-12 items-center rounded-xl px-3 font-semibold touch-manipulation"
                      onClick={async () => {
                        await forcerAction(item.id);
                        if (online) await rejouerFile(sessionKey, api);
                        await refresh();
                      }}
                    >
                      {fr.queueReplace}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex min-h-12 items-center rounded-xl px-3 font-semibold touch-manipulation"
                      onClick={async () => {
                        if (online) await rejouerFile(sessionKey, api);
                        await refresh();
                      }}
                    >
                      {fr.queueRetry}
                    </button>
                  )}
                  <button
                    type="button"
                    className="inline-flex min-h-12 items-center rounded-xl px-3 font-semibold touch-manipulation"
                    onClick={async () => {
                      await retirerAction(item.id);
                      await refresh();
                    }}
                  >
                    {fr.queueDrop}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-4 inline-flex min-h-12 items-center font-semibold touch-manipulation"
            onClick={async () => {
              await purgerFile(sessionKey);
              await refresh();
            }}
          >
            {fr.queueClear}
          </button>
        </SheetSpring>
      ) : null}
    </>
  );
}
