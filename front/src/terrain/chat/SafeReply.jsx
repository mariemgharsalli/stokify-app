import { useState } from "react";
import { Link } from "react-router-dom";
import { fr } from "../strings/fr";
import { isTerrainLink, replyLines, splitReply } from "./chatText";

function Inline({ line }) {
  return splitReply(line).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (isTerrainLink(part)) {
      return (
        <Link key={index} to={part} className="font-semibold underline">
          {part}
        </Link>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export default function SafeReply({ content }) {
  const lines = replyLines(content);
  const [open, setOpen] = useState(false);
  const folded = !open && lines.length > 6;
  const visible = folded ? lines.slice(0, 6) : lines;
  return (
    <div>
      {visible.map((line, index) => (
        <p key={index} className={index > 0 ? "mt-1" : undefined}>
          <Inline line={line} />
        </p>
      ))}
      {lines.length > 6 ? (
        <button type="button" className="mt-2 min-h-12 font-semibold touch-manipulation" onClick={() => setOpen((value) => !value)}>
          {open ? fr.stokiLess : fr.stokiMore}
        </button>
      ) : null}
    </div>
  );
}
