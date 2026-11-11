import { useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { marqueGradient } from "./refsUtils";

const ACCEPT = ".jpg,.jpeg,.png,image/jpeg,image/png";

export default function MarqueImagePicker({
  nom,
  code,
  previewSrc,
  onPickFile,
  onClear,
  compact = false,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file) {
    if (!file) return;
    const ok = ["image/jpeg", "image/jpg", "image/png"].includes(file.type);
    if (!ok) return;
    onPickFile(file);
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <label className="block text-xs font-medium text-slate-400">Logo de la marque (optionnel)</label>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div
        className={`flex items-center gap-4 rounded-xl border-2 border-dashed p-4 transition-all duration-200 ${
          dragging
            ? "border-violet-500/60 bg-violet-500/10"
            : "border-white/15 bg-white/[0.02] hover:border-violet-500/35"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        {previewSrc ? (
          <img
            src={previewSrc}
            alt="Aperçu logo"
            className="h-16 w-16 shrink-0 rounded-xl border border-white/10 bg-[#0d1219] object-cover"
          />
        ) : (
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: marqueGradient(code || nom || "marque") }}
          >
            <ImagePlus size={24} className="opacity-80" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs text-slate-400">JPG ou PNG — glissez-déposez ou parcourez</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
            >
              <Upload size={14} />
              {previewSrc ? "Changer l'image" : "Ajouter un logo"}
            </button>
            {previewSrc && (
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
              >
                <Trash2 size={14} />
                Retirer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
