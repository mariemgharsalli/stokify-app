import api, { getApiOrigin } from "../services/api";

/** Enlève `/api` devant `/uploads/…`. */
function stripApiBeforeUploads(pathname) {
  return String(pathname || "").replace(/^\/api(?=\/uploads\/)/i, "");
}

/** Résout l'URL d'avatar : data URL, chemin `/uploads/…`, ou URL absolue. */
export function resolveAvatarUrl(raw) {
  const s0 = String(raw || "").trim().replace(/\\/g, "/");
  if (!s0) return "";
  if (s0.startsWith("data:")) return s0;

  let path = "";
  try {
    const u = new URL(s0);
    const p = stripApiBeforeUploads(u.pathname || "");
    if (p.startsWith("/uploads/")) {
      path = p + (u.search || "") + (u.hash || "");
    } else if (/^https?:\/\//i.test(s0)) {
      return s0;
    } else {
      return s0;
    }
  } catch {
    let p = s0.startsWith("/") ? s0 : `/${s0}`;
    p = stripApiBeforeUploads(p);
    if (!p.startsWith("/uploads/")) return s0;
    path = p;
  }

  const origin = getApiOrigin();
  return origin ? `${origin}${path}` : path;
}

/** Compresse une image côté client (max 256px, JPEG). */
export function compressImageFile(file, maxSize = 256, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, maxSize / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression échouée"));
            return;
          }
          resolve(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image invalide"));
    };
    img.src = url;
  });
}

export async function uploadAvatarImage(file) {
  const compressed = await compressImageFile(file);
  const fd = new FormData();
  fd.append("image", compressed);
  const res = await api.post("users/me/avatar", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
