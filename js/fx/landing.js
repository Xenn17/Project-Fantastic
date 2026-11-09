/* Landing page orchestrator (ES module).
   Pinned intro: scroll progress drives the image sequence, stage transform, text chapters and 3D particles.
   NOTE: never write textContent per frame here — i18n.js re-translates the page on every childList mutation.
   Per-frame values go through CSS custom properties / data attributes only. */
import { createSequence } from "./sequence.js?v=20261109-arrive";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const intro = document.querySelector("#home.intro");
const body = document.body;

/* ---------- Smooth scroll (optional: a blocked CDN must never break the intro) ---------- */
if (!reduced) {
  import("lenis")
    .then(({ default: Lenis }) => {
      const lenis = new Lenis({ autoRaf: true, lerp: 0.1, anchors: { offset: -70 }, prevent: (node) => node.closest?.(".join-modal, .main-nav.is-open") });
      // Freeze smooth scroll while the mobile menu or join modal locks the page.
      new MutationObserver(() => {
        if (body.classList.contains("menu-open")) lenis.stop();
        else lenis.start();
      }).observe(body, { attributes: true, attributeFilter: ["class"] });
      window.F4Lenis = lenis;
    })
    .catch(() => {});
}

// Last frame of the logo reveal in assets/sequence (the source animation fades to black afterwards).
const HOLD_FRAME = 190;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// When we arrive through the page-transition curtain (html.f4-arriving, see the inline <head> snippet),
// hold the heavy work — 200+ frame decodes and the WebGL init — until the curtain has fully opened, so the
// reveal animation gets the whole main thread / GPU. Then start when the browser is idle.
const afterArrival = () =>
  new Promise((resolve) => {
    const root = document.documentElement;
    const idle = () => (window.requestIdleCallback ? requestIdleCallback(() => resolve(), { timeout: 300 }) : setTimeout(resolve, 60));
    if (!root.classList.contains("f4-arriving")) return resolve();
    const mo = new MutationObserver(() => {
      if (root.classList.contains("f4-arriving")) return;
      mo.disconnect();
      idle();
    });
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    setTimeout(() => { mo.disconnect(); resolve(); }, 2000);
  });

async function boot() {
  if (!intro) return;
  await afterArrival();
  if (reduced) intro.classList.add("is-static");

  const film = intro.querySelector("#seqCanvas");
  const grid = intro.querySelector(".intro-grid");
  const chapters = [...intro.querySelectorAll("[data-chapter]")].map((el) => {
    const [from, to] = el.dataset.chapter.split(",").map(Number);
    return { el, from, to };
  });
  let lastP = 0;
  let introVisible = true;

  // The canvas draws each frame at a fixed base size; the scroll choreography then moves/scales the whole
  // canvas with a GPU transform, so the canvas is repainted only when the frame index actually changes.
  const isPortrait = () => innerWidth / innerHeight < 0.9;
  const BASE_H = isPortrait() ? 1.02 : 1.38;
  const seqPromise = createSequence({ canvas: film, priority: [HOLD_FRAME], frameHeight: BASE_H });

  // Three.js is optional: no WebGL / blocked CDN → CSS emblem fallback stays visible.
  let logo = null;
  const logoCanvas = intro.querySelector("#logo3d");
  // Cheap capability check — creating a throwaway WebGL context just to probe costs ~15ms; createLogo3D
  // already falls back cleanly (returns null) if the real context cannot be created.
  const webgl = "WebGLRenderingContext" in window;
  if (webgl && logoCanvas) {
    import("./logo3d.js?v=20261109-arrive")
      .then(({ createLogo3D }) => createLogo3D({ canvas: logoCanvas, emblem: false }))
      .then((instance) => {
        if (!instance) throw new Error("webgl");
        logo = instance;
        body.classList.add("has-webgl");
        logo.setProgress(lastP);
        if (introVisible) logo.start();
        if (reduced) setTimeout(() => logo.stop(), 1800);
      })
      .catch(() => body.classList.add("no-webgl"));
  } else {
    body.classList.add("no-webgl");
  }

  const seq = await seqPromise;
  if (seq) intro.classList.add("is-ready");

  /* ---------- Scroll timeline ---------- */
  const update = () => {
    const rect = intro.getBoundingClientRect();
    const span = rect.height - innerHeight;
    const p = reduced || span <= 0 ? 0 : Math.min(1, Math.max(0, -rect.top / span));
    if (p === lastP) return;
    lastP = p;

    // Intro animation plays across the first 86% of the pinned scroll and holds on the logo reveal
    // (it fades to black after HOLD_FRAME, so we never scrub past it).
    const finale = smooth(0.6, 0.86, p);
    if (seq) {
      const hold = Math.min(1, HOLD_FRAME / (seq.count - 1));
      seq.render(Math.min(1, p / 0.86) * hold);
      const L = isPortrait()
        ? { x: 0.5, y: 0.34 + finale * 0.04, h: 1.02 }
        : { x: 0.68 - finale * 0.18, y: 0.5 - finale * 0.1, h: 1.38 + finale * 0.22 };
      film.style.transform = `translate3d(${((L.x - 0.5) * innerWidth).toFixed(1)}px, ${((L.y - 0.5) * innerHeight).toFixed(1)}px, 0) scale(${(L.h / BASE_H).toFixed(4)})`;
    }
    // Grid floor slides by whole tiles' remainder → a transform, never a background repaint.
    if (grid) grid.style.setProperty("--gy", `${((p * 1400) % 64).toFixed(1)}px`);

    intro.style.setProperty("--p", p.toFixed(4));
    intro.style.setProperty("--finale", finale.toFixed(4));

    for (const { el, from, to } of chapters) {
      const fadeIn = from <= 0 ? 1 : smooth(from, from + 0.07, p);
      const fadeOut = to >= 1 ? 1 : 1 - smooth(to - 0.07, to, p);
      const v = Math.min(fadeIn, fadeOut);
      el.style.setProperty("--v", v.toFixed(3));
      el.style.setProperty("--dir", p < (from + to) / 2 ? 1 : -1);
      el.toggleAttribute("inert", v < 0.2);
      el.classList.toggle("is-current", v > 0.5);
    }
    logo?.setProgress(p);
  };

  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", () => {
    lastP = -1;
    logo?.resize();
    queue();
  });
  lastP = -1;
  update();

  // Pause WebGL when the intro is off-screen.
  new IntersectionObserver(([entry]) => {
    introVisible = entry.isIntersecting;
    if (!logo) return;
    if (introVisible && !reduced) logo.start();
    else logo.stop();
  }).observe(intro);
}

boot();
