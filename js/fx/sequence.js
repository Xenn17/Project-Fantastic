/* Scroll-scrubbed image sequence.
   Draws pre-rendered WebP frames (assets/sequence/{desktop|mobile}) onto a full-screen canvas for a 0..1
   progress value supplied by the caller.

   Performance rules (scroll-scrubbing is unforgiving):
   - the canvas is only redrawn when the frame index changes; any movement/scaling of the stage is done by the
     caller with a CSS transform (GPU-composited, no repaint)
   - frames are decoded off the main thread (img.decode) before they can be drawn, so a draw never blocks on a
     synchronous decode
   - desktop renders at 1x device pixels: the source frames are 720px wide, rendering more pixels than that only
     costs fill-rate without adding detail */

const loadFrame = async (src) => {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
};

export async function createSequence({ canvas, root = "assets/sequence", priority = [], frameHeight = 1 }) {
  const mobile = matchMedia("(max-width: 720px)").matches;
  const variant = mobile ? "mobile" : "desktop";
  let manifest;
  try {
    manifest = await (await fetch(`${root}/manifest.json`)).json();
  } catch {
    return null;
  }
  const count = manifest.count;
  const src = (i) => `${root}/${variant}/f_${String(i + 1).padStart(3, "0")}.webp`;
  const frames = new Array(count).fill(null);

  const ctx = canvas.getContext("2d", { alpha: false });
  let current = -1;
  let wanted = 0;

  const resize = () => {
    const dpr = mobile ? Math.min(devicePixelRatio || 1, 1.5) : 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.imageSmoothingQuality = "high";
    current = -1;
    draw(wanted);
  };

  // Nearest frame that has already loaded (searching backwards first so motion never jumps ahead).
  const nearest = (i) => {
    for (let d = 0; d < count; d++) {
      if (frames[i - d]) return i - d;
      if (frames[i + d]) return i + d;
    }
    return -1;
  };

  function draw(index) {
    wanted = index;
    const i = nearest(index);
    if (i < 0 || i === current) return;
    current = i;
    const img = frames[i];
    const w = canvas.width;
    const h = canvas.height;
    const dh = h * frameHeight;
    const dw = (img.naturalWidth / img.naturalHeight) * dh;
    // Footage sits on pure black → clear to black; CSS composites the canvas with `screen`.
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  frames[0] = await loadFrame(src(0));
  resize();
  addEventListener("resize", resize);

  // Load order: caller priorities (e.g. the frame the intro holds on), a coarse pass, then the gaps.
  const order = [];
  const seen = new Set([0]);
  const push = (i) => {
    if (i > 0 && i < count && !seen.has(i)) {
      seen.add(i);
      order.push(i);
    }
  };
  priority.forEach(push);
  for (let i = 8; i < count; i += 8) push(i);
  for (let i = 1; i < count; i++) push(i);
  let cursor = 0;
  const worker = async () => {
    while (cursor < order.length) {
      const i = order[cursor++];
      frames[i] = await loadFrame(src(i));
      // A closer frame for the current position just arrived → refresh.
      if (frames[i] && Math.abs(i - wanted) < Math.abs(current - wanted)) {
        current = -1;
        draw(wanted);
      }
    }
  };
  Promise.all(Array.from({ length: 6 }, worker));

  return {
    count,
    /** Render the frame for a progress value in [0, 1]; returns the frame index actually drawn. */
    render(progress) {
      draw(Math.min(count - 1, Math.max(0, Math.round(progress * (count - 1)))));
      return current;
    },
    resize,
  };
}
