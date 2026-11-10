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
  const ROLES = [
    {
      key: "owner",
      label: "Owner",
      rank: 6,
      desc: "Pemilik tertinggi komunitas.",
    },
    {
      key: "developer",
      label: "Developer",
      rank: 5,
      desc: "Mengembangkan sistem F4NTASTIC.",
    },
    {
      key: "admin",
      label: "Admin",
      rank: 4,
      desc: "Mengelola panel dan laporan.",
    },
    {
      key: "leader_squad",
      label: "Leader Squad",
      rank: 3,
      desc: "Memimpin squad komunitas.",
    },
    {
      key: "member",
      label: "Member",
      rank: 2,
      desc: "Anggota resmi F4NTASTIC.",
    },
    {
      key: "calon_member",
      label: "Calon Member",
      rank: 1,
      desc: "Kandidat anggota komunitas.",
    },
    {
      key: "tamu",
      label: "Tamu",
      rank: 0,
      desc: "Akun baru / belum menjadi member.",
    },
    {
      key: "ex_member",
      label: "Ex Member",
      rank: 0,
      desc: "Pernah dikeluarkan dari F4NTASTIC.",
    },
  ];
  const TIER = ["member", "calon_member", "tamu"],
    EXTRAS = ["owner", "developer", "admin", "leader_squad"];
  const ROLE_BY_KEY = Object.fromEntries(ROLES.map((role) => [role.key, role]));
  const esc = (value) =>
    String(value ?? "—").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const loginScreen = $("loginScreen"),
    dashboard = $("dashboard");
  let profiles = [],
    actor = null,
    actorMaxRank = -1,
    activeProfile = null,
    activeDetail = null,
    selectedTier = "member",
    saving = false,
    editorSelf = false;
  // Division data: membership (1 division per account) + leaderships (an account may lead several divisions)
  let divisions = [],
    membership = new Map(), // profile_id → division_id
    leaderBy = new Map(), // division_id → [profile_id, …] (max 2 leaders per division)
    rosterOk = false;
  const pad2 = (n) => String(n).padStart(2, "0");
  const divisionOf = (profile) => (membership.has(String(profile.id)) ? { division_id: membership.get(String(profile.id)) } : null);
  const MAX_LEADERS = 2;
  const leadersIds = (id) => leaderBy.get(id) || [];
  const ledBy = (profile) => [...leaderBy].filter(([, ids]) => ids.includes(String(profile.id))).map(([d]) => d).sort((a, b) => a - b);
  const divisionCount = (id) => {
    const set = new Set([...membership].filter(([, d]) => d === id).map(([pid]) => pid));
    leadersIds(id).forEach((pid) => set.add(pid));
    return set.size;
  };
  const leadersOf = (id) => leadersIds(id).map((pid) => profiles.find((p) => String(p.id) === pid) || { id: pid, username: "?" });
  const handle = (p) => `@${p.username || p.full_name || "?"}`;
  const divisionChip = (profile) => {
    const r = divisionOf(profile),
      led = ledBy(profile);
    if (!r && !led.length) return '<span class="role-division-none">—</span>';
    return `${r ? `<span class="role-division-chip">DIV ${pad2(r.division_id)}</span>` : ""}${led.length ? ` <span class="role-division-chip is-leader">★ LEAD ${led.map(pad2).join(", ")}</span>` : ""}`;
  };
  async function loadRoster() {
    const [d, r, l] = await Promise.all([
      db.from("f4_divisions").select("id,capacity").order("id"),
      db.from("f4_division_roster").select("profile_id,division_id"),
      db.from("f4_division_leaders").select("division_id,profile_id"),
    ]);
    divisions = (d.data || []).map((x) => ({ id: Number(x.id), capacity: Number(x.capacity) || 25 }));
    if (!divisions.length) divisions = Array.from({ length: 41 }, (_, i) => ({ id: i + 1, capacity: 25 }));
    rosterOk = !r.error;
    if (r.error) console.warn("f4_division_roster belum ada — jalankan supabase-division-roster.sql", r.error);
    membership = new Map((r.data || []).map((x) => [String(x.profile_id), Number(x.division_id)]));
    leaderBy = new Map();
    (l.data || []).forEach((x) => {
      const k = Number(x.division_id);
      leaderBy.set(k, [...(leaderBy.get(k) || []), String(x.profile_id)]);
    });
  }
  const redirectToLogin = () =>
    window.location.replace("login.html?redirect=manage-role.html");
  const watchdog = setTimeout(() => {
    if (dashboard.hidden) redirectToLogin();
  }, 8000);
  const rolesOf = (profile) => [
    ...new Set(
      (Array.isArray(profile.roles) && profile.roles.length
        ? profile.roles
        : [profile.role || "tamu"]
      )
        .map(String)
        .map((role) => role.toLowerCase()),
    ),
  ];
  const maxRank = (roles) =>
    Math.max(-1, ...roles.map((role) => ROLE_BY_KEY[role]?.rank ?? -1));
  const roleList = (roles) =>
    [...roles].sort(
      (a, b) => (ROLE_BY_KEY[b]?.rank ?? -1) - (ROLE_BY_KEY[a]?.rank ?? -1),
    );
  const say = (text, ok = false) => {
    const el = $("roleStatus");
    el.textContent = text;
    el.className = `role-status-message ${ok ? "is-success" : "is-error"}`;
  };
  const editorSay = (text) => {
    $("roleEditorStatus").textContent = text || "";
  };
  const prettyError = (error) => {
    const message = String(error?.message || error || "");
    if (
      /Hanya admin|Role cannot|role akun|permission denied|row-level security|not allowed/i.test(
        message,
      )
    )
      return "Akses ditolak. Pastikan migrasi supabase-multi-role.sql sudah dijalankan.";
    if (/role sendiri/i.test(message))
      return "Kamu tidak bisa mengubah role akunmu sendiri.";
    if (/Role tujuan|terlalu tinggi|lebih tinggi/i.test(message))
      return "Role tujuan atau akun tersebut berada di atas wewenangmu.";
    if (/Role tidak dikenal/i.test(message))
      return "Role yang dipilih tidak dikenal.";
    return message || "Terjadi kesalahan. Coba lagi.";
  };

  async function requireManager() {
    try {
      const {
        data: { session },
        error,
      } = await db.auth.getSession();
      if (error || !session?.user) {
        redirectToLogin();
        return false;
      }
      const [{ data: profile }, { data: manager }] = await Promise.all([
        db
          .from("profiles")
          .select("role,roles")
          .eq("id", session.user.id)
          .maybeSingle(),
        db
          .from("gallery_managers")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle(),
      ]);
      const profileRoles = profile ? rolesOf(profile) : [],
        managerRole = String(manager?.role || "").toLowerCase();
      if (
        !profileRoles.some((role) =>
          ["admin", "developer", "owner"].includes(role),
        ) &&
        !["admin", "developer", "owner"].includes(managerRole)
      ) {
        // Leader Squad manages their division on /devisi
        if (profileRoles.includes("leader_squad")) {
          window.location.replace("devisi/");
          return false;
        }
        redirectToLogin();
        return false;
      }
      actor = session.user;
      actorMaxRank = Math.max(
        maxRank(profileRoles),
        ROLE_BY_KEY[managerRole]?.rank ?? -1,
      );
      return true;
    } catch (error) {
      console.error(error);
      redirectToLogin();
      return false;
    }
  }
  // latest expulsion per account (f4_account_actions, staff only)
  let expelled = new Map();
  async function loadExpulsions() {
    const { data, error } = await db
      .from("f4_account_actions")
      .select("target_id,created_at,reason,actor_username,member_division,led_divisions")
      .eq("action", "expel")
      .order("created_at", { ascending: false });
    expelled = new Map();
    if (error) return console.warn("f4_account_actions belum ada — jalankan supabase-account-actions.sql", error);
    (data || []).forEach((r) => expelled.has(String(r.target_id)) || expelled.set(String(r.target_id), r));
  }
  const fmtDateTime = (v) =>
    v ? new Date(v).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  // server rule mirrored: staff, not yourself, and only accounts ranked BELOW your highest role
  const canManageAccount = (profile) =>
    Boolean(actor) && String(actor.id) !== String(profile.id) && maxRank(rolesOf(profile)) < actorMaxRank;
  const canExpel = (profile) =>
    canManageAccount(profile) &&
    (rolesOf(profile).some((r) => ["calon_member", "member", "leader_squad", "admin", "developer"].includes(r)) ||
      Boolean(divisionOf(profile)) ||
      ledBy(profile).length > 0);
  const nameOfProfile = (p) => p.full_name || p.username || "akun ini";
  async function expelAccount(profile) {
    const name = nameOfProfile(profile);
    const reason = prompt(`Keluarkan ${name} dari F4NTASTIC?\n\nAlasan (opsional, maks. 300 karakter):`, "");
    if (reason === null) return;
    if (
      !confirm(
        `Yakin keluarkan ${name}?\n\n• Dikeluarkan dari semua divisi (anggota & leader)\n• Role jadi Tamu + Ex Member\n• Tanggal dikeluarkan dicatat`,
      )
    )
      return;
    const { data, error } = await db.rpc("f4_expel_member", { p_target_id: profile.id, p_reason: reason.trim() || null });
    if (error) return say(actionError(error));
    closeAccountDetail();
    await load();
    say(`${name} dikeluarkan · ${fmtDateTime(data)}.`, true);
  }
  async function deleteAccount(profile) {
    const name = nameOfProfile(profile),
      handle = profile.username || "";
    if (!confirm(`HAPUS AKUN ${name} secara permanen?\n\nAkun login, profil, divisi, dan foto profilnya tidak bisa dikembalikan.`)) return;
    const typed = prompt(`Ketik username "${handle}" untuk konfirmasi:`, "");
    if (typed === null) return;
    if (typed.trim().replace(/^@/, "").toLowerCase() !== handle.toLowerCase()) return say("Username tidak cocok — akun tidak dihapus.");
    const { error } = await db.rpc("f4_delete_account", { p_target_id: profile.id, p_reason: null });
    if (error) return say(actionError(error));
    closeAccountDetail();
    await load();
    say(`Akun @${handle} sudah dihapus.`, true);
  }
  const actionError = (error) => {
    const msg = String(error?.message || error || "");
    if (/Could not find the function|does not exist|schema cache/i.test(msg))
      return "Fitur ini belum aktif — jalankan supabase-account-actions.sql di Supabase SQL Editor.";
    return msg || "Terjadi kesalahan. Coba lagi.";
  };
  async function load() {
    $("roleGroups").innerHTML = '<p class="empty">Mengambil data akun...</p>';
    const [{ data, error }] = await Promise.all([
      db
      .from("profiles")
      .select(
        "id,username,full_name,email,role,roles,avatar_url,phone,ml_id,ml_server,gender,birth_date,main_hero,game_role,profile_gallery,created_at,last_seen",
      )
      .order("created_at", { ascending: false }),
      loadRoster().catch((e) => console.warn(e)),
      loadExpulsions().catch((e) => console.warn(e)),
    ]);
    if (error) {
      $("roleGroups").innerHTML =
        `<p class="empty">Gagal memuat akun: ${esc(prettyError(error))}</p>`;
      return;
    }
    profiles = data || [];
    render();
  }
  function renderStats() {
    $("stat-total").textContent = profiles.length;
    ROLES.forEach((role) => {
      $("stat-" + role.key).textContent = profiles.filter((profile) =>
        rolesOf(profile).includes(role.key),
      ).length;
    });
  }
  function roleDesc(key) {
    return ROLE_BY_KEY[key]?.desc || "";
  }
  function chipHtml(key) {
    return `<span class="role-chip role-chip-${key}">${esc(ROLE_BY_KEY[key]?.label || key)}</span>`;
  }
  function render() {
    const query = ($("search").value || "").toLowerCase(),
      filter = $("filter").value;
    const filtered = profiles.filter(
      (profile) =>
        (!filter || rolesOf(profile).includes(filter)) &&
        [profile.username, profile.full_name, profile.email, divisionOf(profile) ? `div ${pad2(divisionOf(profile).division_id)}` : ""].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        ),
    );
    $("count").textContent = `${filtered.length} dari ${profiles.length} akun`;
    renderStats();
    const wrap = $("roleGroups");
    wrap.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Tidak ada akun yang cocok.";
      wrap.append(empty);
      return;
    }
    ROLES.forEach((role) => {
      const members = filtered.filter((profile) =>
        rolesOf(profile).includes(role.key),
      );
      if (!members.length) return;
      const group = document.createElement("section");
      group.className = `role-group role-${role.key}`;
      const head = document.createElement("div");
      head.className = "role-group-head";
      head.innerHTML = `<span class="role-label">${role.label} <small>${members.length}</small></span><span class="role-desc">${esc(roleDesc(role.key))}</span>`;
      group.append(head);
      const table = document.createElement("table");
      table.innerHTML =
        "<thead><tr><th>AKUN</th><th>EMAIL</th><th>ROLE</th><th>DIVISI</th><th>BERGABUNG</th><th>AKSI</th></tr></thead>";
      const body = document.createElement("tbody");
      members.forEach((profile) => body.append(buildRow(profile)));
      table.append(body);
      const scroller = document.createElement("div");
      scroller.className = "role-table-scroll";
      scroller.append(table);
      group.append(scroller);
      wrap.append(group);
    });
  }
  function buildRow(profile) {
    const tr = document.createElement("tr"),
      roles = roleList(rolesOf(profile)),
      isSelf = actor && String(actor.id) === String(profile.id),
      initial = String(profile.full_name || profile.username || "F")
        .charAt(0)
        .toUpperCase();
    const avatarHtml = profile.avatar_url
      ? `<img class="role-avatar-img" src="${esc(profile.avatar_url)}" alt="" loading="lazy">`
      : `<span class="role-avatar-letter">${esc(initial)}</span>`;
    tr.innerHTML = `<td><div class="role-account" tabindex="0" role="button" aria-label="Lihat data ${esc(profile.full_name || profile.username || "akun")}"><span class="role-avatar">${avatarHtml}</span><div><strong class="candidate-name">${esc(profile.full_name || profile.username || "Tanpa nama")}</strong><span class="ign">@ ${esc(profile.username || "—")}${isSelf ? " · KAMU" : ""}</span></div></div></td><td>${esc(profile.email || "—")}</td><td><div class="role-chip-list">${roles.map(chipHtml).join("")}</div></td><td>${divisionChip(profile)}</td><td>${profile.created_at ? new Date(profile.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td><td><div class="role-row-actions">${isSelf ? '<button class="save-role role-edit-button" type="button">ATUR DIVISI</button>' : '<button class="save-role role-edit-button" type="button">ATUR ROLE</button>'}${canExpel(profile) ? '<button class="role-danger role-expel-button" type="button">KELUARKAN</button>' : ""}${canManageAccount(profile) ? '<button class="role-danger is-solid role-delete-button" type="button" title="Hapus akun permanen">HAPUS AKUN</button>' : ""}</div>${expelled.has(String(profile.id)) && rolesOf(profile).includes("ex_member") ? `<small class="role-expelled-note">Dikeluarkan ${esc(fmtDateTime(expelled.get(String(profile.id)).created_at))}</small>` : ""}</td>`;
    const accountButton = tr.querySelector(".role-account");
    accountButton.addEventListener("click", () => openAccountDetail(profile));
    accountButton.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openAccountDetail(profile);
      }
    });
    const avatarImg = tr.querySelector(".role-avatar-img");
    if (avatarImg)
      avatarImg.addEventListener("error", () => {
        avatarImg.replaceWith(
          Object.assign(document.createElement("span"), {
            className: "role-avatar-letter",
            textContent: initial,
          }),
        );
      });
    tr.querySelector(".role-edit-button")?.addEventListener("click", () =>
      openEditor(profile),
    );
    tr.querySelector(".role-expel-button")?.addEventListener("click", () => expelAccount(profile));
    tr.querySelector(".role-delete-button")?.addEventListener("click", () => deleteAccount(profile));
    return tr;
  }
  function openAccountDetail(profile) {
    const roles = roleList(rolesOf(profile)),
      initial = String(profile.full_name || profile.username || "F")
        .charAt(0)
        .toUpperCase(),
      isSelf = actor && String(actor.id) === String(profile.id);
    activeDetail = profile;
    $("accountNumber").textContent =
      roles.map((key) => ROLE_BY_KEY[key].label).join(" + ") || "—";
    const avatar = $("accountAvatar");
    avatar.replaceChildren();
    if (profile.avatar_url) {
      const img = document.createElement("img");
      img.src = profile.avatar_url;
      img.alt = "";
      img.addEventListener("error", () => {
        img.replaceWith(
          Object.assign(document.createElement("span"), {
            textContent: initial,
          }),
        );
      });
      avatar.append(img);
    } else avatar.textContent = initial;
    $("accountName").textContent = profile.full_name || "Tanpa nama";
    $("accountHandle").textContent = "@" + (profile.username || "—");
    const rows = [
      ["NAMA LENGKAP", profile.full_name || "—"],
      ["USERNAME", profile.username ? "@" + profile.username : "—"],
      ["EMAIL", profile.email || "—"],
      ["TELEPON", profile.phone || "—"],
      [
        "MOBILE LEGENDS ID",
        profile.ml_id ? `${profile.ml_id} (${profile.ml_server || "—"})` : "—",
      ],
      ["MAIN HERO", profile.main_hero || "—"],
      [
        "DIVISI",
        [
          divisionOf(profile) ? `Anggota DIV ${pad2(divisionOf(profile).division_id)}` : "Belum di divisi",
          ledBy(profile).length ? `Leader DIV ${ledBy(profile).map(pad2).join(", ")}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      ],
      ...(expelled.has(String(profile.id))
        ? (() => {
            const x = expelled.get(String(profile.id));
            return [
              ["DIKELUARKAN", `${fmtDateTime(x.created_at)}${x.actor_username ? ` · oleh @${x.actor_username}` : ""}`],
              ["ALASAN DIKELUARKAN", x.reason || "—"],
              ["DIVISI SEBELUMNYA", [x.member_division ? `Anggota DIV ${pad2(x.member_division)}` : "", (x.led_divisions || []).length ? `Leader DIV ${x.led_divisions.map(pad2).join(", ")}` : ""].filter(Boolean).join(" · ") || "—"],
            ];
          })()
        : []),
      ["GENDER", profile.gender || "—"],
      [
        "TANGGAL LAHIR",
        profile.birth_date
          ? new Date(profile.birth_date).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "—",
      ],
      [
        "BERGABUNG",
        profile.created_at
          ? new Date(profile.created_at).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "—",
      ],
      [
        "TERAKHIR DILIHAT",
        profile.last_seen
          ? new Date(profile.last_seen).toLocaleString("id-ID", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
      ],
    ];
    const chips = `<div class="detail-grid-title">ROLE SAAT INI</div><div><small>STATUS</small><strong><span class="detail-role-chips">${roles.map(chipHtml).join("")}</span></strong></div>`;
    $("accountDetails").innerHTML =
      chips +
      rows
        .map(
          ([label, value]) =>
            `<div><small>${label}</small><strong>${esc(String(value))}</strong></div>`,
        )
        .join("");
    const showcase = $("accountShowcase");
    showcase.replaceChildren();
    const gallery = Array.isArray(profile.profile_gallery)
      ? profile.profile_gallery.filter(Boolean).slice(0, 3)
      : [];
    if (!gallery.length) {
      const empty = document.createElement("p");
      empty.className = "account-showcase-empty";
      empty.textContent = "Belum ada foto showcase.";
      showcase.append(empty);
    } else
      gallery.forEach((url, index) => {
        const link = document.createElement("a");
        link.className = "account-showcase-item";
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener";
        link.setAttribute("aria-label", `Buka showcase ${index + 1}`);
        const image = document.createElement("img");
        image.src = url;
        image.alt = `Showcase ${index + 1}`;
        image.loading = "lazy";
        image.onerror = () => link.remove();
        link.append(image);
        showcase.append(link);
      });
    $("accountExpel").hidden = !canExpel(profile);
    $("accountDelete").hidden = !canManageAccount(profile);
    $("accountEditRole").hidden = false;
    $("accountEditRole").textContent = isSelf ? "ATUR DIVISI" : "ATUR ROLE & DIVISI";
    $("accountOverlay").hidden = false;
  }
  let pickedLeads = new Set();
  function renderDivisionPicker(profile) {
    const cur = divisionOf(profile),
      sel = $("roleDivision"),
      grid = $("roleLeaderOf");
    sel.replaceChildren(new Option("— Tidak di divisi mana pun", ""));
    divisions.forEach((d) => {
      const n = divisionCount(d.id),
        mine = cur?.division_id === d.id || leadersIds(d.id).includes(String(profile.id)),
        full = !mine && n >= d.capacity,
        leads = leadersOf(d.id);
      const opt = new Option(
        `DIV ${pad2(d.id)} · ${n}/${d.capacity}${leads.length ? ` · Leader ${leads.map(handle).join(" & ")}` : " · belum ada leader"}${full ? " (PENUH)" : ""}`,
        String(d.id),
      );
      opt.disabled = full;
      sel.append(opt);
    });
    sel.value = cur ? String(cur.division_id) : "";
    pickedLeads = new Set(ledBy(profile));
    const drawGrid = () => {
      grid.replaceChildren(
        ...divisions.map((d) => {
          const b = document.createElement("button"),
            others = leadersOf(d.id).filter((p) => String(p.id) !== String(profile.id)),
            on = pickedLeads.has(d.id),
            slotsFull = others.length >= MAX_LEADERS;
          b.type = "button";
          b.className = `role-leader-pill${on ? " is-on" : ""}${others.length ? " has-other" : ""}${slotsFull && !on ? " is-full" : ""}`;
          b.textContent = pad2(d.id);
          b.disabled = !rosterOk || (slotsFull && !on);
          b.setAttribute("aria-pressed", String(on));
          b.title = slotsFull
            ? `DIV ${pad2(d.id)} — sudah 2 leader (${others.map(handle).join(" & ")}). Lepas salah satu dulu.`
            : others.length
              ? `DIV ${pad2(d.id)} — leader sekarang ${others.map(handle).join(" & ")} (masih bisa 1 lagi)`
              : `DIV ${pad2(d.id)} — belum ada leader`;
          b.onclick = () => {
            if (pickedLeads.has(d.id)) pickedLeads.delete(d.id);
            else pickedLeads.add(d.id);
            drawGrid();
            sync();
          };
          return b;
        }),
      );
    };
    const sync = () => {
      const shared = [...pickedLeads].filter((n) => leadersOf(n).some((p) => String(p.id) !== String(profile.id)));
      $("roleDivisionHint").textContent = !rosterOk
        ? "Fitur divisi belum aktif. Jalankan supabase-division-roster.sql di Supabase SQL Editor dulu."
        : shared.length
          ? `Leader bersama: ${shared.map((n) => `DIV ${pad2(n)} (dengan ${leadersOf(n).filter((p) => String(p.id) !== String(profile.id)).map(handle).join(" & ")})`).join(", ")}. Maks. 2 leader per divisi.`
          : (sel.value || pickedLeads.size) && !["member", "calon_member"].some((r) => rolesOf(profile).includes(r)) && !rolesOf(profile).some((r) => ["leader_squad", "admin", "developer", "owner"].includes(r))
            ? "Akun ini masih Tamu — ubah status jadi Member supaya bisa membuka halaman /devisi."
            : "Anggota: satu divisi saja. Leader: boleh memimpin beberapa divisi, dan 1 divisi boleh punya 2 leader.";
    };
    sel.disabled = !rosterOk;
    sel.onchange = sync;
    drawGrid();
    sync();
  }
  function openEditor(profile) {
    activeProfile = profile;
    editorSelf = Boolean(actor && String(actor.id) === String(profile.id));
    const roles = rolesOf(profile);
    selectedTier = roles.includes("member")
      ? "member"
      : roles.includes("calon_member")
        ? "calon_member"
        : "tamu";
    $("roleEditorTitle").textContent = editorSelf ? "ATUR DIVISI" : "ATUR ROLE & DIVISI";
    $("roleEditorMeta").textContent =
      `@${profile.username || "akun"} · ${profile.full_name || profile.email || ""}`;
    editorSay("");
    const tierWrap = $("roleTier");
    tierWrap.replaceChildren();
    TIER.forEach((key) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "role-tier-option";
      button.dataset.role = key;
      button.innerHTML = `<strong>${esc(ROLE_BY_KEY[key].label)}</strong><small>${esc(ROLE_BY_KEY[key].desc)}</small>`;
      button.disabled = editorSelf;
      button.addEventListener("click", () => {
        if (editorSelf) return;
        selectedTier = key;
        renderEditorOptions();
      });
      tierWrap.append(button);
    });
    renderEditorOptions();
    renderDivisionPicker(profile);
    $("roleOverlay").hidden = false;
  }
  function renderEditorOptions() {
    const roles = activeProfile ? rolesOf(activeProfile) : [],
      tierButtons = [...$("roleTier").querySelectorAll("button")];
    tierButtons.forEach((button) =>
      button.classList.toggle(
        "is-active",
        button.dataset.role === selectedTier,
      ),
    );
    const extra = $("roleExtra");
    extra.replaceChildren();
    EXTRAS.forEach((key) => {
      const role = ROLE_BY_KEY[key],
        label = document.createElement("label");
      label.className = "role-extra-card";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = key;
      input.checked = selectedTier === "member" && roles.includes(key);
      input.disabled = editorSelf || selectedTier !== "member" || role.rank > actorMaxRank;
      const copy = document.createElement("span");
      copy.innerHTML = `<strong>${role.label}</strong><small>${role.desc}</small>`;
      label.append(input, copy);
      extra.append(label);
    });
    $("roleEditorHint").textContent = editorSelf
      ? "Kamu tidak bisa mengubah role akunmu sendiri — hanya divisinya."
      : selectedTier === "member"
        ? "Peran tambahan boleh lebih dari satu. Semuanya otomatis tetap dihitung sebagai Member."
        : "Peran tambahan hanya tersedia setelah status keanggotaan menjadi Member.";
  }
  async function saveEditor() {
    if (!activeProfile || saving) return;
    const target = activeProfile;
    const selected = [
      selectedTier,
      ...(selectedTier === "tamu" && rolesOf(target).includes("ex_member") ? ["ex_member"] : []),
      ...[...$("roleExtra").querySelectorAll("input:checked")].map(
        (input) => input.value,
      ),
    ];
    const oldRoles = roleList(rolesOf(target)),
      newRoles = roleList(selected),
      rolesChanged = !editorSelf && oldRoles.join(",") !== newRoles.join(",");
    const cur = divisionOf(target),
      nextDiv = rosterOk && $("roleDivision").value ? Number($("roleDivision").value) : null,
      divChanged = rosterOk && (cur?.division_id || null) !== nextDiv,
      oldLeads = ledBy(target),
      addLeads = rosterOk ? [...pickedLeads].filter((n) => !oldLeads.includes(n)).sort((a, b) => a - b) : [],
      dropLeads = rosterOk ? oldLeads.filter((n) => !pickedLeads.has(n)) : [];
    if (!rolesChanged && !divChanged && !addLeads.length && !dropLeads.length) {
      closeEditor();
      return;
    }
    const lines = [];
    if (rolesChanged) lines.push(`Role: ${newRoles.map((key) => ROLE_BY_KEY[key].label).join(" + ")}`);
    if (divChanged) lines.push(`Anggota: ${nextDiv ? `DIV ${pad2(nextDiv)}` : "tidak di divisi"}`);
    if (addLeads.length) lines.push(`Jadi leader: ${addLeads.map((n) => `DIV ${pad2(n)}`).join(", ")}`);
    if (dropLeads.length) lines.push(`Lepas leader: ${dropLeads.map((n) => `DIV ${pad2(n)}`).join(", ")}`);
    if (!confirm(`Simpan perubahan @${target.username || target.full_name}?\n\n${lines.join("\n")}`)) return;
    saving = true;
    $("roleSave").disabled = true;
    editorSay("Menyimpan perubahan...");
    try {
      if (rolesChanged) {
        const { data, error } = await db.rpc("f4_set_profile_roles", {
          p_target_id: target.id,
          p_roles: selected,
        });
        if (error) throw error;
        target.roles = data?.roles || selected;
        target.role = data?.role || target.role;
      }
      try {
        if (divChanged) {
          const { error } = await db.rpc("f4_set_profile_division", {
            p_target_id: target.id,
            p_division_id: nextDiv,
            p_is_leader: false,
          });
          if (error) throw error;
        }
        for (const n of dropLeads) {
          const { error } = await db.rpc("f4_remove_division_leader", { p_division: n, p_profile_id: target.id });
          if (error) throw error;
        }
        for (const n of addLeads) {
          const { error } = await db.rpc("f4_set_division_leader", { p_division: n, p_profile_id: target.id });
          if (error) throw error;
        }
      } finally {
        if (divChanged || addLeads.length || dropLeads.length) await loadRoster();
      }
      closeEditor();
      say(`@${target.username || target.full_name} berhasil diperbarui · ${lines.join(" · ")}.`, true);
      render();
    } catch (error) {
      const msg = String(error?.message || error || "");
      editorSay(
        /Could not find the function|does not exist/i.test(msg)
          ? "Jalankan supabase-division-two-leaders.sql di Supabase dulu."
          : /penuh|tidak ditemukan|tidak ada|harus akun|2 leader/i.test(msg)
            ? msg
            : prettyError(error),
      );
      render();
    } finally {
      saving = false;
      $("roleSave").disabled = false;
    }
  }
  function closeEditor() {
    $("roleOverlay").hidden = true;
    activeProfile = null;
    editorSay("");
  }
  function closeAccountDetail() {
    $("accountOverlay").hidden = true;
  }
  if ($("logout")) $("logout").onclick = async () => {
    await db.auth.signOut();
    redirectToLogin();
  };
  $("refresh").onclick = load;
  $("search").oninput = render;
  $("filter").onchange = render;
  $("roleSave").onclick = saveEditor;
  $("roleClose").onclick = closeEditor;
  $("roleCancel").onclick = closeEditor;
  $("roleOverlay").onclick = (event) => {
    if (event.target.id === "roleOverlay") closeEditor();
  };
  $("accountClose").onclick = closeAccountDetail;
  $("accountClose2").onclick = closeAccountDetail;
  $("accountOverlay").onclick = (event) => {
    if (event.target.id === "accountOverlay") closeAccountDetail();
  };
  $("accountExpel").onclick = () => activeDetail && expelAccount(activeDetail);
  $("accountDelete").onclick = () => activeDetail && deleteAccount(activeDetail);
  $("accountEditRole").onclick = () => {
    closeAccountDetail();
    if (activeDetail) openEditor(activeDetail);
  };
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!$("roleOverlay").hidden) closeEditor();
    else if (!$("accountOverlay").hidden) closeAccountDetail();
  });
  requireManager().then((ok) => {
    if (!ok) return;
    clearTimeout(watchdog);
    loginScreen.hidden = true;
    dashboard.hidden = false;
    load();
  });
})();
