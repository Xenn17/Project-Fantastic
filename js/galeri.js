(() => {
  "use strict";
  const data = Array.isArray(window.GALERI_DATA) ? window.GALERI_DATA : [];
  const fallbackCategories = [
    {
      name: "Achievement Offline",
      desc: "Pencapaian yang diraih bersama secara langsung.",
      file: "achievement-offline.html",
      num: "01",
      tag: "PROOF OF PRESENCE",
    },
    {
      name: "Achievement Online",
      desc: "Perjalanan dan pencapaian di arena online.",
      file: "achievement-online.html",
      num: "02",
      tag: "DIGITAL VICTORIES",
    },
    {
      name: "GLOBAL #1",
      desc: "Nama hero dan pemain di balik pencapaian global.",
      file: "global-1.html",
      num: "03",
      tag: "GLOBAL DOMINATION",
    },
    {
      name: "Memory",
      desc: "Momen yang akan selalu jadi bagian cerita kita.",
      file: "memory.html",
      num: "04",
      tag: "MADE OF MEMORIES",
    },
    {
      name: "HALL OF FAME",
      desc: "Setiap bintang memiliki cerita, setiap pencapaian memiliki perjuangan. Di balik setiap prestasi, ada waktu yang dikorbankan, usaha yang tidak selalu terlihat, dan tekad untuk terus berkembang. Di F4NTASTIC, kami percaya bahwa setiap pencapaian bukan sekadar angka, melainkan bukti dedikasi dan semangat seorang member. Setiap langkah adalah perjuangan, setiap pencapaian adalah kebanggaan, dan setiap kisah menjadi bagian dari perjalanan keluarga F4NTASTIC.",
      file: "1000-stars.html",
      num: "05",
      tag: "F4NTASTIC LEGACY",
    },
    {
      name: "FANTASTIC COMPE",
      desc: "Dokumentasi tim kompetisi dan roster pemain F4NTASTIC.",
      file: "fantastic-compe.html",
      num: "06",
      tag: "COMPETITIVE LINEUP",
    },
  ];
  let categories = [...fallbackCategories];
  const $ = (s) => document.querySelector(s),
    txt = (v) => (typeof v === "string" ? v : ""),
    title = (x) => txt(x.hero || x.judul || "Untitled Moment"),
    desc = (x) =>
      txt(x.deskripsi).trim() === "ISI DESKRIPSI DI SINI"
        ? ""
        : txt(x.deskripsi),
    video = (x) =>
      x.tipe === "video" || /\.(mp4|webm|ogg)$/i.test(x.gambar || "");
  const media = (x) => {
    const n = document.createElement(video(x) ? "video" : "img");
    n.src = x.gambar;
    if (n.tagName === "VIDEO") {
      n.controls = true;
      n.preload = "metadata";
      n.playsInline = true;
    } else {
      n.alt = title(x);
      n.loading = "lazy";
    }
    return n;
  };
  let slides = data.filter((x) => x.gambar && !video(x)),
    slide = 0,
    timer = null,
    lbList = data,
    lbIndex = 0;
  function setSlide(i) {
    if (!slides.length) return;
    slide = (i + slides.length) % slides.length;
    const item = slides[slide],
      im = $("#heroImage");
    im.classList.add("is-changing");
    window.setTimeout(() => {
      im.style.backgroundImage = `linear-gradient(0deg,rgba(0,0,0,.12),rgba(0,0,0,.12)),url("${item.gambar.replace(/["\\]/g, "")}")`;
      im.classList.remove("is-changing");
    }, 220);
    $("#heroCategory").textContent =
      item.kategori === "GLOBAL #1"
        ? `GLOBAL #1 / ${title(item)}`
        : item.kategori.toUpperCase();
  }
  function start() {
    if (timer) clearInterval(timer);
    if (slides.length > 1)
      timer = setInterval(() => {
        let n = slide;
        if (slides.length > 1) {
          while (n === slide) n = Math.floor(Math.random() * slides.length);
        }
        setSlide(n);
      }, 3000);
  }
  function renderCategories() {
    const grid = $("#categoryGrid");
    grid.replaceChildren();
    categories.forEach((c, i) => {
      const list = data.filter((x) => x.kategori === c.name && x.gambar),
        item = list[Math.floor(Math.random() * list.length)];
      const a = document.createElement("a");
      a.className = "category-card";
      a.style.setProperty("--i", Math.min(i, 6));
      a.href = c.file || `galeri.html?category=${encodeURIComponent(c.name)}`;
      a.setAttribute("aria-label", `Buka kategori ${c.name}`);
      const im = document.createElement("div");
      im.className = "category-image";
      if (item) im.append(media(item));
      const body = document.createElement("div");
      body.className = "category-body";
      if (window.F4GalleryDeveloper) {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "category-edit-icon";
        edit.setAttribute("aria-label", `Edit kategori ${c.name}`);
        edit.title = "Edit kategori";
        edit.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19.5 8.5a2.12 2.12 0 0 0-3-3L5 17v3Z"></path><path d="m14.5 7.5 2 2"></path></svg>';
        edit.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.F4GalleryOpenCategory?.({ ...c, description: c.desc });
        });
        im.append(edit);
      }
      const index = document.createElement("span");
      index.className = "category-index";
      index.textContent = `${c.num} / ${c.tag}`;
      const h = document.createElement("h3");
      h.textContent = c.name;
      const p = document.createElement("p");
      p.textContent = c.desc;
      const count = document.createElement("span");
      count.className = "category-count";
      count.textContent = `${list.length} MEDIA`;
      body.append(index, h, p, count);
      a.append(im, body);
      grid.append(a);
    });
  }
  window.F4GalleryRenderCategories = renderCategories;
  /* All Moments: category filter chips + paged masonry (24 at a time instead of every item at once). */
  const PAGE = 24;
  let momentFilter = "";
  let momentShown = PAGE;
  function renderFilters() {
    const bar = $("#momentFilters");
    if (!bar) return;
    const counts = new Map();
    data.forEach((x) => counts.set(x.kategori, (counts.get(x.kategori) || 0) + 1));
    const chips = [["", "Semua", data.length], ...categories.filter((c) => counts.get(c.name)).map((c) => [c.name, c.name, counts.get(c.name)])];
    // categories that only exist in remote data
    counts.forEach((n, k) => { if (k && !chips.some((c) => c[0] === k)) chips.push([k, k, n]); });
    bar.replaceChildren(
      ...chips.map(([value, label, n]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "moment-chip" + (value === momentFilter ? " is-active" : "");
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", String(value === momentFilter));
        b.innerHTML = `<span></span><b></b>`;
        b.querySelector("span").textContent = label;
        b.querySelector("b").textContent = n;
        b.addEventListener("click", () => {
          momentFilter = value;
          momentShown = PAGE;
          renderFilters();
          renderAll();
        });
        return b;
      }),
    );
  }
  function renderAll() {
    const grid = $("#galleryGrid");
    grid.replaceChildren();
    const filtered = data.map((x, i) => ({ ...x, _index: i })).filter((x) => !momentFilter || x.kategori === momentFilter);
    const visible = filtered.slice(0, momentShown);
    visible.forEach((item, i) => {
      const card = document.createElement("article");
      card.className = "gallery-card all-moment-card";
      card.style.setProperty("--i", Math.min(i % PAGE, 6));
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gallery-card-image";
      button.setAttribute("aria-label", `Buka detail ${title(item)}`);
      button.append(media(item));
      button.addEventListener("click", () => openLB(filtered, i));
      if (window.F4GalleryDeveloper) {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "album-edit-icon all-moment-edit";
        edit.textContent = "✎";
        edit.title = "Edit album";
        edit.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.F4GalleryOpenAlbumEdit?.([item]);
        });
        card.append(edit);
      }
      const body = document.createElement("div");
      body.className = "gallery-card-body all-moment-title";
      const cat = document.createElement("span");
      cat.className = "all-moment-category";
      cat.textContent = item.kategori || "";
      const h = document.createElement("h3");
      h.textContent = title(item);
      body.append(cat, h);
      card.append(button, body);
      grid.append(card);
    });
    $("#galleryEmpty").hidden = filtered.length > 0;
    const more = $("#galleryMore");
    if (more) {
      const left = filtered.length - visible.length;
      more.hidden = left <= 0;
      $("#galleryMoreCount").textContent = left > 0 ? `(${Math.min(left, PAGE)} dari ${left} lagi)` : "";
      $("#galleryProgress").textContent = filtered.length ? `Menampilkan ${visible.length} dari ${filtered.length} momen` : "";
    }
  }
  $("#galleryMore")?.addEventListener("click", () => {
    const before = momentShown;
    momentShown += PAGE;
    renderAll();
    // keep keyboard focus near where the new items start
    $("#galleryGrid").children[before]?.querySelector("button")?.focus({ preventScroll: true });
  });
  function openLB(list, index) {
    lbList = list;
    lbIndex = index;
    updateLB();
    $("#mediaLightbox").hidden = false;
    document.body.style.overflow = "hidden";
    $("#lightboxClose").focus();
  }
  function updateLB() {
    const x = lbList[lbIndex];
    if (!x) return;
    const box = $("#lightboxMedia");
    box.replaceChildren(media(x));
    $("#lightboxCategory").textContent = x.kategori;
    $("#lightboxTitle").textContent =
      title(x) +
      (x.kategori === "GLOBAL #1" && x.nickname ? ` — ${x.nickname}` : "");
    $("#lightboxDescription").textContent =
      desc(x) || "";
    $("#lightboxDate").textContent = x.tanggal || "";
    $("#lightboxPosition").textContent =
      `${String(lbIndex + 1).padStart(2, "0")} / ${String(lbList.length).padStart(2, "0")}`;
  }
  function moveLB(d) {
    lbIndex = (lbIndex + d + lbList.length) % lbList.length;
    updateLB();
  }
  function closeLB() {
    $("#mediaLightbox").hidden = true;
    $("#lightboxMedia").replaceChildren();
    document.body.style.overflow = "";
  }
  $("#lightboxClose").addEventListener("click", closeLB);
  $("#lightboxPrev").addEventListener("click", () => moveLB(-1));
  $("#lightboxNext").addEventListener("click", () => moveLB(1));
  $("#mediaLightbox").addEventListener("click", (e) => {
    if (e.target === $("#mediaLightbox")) closeLB();
  });
  document.addEventListener("keydown", (e) => {
    if (!$("#mediaLightbox").hidden) {
      if (e.key === "Escape") closeLB();
      if (e.key === "ArrowLeft") moveLB(-1);
      if (e.key === "ArrowRight") moveLB(1);
    }
  });
  // ☰ menu is handled by js/site-nav.js (shared navbar)
  const y = $("#galleryYear");
  if (y) y.textContent = new Date().getFullYear();
  renderCategories();
  renderFilters();
  renderAll();
  if (window.F4_GALLERY_SUPABASE_CONFIG && window.supabase) {
    const db = window.getF4GalleryClient();
    db.from("gallery_categories")
      .select("id,name,description,tag")
      .order("name")
      .then(({ data, error }) => {
        if (error || !Array.isArray(data)) return;
        const byName = new Map(categories.map((c) => [c.name, c]));
        data.forEach((c) => {
          const local = byName.get(c.name);
          if (local) {
            local.id = c.id;
            local.desc =
              c.description && c.description.trim()
                ? c.description
                : local.desc;
            local.tag = c.tag && c.tag !== "NEW COLLECTION" ? c.tag : local.tag;
          } else {
            categories.push({
              id: c.id,
              name: c.name,
              desc: c.description || "Koleksi media F4NTASTIC.",
              file: `category.html?name=${encodeURIComponent(c.name)}`,
              num: String(categories.length + 1).padStart(2, "0"),
              tag: c.tag || c.name,
            });
          }
        });
        renderCategories();
      })
      .catch(() => {});
  }
  if (window.F4GalleryRemote) {
    window.F4GalleryRemote.load()
      .then((remote) => {
        const known = new Set(data.map((x) => x.id).filter(Boolean));
        remote.forEach((p) => {
          if (!known.has(p.id))
            data.push({
              id: p.id,
              kategori: p.category,
              hero: p.title,
              judul: p.title,
              deskripsi: p.description,
              gambar: p.imageUrl,
              tanggal: p.createdAt
                ? new Date(p.createdAt).toLocaleDateString("id-ID")
                : "",
              tipe: "gambar",
            });
        });
        renderCategories();
        renderFilters();
        renderAll();
      })
      .catch(() => {});
  }
  if (slides.length) {
    setSlide(Math.floor(Math.random() * slides.length));
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
      start();
  }
})();
window.addEventListener("f4-gallery-developer", () => {
  window.F4GalleryRenderCategories?.();
});
