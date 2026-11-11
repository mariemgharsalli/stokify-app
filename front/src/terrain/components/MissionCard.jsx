import { Link } from "react-router-dom";
import { getAxiosErrorMessage } from "../../services/api";
import CountUp from "../motion/CountUp";
import Skeleton from "../motion/Skeleton";
import { fr } from "../strings/fr";

function scrollToAnchor(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function MissionCard({ spec, query, featured = false }) {
  const Icon = spec.icon;
  const count = !query.allowed ? fr.pendingCount : query.isLoading ? null : query.isError ? "!" : Number(query.data?.count) || 0;
  const numeric = typeof count === "number";
  const labelCount = numeric ? `${spec.label} ${count}` : `${spec.label} ${query.isLoading ? fr.scanResolving : count}`;
  const className = `terrain-mission relative flex min-h-[6.5rem] flex-col justify-between overflow-hidden rounded-2xl border p-3 ps-4 text-start text-text-main${featured ? " is-featured" : ""}`;
  const body = (
    <>
      <span className="absolute bottom-0 start-0 top-0 w-1" style={{ background: spec.tone }} aria-hidden />
      <div className="flex items-center justify-between gap-2 text-sm text-text-sub">
        <span className="flex items-center gap-2">
          <span className="terrain-ico" style={{ color: spec.tone, background: `color-mix(in srgb, ${spec.tone} 16%, transparent)` }}>
            <Icon size={16} aria-hidden />
          </span>
          <span>{spec.label}</span>
        </span>
        {featured ? <span className="terrain-urgent">{fr.urgent}</span> : null}
      </div>
      {query.isLoading ? (
        <Skeleton className="mt-3 h-9 w-16" />
      ) : numeric ? (
        <CountUp value={count} className="text-3xl font-semibold" label={labelCount} />
      ) : (
        <p className="text-3xl font-semibold" aria-label={labelCount}>{count}</p>
      )}
      {spec.key === "receive" && query.data?.late != null ? (
        <p className="text-xs text-text-sub">{fr.includingLate.replace("{n}", query.data.late)}</p>
      ) : null}
      {spec.key === "prepare" ? <p className="text-xs text-text-sub">{fr.prepareScope}</p> : null}
      {spec.key !== "prepare" && query.data && query.data.scoped === false ? <p className="text-xs text-text-sub">{fr.allDepots}</p> : null}
    </>
  );

  return (
    <div className={`flex flex-col${featured ? " is-featured" : ""}`}>
      {spec.to ? (
        <Link to={spec.to} className={`${className} touch-manipulation`}>{body}</Link>
      ) : spec.anchor ? (
        <button type="button" className={`${className} touch-manipulation`} onClick={() => scrollToAnchor(spec.anchor)}>
          {body}
        </button>
      ) : (
        <div className={className}>{body}</div>
      )}
      {query.isError ? (
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mt-1 inline-flex min-h-12 items-center text-sm font-semibold touch-manipulation"
          style={{ color: "var(--accent-danger)" }}
        >
          {fr.retry}
          <span className="sr-only"> {spec.label}. {getAxiosErrorMessage(query.error)}</span>
        </button>
      ) : null}
    </div>
  );
}
