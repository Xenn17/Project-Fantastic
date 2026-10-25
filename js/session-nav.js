(() => {
  const SUPABASE_URL = "https://uxkieyunztzhiwrocnei.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4a2lleXVuenR6aGl3cm9jbmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDQwODIsImV4cCI6MjEwNzg4MDA4Mn0.nlWhlGbagxwZ2-XeHEa195n5sQmRtXn3xutTISDXR70";
  const navLinks = [...document.querySelectorAll(".nav-login")];
  if (!navLinks.length || !window.supabase) return;
  const db = window.getF4GalleryClient ? window.getF4GalleryClient() : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.localStorage } });
  const safeText = (value, fallback) => typeof value === "string" && value.trim() ? value.trim() : fallback;
  const mobileNavQuery = window.matchMedia("(max-width: 780px)");
  let accountPlaceholder = null;
  function placeAccountForViewport() {
    const wrap = document.querySelector(".main-nav .nav-account");
    const nav = document.querySelector("#mainNav");
    if (!wrap || !nav) return;
    if (mobileNavQuery.matches) {
      // Account identity is the first item in the mobile menu, above page navigation.
      if (wrap.parentElement !== nav || nav.firstElementChild !== wrap) nav.insertBefore(wrap, nav.firstElementChild);
    } else if (accountPlaceholder && accountPlaceholder.parentNode === nav && wrap.nextSibling !== accountPlaceholder) {
      nav.insertBefore(wrap, accountPlaceholder);
    }
  }
  mobileNavQuery.addEventListener?.("change", placeAccountForViewport);
  const getProfile = async user => {
    const { data, error } = await db.from("profiles").select("username,full_name,role,avatar_url,phone,ml_id,ml_server,gender,birth_date").eq("id", user.id).maybeSingle();
    if (error) return null;
    return data;
  };
  function renderLoggedOut(link) {
    link.href = "login.html"; link.classList.remove("is-account-link"); link.innerHTML = '<span class="nav-login-icon" aria-hidden="true">↗</span><span>Masuk</span>'; link.setAttribute("aria-label", "Masuk ke akun F4NTASTIC");
    const wrap = link.closest(".nav-account"); if (wrap && wrap.parentNode) { wrap.parentNode.insertBefore(link, wrap); wrap.remove(); }
  }
  function renderLoggedIn(link, user, profile) {
    const label = safeText(profile?.username, safeText(user.user_metadata?.username, user.email?.split("@")[0] || "Member"));
    const name = safeText(profile?.full_name, safeText(user.user_metadata?.full_name, label));
    const normalizedRole = String(profile?.role || "member").toLowerCase();
    const roleLabels = { developer: "Developer F4NTASTIC", admin: "Admin F4NTASTIC", member: "Member F4NTASTIC" };
    const role = roleLabels[normalizedRole] || "Member F4NTASTIC";
    const avatar = profile?.avatar_url || "";
    try { localStorage.setItem("f4ntastic-user", JSON.stringify({ id: user.id, email: user.email, username: label, name, role: profile?.role || "member", avatar_url: avatar, profileComplete: Boolean(profile?.full_name && profile?.phone && profile?.ml_id && profile?.ml_server && profile?.gender && profile?.birth_date) })); } catch {}
    let wrap = link.closest(".nav-account");
    if (!wrap) {
      wrap = document.createElement("div"); wrap.className = "nav-account";
      accountPlaceholder = document.createComment("F4NTASTIC account nav position");
      link.parentNode.insertBefore(accountPlaceholder, link);
      link.parentNode.insertBefore(wrap, link); wrap.appendChild(link);
    }
    link.href = "profile.html"; link.classList.add("is-account-link"); link.innerHTML = `<span class="nav-avatar">${avatar ? `<img src="${avatar.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" alt="" loading="lazy">` : `<span>${name.charAt(0).toUpperCase()}</span>`}</span><span class="nav-account-copy"><strong>${escapeHTML(label)}</strong><small>${role}</small></span>`; link.setAttribute("aria-label", `Buka profil ${name}`);
    // Akun membuka profil langsung; jangan sisipkan tombol chevron/dropdown.
    const oldToggle = wrap.querySelector(".nav-account-toggle");
    if (oldToggle) oldToggle.remove();
  }
  function escapeHTML(value) { return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
  async function sync() {
    const { data: { session }, error } = await db.auth.getSession();
    if (error || !session?.user) { navLinks.forEach(renderLoggedOut); return; }
    const profile = await getProfile(session.user);
    navLinks.forEach(link => renderLoggedIn(link, session.user, profile));
  }
  sync();
  db.auth.onAuthStateChange((_event, session) => { if (session?.user) setTimeout(sync, 0); else navLinks.forEach(renderLoggedOut); });
  const toggle = document.querySelector("#menuToggle"); const mainNav = document.querySelector("#mainNav");
  if (toggle && mainNav) mainNav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => { if (window.matchMedia("(max-width: 780px)").matches) { mainNav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-label", "Buka navigasi"); } }));
})();
