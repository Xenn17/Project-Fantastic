(() => {
  "use strict";
  const SUPABASE_URL = "https://uxkieyunztzhiwrocnei.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4a2lleXVuenR6aGl3cm9jbmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDQwODIsImV4cCI6MjEwNzg4MDA4Mn0.nlWhlGbagxwZ2-XeHEa195n5sQmRtXn3xutTISDXR70";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.localStorage } });
  const $ = id => document.getElementById(id);
  const keys = ["full_name", "phone", "ml_id", "ml_server", "gender", "birth_date"];
  const PROFILE_COLS = "id,email,username,full_name,phone,ml_id,ml_server,gender,birth_date,role,avatar_url,avatar_updated_at,presence_mode,last_seen,created_at,main_hero,favorite_heroes,profile_gallery,game_role";
  let user = null, profile = null, profilePersisted = false, busy = false, viewMode = false, gallerySlot = null, heartbeatTimer = null;
  const say = (message, good = false) => { const s = $("profileStatus"); s.textContent = message; s.classList.toggle("is-error", !good); s.classList.toggle("is-success", good); };
  const prettyError = error => {
    const message = String(error?.message || error || "");
    if (/Avatar can only be changed once every 24 hours/i.test(message)) return "Foto profil hanya bisa diganti setiap 24 jam. Foto lama tetap digunakan.";
    if (/row-level security|permission denied|not allowed/i.test(message)) return "Akses database ditolak. Pastikan migrasi SQL sudah diterapkan.";
    if (/network|fetch/i.test(message)) return "Koneksi gagal. Periksa internet lalu coba kembali.";
    if (/column .* does not exist|schema cache|relation .* does not exist/i.test(message)) return "Struktur database belum diperbarui. Jalankan SQL terbaru di Supabase SQL Editor.";
    return message || "Terjadi kesalahan. Coba kembali.";
  };
  function setBusy(state) { busy = state; const b = $("saveProfile"); b.disabled = state; b.innerHTML = state ? "MEMPROSES…" : "SIMPAN DATA DIRI <span aria-hidden=\"true\">↗</span>"; }
  function showAvatar(url, name) { const avatar = $("avatar"); avatar.replaceChildren(); if (url) { const image = document.createElement("img"); image.src = url; image.alt = `Foto profil ${name || "member"}`; image.onerror = () => { avatar.textContent = (name || "F").charAt(0).toUpperCase(); }; avatar.appendChild(image); } else avatar.textContent = (name || "F").charAt(0).toUpperCase(); }
  function updateCompletion(data) { return keys.every(key => String(data?.[key] ?? "").trim()); }
  function setCooldown() {
    const target = $("avatarCooldown"), changedAt = profile?.avatar_updated_at ? new Date(profile.avatar_updated_at).getTime() : 0, remaining = changedAt + 86400000 - Date.now();
    if (remaining > 0) { const hours = Math.floor(remaining / 3600000), minutes = Math.floor((remaining % 3600000) / 60000); target.textContent = `Ganti foto lagi dalam ${hours} jam ${minutes} menit.`; }
    else target.textContent = "Siap diganti. Batas cooldown: 24 jam.";
  }

  /* presence */
  function presenceState(p) {
    const mode = p?.presence_mode || "auto";
    if (mode === "busy") return "busy";
    if (mode === "offline") return "offline";
    const ls = p?.last_seen ? new Date(p.last_seen).getTime() : 0;
    return (Date.now() - ls < 5 * 60 * 1000) ? "online" : "offline";
  }
  function renderPresence(state) {
    const dot = $("avatarStatusDot"), label = $("presenceLabel"), lastSeen = $("presenceLastSeen");
    dot.className = "avatar-online-dot " + state;
    if (state === "online") { label.textContent = "ONLINE"; lastSeen.textContent = "Sedang membuka website."; }
    else if (state === "busy") { label.textContent = "SIBUK"; lastSeen.textContent = "Status disetel manual."; }
    else { label.textContent = "OFFLINE"; const ls = profile?.last_seen ? new Date(profile.last_seen) : null; lastSeen.textContent = ls ? "Terakhir terlihat " + ls.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Belum terlihat akhir-akhir ini."; }
  }
  async function heartbeat() { if (!user || !profile || profile.presence_mode !== "auto") return; const now = new Date().toISOString(); profile.last_seen = now; const { error } = await db.from("profiles").update({ last_seen: now }).eq("id", user.id); if (!error) renderPresence("online"); }
  async function setPresence(mode) {
    if (!user || !profile) return;
    const now = new Date().toISOString();
    const { error } = await db.from("profiles").update({ presence_mode: mode, last_seen: now }).eq("id", user.id);
    if (error) { say(`Status gagal disimpan: ${prettyError(error)}`); return; }
    profile.presence_mode = mode; profile.last_seen = now; renderPresence(presenceState(profile));
    if (mode === "auto") { heartbeat(); startHeartbeat(); } else stopHeartbeat();
  }
  function startHeartbeat() { stopHeartbeat(); heartbeatTimer = setInterval(() => { if (document.visibilityState === "visible") heartbeat(); }, 60000); }
  function stopHeartbeat() { if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; } }

  /* gallery showcase (max 3) */
  function galleryRender() {
    const grid = $("galleryGrid"); if (!grid) return;
    const g = Array.isArray(profile?.profile_gallery) ? profile.profile_gallery : [];
    grid.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const slot = document.createElement("div"); slot.className = "gallery-slot " + (g[i] ? "has-photo" : "is-empty");
      if (g[i]) {
        const img = document.createElement("img"); img.src = g[i]; img.alt = "Showcase profil " + (i + 1); img.loading = "lazy"; slot.append(img);
        const over = document.createElement("div"); over.className = "gallery-overlay";
        const cg = document.createElement("button"); cg.type = "button"; cg.textContent = "GANTI"; cg.addEventListener("click", () => { gallerySlot = i; $("galleryFile").click(); });
        const dl = document.createElement("button"); dl.type = "button"; dl.className = "gallery-del"; dl.textContent = "HAPUS"; dl.addEventListener("click", () => removeGallery(i));
        over.append(cg, dl); slot.append(over);
      } else {
        const add = document.createElement("button"); add.type = "button"; add.className = "gallery-add"; add.innerHTML = "＋<small>TAMBAH</small>"; add.addEventListener("click", () => { gallerySlot = i; $("galleryFile").click(); });
        slot.append(add);
      }
      grid.append(slot);
    }
  }
  async function persistGallery() { if (!user || !profile) return; const g = Array.isArray(profile.profile_gallery) ? profile.profile_gallery : []; await db.from("profiles").update({ profile_gallery: g }).eq("id", user.id); }
  async function removeGallery(i) { if (!user || !profile) return; const g = Array.isArray(profile.profile_gallery) ? profile.profile_gallery.slice() : []; g[i] = null; profile.profile_gallery = g; await persistGallery(); galleryRender(); }
  async function uploadGallery(file) {
    if (!file || gallerySlot == null || !user || !profile) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { say("Format foto harus JPG, PNG, atau WebP."); return; }
    if (file.size > 10 * 1024 * 1024) { say("Ukuran foto maksimal 10 MB."); return; }
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/showcase-${Date.now()}-${gallerySlot}.${ext}`;
    const { error: upErr } = await db.storage.from("f4ntastic-showcase").upload(path, file, { upsert: false, contentType: file.type, cacheControl: "3600" });
    if (upErr) { say("Gagal mengunggah foto: " + prettyError(upErr)); return; }
    const { data: urlData } = db.storage.from("f4ntastic-showcase").getPublicUrl(path);
    const url = `${urlData.publicUrl}?v=${Date.now()}`;
    const g = Array.isArray(profile.profile_gallery) ? profile.profile_gallery.slice() : [];
    g[gallerySlot] = url; profile.profile_gallery = g;
    await persistGallery(); galleryRender(); say("Foto showcase diperbarui.", true);
  }

  /* view / edit switching */
  function fillForm() {
    const map = { fullName: "full_name", phone: "phone", mlId: "ml_id", mlServer: "ml_server", gender: "gender", birthDate: "birth_date" };
    for (const id in map) $(id).value = profile[map[id]] || "";
    $("mainHero").value = profile?.main_hero || "";
    $("favHeroes").value = Array.isArray(profile?.favorite_heroes) ? profile.favorite_heroes.filter(Boolean).join(", ") : "";
    $("gameRole").value = profile?.game_role || "";
  }
  function renderView() {
    $("vFullName").textContent = profile?.full_name || "—";
    $("vEmail").textContent = profile?.email || "—";
    $("vPhone").textContent = profile?.phone || "—";
    $("vGenderBirth").textContent = [profile?.gender, profile?.birth_date].filter(Boolean).join(" · ") || "—";
    $("vMl").textContent = profile?.ml_id ? `${profile.ml_id} (${profile.ml_server || "—"})` : "—";
    const heroes = [profile?.main_hero].filter(Boolean).concat(Array.isArray(profile?.favorite_heroes) ? profile.favorite_heroes.filter(Boolean) : []);
    $("vHero").textContent = heroes.join(" · ") || "—";
    const roleLabels = { jungler: "JUNGLER", gold: "GOLD", exp: "EXP", roam: "ROAM", mid: "MID" };
    $("sRole").textContent = roleLabels[profile?.game_role] || "BELUM DIATUR";
    updateCompletion(profile); galleryRender();
  }
  function loadStats() {
    $("sSince").textContent = profile?.created_at ? new Date(profile.created_at).toLocaleDateString("id-ID", { month: "short", year: "numeric" }) : "—";
    const roleLabels = { jungler: "JUNGLER", gold: "GOLD", exp: "EXP", roam: "ROAM", mid: "MID" };
    $("sRole").textContent = roleLabels[profile?.game_role] || "BELUM DIATUR";
  }
  function switchView() { viewMode = false; $("profileView").hidden = false; $("profileForm").hidden = true; $("viewTitle").textContent = "PROFIL MEMBER."; $("viewDesc").textContent = "Ringkasan profil member F4NTASTIC."; renderView(); loadStats(); }
  function switchEdit() { viewMode = true; $("profileView").hidden = true; $("profileForm").hidden = false; $("viewTitle").textContent = "EDIT PROFIL."; $("viewDesc").textContent = "Perbarui informasi dan simpan perubahan."; fillForm(); }

  async function loadProfile() {
    const { data: { session }, error: sessionError } = await db.auth.getSession();
    if (sessionError || !session?.user) { location.replace("login.html?next=profile.html"); return; }
    user = session.user;
    let { data, error } = await db.from("profiles").select(PROFILE_COLS).eq("id", user.id).maybeSingle();
    if (error) { say(`Gagal membaca profil: ${prettyError(error)}`); return; }
    profilePersisted = Boolean(data);
    profile = data || { id: user.id, email: user.email, username: user.user_metadata?.username || user.email?.split("@")[0], full_name: user.user_metadata?.full_name || "", role: "member", presence_mode: "auto", favorite_heroes: [], profile_gallery: [] };
    const label = profile.username || user.email?.split("@")[0] || "member", name = profile.full_name || label;
    $("profileName").textContent = name; $("profileHandle").textContent = `@${label}`;
    const role = profile.role === "developer" ? "DEVELOPER F4NTASTIC" : profile.role === "admin" ? "ADMIN F4NTASTIC" : "MEMBER F4NTASTIC";
    $("profileRole").textContent = role; $("profileRole").classList.toggle("is-developer", profile.role === "developer");
    showAvatar(profile.avatar_url, name); $("presenceMode").value = profile.presence_mode || "auto"; renderPresence(presenceState(profile)); setCooldown();
    const complete = updateCompletion(profile);
    if (complete) switchView(); else switchEdit();
    if ((profile.presence_mode || "auto") === "auto") { heartbeat(); startHeartbeat(); }
  }

  $("editProfile").addEventListener("click", () => switchEdit());
  $("cancelEdit").addEventListener("click", () => { if (!profilePersisted || !updateCompletion(profile)) { switchEdit(); return; } switchView(); });
  $("profileForm").addEventListener("submit", async event => {
    event.preventDefault(); if (busy || !user) return;
    const values = { full_name: $("fullName").value.trim(), phone: $("phone").value.trim(), ml_id: $("mlId").value.trim(), ml_server: $("mlServer").value.trim(), gender: $("gender").value, birth_date: $("birthDate").value };
    if (Object.values(values).some(value => !value)) return say("Semua kolom bertanda * wajib diisi.");
    if (values.full_name.length > 100 || values.phone.length > 24 || values.ml_id.length > 30 || values.ml_server.length > 12) return say("Ada data yang melebihi batas karakter.");
    if (new Date(values.birth_date + "T00:00:00") > new Date()) return say("Tanggal lahir tidak boleh berada di masa depan.");
    const main_hero = $("mainHero").value.trim() || null;
    const favorite_heroes = $("favHeroes").value.split(",").map(s => s.trim()).filter(Boolean).slice(0, 8);
    const game_role = $("gameRole").value || null;
    setBusy(true);
    try {
      const payload = { ...values, main_hero, favorite_heroes, game_role, id: user.id, email: user.email, username: profile?.username || user.user_metadata?.username || user.email.split("@")[0] };
      const { data, error } = await db.from("profiles").upsert(payload, { onConflict: "id" }).select(PROFILE_COLS).single();
      if (error) throw error;
      profile = data; profilePersisted = true; $("profileName").textContent = data.full_name; $("profileHandle").textContent = `@${data.username}`;
      say("Data diri berhasil disimpan.", true); switchView();
      const redirectTarget = new URLSearchParams(location.search).get("redirect"); if (redirectTarget === "pengaduan.html" || redirectTarget === "/pengaduan.html") setTimeout(() => { location.href = "pengaduan.html"; }, 700);
      try { localStorage.setItem("f4ntastic-user", JSON.stringify({ id: user.id, email: user.email, name: data.full_name, username: data.username, role: data.role, avatar_url: data.avatar_url, profileComplete: true })); } catch {}
    } catch (error) { say(`Gagal menyimpan data: ${prettyError(error)}`); }
    finally { setBusy(false); }
  });

  $("avatarFile").addEventListener("change", async () => {
    const file = $("avatarFile").files?.[0]; if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { say("Format foto harus JPG, PNG, atau WebP."); $("avatarFile").value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { say("Ukuran foto maksimal 5 MB."); $("avatarFile").value = ""; return; }
    if (!user || busy) return;
    if (!profilePersisted) return say("Simpan DATA DIRI terlebih dahulu agar foto dapat ditautkan ke akun.");
    const changedAt = profile?.avatar_updated_at ? new Date(profile.avatar_updated_at).getTime() : 0;
    if (changedAt && Date.now() < changedAt + 86400000) { setCooldown(); return say("Foto profil masih dalam masa cooldown 24 jam."); }
    busy = true; const fileInput = $("avatarFile"); $("saveProfile").disabled = true; say("Mengganti foto profil…");
    try {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await db.storage.from("f4ntastic-avatars").upload(path, file, { upsert: false, contentType: file.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data: urlData } = db.storage.from("f4ntastic-avatars").getPublicUrl(path);
      const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`;
      const { data, error } = await db.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id).select(PROFILE_COLS).single();
      if (error) throw error;
      profile = { ...profile, ...data }; showAvatar(data.avatar_url, data.full_name); setCooldown(); say("Foto profil berhasil diperbarui.", true);
      try { localStorage.setItem("f4ntastic-user", JSON.stringify({ id: user.id, email: user.email, name: data.full_name, username: data.username, role: data.role, avatar_url: data.avatar_url, profileComplete: updateCompletion(data) })); } catch {}
    } catch (error) { say(`Foto belum tersimpan: ${prettyError(error)}`); }
    finally { busy = false; fileInput.value = ""; $("saveProfile").disabled = false; }
  });

  $("galleryFile").addEventListener("change", () => { const file = $("galleryFile").files?.[0]; $("galleryFile").value = ""; if (file) uploadGallery(file); });
  $("presenceMode").addEventListener("change", () => setPresence($("presenceMode").value));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && (profile?.presence_mode || "auto") === "auto") heartbeat(); });
  $("logout").addEventListener("click", async () => { const button = $("logout"); button.disabled = true; button.textContent = "KELUAR…"; stopHeartbeat(); const { error } = await db.auth.signOut({ scope: "local" }); if (error) { button.disabled = false; button.innerHTML = 'GAGAL KELUAR — COBA LAGI <span aria-hidden="true">↗</span>'; return; } try { localStorage.removeItem("f4ntastic-user"); sessionStorage.removeItem("f4ntastic-user"); } catch {} location.replace("index.html?logout=" + Date.now()); });

  loadProfile().catch(error => say(`Profil gagal dimuat: ${prettyError(error)}`));
})();