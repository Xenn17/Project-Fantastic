/* F4NTASTIC UI effects — shared by every public page (classic script, load with `defer`).
   Header scroll state, scroll progress, cursor light, 3D tilt + sheen, magnetic buttons,
   reveal stagger and an ambient gold-dust canvas for sub pages. */
(() => {
  "use strict";
  const doc = document;
  const body = doc.body;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const isLanding = body.classList.contains("is-landing");

  /* ---------- Header state + progress bar ---------- */
  const header = doc.querySelector(".site-header");
  const progress = doc.createElement("div");
  progress.className = "fx-progress";
  progress.setAttribute("aria-hidden", "true");
  body.append(progress);
  // Page height is cached via ResizeObserver (computed during rendering) instead of reading scrollHeight
  // on every scroll — that read forced the first full-page layout from JS while the page was loading,
  // a ~280ms freeze on phones.
  let maxScroll = 0;
  new ResizeObserver(() => {
    maxScroll = doc.documentElement.scrollHeight - innerHeight;
  }).observe(body);
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = scrollY;
      progress.style.setProperty("--p", maxScroll > 0 ? Math.min(1, y / maxScroll).toFixed(4) : 0);
      if (header) header.classList.toggle("is-scrolled", y > 24);
    });
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  // Initial state is "top of page" already; reading scrollY right away would force layout during load.
  // (Restored scroll positions fire a scroll event anyway.)
  (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(onScroll, { timeout: 1000 });

  /* ---------- Reveal stagger: index .reveal siblings so grids cascade in ---------- */
  const stagger = () => {
    const parents = new Set();
    doc.querySelectorAll(".reveal").forEach((el) => el.parentElement && parents.add(el.parentElement));
    parents.forEach((parent) => {
      let i = 0;
      for (const child of parent.children) {
        if (child.classList.contains("reveal") && !child.style.getPropertyValue("--i"))
          child.style.setProperty("--i", Math.min(i++, 6));
      }
    });
  };
  stagger();
  let staggerTimer;
  new MutationObserver(() => {
    clearTimeout(staggerTimer);
    staggerTimer = setTimeout(stagger, 120);
  }).observe(body, { childList: true, subtree: true });

  if (reduced) return;

  /* ---------- Cursor light ---------- */
  if (finePointer) {
    const light = doc.createElement("div");
    light.className = "fx-cursor";
    light.setAttribute("aria-hidden", "true");
    body.append(light);
    let lx = innerWidth / 2, ly = innerHeight / 2, tx = lx, ty = ly, running = false;
    const loop = () => {
      lx += (tx - lx) * 0.12;
      ly += (ty - ly) * 0.12;
      light.style.transform = `translate3d(${lx}px, ${ly}px, 0)`;
      if (Math.abs(tx - lx) + Math.abs(ty - ly) > 0.5) requestAnimationFrame(loop);
      else running = false;
    };
    addEventListener("pointermove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
      light.classList.add("is-on");
      if (!running) {
        running = true;
        requestAnimationFrame(loop);
      }
    }, { passive: true });
    doc.addEventListener("pointerleave", () => light.classList.remove("is-on"));
  }

  /* ---------- 3D tilt + sheen (event delegation, works for cards rendered later) ---------- */
  const TILT = [
    ".goal-card", ".admin-card", ".founder-card", ".logo-history-card", ".official-social-card",
    ".vision-feature", ".promotion-panel", ".join-panel", ".report-strip-panel", ".stat-item",
    ".why-card", ".package-card", ".category-card", ".gallery-card", ".division-card", ".faq-item", ".player-card",
  ].join(",");
  if (finePointer) {
    let active = null;
    const release = (el) => {
      el.classList.remove("is-tilting");
      el.style.transform = "";
    };
    doc.addEventListener("pointermove", (e) => {
      const el = e.target.closest && e.target.closest(TILT);
      if (active && active !== el) release(active);
      active = el;
      if (!el) return;
      if (!el.classList.contains("fx-tilt")) {
        el.classList.add("fx-tilt");
        if (getComputedStyle(el).position === "static") el.style.position = "relative";
        const sheen = doc.createElement("span");
        sheen.className = "fx-sheen";
        sheen.setAttribute("aria-hidden", "true");
        el.append(sheen);
      }
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      // Large cards tilt less so they stay readable.
      const strength = r.width > 700 ? 3 : r.width > 420 ? 5 : 8;
      el.classList.add("is-tilting");
      el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      el.style.transform = `perspective(1000px) rotateX(${((0.5 - py) * strength).toFixed(2)}deg) rotateY(${((px - 0.5) * strength).toFixed(2)}deg) translateZ(0)`;
    }, { passive: true });
    doc.addEventListener("pointerleave", () => active && release(active));
  }

  /* ---------- Magnetic buttons ---------- */
  if (finePointer) {
    doc.addEventListener("pointermove", (e) => {
      const btn = e.target.closest && e.target.closest(".button, .nav-cta");
      doc.querySelectorAll(".is-magnet").forEach((b) => {
        if (b !== btn) {
          b.classList.remove("is-magnet");
          b.style.translate = "";
        }
      });
      if (!btn || btn.disabled) return;
      const r = btn.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      btn.classList.add("is-magnet");
      btn.style.translate = `${(dx * 10).toFixed(1)}px ${(dy * 8).toFixed(1)}px`;
    }, { passive: true });
  }

  /* ---------- Ambient gold dust (sub pages; landing has its own WebGL scene) ---------- */
  if (!isLanding && body.dataset.fx !== "off") {
    const canvas = doc.createElement("canvas");
    canvas.className = "fx-particles";
    canvas.setAttribute("aria-hidden", "true");
    body.prepend(canvas);
    const ctx = canvas.getContext("2d");
    let w, h, dpr, dots = [];
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.width = innerWidth * dpr;
      h = canvas.height = innerHeight * dpr;
      const count = Math.round(Math.min(90, (innerWidth * innerHeight) / 18000));
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: (Math.random() * 1.4 + 0.4) * dpr,
        vy: (Math.random() * 0.25 + 0.06) * dpr,
        vx: (Math.random() - 0.5) * 0.12 * dpr,
        t: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    addEventListener("resize", resize);
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.y -= d.vy;
        d.x += d.vx;
        d.t += 0.02;
        if (d.y < -10) { d.y = h + 10; d.x = Math.random() * w; }
        const a = 0.25 + Math.sin(d.t) * 0.2;
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 4);
        g.addColorStop(0, `rgba(246, 221, 147, ${a + 0.3})`);
        g.addColorStop(1, "rgba(217, 180, 91, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    doc.addEventListener("visibilitychange", () => {
      cancelAnimationFrame(raf);
      if (!doc.hidden) draw();
    });
  }
})();
