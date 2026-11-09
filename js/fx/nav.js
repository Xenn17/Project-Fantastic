/* F4NTASTIC navigation FX (classic script, load with `defer`).
   - Desktop: a gold "pill" indicator that springs to the active / hovered link, click ripple + press feedback.
   - Mobile: stagger index for the full-screen menu animation (styling in components.css).
   - Page transitions: a short gold curtain when navigating to another page of the site.
   Never writes text nodes (i18n.js re-translates on childList mutations); only adds decorative elements once. */
(() => {
  "use strict";
  const doc = document;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const desktop = matchMedia("(min-width: 781px)");

  /* ---------- Page transition curtain ---------- */
  const curtain = doc.createElement("div");
  curtain.className = "fx-curtain";
  curtain.setAttribute("aria-hidden", "true");
  curtain.innerHTML = '<i></i><b class="fx-curtain-mark">F<span>4</span>N\'T</b>';
  doc.body.append(curtain);
  // Arrival (cover + reveal) is handled entirely by the inline <head> snippet so it never waits for
  // render-blocking CDN scripts (supabase-js) that delay deferred scripts like this one.
  const root = doc.documentElement;
  addEventListener("pageshow", (e) => {
    // Back/forward cache restores the page mid-transition → clear it.
    if (e.persisted) {
      curtain.classList.remove("is-covering");
      root.classList.remove("f4-arriving", "f4-revealing");
    }
  });

  const isInternalPage = (a, e) => {
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (a.target && a.target !== "_self") return false;
    if (a.hasAttribute("download") || a.dataset.noTransition !== undefined) return false;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/\.html?$|\/$/.test(url.pathname)) return false;
    // Same page (hash/anchor scroll) → let the page handle it.
    return url.pathname !== location.pathname;
  };
  const prefetched = new Set();
  const prefetch = (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname || !/\.html?$|\/$/.test(url.pathname)) return;
    const key = url.origin + url.pathname;
    if (prefetched.has(key)) return;
    prefetched.add(key);
    const link = doc.createElement("link");
    link.rel = "prefetch";
    link.href = key;
    doc.head.append(link);
  };
  doc.addEventListener("pointerover", prefetch, { passive: true });
  doc.addEventListener("pointerdown", prefetch, { passive: true });
  doc.addEventListener("focusin", prefetch);

  if (!reduced)
    doc.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (!isInternalPage(a, e)) return;
      e.preventDefault();
      try { sessionStorage.setItem("f4-curtain", "1"); } catch {}
      curtain.classList.add("is-covering");
      setTimeout(() => (location.href = a.href), 260);
    });

  /* ---------- Navbar ---------- */
  const nav = doc.querySelector("#mainNav");
  if (!nav) return;

  const plainLinks = () => [...nav.querySelectorAll(":scope > a:not(.nav-cta):not(.nav-login)")];
  const activeLink = () =>
    plainLinks().find((a) => a.classList.contains("is-active") || a.classList.contains("active") || a.getAttribute("aria-current") === "page") || null;

  // Stagger index for the mobile menu entrance.
  const indexItems = () => [...nav.children].forEach((el, i) => el.style.setProperty("--i", i));
  indexItems();

  const indicator = doc.createElement("span");
  indicator.className = "nav-indicator";
  indicator.setAttribute("aria-hidden", "true");
  nav.prepend(indicator);

  let shown = false;
  const place = (el, instant) => {
    if (!el || !desktop.matches) {
      indicator.classList.remove("is-on");
      shown = false;
      return;
    }
    const n = nav.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const pad = 14;
    if (!shown || instant) indicator.classList.add("is-instant");
    indicator.style.setProperty("--x", `${(r.left - n.left - pad).toFixed(1)}px`);
    indicator.style.setProperty("--w", `${(r.width + pad * 2).toFixed(1)}px`);
    indicator.classList.add("is-on");
    if (!shown || instant) {
      indicator.getBoundingClientRect(); // commit the jump before re-enabling transitions
      indicator.classList.remove("is-instant");
    }
    shown = true;
  };
  // Batched: many triggers (account chip render, i18n, scroll-spy) collapse into one measurement per frame,
  // and nothing is measured while the arrival curtain still covers the page (no forced layouts during load).
  let pending = null;
  let pendingInstant = false;
  const moveTo = (el, instant = false) => {
    const first = pending === null;
    pending = el || false;
    pendingInstant = pendingInstant || instant;
    if (!first) return;
    const flush = () => {
      if (doc.documentElement.classList.contains("f4-arriving")) return setTimeout(flush, 120);
      const target = pending;
      const inst = pendingInstant;
      pending = null;
      pendingInstant = false;
      place(target || null, inst);
    };
    requestAnimationFrame(flush);
  };
  const home = () => moveTo(activeLink());

  const isPlain = (el) => el && el.parentElement === nav && el.matches("a:not(.nav-cta):not(.nav-login)");
  nav.addEventListener("pointerover", (e) => {
    const a = e.target.closest("a");
    if (isPlain(a)) moveTo(a);
  });
  nav.addEventListener("pointerleave", home);
  nav.addEventListener("focusin", (e) => {
    if (isPlain(e.target)) moveTo(e.target);
  });
  nav.addEventListener("focusout", () => setTimeout(() => !nav.contains(doc.activeElement) && home(), 0));

  // Click: ripple from the pointer + press bounce; the pill lands on the clicked link right away.
  nav.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a || !nav.contains(a)) return;
    if (plainLinks().includes(a)) moveTo(a);
    a.classList.remove("is-pressed");
    void a.offsetWidth;
    a.classList.add("is-pressed");
    setTimeout(() => a.classList.remove("is-pressed"), 450);
    if (reduced) return;
    const n = nav.getBoundingClientRect();
    const ripple = doc.createElement("span");
    ripple.className = "nav-ripple";
    ripple.setAttribute("aria-hidden", "true");
    const x = e.clientX || a.getBoundingClientRect().left + a.offsetWidth / 2;
    const y = e.clientY || a.getBoundingClientRect().top + a.offsetHeight / 2;
    ripple.style.left = `${x - n.left}px`;
    ripple.style.top = `${y - n.top}px`;
    nav.append(ripple);
    setTimeout(() => ripple.remove(), 700);
  });

  // Scroll-spy on the landing page toggles .is-active → follow it. Only reacts when the active link actually
  // changes, so the indicator's own class/style updates can never feed back into this observer.
  let lastActive = activeLink();
  new MutationObserver(() => {
    const a = activeLink();
    if (a === lastActive) return;
    lastActive = a;
    if (!nav.matches(":hover")) moveTo(a);
  }).observe(nav, { subtree: true, attributes: true, attributeFilter: ["class", "aria-current"] });
  // Account chip / language changes alter link widths (ignore our own ripple/indicator nodes).
  const ours = (n) => n.nodeType === 1 && (n.classList.contains("nav-ripple") || n.classList.contains("nav-indicator"));
  new MutationObserver((records) => {
    if (records.every((r) => r.type === "childList" && [...r.addedNodes, ...r.removedNodes].every(ours))) return;
    indexItems();
    if (!nav.matches(":hover")) moveTo(activeLink(), true);
  }).observe(nav, { childList: true, characterData: true, subtree: true });

  addEventListener("resize", () => moveTo(activeLink(), true));
  desktop.addEventListener?.("change", () => moveTo(activeLink(), true));
  // Re-measure once web fonts settle. Touching document.fonts.ready forces a synchronous full-page style
  // recalc in Chromium, so only do it after load instead of during parsing.
  addEventListener("load", () => doc.fonts?.ready.then(() => moveTo(activeLink(), true)), { once: true });
  moveTo(activeLink(), true);
})();
