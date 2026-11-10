(() => {
  // Site root resolved from this script's own URL (/js/session-nav.js → /), so links also work on
  // pages that live in a sub folder such as /devisi/.
  const ROOT = (() => {
    try { return new URL("../", document.currentScript.src).href; } catch { return ""; }
  })();
  const SUPABASE_URL = "https://uxkieyunztzhiwrocnei.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4a2lleXVuenR6aGl3cm9jbmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDQwODIsImV4cCI6MjEwNzg4MDA4Mn0.nlWhlGbagxwZ2-XeHEa195n5sQmRtXn3xutTISDXR70";
  const navLinks = [...document.querySelectorAll(".nav-login")];
  if (!navLinks.length || !window.supabase) return;

  // Fallback recovery: jika Supabase mengarahkan token reset ke Site URL,
  // pindahkan hash token ke halaman pembuatan password sebelum diproses.
  const recoveryHash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const recoveryQuery = new URLSearchParams(location.search);
  const isRecoveryLink =
    recoveryHash.get("type") === "recovery" ||
    recoveryQuery.get("type") === "recovery";
  if (isRecoveryLink && !location.pathname.endsWith("/reset-password.html")) {
    window.location.replace(
      `${ROOT}reset-password.html${location.search}${location.hash}`,
    );
    return;
  }
  const db = window.getF4GalleryClient
    ? window.getF4GalleryClient()
    : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
        },
      });
  const safeText = (value, fallback) =>
    typeof value === "string" && value.trim() ? value.trim() : fallback;
  const mobileNavQuery = window.matchMedia("(max-width: 780px)");
  let accountPlaceholder = null;
  function placeAccountForViewport() {
    const wrap = document.querySelector(".main-nav .nav-account");
    const nav = document.querySelector("#mainNav");
    if (!wrap || !nav) return;
    if (mobileNavQuery.matches) {
      // Account identity is the first item in the mobile menu, above page navigation.
      if (wrap.parentElement !== nav || nav.firstElementChild !== wrap)
        nav.insertBefore(wrap, nav.firstElementChild);
    } else if (
      accountPlaceholder &&
      accountPlaceholder.parentNode === nav &&
      wrap.nextSibling !== accountPlaceholder
    ) {
      nav.insertBefore(wrap, accountPlaceholder);
    }
  }
  mobileNavQuery.addEventListener?.("change", placeAccountForViewport);
  const getProfile = async (user) => {
    const { data, error } = await db
      .from("profiles")
      .select(
        "username,full_name,role,roles,avatar_url,phone,ml_id,ml_server,gender,birth_date,presence_mode,last_seen",
      )
      .eq("id", user.id)
      .maybeSingle();
    if (error) return null;
    return data;
  };
  function renderLoggedOut(link) {
    document.getElementById("f4ProfileNag")?.remove();
    link.href = ROOT + "login.html";
    link.classList.remove("is-account-link");
    link.innerHTML =
      '<span class="nav-login-icon" aria-hidden="true">↗︎</span><span>Masuk</span>';
    link.setAttribute("aria-label", "Masuk ke akun F4NTASTIC");
    const wrap = link.closest(".nav-account");
    if (wrap && wrap.parentNode) {
      wrap.parentNode.insertBefore(link, wrap);
      wrap.remove();
    }
  }
  // ---- profile completeness: 6 required fields (same as profile.js) ----
  const REQUIRED = ["full_name", "phone", "ml_id", "ml_server", "gender", "birth_date"];
  const isComplete = (p) => Boolean(p) && REQUIRED.every((k) => String(p[k] ?? "").trim());
  function showIncompleteBanner(show) {
    let bar = document.getElementById("f4ProfileNag");
    if (!show || /\/profile\.html$/.test(location.pathname)) {
      bar?.remove();
      return;
    }
    if (bar) return;
    if (!document.getElementById("f4ProfileNagStyle")) {
      const st = document.createElement("style");
      st.id = "f4ProfileNagStyle";
      st.textContent = `
        #f4ProfileNag{position:fixed;left:50%;bottom:18px;z-index:900;transform:translateX(-50%);display:flex;align-items:center;gap:12px;
          width:min(560px,calc(100vw - 28px));padding:12px 12px 12px 16px;border-radius:18px;color:#f5e9e6;font:600 13px/1.4 Manrope,system-ui,sans-serif;
          background:linear-gradient(120deg,rgba(120,34,24,.96),rgba(40,14,10,.96));border:1px solid rgba(239,138,124,.55);box-shadow:0 20px 50px -20px #000;
          animation:f4nag .6s cubic-bezier(.16,1,.3,1) both}
        #f4ProfileNag i{flex:none;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;font-style:normal;font-weight:900;color:#2a0b07;background:#ef8a7c}
        #f4ProfileNag span{flex:1;min-width:0}#f4ProfileNag b{display:block;font-size:13px;color:#fff}
        #f4ProfileNag a{flex:none;padding:9px 14px;border-radius:99px;font-size:11px;font-weight:800;letter-spacing:.1em;text-decoration:none;color:#2a0b07;background:#f6dd93}
        #f4ProfileNag button{flex:none;width:28px;height:28px;border:0;border-radius:50%;cursor:pointer;color:#f5e9e6;background:rgba(255,255,255,.08);font-size:16px;line-height:1}
        body.menu-open #f4ProfileNag{display:none}
        @keyframes f4nag{from{opacity:0;transform:translate(-50%,20px)}}
        @media(max-width:560px){#f4ProfileNag{bottom:calc(64px + env(safe-area-inset-bottom));font-size:12px}#f4ProfileNag small{display:none}}`;
      document.head.appendChild(st);
    }
    const here = location.pathname.replace(/^\//, "") + location.search;
    bar = document.createElement("div");
    bar.id = "f4ProfileNag";
    bar.setAttribute("role", "status");
    bar.innerHTML = `<i aria-hidden="true">!</i><span><b>Profil kamu belum lengkap</b><small>Devisi, Posko & Join Team terbuka setelah 6 data wajib diisi.</small></span><a href="${ROOT}profile.html?complete=1&redirect=${encodeURIComponent(here)}">LENGKAPI</a><button type="button" aria-label="Sembunyikan">×</button>`;
    bar.querySelector("button").onclick = () => bar.remove(); // hidden until the next page load
    document.body.appendChild(bar);
  }
  function renderLoggedIn(link, user, profile) {
    const label = safeText(
      profile?.username,
      safeText(
        user.user_metadata?.username,
        user.email?.split("@")[0] || "Member",
      ),
    );
    const name = safeText(
      profile?.full_name,
      safeText(user.user_metadata?.full_name, label),
    );
    const normalizedRole = String(profile?.role || "tamu").toLowerCase();
    const roleLabels = {
      tamu: "Tamu F4NTASTIC",
      calon_member: "Calon Member F4NTASTIC",
      member: "Member F4NTASTIC",
      leader_squad: "Leader Squad F4NTASTIC",
      admin: "Admin F4NTASTIC",
      developer: "Developer F4NTASTIC",
      owner: "Owner F4NTASTIC",
    };
    const role = roleLabels[normalizedRole] || "Tamu F4NTASTIC";
    const avatar = profile?.avatar_url || "";
    try {
      localStorage.setItem(
        "f4ntastic-user",
        JSON.stringify({
          id: user.id,
          email: user.email,
          username: label,
          name,
          role: profile?.role || "tamu",
          roles: Array.isArray(profile?.roles) ? profile.roles : [],
          avatar_url: avatar,
          profileComplete: Boolean(
            profile?.full_name &&
            profile?.phone &&
            profile?.ml_id &&
            profile?.ml_server &&
            profile?.gender &&
            profile?.birth_date,
          ),
        }),
      );
    } catch {}
    let wrap = link.closest(".nav-account");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "nav-account";
      accountPlaceholder = document.createComment(
        "F4NTASTIC account nav position",
      );
      link.parentNode.insertBefore(accountPlaceholder, link);
      link.parentNode.insertBefore(wrap, link);
      wrap.appendChild(link);
    }
    link.href = ROOT + "profile.html";
    const complete = isComplete(profile);
    window.f4ProfileStatus = { loggedIn: true, complete };
    document.dispatchEvent(new CustomEvent("f4:profile-status", { detail: window.f4ProfileStatus }));
    showIncompleteBanner(Boolean(profile) && !complete);
    link.classList.add("is-account-link");
    link.innerHTML = `<span class="nav-avatar">${avatar ? `<img src="${avatar.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" alt="" loading="lazy">` : `<span>${name.charAt(0).toUpperCase()}</span>`}</span><span class="nav-account-copy"><strong>${escapeHTML(label)}${profile && !isComplete(profile) ? ' <span class="profile-alert" title="Profil belum lengkap">●</span>' : ""}</strong><small>${role}</small></span>`;
    link.setAttribute("aria-label", `Buka profil ${name}`);
    // Akun membuka profil langsung; jangan sisipkan tombol chevron/dropdown.
    const oldToggle = wrap.querySelector(".nav-account-toggle");
    if (oldToggle) oldToggle.remove();
  }
  function escapeHTML(value) {
    return String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  }
  async function sync() {
    const {
      data: { session },
      error,
    } = await db.auth.getSession();
    if (error || !session?.user) {
      navLinks.forEach(renderLoggedOut);
      return;
    }
    const profile = await getProfile(session.user);
    navLinks.forEach((link) => renderLoggedIn(link, session.user, profile));
    if (profile && (profile.presence_mode || "auto") === "auto")
      db.from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", session.user.id);
  }
  sync();
  db.auth.onAuthStateChange((event, session) => {
    // Tautan reset password yang mendarat di halaman mana pun (mis. karena
    // Site URL) otomatis dipindahkan ke halaman pembuat password baru.
    if (event === "PASSWORD_RECOVERY") {
      window.location.replace(ROOT + "reset-password.html");
      return;
    }
    if (session?.user) setTimeout(sync, 0);
    else navLinks.forEach(renderLoggedOut);
  });
  const toggle = document.querySelector("#menuToggle");
  const mainNav = document.querySelector("#mainNav");
  if (toggle && mainNav)
    mainNav.querySelectorAll("a").forEach((link) =>
      link.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 780px)").matches) {
          mainNav.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
          toggle.setAttribute("aria-label", "Buka navigasi");
        }
      }),
    );
})();
