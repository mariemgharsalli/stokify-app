import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Click email to copy — stops row navigation. */
export default function CopyableEmail({ email, className = "" }) {
  const [copied, setCopied] = useState(false);

  if (!email) return <span className={className}>—</span>;

  async function handleCopy(e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = email;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copié !" : "Cliquer pour copier"}
      className={`group/mail inline-flex max-w-full items-center gap-1.5 rounded-md text-left transition-colors hover:text-[var(--accent-primary)] ${className}`}
    >
      <span className="truncate underline decoration-transparent underline-offset-2 transition group-hover/mail:decoration-[color-mix(in_srgb,var(--accent-primary)_50%,transparent)]">
        {email}
      </span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent-success)]" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-0 transition group-hover/mail:opacity-60" />
      )}
      {copied ? (
        <span className="shrink-0 text-[10px] font-medium text-[var(--accent-success)]">Copié</span>
      ) : null}
    </button>
  );
}
