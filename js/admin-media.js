/* Shared media previews for the admin pages (admin.html, admin-reports.html).
   - F4Media.thumbs(items): HTML for a grid of thumbnails (images or videos) shown directly in a detail drawer
   - clicking a thumbnail opens an in-page viewer with prev/next, keyboard (← → Esc) and "open original"
   items: [{ src, label, type? }]   (type "video" is inferred from the file extension when omitted) */
(() => {
  "use strict";
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const isVideo = (it) => it.type === "video" || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(it.src || it.path || "");
  const groups = new Map(); // group id -> items (so the viewer can step through every media of one detail)
  let gid = 0;

  function thumbs(items, { group } = {}) {
    const list = items.filter((it) => it && (it.src || it.path));
    if (!list.length) return "";
    const id = group || `g${++gid}`;
    groups.set(id, list);
    return `<div class="media-thumbs" data-media-group="${id}">${list
      .map(
        (it, i) => `<button type="button" class="media-thumb${isVideo(it) ? " is-video" : ""}${it.src ? "" : " is-loading"}" data-media-index="${i}" title="${esc(it.label || "Lihat")}">
          ${it.src ? (isVideo(it) ? `<video src="${esc(it.src)}" muted preload="metadata" playsinline></video>` : `<img src="${esc(it.src)}" alt="${esc(it.label || "")}" loading="lazy" />`) : "<i></i>"}
          <span>${esc(it.label || `Foto ${i + 1}`)}</span>
        </button>`,
      )
      .join("")}</div>`;
  }

  /* Fill in a thumbnail whose URL arrives later (e.g. signed URLs for private buckets). */
  function resolve(group, index, src) {
    const list = groups.get(group);
    if (!list || !list[index]) return;
    list[index].src = src;
    const btn = document.querySelector(`[data-media-group="${group}"] [data-media-index="${index}"]`);
    if (!btn) return;
    btn.classList.remove("is-loading");
    const it = list[index];
    btn.querySelector("i, img, video")?.remove();
    btn.insertAdjacentHTML("afterbegin", isVideo(it) ? `<video src="${esc(src)}" muted preload="metadata" playsinline></video>` : `<img src="${esc(src)}" alt="${esc(it.label || "")}" />`);
  }
  function fail(group, index, message) {
    const btn = document.querySelector(`[data-media-group="${group}"] [data-media-index="${index}"]`);
    if (!btn) return;
    btn.classList.remove("is-loading");
    btn.classList.add("is-error");
    btn.disabled = true;
    btn.querySelector("span").textContent = message || "Gagal dimuat";
  }

  /* ---------- viewer ---------- */
  const box = document.createElement("div");
  box.className = "media-viewer";
  box.hidden = true;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Pratinjau media");
  box.innerHTML = `
    <div class="mv-stage"></div>
    <button type="button" class="mv-close" aria-label="Tutup">×</button>
    <button type="button" class="mv-prev" aria-label="Sebelumnya">‹</button>
    <button type="button" class="mv-next" aria-label="Berikutnya">›</button>
    <div class="mv-bar"><span class="mv-label"></span><span class="mv-count"></span><a class="mv-open" target="_blank" rel="noopener">Buka asli ↗</a></div>`;
  document.body.append(box);
  const stage = box.querySelector(".mv-stage");
  let current = [], at = 0, lastFocus = null;

  function paint() {
    const it = current[at];
    stage.innerHTML = isVideo(it)
      ? `<video src="${esc(it.src)}" controls autoplay playsinline></video>`
      : `<img src="${esc(it.src)}" alt="${esc(it.label || "")}" />`;
    box.querySelector(".mv-label").textContent = it.label || "";
    box.querySelector(".mv-count").textContent = current.length > 1 ? `${at + 1} / ${current.length}` : "";
    box.querySelector(".mv-open").href = it.src;
    box.classList.toggle("is-single", current.length < 2);
  }
  function open(items, index = 0) {
    current = items.filter((it) => it.src);
    if (!current.length) return;
    at = Math.max(0, Math.min(index, current.length - 1));
    lastFocus = document.activeElement;
    paint();
    box.hidden = false;
    box.querySelector(".mv-close").focus();
  }
  function close() {
    if (box.hidden) return;
    stage.querySelector("video")?.pause();
    box.hidden = true;
    stage.innerHTML = "";
    lastFocus?.focus?.();
  }
  const step = (d) => {
    if (current.length < 2) return;
    at = (at + d + current.length) % current.length;
    paint();
  };
  box.querySelector(".mv-close").onclick = close;
  box.querySelector(".mv-prev").onclick = () => step(-1);
  box.querySelector(".mv-next").onclick = () => step(1);
  box.addEventListener("click", (e) => { if (e.target === box || e.target === stage) close(); });
  // capture phase: Esc / arrows belong to the viewer while it is open (not to the drawer underneath)
  document.addEventListener("keydown", (e) => {
    if (box.hidden) return;
    if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); close(); }
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  }, true);
  // swipe on touch screens
  let sx = null;
  stage.addEventListener("pointerdown", (e) => { sx = e.clientX; });
  stage.addEventListener("pointerup", (e) => { if (sx !== null && Math.abs(e.clientX - sx) > 50) step(e.clientX < sx ? 1 : -1); sx = null; });

  // delegated click on any thumbnail
  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.(".media-thumb");
    if (!btn || btn.disabled) return;
    const wrap = btn.closest("[data-media-group]");
    const list = groups.get(wrap?.dataset.mediaGroup) || [];
    const idx = Number(btn.dataset.mediaIndex);
    const visible = list.filter((it) => it.src);
    open(visible, Math.max(0, visible.indexOf(list[idx])));
  });

  window.F4Media = { thumbs, resolve, fail, open, close, isOpen: () => !box.hidden };
})();
