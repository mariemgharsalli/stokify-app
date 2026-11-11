import { useEffect, useState } from "react";
import { getArticleRealImageUrl } from "../../utils/articleImage";

const PALETTE = ["#378ADD", "#1D9E75", "#BA7517", "#E24B4A", "#0F6E56", "#8b5cf6", "#ec4899"];

function colorFromString(str) {
  let hash = 0;
  for (let i = 0; i < String(str).length; i++) hash = String(str).charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsOf(libelle) {
  const words = String(libelle || "?").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function ArticleAvatar({ article, size = 36, className = "" }) {
  const realUrl = getArticleRealImageUrl(article);
  const [imgFailed, setImgFailed] = useState(false);
  const dim = { width: size, height: size };
  const bg = colorFromString(article?.code || article?.libelle || "?");

  useEffect(() => {
    setImgFailed(false);
  }, [realUrl, article?.id, article?.imageUrl]);

  if (realUrl && !imgFailed) {
    return (
      <img
        src={realUrl}
        alt={article?.libelle || "Article"}
        style={dim}
        className={`shrink-0 rounded-lg border border-[var(--border-default)] object-cover ${className}`}
        loading="lazy"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      style={{ ...dim, background: `${bg}22`, color: bg }}
      className={`flex shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] text-[11px] font-bold ${className}`}
      aria-hidden
    >
      {initialsOf(article?.libelle)}
    </div>
  );
}
