import { useRef, useState } from "react";
import { Camera, ImagePlus, Trash2, Upload } from "lucide-react";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export default function SocieteLogoUpload({ previewUrl, fileName, onPickFile, onClear }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file) {
    if (!file) return;
    const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type);
    if (!ok) return;
    onPickFile(file);
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
        Logo de la société (optionnel)
      </label>
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
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={`superadmin-logo-dropzone group relative flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed p-4 ${
          dragging
            ? "is-dragging scale-[1.01] border-violet-500/60 bg-violet-500/10 dark:bg-violet-500/15"
            : "border-slate-300/80 bg-slate-50/80 hover:border-violet-400/50 hover:bg-violet-50/50 dark:border-white/15 dark:bg-white/[0.02] dark:hover:border-violet-500/40 dark:hover:bg-violet-500/5"
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
        <div className="relative shrink-0">
          {previewUrl ? (
            <div className="group/preview relative">
              <img
                src={previewUrl}
                alt="Aperçu logo"
                className="h-16 w-16 rounded-xl border border-slate-200 bg-white object-cover dark:border-white/10 dark:bg-[#0d1219]"
              />
              <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-xl bg-black/50 opacity-0 transition-opacity duration-200 group-hover/preview:opacity-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    inputRef.current?.click();
                  }}
                  className="rounded-lg bg-white/20 p-1.5 text-white backdrop-blur-sm hover:bg-white/30"
                  title="Changer"
                >
                  <Upload size={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  className="rounded-lg bg-red-500/40 p-1.5 text-white backdrop-blur-sm hover:bg-red-500/60"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 transition-transform duration-200 group-hover:scale-105 group-hover:rotate-3 dark:border-white/10 dark:bg-white/[0.04]">
              <ImagePlus className="h-7 w-7 text-slate-400 transition-colors group-hover:text-violet-500 dark:group-hover:text-violet-400" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {previewUrl ? "Changer le logo" : "Ajouter un logo"}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {fileName || "Glissez-déposez ou cliquez pour parcourir"}
          </p>
          <span className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-200/80 bg-white/60 px-2 py-0.5 text-[10px] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-500">
            <Camera className="h-3 w-3" />
            PNG, JPG, WEBP ou GIF · max 2 Mo
          </span>
        </div>
      </div>
    </div>
  );
}
