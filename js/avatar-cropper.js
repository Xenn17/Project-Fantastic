/* Avatar crop & edit popup (profile.html).
   window.F4AvatarCropper.open(file) → Promise<Blob | null>  (null = cancelled)
   Drag / pinch / wheel to position, zoom slider, rotate 90°, mirror, brightness / contrast / saturation.
   Output: 512×512 JPEG. No external libraries. */
(() => {
  "use strict";
  const OUT = 512;
  let ui = null;

  function build() {
    const wrap = document.createElement("div");
    wrap.className = "crop-modal";
    wrap.hidden = true;
    wrap.innerHTML = `
      <div class="crop-backdrop" data-crop-cancel></div>
      <section class="crop-card" role="dialog" aria-modal="true" aria-labelledby="cropTitle">
        <header class="crop-head">
          <p class="crop-kicker">FOTO PROFIL</p>
          <h2 id="cropTitle">Atur foto kamu</h2>
          <button type="button" class="crop-x" data-crop-cancel aria-label="Batal">×</button>
        </header>
        <div class="crop-stage">
          <div class="crop-view" id="cropView">
            <canvas id="cropCanvas"></canvas>
            <div class="crop-ring" aria-hidden="true"></div>
          </div>
          <p class="crop-tip">Geser untuk mengatur posisi · scroll / cubit untuk zoom</p>
        </div>
        <div class="crop-tools">
          <label class="crop-range"><span>ZOOM</span><input type="range" id="cropZoom" min="1" max="4" step="0.01" value="1" /></label>
          <div class="crop-buttons">
            <button type="button" data-crop="rotl" title="Putar kiri" aria-label="Putar kiri"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg></button>
            <button type="button" data-crop="rotr" title="Putar kanan" aria-label="Putar kanan"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg></button>
            <button type="button" data-crop="flip" title="Balik (mirror)" aria-label="Balik"><svg viewBox="0 0 24 24"><path d="M12 3v18"/><path d="M8 7 3 12l5 5V7Z"/><path d="m16 7 5 5-5 5V7Z"/></svg></button>
            <button type="button" data-crop="reset" class="crop-reset">RESET</button>
          </div>
          <details class="crop-adjust">
            <summary>EDIT WARNA</summary>
            <label class="crop-range"><span>KECERAHAN</span><input type="range" data-filter="b" min="50" max="150" value="100" /></label>
            <label class="crop-range"><span>KONTRAS</span><input type="range" data-filter="c" min="50" max="150" value="100" /></label>
            <label class="crop-range"><span>SATURASI</span><input type="range" data-filter="s" min="0" max="200" value="100" /></label>
          </details>
        </div>
        <footer class="crop-actions">
          <button type="button" class="crop-cancel" data-crop-cancel>BATAL</button>
          <button type="button" class="crop-save" id="cropSave">PAKAI FOTO INI</button>
        </footer>
      </section>`;
    document.body.appendChild(wrap);
    return {
      wrap,
      view: wrap.querySelector("#cropView"),
      canvas: wrap.querySelector("#cropCanvas"),
      zoom: wrap.querySelector("#cropZoom"),
      save: wrap.querySelector("#cropSave"),
      filters: [...wrap.querySelectorAll("[data-filter]")],
    };
  }

  function open(file) {
    if (!ui) ui = build();
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      const st = { z: 1, x: 0, y: 0, rot: 0, flip: false, b: 100, c: 100, s: 100 };
      let size = 0, ctx = null, done = false;
      const pointers = new Map();
      let pinch0 = null;

      const dims = () => (st.rot % 180 ? [img.naturalHeight, img.naturalWidth] : [img.naturalWidth, img.naturalHeight]);
      const baseScale = (S) => { const [w, h] = dims(); return Math.max(S / w, S / h); };
      const clamp = () => {
        const [w, h] = dims(), k = baseScale(size) * st.z;
        const mx = Math.max(0, (w * k - size) / 2), my = Math.max(0, (h * k - size) / 2);
        st.x = Math.min(mx, Math.max(-mx, st.x));
        st.y = Math.min(my, Math.max(-my, st.y));
      };
      const filterCss = () => `brightness(${st.b}%) contrast(${st.c}%) saturate(${st.s}%)`;
      function paint(c, S, ratio) {
        const g = c.getContext("2d");
        g.save();
        g.fillStyle = "#111";
        g.fillRect(0, 0, S, S);
        g.translate(S / 2 + st.x * ratio, S / 2 + st.y * ratio);
        g.rotate((st.rot * Math.PI) / 180);
        if (st.flip) g.scale(-1, 1);
        const k = baseScale(S) * st.z;
        g.imageSmoothingQuality = "high";
        g.drawImage(img, (-img.naturalWidth * k) / 2, (-img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
        g.restore();
      }
      function draw() {
        clamp();
        paint(ui.canvas, ui.canvas.width, ui.canvas.width / size);
        ui.canvas.style.filter = filterCss(); // CSS filter works in every browser for the preview
      }
      function resize() {
        size = ui.view.clientWidth || 300;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        ui.canvas.width = ui.canvas.height = Math.round(size * dpr);
        ui.canvas.style.width = ui.canvas.style.height = size + "px";
        draw();
      }
      function setZoom(z, cx = 0, cy = 0) {
        const nz = Math.min(4, Math.max(1, z));
        // keep the point under the cursor / fingers still
        st.x = cx - ((cx - st.x) * nz) / st.z;
        st.y = cy - ((cy - st.y) * nz) / st.z;
        st.z = nz;
        ui.zoom.value = String(nz);
        draw();
      }
      function exportBlob() {
        const out = document.createElement("canvas");
        out.width = out.height = OUT;
        paint(out, OUT, OUT / size);
        const g = out.getContext("2d");
        if (st.b !== 100 || st.c !== 100 || st.s !== 100) {
          // bake the colour edits in (canvas `filter` is not supported everywhere, e.g. older Safari)
          const data = g.getImageData(0, 0, OUT, OUT), px = data.data;
          const bf = st.b / 100, cf = st.c / 100, sf = st.s / 100;
          for (let i = 0; i < px.length; i += 4) {
            let r = px[i] * bf, gr = px[i + 1] * bf, bl = px[i + 2] * bf;
            r = (r - 128) * cf + 128; gr = (gr - 128) * cf + 128; bl = (bl - 128) * cf + 128;
            const l = 0.2126 * r + 0.7152 * gr + 0.0722 * bl;
            px[i] = l + (r - l) * sf; px[i + 1] = l + (gr - l) * sf; px[i + 2] = l + (bl - l) * sf;
          }
          g.putImageData(data, 0, 0);
        }
        return new Promise((res) => out.toBlob((b) => res(b), "image/jpeg", 0.9));
      }
      function finish(result) {
        if (done) return;
        done = true;
        ui.wrap.hidden = true;
        document.documentElement.classList.remove("crop-open");
        URL.revokeObjectURL(url);
        cleanup();
        resolve(result);
      }

      /* events (removed again in cleanup) */
      const onClick = async (e) => {
        if (e.target.closest("[data-crop-cancel]")) return finish(null);
        const t = e.target.closest("[data-crop]")?.dataset.crop;
        if (t === "rotl") st.rot = (st.rot + 270) % 360;
        if (t === "rotr") st.rot = (st.rot + 90) % 360;
        if (t === "flip") st.flip = !st.flip;
        if (t === "reset") {
          Object.assign(st, { z: 1, x: 0, y: 0, rot: 0, flip: false, b: 100, c: 100, s: 100 });
          ui.zoom.value = "1";
          ui.filters.forEach((f) => (f.value = "100"));
        }
        if (t) draw();
        if (e.target.closest("#cropSave")) {
          ui.save.disabled = true;
          ui.save.textContent = "MEMPROSES…";
          const blob = await exportBlob();
          ui.save.disabled = false;
          ui.save.textContent = "PAKAI FOTO INI";
          finish(blob);
        }
      };
      const onInput = (e) => {
        if (e.target === ui.zoom) return setZoom(Number(ui.zoom.value));
        const f = e.target.dataset?.filter;
        if (f) {
          st[f] = Number(e.target.value);
          draw();
        }
      };
      const local = (e) => {
        const r = ui.view.getBoundingClientRect();
        return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2];
      };
      const onDown = (e) => {
        ui.view.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), z: st.z };
        }
      };
      const onMove = (e) => {
        const prev = pointers.get(e.pointerId);
        if (!prev) return;
        const cur = { x: e.clientX, y: e.clientY };
        pointers.set(e.pointerId, cur);
        if (pointers.size === 2 && pinch0) {
          const [a, b] = [...pointers.values()];
          setZoom((pinch0.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch0.d);
        } else if (pointers.size === 1) {
          st.x += cur.x - prev.x;
          st.y += cur.y - prev.y;
          draw();
        }
      };
      const onUp = (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch0 = null;
      };
      const onWheel = (e) => {
        e.preventDefault();
        const [cx, cy] = local(e);
        setZoom(st.z * (e.deltaY < 0 ? 1.08 : 1 / 1.08), cx, cy);
      };
      const onKey = (e) => {
        if (e.key === "Escape") finish(null);
      };
      function cleanup() {
        ui.wrap.removeEventListener("click", onClick);
        ui.wrap.removeEventListener("input", onInput);
        ui.view.removeEventListener("pointerdown", onDown);
        ui.view.removeEventListener("pointermove", onMove);
        ui.view.removeEventListener("pointerup", onUp);
        ui.view.removeEventListener("pointercancel", onUp);
        ui.view.removeEventListener("wheel", onWheel);
        document.removeEventListener("keydown", onKey);
        window.removeEventListener("resize", resize);
      }

      img.onload = () => {
        ui.zoom.value = "1";
        ui.filters.forEach((f) => (f.value = "100"));
        ui.wrap.querySelector(".crop-adjust").open = false;
        ui.wrap.hidden = false;
        document.documentElement.classList.add("crop-open");
        ui.wrap.addEventListener("click", onClick);
        ui.wrap.addEventListener("input", onInput);
        ui.view.addEventListener("pointerdown", onDown);
        ui.view.addEventListener("pointermove", onMove);
        ui.view.addEventListener("pointerup", onUp);
        ui.view.addEventListener("pointercancel", onUp);
        ui.view.addEventListener("wheel", onWheel, { passive: false });
        document.addEventListener("keydown", onKey);
        window.addEventListener("resize", resize);
        requestAnimationFrame(resize);
        setTimeout(() => ui.save.focus({ preventScroll: true }), 80);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  window.F4AvatarCropper = { open };
})();
