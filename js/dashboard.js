/* Member dashboard (dashboard.html) — Member and above only.
   Not logged in → login; Tamu / Calon Member → back to the home page.
   Menu tiles live in TILES below: add new features there ("soon: true" shows a "SEGERA HADIR" card). */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pad = (n) => String(n).padStart(2, "0");
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "")) ? String(u) : "");
  const MEMBER_UP = ["member", "leader_squad", "admin", "developer", "owner"];
  const ROLE_LABEL = { owner: "OWNER", developer: "DEVELOPER", admin: "ADMIN", leader_squad: "LEADER SQUAD", member: "MEMBER" };
  const ROLE_ORDER = ["owner", "developer", "admin", "leader_squad", "member"];
  const GAME_ROLE = { jungler: "JUNG", gold: "GOLD", exp: "EXP", roam: "ROAM", mid: "MID" };

  const ICON = {
    devisi: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    posko: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    profil: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/>',
    galeri: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    admin: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    event: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    info: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  };
  // `show(ctx)` decides visibility; `desc` may be a function of ctx.
  const TILES = [
    {
      key: "devisi", href: "devisi/", title: "Devisi", icon: "devisi", accent: true,
      desc: (c) => (c.isLeader ? "Lihat semua divisi, edit divisimu & kelola anggotanya." : "Lihat 41 divisi, anggota, dan divisi yang lagi rekrutmen."),
      tag: (c) => (c.isLeader ? "LEADER PANEL" : ""),
    },
    { key: "posko", href: "pengaduan.html", title: "Posko Pengaduan", icon: "posko", desc: "Laporkan masalah, toxic, atau penipuan secara aman ke admin." },
    { key: "profil", href: "profile.html", title: "Profil Saya", icon: "profil", desc: "Atur data diri, foto, status online, dan showcase." },
    { key: "galeri", href: "galeri.html", title: "Galeri", icon: "galeri", desc: "Momen, turnamen, dan album komunitas F4NTASTIC." },
    { key: "admin", href: "admin.html", title: "Admin Panel", icon: "admin", desc: "Pendaftaran, laporan, role & divisi.", show: (c) => c.isAdmin, tag: () => "ADMIN" },
    { key: "event", title: "Event & Turnamen", icon: "event", desc: "Jadwal scrim, turnamen internal, dan event komunitas.", soon: true },
    { key: "info", title: "Pengumuman", icon: "info", desc: "Info terbaru dari admin langsung di dashboard kamu.", soon: true },
  ];

  const db = window.getF4GalleryClient?.();
  const main = $("dashMain");

  function greeting() {
    const h = new Date().getHours();
    return h < 11 ? "Selamat pagi," : h < 15 ? "Selamat siang," : h < 18 ? "Selamat sore," : "Selamat malam,";
  }

  function renderTiles(ctx) {
    $("dashGrid").innerHTML = TILES.filter((t) => !t.show || t.show(ctx))
      .map((t) => {
        const desc = typeof t.desc === "function" ? t.desc(ctx) : t.desc;
        const tag = t.soon ? "SEGERA HADIR" : t.tag ? t.tag(ctx) : "";
        const inner = `
          <span class="dash-tile-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[t.icon] || ""}</svg></span>
          ${tag ? `<span class="dash-tile-tag">${esc(tag)}</span>` : ""}
          <strong>${esc(t.title)}</strong>
          <small>${esc(desc)}</small>
          ${t.soon ? "" : '<em aria-hidden="true">↗</em>'}`;
        return t.soon
          ? `<div class="dash-tile is-soon" aria-disabled="true">${inner}</div>`
          : `<a class="dash-tile${t.accent ? " is-accent" : ""}" href="${t.href}">${inner}</a>`;
      })
      .join("");
  }

  function renderDivision(entries) {
    const box = $("dashDivision");
    if (!entries.length) {
      box.hidden = false;
      box.innerHTML = `<div class="dash-division-empty"><strong>Kamu belum masuk divisi.</strong><span>Leader atau admin bisa memasukkan kamu ke salah satu dari 41 divisi.</span><a href="devisi/">LIHAT DIVISI YANG REKRUTMEN →</a></div>`;
      return;
    }
    const home = entries.find((e) => e.in_roster !== false) || entries[0];
    const led = entries.filter((e) => e.is_leader).map((e) => Number(e.division_id)).sort((a, b) => a - b);
    box.hidden = false;
    box.innerHTML = `
      <a class="dash-division-card" href="devisi/?id=${pad(home.division_id)}">
        <span class="dash-division-no">${pad(home.division_id)}</span>
        <span class="dash-division-copy">
          <small>DIVISIMU</small>
          <strong>F4NTASTIC DIV. ${pad(home.division_id)}</strong>
          <em>${led.length ? `Leader di ${led.map((n) => "DIV " + pad(n)).join(", ")}` : "Anggota divisi"}</em>
        </span>
        <span class="dash-division-go">BUKA DIVISI ↗</span>
      </a>`;
  }

  async function boot() {
    if (!db) return;
    const { data: { session } } = await db.auth.getSession();
    if (!session?.user) return location.replace("login.html?redirect=dashboard.html");
    const user = session.user;
    const { data: p } = await db
      .from("profiles")
      .select("username,full_name,avatar_url,role,roles,main_hero,game_role,created_at")
      .eq("id", user.id)
      .maybeSingle();
    const roles = [...new Set([...(Array.isArray(p?.roles) ? p.roles : []), p?.role].map((r) => String(r || "").toLowerCase()).filter(Boolean))];
    // dashboard is for Member and above only
    if (!roles.some((r) => MEMBER_UP.includes(r))) return location.replace("index.html");

    const ctx = {
      isAdmin: roles.some((r) => ["admin", "developer", "owner"].includes(r)),
      isLeader: roles.some((r) => ["leader_squad", "admin", "developer", "owner"].includes(r)),
    };
    const name = p?.full_name || p?.username || user.email?.split("@")[0] || "Member";
    $("dashGreeting").textContent = greeting();
    $("dashName").textContent = `${name}.`;
    $("dashHandle").textContent = p?.username ? "@" + p.username : name;
    const avatar = safeUrl(p?.avatar_url);
    $("dashAvatar").innerHTML = avatar ? `<img src="${esc(avatar)}" alt="">` : esc(name.charAt(0).toUpperCase());
    $("dashAvatar").querySelector("img")?.addEventListener("error", (e) => e.target.replaceWith(document.createTextNode(name.charAt(0).toUpperCase())));
    const since = p?.created_at ? new Date(p.created_at).toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : "";
    $("dashSub").textContent = since ? `Member F4NTASTIC sejak ${since}. Semua fitur member ada di sini.` : "Semua fitur member F4NTASTIC ada di sini.";
    $("dashBadges").innerHTML =
      ROLE_ORDER.filter((r) => roles.includes(r)).map((r) => `<b class="dash-badge is-${r}">${ROLE_LABEL[r]}</b>`).join("") +
      (GAME_ROLE[p?.game_role] ? `<b class="dash-badge is-game">${GAME_ROLE[p.game_role]}</b>` : "") +
      (p?.main_hero ? `<b class="dash-badge is-game">MAIN ${esc(String(p.main_hero).toUpperCase())}</b>` : "");
    renderTiles(ctx);

    // my division(s) — optional: hidden if the roster feature isn't set up yet
    try {
      const { data: roster, error } = await db.rpc("f4_division_roster");
      if (!error) renderDivision((roster || []).filter((r) => String(r.profile_id) === String(user.id)));
    } catch {}
    main.removeAttribute("aria-busy");
    main.classList.add("is-ready");
  }

  $("yearNow").textContent = new Date().getFullYear();
  boot().catch((e) => {
    console.error(e);
    renderTiles({ isAdmin: false, isLeader: false });
    main.classList.add("is-ready");
  });
})();
