/* Global navbar behaviour for every page that uses the shared header (index.html binds its own in script.js).
   ☰ opens / closes the full-screen menu, Esc + link clicks close it, items get a stagger index. */
(() => {
  "use strict";
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("mainNav");
  if (!toggle || !nav || toggle.dataset.navBound) return;
  toggle.dataset.navBound = "1";
  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Tutup navigasi" : "Buka navigasi");
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
    if (open) [...nav.children].forEach((el, i) => el.style.setProperty("--i", i));
  };
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });
})();
