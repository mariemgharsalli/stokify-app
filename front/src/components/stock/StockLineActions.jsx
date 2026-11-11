import { IconArrowLeftRight, IconArrowsTransferUp, IconBarcode, IconQrcode } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export default function StockLineActions({ ligne, onTransfer, onQrClick, pending }) {
  const navigate = useNavigate();
  const articleId = ligne.articleId ?? ligne.article?.id;
  const depotId = ligne.depotId;

  const actions = [
    {
      key: "mouvements",
      label: "Voir mouvements",
      Icon: IconArrowLeftRight,
      color: "#378ADD",
      onClick: () => navigate(`/mouvements?articleId=${articleId}&depotId=${depotId}`),
    },
    {
      key: "lots",
      label: "Voir lots",
      Icon: IconBarcode,
      color: "#1D9E75",
      onClick: () => navigate(`/lots?articleId=${articleId}`),
    },
    {
      key: "transfer",
      label: "Transférer",
      Icon: IconArrowsTransferUp,
      color: "#0EA5E9",
      onClick: () => onTransfer?.(ligne),
    },
    ...(onQrClick
      ? [
          {
            key: "qr",
            label: "Générer le QR code",
            Icon: IconQrcode,
            color: "#378ADD",
            onClick: () => onQrClick(ligne),
          },
        ]
      : []),
  ];

  return (
    <div className="flex items-center justify-center gap-1">
      {actions.map(({ key, label, Icon, color, onClick }) => (
        <button
          key={key}
          type="button"
          title={label}
          aria-label={label}
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-all hover:scale-105 disabled:opacity-40"
          style={{
            background: `${color}20`,
            borderColor: `${color}60`,
            color,
          }}
        >
          <Icon size={14} stroke={1.75} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
