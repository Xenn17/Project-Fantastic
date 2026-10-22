(() => {
  const db = window.supabase.createClient("https://uxkieyunztzhiwrocnei.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4a2lleXVuenR6aGl3cm9jbmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDQwODIsImV4cCI6MjEwNzg4MDA4Mn0.nlWhlGbagxwZ2-XeHEa195n5sQmRtXn3xutTISDXR70");
  const popup = (() => {
    let timer;
    let box = document.querySelector("#authPopup");
    if (!box) {
      box = document.createElement("div");
      box.id = "authPopup";
      box.className = "auth-popup";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      box.innerHTML = '<span class="auth-popup-icon" aria-hidden="true"></span><span class="auth-popup-text"></span><button type="button" aria-label="Tutup">×</button>';
      document.body.appendChild(box);
      box.querySelector("button").addEventListener("click", () => box.classList.remove("is-visible"));
    }
    return (text, ok = false) => {
      clearTimeout(timer);
      box.classList.toggle("is-success", ok);
      box.classList.toggle("is-error", !ok);
      box.querySelector(".auth-popup-icon").textContent = ok ? "✓" : "!";
      box.querySelector(".auth-popup-text").textContent = text;
      box.classList.add("is-visible");
      timer = setTimeout(() => box.classList.remove("is-visible"), 5200);
    };
  })();
  const msg = (el, text, ok = false) => { el.textContent = text; el.className = `auth-message ${ok ? "is-success" : "is-error"}`; popup(text, ok); };
  const readable = error => { const t = String(error?.message || error || ""); if (/network|fetch|load failed/i.test(t)) return "Koneksi bermasalah. Periksa internet lalu coba lagi."; if (/profiles|relation .* does not exist|schema cache/i.test(t)) return "Database belum siap. Jalankan supabase-auth.sql di Supabase SQL Editor."; if (/invalid login credentials/i.test(t)) return "Email/username atau password belum sesuai."; if (/email not confirmed/i.test(t)) return "Email belum diverifikasi. Cek inbox email kamu terlebih dahulu."; return "Terjadi kesalahan. Silakan coba lagi."; };
  const busy = (form, state, label) => { const button = form.querySelector('button[type="submit"]'); if (!button) return; button.disabled = state; button.innerHTML = state ? "MEMPROSES..." : `${label} <span>↗</span>`; };
  const register = document.querySelector("#registerForm");
  if (register) register.addEventListener("submit", async e => {
    e.preventDefault(); const name = register.querySelector("#registerUsername").value.trim(); const email = register.querySelector("#registerEmail").value.trim().toLowerCase(); const username = register.querySelector("#registerUsername").value.trim().toLowerCase(); const password = register.querySelector("#registerPassword").value; const confirm = register.querySelector("#registerPasswordConfirm").value; const out = register.querySelector("#registerMessage");
    if (!name || !email || !username || !password || !confirm) return msg(out, "Semua kolom wajib diisi.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return msg(out, "Format email belum valid.");
    if (!/^[a-z0-9._-]{3,24}$/.test(username)) return msg(out, "Username 3–24 karakter dan hanya boleh huruf kecil, angka, titik, garis bawah, atau strip.");
    if (password.length < 6) return msg(out, "Password minimal 6 karakter.");
    if (password !== confirm) return msg(out, "Ulangi password harus sama.");
    busy(register, true, "BUAT AKUN");
    try { const { data: exists, error: checkError } = await db.from("profiles").select("id").eq("username", username).maybeSingle(); if (checkError) throw checkError; if (exists) return msg(out, "Username sudah digunakan.");
    const { data, error } = await db.auth.signUp({ email, password, options: { data: { full_name: name, username } } }); if (error) return msg(out, error.message.includes("already registered") ? "Email sudah terdaftar." : readable(error)); if (!data.user) return msg(out, "Akun belum dapat dibuat. Coba lagi.");
    const { error: profileError } = await db.from("profiles").insert({ id: data.user.id, full_name: name, username, email }); if (profileError) return msg(out, "Akun dibuat, tetapi profil gagal disimpan. Jalankan supabase-auth.sql terlebih dahulu.");
    msg(out, "Akun berhasil dibuat. Cek email untuk verifikasi, lalu masuk.", true); register.reset(); } catch (error) { msg(out, readable(error)); } finally { busy(register, false, "BUAT AKUN"); }
  });
  const login = document.querySelector("#loginForm");
  if (login) login.addEventListener("submit", async e => {
    e.preventDefault(); const identity = login.querySelector("#loginIdentity").value.trim().toLowerCase(); const password = login.querySelector("#loginPassword").value; const out = login.querySelector("#loginMessage"); let email = identity;
    if (!identity || !password) return msg(out, "Email/username dan password wajib diisi."); busy(login, true, "MASUK KE COMMUNITY");
    try { if (!identity.includes("@")) { const { data: profile, error } = await db.from("profiles").select("email").eq("username", identity).maybeSingle(); if (error) throw error; if (!profile) return msg(out, "Username tidak ditemukan."); email = profile.email; }
    const { data, error } = await db.auth.signInWithPassword({ email, password }); if (error) return msg(out, readable(error));
    sessionStorage.setItem("f4ntastic-user", JSON.stringify({ id: data.user.id, email: data.user.email, name: data.user.user_metadata?.full_name || "Member" })); msg(out, "Login berhasil. Mengarahkan...", true); setTimeout(() => location.href = "index.html", 650); } catch (error) { msg(out, readable(error)); } finally { busy(login, false, "MASUK KE COMMUNITY"); }
  });
  document.querySelectorAll(".password-toggle").forEach(toggle => toggle.addEventListener("click", () => { const input = document.getElementById(toggle.dataset.target); const visible = input.type === "text"; input.type = visible ? "password" : "text"; toggle.classList.toggle("is-visible", !visible); toggle.setAttribute("aria-label", visible ? "Tampilkan password" : "Sembunyikan password"); }));
  const google = document.querySelector("#googleLogin");
  if (google) google.addEventListener("click", async () => { google.disabled = true; google.textContent = "MENGHUBUNGKAN..."; const { error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/index.html` } }); if (error) { google.disabled = false; google.innerHTML = '<span class="google-g">G</span> LOGIN DENGAN GOOGLE'; const out = document.querySelector("#loginMessage"); msg(out, readable(error)); } });
})();
