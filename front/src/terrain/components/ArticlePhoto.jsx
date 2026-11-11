import { useState } from "react";
import { getArticleRealImageUrl } from "../../utils/articleImage";

export default function ArticlePhoto({ article, imageUrl, title, className = "" }) {
  const [failed, setFailed] = useState(false);
  const src = imageUrl || getArticleRealImageUrl(article);
  const letters = String(title || "?").trim().slice(0, 2).toUpperCase() || "?";
  if (!src || failed) {
    return (
      <span className={`terrain-photo is-fallback ${className}`} aria-hidden>
        {letters}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className={`terrain-photo ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
