/* Posko Pengaduan UX layer (pengaduan.html). js/report.js keeps all logic (auth gate, member search, upload,
   insert, history); this file only adds presentation on top of the same elements:
   - category cards that drive the (visually hidden) #category <select>
   - evidence thumbnails with remove buttons and a 3-file counter (+ fix: drag & drop now refreshes the list)
   - progress steps (Terkirim → Ditinjau → Selesai) and a counter on every report in the history */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const form = $("#reportForm");
  if (!form) return;

  /* ---------- category cards ---------- */
  const select = $("#category");
  const chips = $("#categoryChips");
  // plain symbols present in standard fonts (colour emoji are missing on many Linux setups)
  const ICONS = { bullying: "!", scam: "Rp", toxic: "☣", agreement: "§", internal: "⌂", rw: "◎", dk: "⌖", other: "✦" };
  const HINTS = {
    bullying: "Diolok, diserang, dikucilkan",
    scam: "Uang / akun / jual-beli",
    toxic: "Chat kasar, flame, feeding",
    agreement: "Ingkar janji / aturan squad",
    internal: "Masalah dalam komunitas",
    rw: "Room wangi / atur match",
    dk: "Cheat, map hack, script",
    other: "Di luar kategori di atas",
  };
  if (select && chips) {
    select.classList.add("visually-hidden-select");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    const sync = () =>
      chips.querySelectorAll("[data-value]").forEach((b) => {
        const on = b.dataset.value === select.value;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-checked", String(on));
      });
    chips.replaceChildren(
      ...[...select.options]
        .filter((o) => o.value)
        .map((o) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "category-chip";
          b.dataset.value = o.value;
          b.setAttribute("role", "radio");
          b.innerHTML = `<i aria-hidden="true"></i><span><b></b><small></small></span>`;
          b.querySelector("i").textContent = ICONS[o.value] || "✦";
          b.querySelector("b").textContent = o.textContent.trim();
          b.querySelector("small").textContent = HINTS[o.value] || "";
          b.addEventListener("click", () => {
            select.value = o.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            sync();
          });
          return b;
        }),
    );
    select.addEventListener("change", sync);
    form.addEventListener("reset", () => setTimeout(sync, 0));
    sync();
  }

  /* ---------- evidence thumbnails ---------- */
  const input = $("#evidence");
  const list = $("#fileList");
  const box = $("#uploadBox");
  const MAX = 3, MAX_MB = 10;
  function renderEvidence() {
    if (!input || !list) return;
    list.querySelectorAll("img, video").forEach((m) => URL.revokeObjectURL(m.src));
    const files = [...(input.files || [])];
    const tiles = files.map((file, i) => {
      const tile = document.createElement("figure");
      const video = file.type.startsWith("video/");
      const tooBig = file.size > MAX_MB * 1048576;
      tile.className = `evidence-tile${video ? " is-video" : ""}${i >= MAX || tooBig ? " is-invalid" : ""}`;
      const media = document.createElement(video ? "video" : "img");
      media.src = URL.createObjectURL(file);
      if (video) { media.muted = true; media.preload = "metadata"; } else media.alt = file.name;
      const cap = document.createElement("figcaption");
      cap.innerHTML = "<span></span><small></small>";
      cap.querySelector("span").textContent = file.name;
      cap.querySelector("small").textContent = i >= MAX ? "Melebihi 3 file" : tooBig ? "Lebih dari 10 MB" : `${(file.size / 1048576).toFixed(1)} MB`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "evidence-remove";
      remove.setAttribute("aria-label", `Hapus ${file.name}`);
      remove.textContent = "×";
      remove.addEventListener("click", (e) => {
        e.preventDefault();
        const dt = new DataTransfer();
        files.forEach((f, j) => j !== i && dt.items.add(f));
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      tile.append(media, cap, remove);
      // tiles live inside the upload <label>: don't let a click on a preview reopen the file picker
      tile.addEventListener("click", (e) => e.preventDefault());
      return tile;
    });
    list.replaceChildren(...tiles);
    box?.classList.toggle("has-files", files.length > 0);
    const counter = box?.querySelector(".evidence-counter") || (() => {
      const c = document.createElement("em");
      c.className = "evidence-counter";
      box?.append(c);
      return c;
    })();
    if (counter) {
      counter.textContent = files.length ? `${Math.min(files.length, 99)} / ${MAX} file` : "";
      counter.classList.toggle("is-over", files.length > MAX);
    }
  }
  // registered after report.js's own listener, so the rich tiles replace its plain name list
  input?.addEventListener("change", renderEvidence);
  // report.js assigns dropped files to the input without a change event → refresh explicitly
  box?.addEventListener("drop", () => setTimeout(() => input.dispatchEvent(new Event("change", { bubbles: true })), 0));
  form.addEventListener("reset", () => setTimeout(renderEvidence, 0));

  /* ---------- history: progress steps + count ---------- */
  const listEl = $("#reportList");
  const STEP = { new: 1, need_info: 2, in_review: 2, resolved: 3, dismissed: 3 };
  function enhanceHistory() {
    if (!listEl) return;
    const items = listEl.querySelectorAll(".report-item");
    items.forEach((item) => {
      if (item.querySelector(".report-progress")) return;
      const badge = item.querySelector(".report-badge");
      const status = [...(badge?.classList || [])].find((c) => c in STEP) || "new";
      const step = STEP[status];
      item.dataset.status = status;
      const prog = document.createElement("ol");
      prog.className = `report-progress step-${step}${status === "dismissed" ? " is-dismissed" : ""}${status === "need_info" ? " is-need-info" : ""}`;
      prog.setAttribute("aria-label", "Progres laporan");
      const last = status === "dismissed" ? "Ditolak" : "Selesai";
      const mid = status === "need_info" ? "Perlu info" : "Ditinjau";
      prog.innerHTML = ["Terkirim", mid, last].map((t, i) => `<li class="${i < step ? "is-done" : ""}${i === step - 1 ? " is-current" : ""}"><i></i><span>${t}</span></li>`).join("");
      item.querySelector(".report-item-top")?.after(prog);
    });
    const head = listEl.closest(".report-history")?.querySelector(".report-card-head h2");
    if (head) {
      let count = head.querySelector(".report-count");
      if (!count) {
        count = document.createElement("span");
        count.className = "report-count";
        head.append(count);
      }
      count.textContent = items.length ? String(items.length) : "";
      count.hidden = !items.length;
    }
  }
  if (listEl) new MutationObserver(enhanceHistory).observe(listEl, { childList: true });
  enhanceHistory();
})();
