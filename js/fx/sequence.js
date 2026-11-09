/* Scroll-scrubbed image sequence.
   Draws pre-rendered WebP frames (assets/sequence/{desktop|mobile}) onto a canvas based on a 0..1 progress
   value supplied by the caller. A tiny second canvas renders the same frame as a blurred ambient backdrop. */

const loadImage = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

export async function createSequence({ canvas, ambient, root = "assets/sequence", priority = [] }) {
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
  const actx = ambient ? ambient.getContext("2d", { alpha: false }) : null;
  let current = -1;
  let wanted = 0;
  // Stage layout: frame centre (x, y as 0..1 of the canvas) and frame height as a multiple of canvas height.
  let layout = { x: 0.5, y: 0.5, h: 1 };
  let layoutKey = "";

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, mobile ? 2 : 1.5);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    if (ambient) {
      ambient.width = 48;
      ambient.height = 48;
    }
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

  const cover = (context, img, w, h) => {
    const s = Math.max(w / img.width, h / img.height);
    const dw = img.width * s;
    const dh = img.height * s;
    context.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  };

  // Footage sits on pure black, so the stage is cleared to black and composited with `screen` in CSS.
  const stage = (context, img, w, h) => {
    const dh = h * layout.h;
    const dw = (img.width / img.height) * dh;
    context.fillStyle = "#000";
    context.fillRect(0, 0, w, h);
    context.drawImage(img, w * layout.x - dw / 2, h * layout.y - dh / 2, dw, dh);
  };

  function draw(index) {
    wanted = index;
    const i = nearest(index);
    if (i < 0 || i === current) return;
    current = i;
    const img = frames[i];
    stage(ctx, img, canvas.width, canvas.height);
    if (actx) cover(actx, img, ambient.width, ambient.height);
  }

  // Priority: first frame, then a coarse pass (every 8th) so scrubbing works early, then fill the gaps.
  frames[0] = await loadImage(src(0));
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
      frames[i] = await loadImage(src(i));
      if (Math.abs(i - wanted) < 8) {
        current = -1;
        draw(wanted);
      }
    }
  };
  Promise.all(Array.from({ length: 6 }, worker));

  return {
    count,
    /** Render the frame for a progress value in [0, 1], optionally with a new stage layout. */
    render(progress, nextLayout) {
      if (nextLayout) {
        const key = `${nextLayout.x.toFixed(4)}|${nextLayout.y.toFixed(4)}|${nextLayout.h.toFixed(4)}`;
        if (key !== layoutKey) {
          layoutKey = key;
          layout = nextLayout;
          current = -1;
        }
      }
      draw(Math.min(count - 1, Math.max(0, Math.round(progress * (count - 1)))));
      return current;
    },
    resize,
  };
}
