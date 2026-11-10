/* Global navbar behaviour (index.html + every page with the shared header).
   - ☰ open / close, Esc, close on link click (skipped on index.html, where js/script.js already binds it)
   - menu rows: wraps each label and adds a one-line description (translated by i18n.js like any text)
   - laptop: "Layanan" is shown expanded in the menu's side panel */
(() => {
  "use strict";
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("mainNav");
  if (!toggle || !nav) return;

  const DESC = [
    [/#home$/, "Halaman utama F4NTASTIC"],
    [/#about$/, "Cerita, visi & para pendiri"],
    [/galeri\.html$|#gallery-feature$/, "Momen & album komunitas"],
    [/sponsor\.html$|#promotion$/, "Paket promosi & kerja sama"],
    [/#join-team$/, "Gabung jadi member F4NTASTIC"],
    [/pengaduan\.html$|#report-hub$/, "Laporkan masalah dengan aman"],
    [/devisi\/$/, "41 divisi & info rekrutmen"],
  ];
  nav.querySelectorAll(":scope > a:not(.nav-cta):not(.nav-login)").forEach((a) => {
    if (a.querySelector(".nav-label")) return;
    const label = document.createElement("span");
    label.className = "nav-label";
    while (a.firstChild) label.appendChild(a.firstChild);
    a.appendChild(label);
    const d = DESC.find(([re]) => re.test(a.getAttribute("href") || ""));
    if (d) {
      const small = document.createElement("small");
      small.className = "nav-desc";
      small.textContent = d[1];
      a.appendChild(small);
    }
  });

  const services = nav.querySelector(".nav-services-mobile");
  const laptop = window.matchMedia("(min-width: 781px)");
  const onOpened = () => {
    [...nav.children].forEach((el, i) => el.style.setProperty("--i", i));
    if (services) services.open = laptop.matches;
  };

  if (toggle.dataset.navBound) {
    // index.html: script.js owns open/close — just decorate after it toggles
    toggle.addEventListener("click", () => setTimeout(() => nav.classList.contains("is-open") && onOpened()));
    return;
  }
  toggle.dataset.navBound = "1";
  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Tutup navigasi" : "Buka navigasi");
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
    if (open) onOpened();
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
