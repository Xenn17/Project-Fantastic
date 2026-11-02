(() => {
  const RESET_ENDPOINT = "https://uxkieyunztzhiwrocnei.supabase.co/functions/v1/password-reset";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4a2lleXVuenR6aGl3cm9jbmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDQwODIsImV4cCI6MjEwNzg4MDA4Mn0.nlWhlGbagxwZ2-XeHEa195n5sQmRtXn3xutTISDXR70";
  const form = document.querySelector("#forgotPasswordForm");
  const message = document.querySelector("#forgotMessage");
  const button = form.querySelector("button");
  const say = (text, ok = false) => {
    message.className = `recovery-message ${ok ? "is-success" : "is-error"}`;
    message.textContent = text;
  };
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const email = document.querySelector("#forgotEmail").value.trim().toLowerCase();
    if (!email) { say("Masukkan email terlebih dahulu."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say("Format email belum valid."); return; }
    button.disabled = true;
    button.firstChild.textContent = "MENGIRIM...";
    try {
      const response = await fetch(RESET_ENDPOINT, {
        method: "POST",
        headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        say(data?.error === "EMAIL_API_NOT_CONFIGURED"
          ? "Layanan email belum dikonfigurasi. Hubungi admin F4NTASTIC."
          : (data?.error || "Gagal mengirim tautan. Coba lagi."));
        return;
      }
      say("Jika email itu terdaftar, tautan reset akan dikirim. Periksa inbox, spam, dan tab promosi.", true);
      form.reset();
    } catch (error) {
      say("Koneksi bermasalah. Periksa internet lalu coba lagi.");
    } finally {
      button.disabled = false;
      button.firstChild.textContent = "KIRIM TAUTAN RESET ";
    }
  });
})();