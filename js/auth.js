(() => {
  const SUPABASE_URL = "https://uxkieyunztzhiwrocnei.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4a2lleXVuenR6aGl3cm9jbmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDQwODIsImV4cCI6MjEwNzg4MDA4Mn0.nlWhlGbagxwZ2-XeHEa195n5sQmRtXn3xutTISDXR70";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.localStorage }
  });
  window.f4ntasticSupabase = db;
  const popup = (() => {
    let timer;
    let box = document.querySelector("#authPopup");
    if (!box) {
      box = document.createElement("div"); box.id = "authPopup"; box.className = "auth-popup";
      box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite");
      box.innerHTML = '<span class="auth-popup-icon" aria-hidden="true"></span><span class="auth-popup-text"></span><button type="button" aria-label="Tutup">×</button>';
      document.body.appendChild(box); box.querySelector("button").addEventListener("click", () => box.classList.remove("is-visible"));
    }
    return (text, ok = false) => { clearTimeout(timer); box.classList.toggle("is-success", ok); box.classList.toggle("is-error", !ok); box.querySelector(".auth-popup-icon").textContent = ok ? "✓" : "!"; box.querySelector(".auth-popup-text").textContent = text; box.classList.add("is-visible"); timer = setTimeout(() => box.classList.remove("is-visible"), 5200); };
  })();
  const msg = (el, text, ok = false) => { if (!el) return; el.textContent = text; el.className = `auth-message ${ok ? "is-success" : "is-error"}`; popup(text, ok); };
  const readable = error => {
    const t = String(error?.message || error || "");
    if (/network|fetch|load failed|failed to fetch/i.test(t)) return "Koneksi bermasalah. Periksa internet lalu coba lagi.";
    if (/profiles|relation .* does not exist|schema cache|function .* does not exist/i.test(t)) return "Database belum siap. Jalankan supabase-auth.sql di Supabase SQL Editor.";
    if (/invalid login credentials/i.test(t)) return "Email/username atau password belum sesuai.";
    if (/email not confirmed/i.test(t)) return "Email belum diverifikasi. Cek inbox email kamu terlebih dahulu.";
    if (/already registered|already exists/i.test(t)) return "Email atau username sudah digunakan.";
    return t || "Terjadi kesalahan. Silakan coba lagi.";
  };
  const busy = (form, state, label) => { const button = form.querySelector('button[type="submit"]'); if (!button) return; button.disabled = state; button.innerHTML = state ? "MEMPROSES..." : `${label} <span>↗</span>`; };
  const saveDisplayUser = async authUser => {
    const { data: profile } = await db.from("profiles").select("username,full_name,role,avatar_url,phone,ml_id,ml_server,gender,birth_date").eq("id", authUser.id).maybeSingle();
    const user = { id: authUser.id, email: authUser.email, name: profile?.full_name || authUser.user_metadata?.full_name || "Member", username: profile?.username || authUser.user_metadata?.username || authUser.email?.split("@")[0] || "member", role: profile?.role || "member", avatar_url: profile?.avatar_url || null, profileComplete: Boolean(profile?.full_name && profile?.phone && profile?.ml_id && profile?.ml_server && profile?.gender && profile?.birth_date) };
    try { localStorage.setItem("f4ntastic-user", JSON.stringify(user)); } catch {}
    return user;
  };
  const register = document.querySelector("#registerForm");
  if (register) register.addEventListener("submit", async e => {
    e.preventDefault();
    const name = register.querySelector("#registerUsername").value.trim();
    const email = register.querySelector("#registerEmail").value.trim().toLowerCase();
    const username = name.toLowerCase();
    const password = register.querySelector("#registerPassword").value;
    const confirm = register.querySelector("#registerPasswordConfirm").value;
    const out = register.querySelector("#registerMessage");
    if (!name || !email || !username || !password || !confirm) return msg(out, "Semua kolom wajib diisi.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return msg(out, "Format email belum valid.");
    if (!/^[a-z0-9._-]{3,24}$/.test(username)) return msg(out, "Username 3–24 karakter dan hanya boleh huruf kecil, angka, titik, garis bawah, atau strip.");
    if (password.length < 8) return msg(out, "Password minimal 8 karakter untuk keamanan akun.");
    if (password !== confirm) return msg(out, "Ulangi password harus sama.");
    busy(register, true, "BUAT AKUN");
    try {
      const { data: exists, error: checkError } = await db.rpc("f4_username_exists", { p_username: username });
      if (checkError) throw checkError;
      if (exists === true) return msg(out, "Username sudah digunakan.");
      const { data, error } = await db.auth.signUp({ email, password, options: { data: { full_name: name, username, role: "member" } } });
      if (error) return msg(out, readable(error));
      if (!data.user) return msg(out, "Akun belum dapat dibuat. Coba lagi.");
      msg(out, data.session ? "Akun berhasil dibuat. Menyiapkan profil..." : "Akun berhasil dibuat. Cek email untuk verifikasi, lalu masuk.", true);
      register.reset();
      if (data.session) { await saveDisplayUser(data.user); setTimeout(() => location.href = "index.html", 700); }
    } catch (error) { msg(out, readable(error)); }
    finally { busy(register, false, "BUAT AKUN"); }
  });
  const login = document.querySelector("#loginForm");
  if (login) login.addEventListener("submit", async e => {
    e.preventDefault(); const identity = login.querySelector("#loginIdentity").value.trim().toLowerCase(); const password = login.querySelector("#loginPassword").value; const out = login.querySelector("#loginMessage");
    if (!identity || !password) return msg(out, "Email/username dan password wajib diisi.");
    busy(login, true, "MASUK KE COMMUNITY");
    try {
      let email = identity;
      if (!identity.includes("@")) { const { data, error } = await db.rpc("f4_login_email_for_username", { p_username: identity }); if (error) throw error; if (!data) return msg(out, "Username tidak ditemukan."); email = data; }
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) return msg(out, readable(error));
      await saveDisplayUser(data.user); msg(out, "Login berhasil. Mengarahkan...", true); setTimeout(() => location.href = "index.html", 500);
    } catch (error) { msg(out, readable(error)); }
    finally { busy(login, false, "MASUK KE COMMUNITY"); }
  });
  document.querySelectorAll(".password-toggle").forEach(toggle => toggle.addEventListener("click", event => { event.preventDefault(); const input = document.getElementById(toggle.dataset.target); if (!input) return; const visible = input.type === "text"; input.type = visible ? "password" : "text"; toggle.classList.toggle("is-visible", !visible); toggle.setAttribute("aria-label", visible ? "Tampilkan password" : "Sembunyikan password"); }));
  const google = document.querySelector("#googleLogin");
  if (google) google.addEventListener("click", async () => { google.disabled = true; google.textContent = "MENGHUBUNGKAN..."; try { const { error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/index.html` } }); if (error) throw error; } catch (error) { google.disabled = false; google.innerHTML = '<span class="google-g">G</span> LOGIN DENGAN GOOGLE'; msg(document.querySelector("#loginMessage"), readable(error)); } });
})();
