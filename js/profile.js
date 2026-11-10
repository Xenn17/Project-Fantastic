(() => {
  "use strict";
  const SUPABASE_URL = "https://uxkieyunztzhiwrocnei.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4a2lleXVuenR6aGl3cm9jbmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDQwODIsImV4cCI6MjEwNzg4MDA4Mn0.nlWhlGbagxwZ2-XeHEa195n5sQmRtXn3xutTISDXR70";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  });
  const $ = (id) => document.getElementById(id);
  const keys = [
    "full_name",
    "phone",
    "ml_id",
    "ml_server",
    "gender",
    "birth_date",
  ];
  const PROFILE_COLS =
    "id,email,username,full_name,phone,ml_id,ml_server,gender,birth_date,role,roles,avatar_url,avatar_updated_at,presence_mode,last_seen,created_at,main_hero,favorite_heroes,profile_gallery,game_role";
  let user = null,
    profile = null,
    profilePersisted = false,
    busy = false,
    viewMode = false,
    gallerySlot = null,
    heartbeatTimer = null;
  const say = (message, good = false) => {
    const s = $("profileStatus");
    s.textContent = message;
    s.classList.toggle("is-error", !good);
    s.classList.toggle("is-success", good);
  };
  const prettyError = (error) => {
    const message = String(error?.message || error || "");
    if (/Avatar can only be changed once every 24 hours/i.test(message))
      return "Foto profil hanya bisa diganti setiap 24 jam. Foto lama tetap digunakan.";
    if (/row-level security|permission denied|not allowed/i.test(message))
      return "Akses database ditolak. Pastikan migrasi SQL sudah diterapkan.";
    if (/network|fetch/i.test(message))
      return "Koneksi gagal. Periksa internet lalu coba kembali.";
    if (
      /column .* does not exist|schema cache|relation .* does not exist/i.test(
        message,
      )
    )
      return "Struktur database belum diperbarui. Jalankan SQL terbaru di Supabase SQL Editor.";
    return message || "Terjadi kesalahan. Coba kembali.";
  };
  function setBusy(state) {
    busy = state;
    const b = $("saveProfile");
    b.disabled = state;
    b.innerHTML = state
      ? "MEMPROSES…"
      : 'SIMPAN DATA DIRI <span aria-hidden="true">↗︎</span>';
  }
  function showAvatar(url, name) {
    const avatar = $("avatar");
    avatar.replaceChildren();
    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = `Foto profil ${name || "member"}`;
      image.onerror = () => {
        avatar.textContent = (name || "F").charAt(0).toUpperCase();
      };
      avatar.appendChild(image);
    } else avatar.textContent = (name || "F").charAt(0).toUpperCase();
    syncCard();
  }
  function updateCompletion(data) {
    return keys.every((key) => String(data?.[key] ?? "").trim());
  }
  function setCooldown() {
    const target = $("avatarCooldown"),
      changedAt = profile?.avatar_updated_at
        ? new Date(profile.avatar_updated_at).getTime()
        : 0,
      remaining = changedAt + 86400000 - Date.now();
    if (remaining > 0) {
      const hours = Math.floor(remaining / 3600000),
        minutes = Math.floor((remaining % 3600000) / 60000);
      target.textContent = `Ganti foto lagi dalam ${hours} jam ${minutes} menit.`;
    } else target.textContent = "Siap diganti. Batas cooldown: 24 jam.";
  }

  /* presence */
  function presenceState(p) {
    const mode = p?.presence_mode || "auto";
    if (mode === "busy") return "busy";
    if (mode === "offline") return "offline";
    const ls = p?.last_seen ? new Date(p.last_seen).getTime() : 0;
    return Date.now() - ls < 5 * 60 * 1000 ? "online" : "offline";
  }
  function renderPresence(state) {
    const dot = $("avatarStatusDot"),
      label = $("presenceLabel"),
      lastSeen = $("presenceLastSeen");
    dot.className = "avatar-online-dot " + state;
    if (state === "online") {
      label.textContent = "ONLINE";
      lastSeen.textContent = "Sedang membuka website.";
    } else if (state === "busy") {
      label.textContent = "SIBUK";
      lastSeen.textContent = "Status disetel manual.";
    } else {
      label.textContent = "OFFLINE";
      const ls = profile?.last_seen ? new Date(profile.last_seen) : null;
      lastSeen.textContent = ls
        ? "Terakhir terlihat " +
          ls.toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Belum terlihat akhir-akhir ini.";
    }
  }
  async function heartbeat() {
    if (!user || !profile || profile.presence_mode !== "auto") return;
    const now = new Date().toISOString();
    profile.last_seen = now;
    const { error } = await db
      .from("profiles")
      .update({ last_seen: now })
      .eq("id", user.id);
    if (!error) renderPresence("online");
  }
  async function setPresence(mode) {
    if (!user || !profile) return;
    const now = new Date().toISOString();
    const { error } = await db
      .from("profiles")
      .update({ presence_mode: mode, last_seen: now })
      .eq("id", user.id);
    if (error) {
      say(`Status gagal disimpan: ${prettyError(error)}`);
      return;
    }
    profile.presence_mode = mode;
    profile.last_seen = now;
    renderPresence(presenceState(profile));
    if (mode === "auto") {
      heartbeat();
      startHeartbeat();
    } else stopHeartbeat();
  }
  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (document.visibilityState === "visible") heartbeat();
    }, 60000);
  }
  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  /* gallery showcase (max 3) */
  function galleryRender() {
    const grid = $("galleryGrid");
    if (!grid) return;
    const g = Array.isArray(profile?.profile_gallery)
      ? profile.profile_gallery
      : [];
    grid.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const slot = document.createElement("div");
      slot.className = "gallery-slot " + (g[i] ? "has-photo" : "is-empty");
      if (g[i]) {
        const img = document.createElement("img");
        img.src = g[i];
        img.alt = "Showcase profil " + (i + 1);
        img.loading = "lazy";
        slot.append(img);
        const over = document.createElement("div");
        over.className = "gallery-overlay";
        const cg = document.createElement("button");
        cg.type = "button";
        cg.textContent = "GANTI";
        cg.addEventListener("click", () => {
          gallerySlot = i;
          $("galleryFile").click();
        });
        const dl = document.createElement("button");
        dl.type = "button";
        dl.className = "gallery-del";
        dl.textContent = "HAPUS";
        dl.addEventListener("click", () => removeGallery(i));
        over.append(cg, dl);
        slot.append(over);
      } else {
        const add = document.createElement("button");
        add.type = "button";
        add.className = "gallery-add";
        add.innerHTML = "＋<small>TAMBAH</small>";
        add.addEventListener("click", () => {
          gallerySlot = i;
          $("galleryFile").click();
        });
        slot.append(add);
      }
      grid.append(slot);
    }
    syncCard();
  }
  async function persistGallery() {
    if (!user || !profile) return;
    const g = Array.isArray(profile.profile_gallery)
      ? profile.profile_gallery
      : [];
    await db.from("profiles").update({ profile_gallery: g }).eq("id", user.id);
  }
  async function removeGallery(i) {
    if (!user || !profile) return;
    const g = Array.isArray(profile.profile_gallery)
      ? profile.profile_gallery.slice()
      : [];
    g[i] = null;
    profile.profile_gallery = g;
    await persistGallery();
    galleryRender();
  }
  async function uploadGallery(file) {
    if (!file || gallerySlot == null || !user || !profile) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      say("Format foto harus JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      say("Ukuran foto maksimal 10 MB.");
      return;
    }
    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
    const path = `${user.id}/showcase-${Date.now()}-${gallerySlot}.${ext}`;
    const { error: upErr } = await db.storage
      .from("f4ntastic-showcase")
      .upload(path, file, {
        upsert: false,
        contentType: file.type,
        cacheControl: "3600",
      });
    if (upErr) {
      say("Gagal mengunggah foto: " + prettyError(upErr));
      return;
    }
    const { data: urlData } = db.storage
      .from("f4ntastic-showcase")
      .getPublicUrl(path);
    const url = `${urlData.publicUrl}?v=${Date.now()}`;
    const g = Array.isArray(profile.profile_gallery)
      ? profile.profile_gallery.slice()
      : [];
    g[gallerySlot] = url;
    profile.profile_gallery = g;
    await persistGallery();
    galleryRender();
    say("Foto showcase diperbarui.", true);
  }

  /* player card + cover + extra stat tiles (redesign) */
  function syncCard() {
    if (!profile) return;
    const set = (id, value) => {
      const el = $(id);
      if (el && el.textContent !== value) el.textContent = value;
    };
    const label = profile.username || user?.email?.split("@")[0] || "member";
    const name = profile.full_name || label;
    const gameRoles = { jungler: "JUNGLER", gold: "GOLD", exp: "EXP", roam: "ROAM", mid: "MID" };
    const ranks = {
      tamu: "TAMU", calon_member: "CALON MEMBER", member: "MEMBER", leader_squad: "LEADER SQUAD",
      admin: "ADMIN", developer: "DEVELOPER", owner: "OWNER",
    };
    set("cardName", name);
    set("cardRank", ranks[profile.role] || "TAMU");
    set("cardHero", profile.main_hero || "—");
    set("cardGameRole", gameRoles[profile.game_role] || "—");
    set("sHero", profile.main_hero || "—");
    const since = profile.created_at
      ? new Date(profile.created_at).toLocaleDateString("id-ID", { month: "short", year: "numeric" })
      : "—";
    set("cardSince", since);
    const showcaseCount = (Array.isArray(profile.profile_gallery) ? profile.profile_gallery.filter(Boolean) : []).length;
    set("cardShowcase", `${showcaseCount} / 3`);
    set("sShowcase", `${showcaseCount} / 3`);
    // Stable short card number derived from the user id.
    const id = String(profile.id || user?.id || "");
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 10000;
    set("cardNo", "#" + String(h).padStart(4, "0"));
    set("cardInitial", name.charAt(0).toUpperCase());
    renderAlbum();
    const gallery = Array.isArray(profile.profile_gallery) ? profile.profile_gallery.filter(Boolean) : [];
    const coverSrc = gallery[0] || profile.avatar_url || "";
    const cover = $("coverImage");
    if (cover) cover.style.backgroundImage = coverSrc ? `url("${String(coverSrc).replace(/["\\]/g, "")}")` : "";
    document.body.classList.toggle("is-developer-profile", ["developer", "owner"].includes(profile.role));
    // Panel shortcuts: Leader Panel for Leader Squad and above, Admin Panel for Admin and above.
    // (Only a shortcut — each panel checks access again on its own and server-side.)
    const myRoles = [...(Array.isArray(profile.roles) ? profile.roles : []), profile.role].map((r) => String(r || "").toLowerCase());
    const isAdmin = myRoles.some((r) => ["admin", "developer", "owner"].includes(r));
    const isLeader = isAdmin || myRoles.includes("leader_squad");
    if ($("adminPanelLink")) $("adminPanelLink").hidden = !isAdmin;
    if ($("leaderPanelLink")) $("leaderPanelLink").hidden = !isLeader;
    if ($("profilePanels")) $("profilePanels").hidden = !isLeader;
  }


  /* ML ID / server: private by default, revealed with the eye button */
  let mlRevealed = false;
  const maskId = (v) => {
    const t = String(v || "");
    return t.length <= 3 ? "•".repeat(t.length) : "•".repeat(Math.max(4, t.length - 3)) + t.slice(-3);
  };
  function renderMl() {
    const el = $("vMl");
    if (!el) return;
    if (!profile?.ml_id) {
      el.textContent = "—";
      return;
    }
    el.textContent = mlRevealed
      ? `${profile.ml_id} (${profile.ml_server || "—"})`
      : `${maskId(profile.ml_id)} (${"•".repeat(Math.max(3, String(profile.ml_server || "").length))})`;
    el.classList.toggle("is-masked", !mlRevealed);
  }
  $("toggleMl")?.addEventListener("click", () => {
    mlRevealed = !mlRevealed;
    const b = $("toggleMl");
    b.setAttribute("aria-pressed", String(mlRevealed));
    b.setAttribute("aria-label", mlRevealed ? "Sembunyikan ML ID dan server" : "Tampilkan ML ID dan server");
    renderMl();
  });

  /* presence popup (✎ on the presence chip) — drives the hidden #presenceMode select */
  const presenceMenu = $("presenceMenu");
  const presenceEdit = $("presenceEdit");
  const syncPresenceMenu = () =>
    presenceMenu?.querySelectorAll("[data-mode]").forEach((b) =>
      b.setAttribute("aria-checked", String(b.dataset.mode === $("presenceMode").value)),
    );
  const closePresence = (focusButton = false) => {
    if (!presenceMenu || presenceMenu.hidden) return;
    presenceMenu.hidden = true;
    presenceEdit.setAttribute("aria-expanded", "false");
    if (focusButton) presenceEdit.focus();
  };
  presenceEdit?.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = presenceMenu.hidden;
    if (!open) return closePresence();
    syncPresenceMenu();
    presenceMenu.hidden = false;
    presenceEdit.setAttribute("aria-expanded", "true");
    (presenceMenu.querySelector('[aria-checked="true"]') || presenceMenu.querySelector("[data-mode]")).focus();
  });
  presenceMenu?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mode]");
    if (!b) return;
    const select = $("presenceMode");
    if (select.value !== b.dataset.mode) {
      select.value = b.dataset.mode;
      select.dispatchEvent(new Event("change"));
    }
    syncPresenceMenu();
    closePresence(true);
  });
  presenceMenu?.addEventListener("keydown", (e) => {
    const items = [...presenceMenu.querySelectorAll("[data-mode]")];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (presenceMenu && !presenceMenu.hidden && !e.target.closest("#presenceChip")) closePresence();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePresence(true);
  });

  /* player card album: avatar + showcase photos, carousel on the card + full-size lightbox */
  let album = [];
  let albumKey = "";
  let albumIndex = 0;
  let albumTimer = null;
  const albumReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function renderAlbum() {
    const gallery = Array.isArray(profile?.profile_gallery) ? profile.profile_gallery.filter(Boolean) : [];
    const list = [profile?.avatar_url, ...gallery].filter(Boolean);
    const key = list.join("|");
    if (key === albumKey) return;
    albumKey = key;
    album = list;
    albumIndex = Math.min(albumIndex, Math.max(0, list.length - 1));
    const track = $("cardAlbum");
    const dots = $("cardDots");
    const photo = $("cardPhoto");
    if (!track || !dots || !photo) return;
    track.replaceChildren(
      ...list.map((src, i) => {
        const slide = document.createElement("button");
        slide.type = "button";
        slide.className = "card-slide";
        slide.style.backgroundImage = `url("${String(src).replace(/["\\]/g, "")}")`;
        slide.setAttribute("aria-label", `Buka foto album ${i + 1} dari ${list.length}`);
        slide.addEventListener("click", () => openAlbum(i));
        return slide;
      }),
    );
    dots.replaceChildren(...list.map(() => document.createElement("i")));
    photo.classList.toggle("has-photo", list.length > 0);
    photo.classList.toggle("has-album", list.length > 1);
    showSlide(albumIndex);
    restartAlbumTimer();
  }
  function showSlide(i) {
    if (!album.length) return;
    albumIndex = (i + album.length) % album.length;
    $("cardAlbum").querySelectorAll(".card-slide").forEach((s, n) => {
      s.classList.toggle("is-current", n === albumIndex);
      s.tabIndex = n === albumIndex ? 0 : -1;
    });
    $("cardDots").querySelectorAll("i").forEach((d, n) => d.classList.toggle("is-current", n === albumIndex));
    $("cardCount").dataset.count = album.length > 1 ? `${albumIndex + 1}/${album.length}` : "";
  }
  function restartAlbumTimer() {
    clearInterval(albumTimer);
    if (albumReduced || album.length < 2) return;
    albumTimer = setInterval(() => {
      if (!$("cardPhoto").matches(":hover") && $("albumLightbox").hidden) showSlide(albumIndex + 1);
    }, 4500);
  }
  $("cardPrev")?.addEventListener("click", () => { showSlide(albumIndex - 1); restartAlbumTimer(); });
  $("cardNext")?.addEventListener("click", () => { showSlide(albumIndex + 1); restartAlbumTimer(); });
  // swipe on touch screens
  let swipeX = null;
  $("cardPhoto")?.addEventListener("pointerdown", (e) => { swipeX = e.clientX; }, { passive: true });
  $("cardPhoto")?.addEventListener("pointerup", (e) => {
    if (swipeX === null) return;
    const dx = e.clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) > 40) { showSlide(albumIndex + (dx < 0 ? 1 : -1)); restartAlbumTimer(); }
  });

  const lightbox = $("albumLightbox");
  let lastFocus = null;
  function paintLightbox() {
    const img = $("albumImage");
    img.src = album[albumIndex];
    img.alt = `Foto album ${albumIndex + 1} dari ${album.length}`;
    $("albumCounter").dataset.count = `${albumIndex + 1} / ${album.length}`;
    lightbox.classList.toggle("is-single", album.length < 2);
  }
  function openAlbum(i) {
    if (!album.length) return;
    lastFocus = document.activeElement;
    showSlide(i);
    paintLightbox();
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    $("albumClose").focus();
  }
  function closeAlbum() {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    document.body.style.overflow = "";
    lastFocus?.focus();
  }
  const stepAlbum = (d) => { showSlide(albumIndex + d); paintLightbox(); };
  $("albumClose")?.addEventListener("click", closeAlbum);
  $("albumPrev")?.addEventListener("click", () => stepAlbum(-1));
  $("albumNext")?.addEventListener("click", () => stepAlbum(1));
  lightbox?.addEventListener("click", (e) => { if (e.target === lightbox) closeAlbum(); });
  document.addEventListener("keydown", (e) => {
    if (lightbox.hidden) return;
    if (e.key === "Escape") closeAlbum();
    else if (e.key === "ArrowLeft") stepAlbum(-1);
    else if (e.key === "ArrowRight") stepAlbum(1);
  });

  /* view / edit switching */
  function fillForm() {
    const map = {
      fullName: "full_name",
      phone: "phone",
      mlId: "ml_id",
      mlServer: "ml_server",
      gender: "gender",
      birthDate: "birth_date",
    };
    for (const id in map) $(id).value = profile[map[id]] || "";
    $("mainHero").value = profile?.main_hero || "";
    $("favHeroes").value = Array.isArray(profile?.favorite_heroes)
      ? profile.favorite_heroes.filter(Boolean).join(", ")
      : "";
    $("gameRole").value = profile?.game_role || "";
  }
  function renderView() {
    $("vFullName").textContent = profile?.full_name || "—";
    $("vEmail").textContent = profile?.email || "—";
    $("vPhone").textContent = profile?.phone || "—";
    $("vGenderBirth").textContent =
      [profile?.gender, profile?.birth_date].filter(Boolean).join(" · ") || "—";
    renderMl();
    const heroes = [profile?.main_hero]
      .filter(Boolean)
      .concat(
        Array.isArray(profile?.favorite_heroes)
          ? profile.favorite_heroes.filter(Boolean)
          : [],
      );
    $("vHero").textContent = heroes.join(" · ") || "—";
    const roleLabels = {
      jungler: "JUNGLER",
      gold: "GOLD",
      exp: "EXP",
      roam: "ROAM",
      mid: "MID",
    };
    $("sRole").textContent = roleLabels[profile?.game_role] || "BELUM DIATUR";
    updateCompletion(profile);
    galleryRender();
    syncCard();
  }
  function loadStats() {
    $("sSince").textContent = profile?.created_at
      ? new Date(profile.created_at).toLocaleDateString("id-ID", {
          month: "short",
          year: "numeric",
        })
      : "—";
    const roleLabels = {
      jungler: "JUNGLER",
      gold: "GOLD",
      exp: "EXP",
      roam: "ROAM",
      mid: "MID",
    };
    $("sRole").textContent = roleLabels[profile?.game_role] || "BELUM DIATUR";
  }
  function switchView() {
    viewMode = false;
    $("profileView").hidden = false;
    $("profileForm").hidden = true;
    $("viewTitle").textContent = "PROFIL MEMBER.";
    $("viewDesc").textContent = "Ringkasan profil member F4NTASTIC.";
    renderView();
    loadStats();
  }
  function switchEdit() {
    viewMode = true;
    $("profileView").hidden = true;
    $("profileForm").hidden = false;
    $("viewTitle").textContent = "EDIT PROFIL.";
    $("viewDesc").textContent = "Perbarui informasi dan simpan perubahan.";
    fillForm();
  }

  async function loadProfile() {
    const {
      data: { session },
      error: sessionError,
    } = await db.auth.getSession();
    if (sessionError || !session?.user) {
      location.replace("login.html?next=profile.html");
      return;
    }
    user = session.user;
    let { data, error } = await db
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      say(`Gagal membaca profil: ${prettyError(error)}`);
      return;
    }
    profilePersisted = Boolean(data);
    profile = data || {
      id: user.id,
      email: user.email,
      username: user.user_metadata?.username || user.email?.split("@")[0],
      full_name: user.user_metadata?.full_name || "",
      role: "tamu",
      presence_mode: "auto",
      favorite_heroes: [],
      profile_gallery: [],
    };
    const label = profile.username || user.email?.split("@")[0] || "member",
      name = profile.full_name || label;
    $("profileName").textContent = name;
    $("profileHandle").textContent = `@${label}`;
    const roleNames = {
      tamu: "TAMU F4NTASTIC",
      calon_member: "CALON MEMBER F4NTASTIC",
      member: "MEMBER F4NTASTIC",
      leader_squad: "LEADER SQUAD F4NTASTIC",
      admin: "ADMIN F4NTASTIC",
      developer: "DEVELOPER F4NTASTIC",
      owner: "OWNER F4NTASTIC",
    };
    const role = roleNames[profile.role] || "TAMU F4NTASTIC";
    $("profileRole").textContent = role;
    $("profileRole").classList.toggle(
      "is-developer",
      ["developer", "owner"].includes(profile.role),
    );
    showAvatar(profile.avatar_url, name);
    $("presenceMode").value = profile.presence_mode || "auto";
    renderPresence(presenceState(profile));
    setCooldown();
    const complete = updateCompletion(profile);
    if (complete) switchView();
    else switchEdit();
    if ((profile.presence_mode || "auto") === "auto") {
      heartbeat();
      startHeartbeat();
    }
  }

  $("editProfile").addEventListener("click", () => switchEdit());
  $("cancelEdit").addEventListener("click", () => {
    if (!profilePersisted || !updateCompletion(profile)) {
      switchEdit();
      return;
    }
    switchView();
  });
  $("profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !user) return;
    const values = {
      full_name: $("fullName").value.trim(),
      phone: $("phone").value.trim(),
      ml_id: $("mlId").value.trim(),
      ml_server: $("mlServer").value.trim(),
      gender: $("gender").value,
      birth_date: $("birthDate").value,
    };
    if (Object.values(values).some((value) => !value))
      return say("Semua kolom bertanda * wajib diisi.");
    if (
      values.full_name.length > 100 ||
      values.phone.length > 24 ||
      values.ml_id.length > 30 ||
      values.ml_server.length > 12
    )
      return say("Ada data yang melebihi batas karakter.");
    if (new Date(values.birth_date + "T00:00:00") > new Date())
      return say("Tanggal lahir tidak boleh berada di masa depan.");
    const main_hero = $("mainHero").value.trim() || null;
    const favorite_heroes = $("favHeroes")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
    const game_role = $("gameRole").value || null;
    setBusy(true);
    try {
      const payload = {
        ...values,
        main_hero,
        favorite_heroes,
        game_role,
        id: user.id,
        email: user.email,
        username:
          profile?.username ||
          user.user_metadata?.username ||
          user.email.split("@")[0],
      };
      const { data, error } = await db
        .from("profiles")
        .upsert(payload, { onConflict: "id" })
        .select(PROFILE_COLS)
        .single();
      if (error) throw error;
      profile = data;
      profilePersisted = true;
      $("profileName").textContent = data.full_name;
      $("profileHandle").textContent = `@${data.username}`;
      say("Data diri berhasil disimpan.", true);
      switchView();
      const redirectTarget = new URLSearchParams(location.search).get(
        "redirect",
      );
      if (
        redirectTarget === "pengaduan.html" ||
        redirectTarget === "/pengaduan.html"
      )
        setTimeout(() => {
          location.href = "pengaduan.html";
        }, 700);
      try {
        localStorage.setItem(
          "f4ntastic-user",
          JSON.stringify({
            id: user.id,
            email: user.email,
            name: data.full_name,
            username: data.username,
            role: data.role,
            avatar_url: data.avatar_url,
            profileComplete: true,
          }),
        );
      } catch {}
    } catch (error) {
      say(`Gagal menyimpan data: ${prettyError(error)}`);
    } finally {
      setBusy(false);
    }
  });

  $("avatarFile").addEventListener("change", async () => {
    const file = $("avatarFile").files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      say("Format foto harus JPG, PNG, atau WebP.");
      $("avatarFile").value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      say("Ukuran foto maksimal 5 MB.");
      $("avatarFile").value = "";
      return;
    }
    if (!user || busy) return;
    if (!profilePersisted)
      return say(
        "Simpan DATA DIRI terlebih dahulu agar foto dapat ditautkan ke akun.",
      );
    const changedAt = profile?.avatar_updated_at
      ? new Date(profile.avatar_updated_at).getTime()
      : 0;
    if (changedAt && Date.now() < changedAt + 86400000) {
      setCooldown();
      return say("Foto profil masih dalam masa cooldown 24 jam.");
    }
    busy = true;
    const fileInput = $("avatarFile");
    $("saveProfile").disabled = true;
    say("Mengganti foto profil…");
    try {
      const extension =
        file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await db.storage
        .from("f4ntastic-avatars")
        .upload(path, file, {
          upsert: false,
          contentType: file.type,
          cacheControl: "3600",
        });
      if (uploadError) throw uploadError;
      const { data: urlData } = db.storage
        .from("f4ntastic-avatars")
        .getPublicUrl(path);
      const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`;
      const { data, error } = await db
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id)
        .select(PROFILE_COLS)
        .single();
      if (error) throw error;
      profile = { ...profile, ...data };
      showAvatar(data.avatar_url, data.full_name);
      setCooldown();
      say("Foto profil berhasil diperbarui.", true);
      try {
        localStorage.setItem(
          "f4ntastic-user",
          JSON.stringify({
            id: user.id,
            email: user.email,
            name: data.full_name,
            username: data.username,
            role: data.role,
            avatar_url: data.avatar_url,
            profileComplete: updateCompletion(data),
          }),
        );
      } catch {}
    } catch (error) {
      say(`Foto belum tersimpan: ${prettyError(error)}`);
    } finally {
      busy = false;
      fileInput.value = "";
      $("saveProfile").disabled = false;
    }
  });

  $("galleryFile").addEventListener("change", () => {
    const file = $("galleryFile").files?.[0];
    $("galleryFile").value = "";
    if (file) uploadGallery(file);
  });
  $("presenceMode").addEventListener("change", () =>
    setPresence($("presenceMode").value),
  );
  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      (profile?.presence_mode || "auto") === "auto"
    )
      heartbeat();
  });
  $("logout").addEventListener("click", async () => {
    const button = $("logout");
    button.disabled = true;
    button.textContent = "KELUAR…";
    stopHeartbeat();
    const { error } = await db.auth.signOut({ scope: "local" });
    if (error) {
      button.disabled = false;
      button.innerHTML =
        'GAGAL KELUAR — COBA LAGI <span aria-hidden="true">↗︎</span>';
      return;
    }
    try {
      localStorage.removeItem("f4ntastic-user");
      sessionStorage.removeItem("f4ntastic-user");
    } catch {}
    location.replace("index.html?logout=" + Date.now());
  });

  loadProfile().catch((error) =>
    say(`Profil gagal dimuat: ${prettyError(error)}`),
  );
})();
