import { Link } from "react-router-dom";
import { fillTemplate } from "../lib/dayProgress";
import { fr } from "../strings/fr";
import { articleLink } from "./chatText";
import SafeReply from "./SafeReply";

export default function MessageBubble({ message, reported, onReport, canReport = true }) {
  const mine = message.role === "user";
  return (
    <article className={`terrain-bubble ${mine ? "is-user" : "is-assistant"}`}>
      <span className="terrain-bubble-who">{mine ? fr.stokiYou : fr.stoki}</span>
      <SafeReply content={message.content} />
      {(message.articles || []).map((article) => {
        const link = articleLink(article);
        if (!link) return null;
        return (
          <Link key={article.id || article.code} to={link.to} state={link.state} className="mt-2 inline-flex min-h-12 items-center font-semibold underline">
            {fillTemplate(fr.stokiOpenArticle, { code: article.code || article.libelle || "" })}
          </Link>
        );
      })}
      {!mine && canReport ? (
        <button type="button" className="mt-2 min-h-12 text-sm font-semibold touch-manipulation" onClick={onReport} disabled={reported}>
          {reported ? fr.stokiReported : fr.stokiReport}
        </button>
      ) : null}
    </article>
  );
}
