/* Gallery editor UX layer (galeri.html + category pages, developers only).
   Purely presentational helpers on top of gallery-editor.js / category-album-editor.js, which keep all upload /
   save logic: file previews before upload, drag & drop into upload boxes, Esc to close, focus + scroll lock.
   Everything is delegated, so it also works for popups those scripts create later. */
(() => {
  "use strict";
  const SCOPE = ".gallery-category-modal, .gallery-editor";
  const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  /* ---------- previews of chosen files ---------- */
  function previewsFor(input) {
    const host = input.closest("label") || input.parentElement;
    let box = host.nextElementSibling;
    if (!box || !box.classList.contains("upload-previews")) {
      box = document.createElement("div");
      box.className = "upload-previews";
      box.setAttribute("aria-live", "polite");
      host.after(box);
    }
    return box;
  }
  function renderPreviews(input) {
    const box = previewsFor(input);
    box.querySelectorAll("img, video").forEach((m) => m.src.startsWith("blob:") && URL.revokeObjectURL(m.src));
    const files = [...(input.files || [])];
    box.replaceChildren(
      ...files.map((file) => {
        const item = document.createElement("figure");
        item.className = "upload-preview-tile";
        const isVideo = file.type.startsWith("video/");
        const media = document.createElement(isVideo ? "video" : "img");
        media.src = URL.createObjectURL(file);
        if (isVideo) { media.muted = true; media.preload = "metadata"; }
        else media.alt = file.name;
        const cap = document.createElement("figcaption");
        const name = document.createElement("span");
        name.textContent = file.name;
        const size = document.createElement("small");
        size.textContent = `${isVideo ? "VIDEO · " : ""}${fmtSize(file.size)}`;
        cap.append(name, size);
        item.append(media, cap);
        if (isVideo) item.classList.add("is-video");
        return item;
      }),
    );
    box.hidden = files.length === 0;
    input.closest("label")?.classList.toggle("has-files", files.length > 0);
  }
  document.addEventListener("change", (e) => {
    const input = e.target;
    if (input instanceof HTMLInputElement && input.type === "file" && input.closest(SCOPE)) renderPreviews(input);
  });
  // forms reset after a successful save → clear their previews too
  document.addEventListener("reset", (e) => {
    if (!e.target.closest?.(SCOPE)) return;
    setTimeout(() => e.target.querySelectorAll('input[type="file"]').forEach(renderPreviews), 0);
  }, true);

  /* ---------- drag & drop onto any upload label ---------- */
  const dropTarget = (e) => {
    const label = e.target.closest?.("label");
    const input = label?.querySelector('input[type="file"]');
    return label && input && label.closest(SCOPE) ? { label, input } : null;
  };
  ["dragenter", "dragover"].forEach((type) =>
    document.addEventListener(type, (e) => {
      const t = dropTarget(e);
      if (!t) return;
      e.preventDefault();
      t.label.classList.add("is-dragging");
    }),
  );
  document.addEventListener("dragleave", (e) => dropTarget(e)?.label.classList.remove("is-dragging"));
  document.addEventListener("drop", (e) => {
    const t = dropTarget(e);
    if (!t) return;
    e.preventDefault();
    t.label.classList.remove("is-dragging");
    const accepted = (t.input.accept || "").split(",").map((s) => s.trim()).filter(Boolean);
    const files = [...e.dataTransfer.files].filter((f) => !accepted.length || accepted.includes(f.type));
    if (!files.length) return;
    const dt = new DataTransfer();
    (t.input.multiple ? files : files.slice(0, 1)).forEach((f) => dt.items.add(f));
    t.input.files = dt.files;
    t.input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  /* ---------- popups: Esc closes, focus first field, lock page scroll ---------- */
  const openModals = () => [...document.querySelectorAll(".gallery-category-modal")].filter((m) => !m.hidden);
  const sync = () => {
    const open = openModals();
    document.documentElement.classList.toggle("gallery-modal-open", open.length > 0);
    open.forEach((m) => {
      if (m.dataset.focused) return;
      m.dataset.focused = "1";
      setTimeout(() => m.querySelector("input:not([type=hidden]):not([type=file]), textarea, select")?.focus({ preventScroll: true }), 60);
    });
    document.querySelectorAll(".gallery-category-modal[hidden][data-focused]").forEach((m) => delete m.dataset.focused);
  };
  new MutationObserver(sync).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const top = openModals().pop();
    if (!top) return;
    // let an open media lightbox handle Esc first
    if (document.querySelector("#mediaLightbox:not([hidden])")) return;
    top.hidden = true;
  });
})();
