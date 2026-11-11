import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import {
  getMarqueInitial,
  marqueGradient,
  resolveMarqueImageUrl,
} from "./refsUtils";

export default function MarqueAvatar({ marque, size = 44, className = "" }) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = marque?.imageUrl ? resolveMarqueImageUrl(marque.imageUrl) : "";
  const showImage = imageUrl && !imgError;
  const px = `${size}px`;
  const grad = marqueGradient(marque?.code || "");

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl ${
        showImage ? "border border-white/10 bg-[#0d1219]" : ""
      } ${className}`}
      style={{
        width: px,
        height: px,
        ...(showImage ? {} : { background: grad }),
      }}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white">
          {marque?.nom ? (
            <span className="text-lg font-bold">{getMarqueInitial(marque.nom)}</span>
          ) : (
            <BadgeCheck size={Math.round(size * 0.5)} />
          )}
        </div>
      )}
    </div>
  );
}
