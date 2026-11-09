/* Landing page orchestrator (ES module).
   Pinned intro: scroll progress drives the image sequence, text chapters, film-card transform and 3D emblem.
   NOTE: never write textContent per frame here — i18n.js re-translates the page on every childList mutation.
   Per-frame values go through CSS custom properties / data attributes only. */
import Lenis from "lenis";
import { createSequence } from "./sequence.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const intro = document.querySelector("#home.intro");
const body = document.body;

/* ---------- Smooth scroll ---------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ autoRaf: true, lerp: 0.09, anchors: { offset: -70 }, prevent: (node) => node.closest?.(".join-modal, .main-nav.is-open") });
  // Freeze smooth scroll while the mobile menu or join modal locks the page.
  new MutationObserver(() => {
    if (body.classList.contains("menu-open")) lenis.stop();
    else lenis.start();
  }).observe(body, { attributes: true, attributeFilter: ["class"] });
  window.F4Lenis = lenis;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

async function boot() {
  if (!intro) return;
  if (reduced) intro.classList.add("is-static");

  const film = intro.querySelector("#seqCanvas");
  const ambient = intro.querySelector("#seqAmbient");
  const chapters = [...intro.querySelectorAll("[data-chapter]")].map((el) => {
    const [from, to] = el.dataset.chapter.split(",").map(Number);
    return { el, from, to };
  });
  const hud = intro.querySelector("[data-frame]");
  let lastP = 0;
  let introVisible = true;

  const seqPromise = createSequence({ canvas: film, ambient });

  // Three.js is optional: no WebGL / blocked CDN → CSS emblem fallback stays visible.
  let logo = null;
  const logoCanvas = intro.querySelector("#logo3d");
  const webgl = (() => {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      return false;
    }
  })();
  if (webgl && logoCanvas) {
    import("./logo3d.js")
      .then(({ createLogo3D }) => createLogo3D({ canvas: logoCanvas }))
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

    // Footage plays across the first 88% of the pinned scroll; the rest is the logo finale.
    const frame = seq ? seq.render(Math.min(1, p / 0.88)) : 0;
    if (hud && seq) hud.dataset.frame = `${String(frame + 1).padStart(3, "0")} / ${seq.count}`;

    const finale = smooth(0.6, 0.86, p);
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
