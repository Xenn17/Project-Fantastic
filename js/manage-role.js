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
    saving = false;
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
  async function load() {
    $("roleGroups").innerHTML = '<p class="empty">Mengambil data akun...</p>';
    const { data, error } = await db
      .from("profiles")
      .select(
        "id,username,full_name,email,role,roles,avatar_url,phone,ml_id,ml_server,gender,birth_date,main_hero,game_role,profile_gallery,created_at,last_seen",
      )
      .order("created_at", { ascending: false });
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
        [profile.username, profile.full_name, profile.email].some((value) =>
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
        "<thead><tr><th>AKUN</th><th>EMAIL</th><th>ROLE</th><th>BERGABUNG</th><th>AKSI</th></tr></thead>";
      const body = document.createElement("tbody");
      members.forEach((profile) => body.append(buildRow(profile)));
      table.append(body);
      group.append(table);
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
    tr.innerHTML = `<td><div class="role-account" tabindex="0" role="button" aria-label="Lihat data ${esc(profile.full_name || profile.username || "akun")}"><span class="role-avatar">${avatarHtml}</span><div><strong class="candidate-name">${esc(profile.full_name || profile.username || "Tanpa nama")}</strong><span class="ign">@ ${esc(profile.username || "—")}${isSelf ? " · KAMU" : ""}</span></div></div></td><td>${esc(profile.email || "—")}</td><td><div class="role-chip-list">${roles.map(chipHtml).join("")}</div></td><td>${profile.created_at ? new Date(profile.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td><td>${isSelf ? '<span class="pill">KAMU</span>' : '<button class="save-role role-edit-button" type="button">ATUR ROLE</button>'}</td>`;
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
    $("accountEditRole").hidden = isSelf;
    $("accountOverlay").hidden = false;
  }
  function openEditor(profile) {
    activeProfile = profile;
    const roles = rolesOf(profile);
    selectedTier = roles.includes("member")
      ? "member"
      : roles.includes("calon_member")
        ? "calon_member"
        : "tamu";
    $("roleEditorTitle").textContent = "ATUR ROLE";
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
      button.addEventListener("click", () => {
        selectedTier = key;
        renderEditorOptions();
      });
      tierWrap.append(button);
    });
    renderEditorOptions();
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
      input.disabled = selectedTier !== "member" || role.rank > actorMaxRank;
      const copy = document.createElement("span");
      copy.innerHTML = `<strong>${role.label}</strong><small>${role.desc}</small>`;
      label.append(input, copy);
      extra.append(label);
    });
    $("roleEditorHint").textContent =
      selectedTier === "member"
        ? "Peran tambahan boleh lebih dari satu. Semuanya otomatis tetap dihitung sebagai Member."
        : "Peran tambahan hanya tersedia setelah status keanggotaan menjadi Member.";
  }
  async function saveEditor() {
    if (!activeProfile || saving) return;
    const selected = [
      selectedTier,
      ...[...$("roleExtra").querySelectorAll("input:checked")].map(
        (input) => input.value,
      ),
    ];
    const oldRoles = roleList(rolesOf(activeProfile)),
      newRoles = roleList(selected);
    if (oldRoles.join(",") === newRoles.join(",")) {
      closeEditor();
      return;
    }
    if (
      !confirm(
        `Simpan role @${activeProfile.username || activeProfile.full_name}?\n\n${newRoles.map((key) => ROLE_BY_KEY[key].label).join(" + ")}`,
      )
    )
      return;
    saving = true;
    $("roleSave").disabled = true;
    editorSay("Menyimpan perubahan...");
    try {
      const { data, error } = await db.rpc("f4_set_profile_roles", {
        p_target_id: activeProfile.id,
        p_roles: selected,
      });
      if (error) throw error;
      activeProfile.roles = data?.roles || selected;
      activeProfile.role = data?.role || activeProfile.role;
      closeEditor();
      say(
        `Role @${activeProfile.username || activeProfile.full_name} berhasil diperbarui.`,
        true,
      );
      render();
    } catch (error) {
      editorSay(prettyError(error));
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
  $("logout").onclick = async () => {
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
