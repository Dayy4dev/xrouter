// Custom topology backdrop lives in the theme store (localStorage), not the
// server-side global theme record: a data URL there would be re-downloaded on
// every /api/theme GET. Uploads are downscaled and re-encoded here so a stored
// value stays a few hundred KB at most.

export const MAX_TOPO_SOURCE_BYTES = 8 * 1024 * 1024; // picked file cap
const MAX_TOPO_CHARS = 600 * 1024; // stored value cap (~440 KB of image)
const MAX_TOPO_DIM = 1600; // longest edge kept, longest-first ladder below
const DATA_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const URL_PATTERN = /^https?:\/\/[^\s"'()<>\\]+$/i;

/** A value safe to drop into a `url("…")`, or null when unusable. */
export function isTopologyBg(value) {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean) return null;
  if (clean.length <= MAX_TOPO_CHARS && DATA_PATTERN.test(clean)) return clean;
  if (clean.length <= 2048 && URL_PATTERN.test(clean)) return clean;
  return null;
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read the file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file is not a readable image"));
    img.src = src;
  });
}

function encode(canvas, quality) {
  const webp = canvas.toDataURL("image/webp", quality);
  // Browsers without WebP encoding silently fall back to PNG, which is huge.
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
}

/**
 * Turns a picked file into a data URL no longer than MAX_TOPO_DIM on its long
 * edge, keeping the source aspect ratio (never squashed). Walks down sizes and
 * qualities until the result fits the storage cap, so a phone photo lands small.
 */
export async function readTopologyBgFile(file) {
  if (!file) throw new Error("Pick an image file");
  if (!/^image\/(png|jpe?g|webp|gif|avif)$/i.test(file.type || "")) {
    throw new Error("Use a PNG, JPEG, WebP, GIF or AVIF image");
  }
  if (file.size > MAX_TOPO_SOURCE_BYTES) throw new Error("Image is larger than 8 MB, pick a smaller one");

  const img = await loadImage(await readAsDataUrl(file));
  const srcW = img.naturalWidth | 0;
  const srcH = img.naturalHeight | 0;
  if (!srcW || !srcH) throw new Error("That image has no size, it cannot be used");

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot process images");

  const longEdge = Math.max(srcW, srcH);
  const rungs = [1, 0.8, 0.62, 0.48].map((r) => Math.max(320, Math.round(MAX_TOPO_DIM * r)));

  for (const dim of rungs) {
    const scale = Math.min(1, dim / longEdge);
    canvas.width = Math.max(1, Math.round(srcW * scale));
    canvas.height = Math.max(1, Math.round(srcH * scale));
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.72, 0.6, 0.5]) {
      const dataUrl = encode(canvas, quality);
      if (dataUrl.length <= MAX_TOPO_CHARS) return dataUrl;
    }
  }
  throw new Error("Could not compress that image enough, try a simpler picture");
}
