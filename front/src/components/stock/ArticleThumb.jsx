import { useState } from "react";
import { Package } from "lucide-react";
import { getArticleRealImageUrl, resolveArticleImageUrl } from "../../utils/articleImage";

/**
 * Article thumbnail with Package fallback.
 * Accepts full article object or raw imageUrl string.
 */
export default function ArticleThumb({
  article,
  imageUrl,
  alt = "",
  size = "md",
  fill = false,
  className = "",
}) {
  const [err, setErr] = useState(false);
  const src =
    getArticleRealImageUrl(article) ||
    (imageUrl ? resolveArticleImageUrl(imageUrl) : null);

  const sizes = {
    sm: "h-9 w-9 rounded-lg",
    md: "h-12 w-12 rounded-xl",
    lg: "h-14 w-14 rounded-xl",
  };
  const box = fill ? "h-full w-full rounded-none border-0" : sizes[size] || sizes.md;
  const iconSize = fill || size === "lg" ? "h-8 w-8" : size === "sm" ? "h-4 w-4" : "h-5 w-5";

  if (src && !err) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden border border-[var(--border-default)] bg-[var(--bg-hover)] ${box} ${className}`}
      >
        <img
          src={src}
          alt={alt}
          onError={() => setErr(true)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)] text-[var(--accent-primary)] ${box} ${className}`}
      aria-hidden
    >
      <Package className={iconSize} />
    </div>
  );
}
