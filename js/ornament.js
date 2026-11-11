(() => {
  "use strict";
  const D = window.__orn;
  if (!D || !window.crypto || !crypto.subtle) return;
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
  const un = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
  async function dec(pass, o) {
    const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(norm(pass)), "PBKDF2", false, ["deriveKey"]);
    const k = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: un(o.s), iterations: 200000, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: un(o.i) }, k, un(o.c))));
  }
  const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
  function form(ph, onTry, label) {
    const f = el("form", "orn-form"), i = el("input"), b = el("button", "", label || "BUKA SEGEL"), m = el("div", "orn-msg");
    i.placeholder = ph; i.autocomplete = "off"; i.spellcheck = false; b.type = "submit";
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!i.value.trim()) return;
      b.disabled = true; m.textContent = "…";
      const ok = await onTry(i.value).catch(() => false);
      b.disabled = false;
      if (!ok) { m.textContent = ""; f.classList.remove("is-no"); void f.offsetWidth; f.classList.add("is-no"); i.select(); }
      m.textContent = ok ? "" : f.dataset.no || "";
    });
    f.append(i, b);
    return { f, m, i };
  }
  window.__ornKit = { dec, el, form };

  // ---- langkah 1: bintang redup di halaman Hall of Fame ----
  const star = document.querySelector(".signoff-mark i");
  if (!star) return;
  star.classList.add("orn-star");
  star.tabIndex = 0;
  star.setAttribute("role", "button");
  star.setAttribute("aria-label", "✦");
  const open = () => {
    const veil = el("div", "orn-veil"), box = el("div", "orn-letter"), x = el("button", "orn-x", "×");
    veil.hidden = false; x.type = "button"; x.setAttribute("aria-label", "Tutup");
    const close = () => { veil.classList.remove("is-on"); setTimeout(() => veil.remove(), 500); document.removeEventListener("keydown", esc); };
    const esc = (e) => e.key === "Escape" && close();
    x.onclick = close; veil.addEventListener("click", (e) => e.target === veil && close());
    document.addEventListener("keydown", esc);
    const paras = [
      "Untuk kamu yang berani menyentuhku…",
      "Aku bukan malam, tapi kau mencariku di tengah siang. Bulan memeluk matahari, dan seisi dunia menahan napas. Sebut namaku — peristiwa langit saat cahaya dipaksa padam, ketika bintang keempat belajar menyala dalam gelap.",
    ];
    box.append(x, el("h2", "", "Bintang Keempat"), ...paras.map((t) => el("p", "", t)));
    const { f, m, i } = form("namaku…", async (v) => {
      const r = await dec(v, D.s1);
      box.replaceChildren(x, el("h2", "", "Surat yang Terbuka"));
      const img = el("img"); img.src = r.img; img.alt = "Cermin yang retak";
      box.append(img, ...r.paras.map((t) => el("p", "", t)));
      const a = el("a", "orn-link", "→ atelier"); a.href = r.gate;
      const p = el("p"); p.append(a); box.append(p);
      return true;
    });
    f.dataset.no = "Segelnya tidak bergeming. Itu bukan namaku.";
    box.append(f, m);
    veil.append(box); document.body.append(veil);
    requestAnimationFrame(() => veil.classList.add("is-on")); i.focus();
  };
  star.addEventListener("click", open);
  star.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open()));
})();
