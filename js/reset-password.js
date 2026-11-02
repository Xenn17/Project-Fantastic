(() => {
  const RESET_ENDPOINT = "https://uxkieyunztzhiwrocnei.supabase.co/functions/v1/password-reset";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4a2lleXVuenR6aGl3cm9jbmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDQwODIsImV4cCI6MjEwNzg4MDA4Mn0.nlWhlGbagxwZ2-XeHEa195n5sQmRtXn3xutTISDXR70";
  const form = document.querySelector("#resetPasswordForm");
  const message = document.querySelector("#resetMessage");
  const button = form.querySelector("button");
  const token = new URLSearchParams(location.search).get("token") || "";
  const say = (text, ok = false) => {
    message.className = `recovery-message ${ok ? "is-success" : "is-error"}`;
    message.textContent = text;
  };
  if (!token) {
    say("Tautan reset tidak valid. Minta tautan baru dari halaman Lupa Password.");
    form.querySelectorAll("input").forEach(input => { input.disabled = true; });
    button.disabled = true;
    return;
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const password = document.querySelector("#newPassword").value;
    const confirm = document.querySelector("#confirmPassword").value;
    if (password.length < 8) { say("Password minimal 8 karakter."); return; }
    if (password !== confirm) { say("Password tidak sama."); return; }
    button.disabled = true;
    button.firstChild.textContent = "MENYIMPAN...";
    try {
      const response = await fetch(RESET_ENDPOINT, {
        method: "POST",
        headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const map = {
          TOKEN_EXPIRED: "Tautan reset sudah kedaluwarsa. Minta tautan baru dari halaman Lupa Password.",
          TOKEN_USED: "Tautan ini sudah pernah dipakai. Minta tautan baru dari halaman Lupa Password.",
          INVALID_TOKEN: "Tautan reset tidak valid. Minta tautan baru dari halaman Lupa Password.",
          WEAK_PASSWORD: "Password minimal 8 karakter.",
        };
        say(map[data?.error] || data?.error || "Gagal menyimpan password. Coba lagi.");
        return;
      }
      say("Password berhasil diubah. Mengarahkan ke login...", true);
      setTimeout(() => { location.href = "login.html"; }, 1200);
    } catch (error) {
      say("Koneksi bermasalah. Periksa internet lalu coba lagi.");
    } finally {
      button.disabled = false;
      button.firstChild.textContent = "SIMPAN PASSWORD ";
    }
  });
})();
document.querySelectorAll('.password-toggle').forEach((toggle) => {
  toggle.addEventListener('click', () => {
    const input = document.getElementById(toggle.dataset.target);
    if (!input) return;
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    toggle.classList.toggle('is-visible', !visible);
    toggle.setAttribute('aria-label', visible ? 'Tampilkan password' : 'Sembunyikan password');
  });
});