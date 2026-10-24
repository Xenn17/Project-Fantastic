(() => {
  const SUPABASE_URL = "https://uxkieyunztzhiwrocnei.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4a2lleXVuenR6aGl3cm9jbmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDQwODIsImV4cCI6MjEwNzg4MDA4Mn0.nlWhlGbagxwZ2-XeHEa195n5sQmRtXn3xutTISDXR70";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.localStorage } });
  const $ = id => document.getElementById(id);
  const form = $("profileForm"), status = $("profileStatus"), avatarFile = $("avatarFile"), uploadButton = $("uploadAvatar"), cancelButton = $("cancelAvatar");
  const keys = ["full_name", "phone", "ml_id", "ml_server", "gender", "birth_date"];
  let user = null, profile = null, profilePersisted = false, selectedAvatar = null, avatarObjectUrl = null, busy = false;
  const say = (message, good = false) => { status.textContent = message; status.classList.toggle("is-error", !good); status.classList.toggle("is-success", good); };
  const prettyError = error => {
    const message = String(error?.message || error || "");
    if (/Avatar can only be changed once every 24 hours/i.test(message)) return "Foto profil hanya bisa diganti setiap 24 jam. Foto lama tetap digunakan.";
    if (/row-level security|permission denied|not allowed/i.test(message)) return "Akses database ditolak. Pastikan migrasi SQL dan kebijakan akses sudah diterapkan.";
    if (/network|fetch/i.test(message)) return "Koneksi gagal. Periksa internet lalu coba kembali.";
    if (/column .* does not exist|schema cache|relation .* does not exist/i.test(message)) return "Struktur database belum diperbarui. Jalankan supabase-auth.sql di Supabase SQL Editor.";
    return message || "Terjadi kesalahan. Coba kembali.";
  };
  function setBusy(state, button = $("saveProfile"), label = "SIMPAN DATA DIRI") { busy = state; button.disabled = state; button.dataset.originalLabel ||= label; button.innerHTML = state ? "MEMPROSES…" : `${button.dataset.originalLabel} <span aria-hidden="true">↗</span>`; }
  function showAvatar(url, name) { const avatar = $("avatar"); avatar.replaceChildren(); if (url) { const image = document.createElement("img"); image.src = url; image.alt = `Foto profil ${name || "member"}`; image.onerror = () => { avatar.textContent = (name || "F").charAt(0).toUpperCase(); }; avatar.appendChild(image); } else avatar.textContent = (name || "F").charAt(0).toUpperCase(); }
  function setCooldown() {
    const target = $("avatarCooldown"), changedAt = profile?.avatar_updated_at ? new Date(profile.avatar_updated_at).getTime() : 0, remaining = changedAt + 86400000 - Date.now();
    if (remaining > 0) { const hours = Math.floor(remaining / 3600000), minutes = Math.floor((remaining % 3600000) / 60000); target.textContent = `Foto dapat diganti lagi dalam ${hours} jam ${minutes} menit.`; uploadButton.disabled = true; }
    else { target.textContent = "Foto profil siap diperbarui. Batas cooldown: 24 jam sejak perubahan berhasil."; uploadButton.disabled = !selectedAvatar || busy; }
  }
  function updateCompletion(data) { const complete = keys.every(key => String(data?.[key] ?? "").trim()); $("completion").textContent = complete ? "PROFIL LENGKAP" : "BELUM LENGKAP"; $("completion").classList.toggle("is-incomplete", !complete); return complete; }
  async function loadProfile() {
    const { data: { session }, error: sessionError } = await db.auth.getSession();
    if (sessionError || !session?.user) { location.replace("login.html?next=profile.html"); return; }
    user = session.user;
    let { data, error } = await db.from("profiles").select("id,email,username,full_name,phone,ml_id,ml_server,gender,birth_date,role,avatar_url,avatar_updated_at").eq("id", user.id).maybeSingle();
    // Older projects may still have the original, smaller profiles table. Load
    // the available identity fields so the account page remains usable and
    // show the migration hint instead of failing during initial render.
    let needsMigration = false;
    if (error && /column .* does not exist|schema cache|relation .* does not exist/i.test(String(error.message || error))) {
      const fallback = await db.from("profiles").select("id,email,username,full_name,role").eq("id", user.id).maybeSingle();
      data = fallback.data; error = fallback.error; needsMigration = !fallback.error;
    }
    if (error) { $("accountStatus").textContent = "DATABASE BELUM SIAP"; say(`Gagal membaca profil: ${prettyError(error)}`); return; }
    profilePersisted = Boolean(data);
    profile = data || { id: user.id, email: user.email, username: user.user_metadata?.username || user.email?.split("@")[0], full_name: user.user_metadata?.full_name || "", role: "member" };
    const label = profile.username || user.email?.split("@")[0] || "member", name = profile.full_name || label;
    $("profileName").textContent = name; $("profileHandle").textContent = `@${label}`;
    const role = profile.role === "developer" ? "DEVELOPER F4NTASTIC" : profile.role === "admin" ? "ADMIN F4NTASTIC" : "MEMBER F4NTASTIC";
    $("profileRole").textContent = role; $("profileRole").classList.toggle("is-developer", profile.role === "developer"); showAvatar(profile.avatar_url, name); updateCompletion(profile);
    for (const id of ["fullName", "phone", "mlId", "mlServer", "gender", "birthDate"]) { const column = { fullName: "full_name", phone: "phone", mlId: "ml_id", mlServer: "ml_server", gender: "gender", birthDate: "birth_date" }[id]; $(id).value = profile[column] || ""; }
    $("accountStatus").textContent = "SESI AKTIF"; setCooldown();
    if (needsMigration) {
      $("accountStatus").textContent = "MIGRASI DIPERLUKAN";
      say("Profil terbaca, tetapi struktur database lama. Jalankan supabase-auth.sql di Supabase SQL Editor sebelum menyimpan data diri.");
    } else if (!data) say("Profil belum memiliki baris data. Simpan data diri untuk membuatnya.");
  }
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (busy || !user) return;
    const values = { full_name: $("fullName").value.trim(), phone: $("phone").value.trim(), ml_id: $("mlId").value.trim(), ml_server: $("mlServer").value.trim(), gender: $("gender").value, birth_date: $("birthDate").value };
    if (Object.values(values).some(value => !value)) return say("Semua kolom bertanda * wajib diisi.");
    if (values.full_name.length > 100 || values.phone.length > 24 || values.ml_id.length > 30 || values.ml_server.length > 12) return say("Ada data yang melebihi batas karakter.");
    if (new Date(values.birth_date + "T00:00:00") > new Date()) return say("Tanggal lahir tidak boleh berada di masa depan.");
    setBusy(true);
    try {
      const payload = { ...values, id: user.id, email: user.email, username: profile?.username || user.user_metadata?.username || user.email.split("@")[0], role: profile?.role || "member" };
      const { data, error } = await db.from("profiles").upsert(payload, { onConflict: "id" }).select("id,email,username,full_name,phone,ml_id,ml_server,gender,birth_date,role,avatar_url,avatar_updated_at").single();
      if (error) throw error;
      if (!data || data.id !== user.id || data.full_name !== values.full_name) throw new Error("Data belum terverifikasi setelah disimpan. Muat ulang dan periksa database.");
      profile = data; profilePersisted = true; $("profileName").textContent = data.full_name; $("profileHandle").textContent = `@${data.username}`; updateCompletion(data); say("Data diri berhasil disimpan dan diverifikasi.", true);
      try { localStorage.setItem("f4ntastic-user", JSON.stringify({ id: user.id, email: user.email, name: data.full_name, username: data.username, role: data.role, avatar_url: data.avatar_url, profileComplete: true })); } catch {}
    } catch (error) { say(`Gagal menyimpan data: ${prettyError(error)}`); }
    finally { setBusy(false); }
  });
  avatarFile.addEventListener("change", () => {
    const file = avatarFile.files?.[0]; if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { say("Format foto harus JPG, PNG, atau WebP."); avatarFile.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { say("Ukuran foto maksimal 5 MB."); avatarFile.value = ""; return; }
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl); selectedAvatar = file; avatarObjectUrl = URL.createObjectURL(file); showAvatar(avatarObjectUrl, profile?.full_name); cancelButton.hidden = false; uploadButton.disabled = false; say("Pratinjau foto siap. Tekan SIMPAN FOTO untuk mengunggah."); setCooldown();
  });
  cancelButton.addEventListener("click", () => { selectedAvatar = null; avatarFile.value = ""; if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl); avatarObjectUrl = null; cancelButton.hidden = true; showAvatar(profile?.avatar_url, profile?.full_name); setCooldown(); say("Pratinjau dibatalkan."); });
  uploadButton.addEventListener("click", async () => {
    if (!selectedAvatar || !user || busy) return;
    if (!profilePersisted) return say("Simpan DATA DIRI terlebih dahulu agar foto dapat ditautkan ke akun.");
    const changedAt = profile?.avatar_updated_at ? new Date(profile.avatar_updated_at).getTime() : 0;
    if (changedAt && Date.now() < changedAt + 86400000) { setCooldown(); return say("Foto profil masih dalam masa cooldown 24 jam."); }
    setBusy(true, uploadButton, "SIMPAN FOTO");
    try {
      const extension = selectedAvatar.type === "image/png" ? "png" : selectedAvatar.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await db.storage.from("f4ntastic-avatars").upload(path, selectedAvatar, { upsert: false, contentType: selectedAvatar.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data: urlData } = db.storage.from("f4ntastic-avatars").getPublicUrl(path);
      const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`;
      const { data, error } = await db.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id).select("id,avatar_url,avatar_updated_at,role,username,full_name,phone,ml_id,ml_server,gender,birth_date,email").single();
      if (error) throw error;
      if (!data?.avatar_url) throw new Error("Foto terunggah, tetapi tautan profil belum terverifikasi.");
      profile = { ...profile, ...data }; showAvatar(data.avatar_url, data.full_name); selectedAvatar = null; avatarFile.value = ""; if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl); avatarObjectUrl = null; cancelButton.hidden = true; say("Foto profil berhasil diperbarui.", true);
      try { localStorage.setItem("f4ntastic-user", JSON.stringify({ id: user.id, email: user.email, name: data.full_name, username: data.username, role: data.role, avatar_url: data.avatar_url, profileComplete: updateCompletion(data) })); } catch {}
    } catch (error) { say(`Foto belum tersimpan: ${prettyError(error)}`); }
    finally { setBusy(false, uploadButton, "SIMPAN FOTO"); setCooldown(); }
  });
  $("logout").addEventListener("click", async () => { const button = $("logout"); button.disabled = true; button.textContent = "KELUAR…"; const { error } = await db.auth.signOut({ scope: "local" }); if (error) { button.disabled = false; button.innerHTML = 'GAGAL KELUAR — COBA LAGI <span aria-hidden="true">↗</span>'; return; } try { localStorage.removeItem("f4ntastic-user"); sessionStorage.removeItem("f4ntastic-user"); } catch {} location.replace("index.html?logout=" + Date.now()); });
  loadProfile().catch(error => { $("accountStatus").textContent = "GAGAL MEMUAT"; say(`Profil gagal dimuat: ${prettyError(error)}`); });
  window.setInterval(setCooldown, 60000);
})();
