/* Client-side image compression for uploads (avatars, showcase photos, division logos).
   window.F4Img.compress(file, { max = 1600, quality = 0.8 }) → Promise<Blob | File>
   Resizes so the longest side is <= max, re-encodes to WebP (falls back to JPEG), keeps transparency.
   Never makes things worse: if decoding/encoding fails or the result is not smaller, the original is returned.
   Used to keep Supabase Storage egress low. No external libraries. */
(() => {
  "use strict";

  const decode = async (file) => {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch {}
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("F4_IMAGE_DECODE")); };
      img.src = url;
    });
  };

  const encode = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));

  async function compress(file, { max = 1600, quality = 0.8 } = {}) {
    try {
      if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
      const bmp = await decode(file);
      const w0 = bmp.width || bmp.naturalWidth;
      const h0 = bmp.height || bmp.naturalHeight;
      if (!w0 || !h0) return file;
      const k = Math.min(1, max / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * k));
      const h = Math.max(1, Math.round(h0 * k));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bmp, 0, 0, w, h);
      if (bmp.close) bmp.close();
      let out = await encode(canvas, "image/webp", quality);
      if (!out || out.type !== "image/webp") {
        // no WebP encoder (older Safari): JPEG has no alpha, so leave PNGs (logos) untouched
        if (file.type === "image/png") return file;
        out = await encode(canvas, "image/jpeg", quality + 0.05);
      }
      if (!out || out.size >= file.size) return file;
      return out;
    } catch {
      return file;
    }
  }

  window.F4Img = { compress };
})();
