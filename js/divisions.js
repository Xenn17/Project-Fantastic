/* /devisi — 41 divisions, rosters built from website accounts.
   Who is in which division (and who leads it) is set by admins in Manage Role → Divisi
   (RPC f4_set_profile_division). This page reads the roster through RPC f4_division_roster(), which only
   returns public account info: no email, phone, birth date or ML ID. */
(() => {
  "use strict";
  // Site root from this script's URL (/js/divisions.js → /): the page lives at /devisi/.
  const ROOT = (() => {
    try { return new URL("../", document.currentScript.src).href; } catch { return ""; }
  })();
  const pad = (n) => String(n).padStart(2, "0");
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "")) ? String(u) : "");
  const fmtDate = (v, long) =>
    v ? new Date(v).toLocaleDateString("id-ID", { day: "2-digit", month: long ? "long" : "short", year: "numeric" }) : "—";

  const SITE_ROLES = { owner: "OWNER", developer: "DEVELOPER", admin: "ADMIN", leader_squad: "LEADER SQUAD", member: "MEMBER", calon_member: "CALON MEMBER", tamu: "TAMU" };
  const SITE_RANK = ["owner", "developer", "admin", "leader_squad", "member", "calon_member", "tamu"];
  const GAME_ROLE = { jungler: "JUNG", gold: "GOLD", exp: "EXP", roam: "ROAM", mid: "MID" };
  const GAME_CLASS = { JUNG: "role-jung", GOLD: "role-gold", EXP: "role-exp", ROAM: "role-roam", MID: "role-mid" };

  const blankDivision = (x) => ({
    number: x.number,
    squad_id: x.squad_id || "",
    whatsapp: x.whatsapp || "",
    capacity: Number(x.capacity) || 25,
    status: "CLOSED",
    description: "",
    announcement: "",
    members: [],
    leader: null,
  });
  let rows = (window.F4_DIVISION_SEED || []).map(blankDivision);
  let db = null,
    profile = null,
    authUser = null,
    rosterReady = false;

  const countOf = (d) => d.members.length;
  const rolesList = () => profile?.roles?.length ? profile.roles : [profile?.role || "tamu"];
  const isStaff = () => rolesList().some((r) => ["admin", "developer", "owner"].includes(r));
  const nameOf = (m) => m.username || m.full_name || "Tanpa nama";
  const myDivision = () => {
    if (!authUser) return null;
    // membership division only (in_roster); leaderships elsewhere are handled by d.leader
    for (const d of rows) if (d.members.some((m) => String(m.id) === String(authUser.id) && m.in_roster !== false)) return d.number;
    return null;
  };
  // Mirrors f4_can_manage_roster(): staff, the division's official leader, or a Leader Squad on its roster.
  const canManageDiv = (n) => {
    if (!authUser) return false;
    if (isStaff()) return true;
    const d = rows.find((x) => x.number === n);
    if (d?.leader && String(d.leader.id) === String(authUser.id)) return true;
    return rolesList().includes("leader_squad") && myDivision() === n;
  };
  const gameRole = (m) => GAME_ROLE[String(m.game_role || "").toLowerCase()] || "";

  function statusOf(d) {
    if (!d.leader) return "LEADER NEEDED";
    if (countOf(d) >= d.capacity) return "FULL";
    return d.status === "RECRUITING" ? "RECRUITING" : "CLOSED";
  }
  const statusClass = (s) =>
    s === "RECRUITING" ? "status-recruiting" : s === "FULL" ? "status-full" : s === "CLOSED" ? "status-closed" : "status-leader-needed";

  function avatarHtml(m, cls = "dv-avatar") {
    const initial = esc(String(m ? nameOf(m) : "?").charAt(0).toUpperCase());
    const url = m && safeUrl(m.avatar_url);
    return `<span class="${cls}">${url ? `<img src="${esc(url)}" alt="" loading="lazy" data-fallback="${initial}">` : initial}</span>`;
  }
  // broken avatar URLs → fall back to the initial (error events don't bubble, so listen in capture phase)
  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (img instanceof HTMLImageElement && img.dataset.fallback !== undefined) img.replaceWith(document.createTextNode(img.dataset.fallback));
    },
    true,
  );
  const gameBadge = (m) => {
    const g = gameRole(m);
    return g ? `<b class="role-badge ${GAME_CLASS[g]}">${g}</b>` : '<b class="role-badge role-unknown">ROLE ?</b>';
  };

  /* ================= data ================= */
  async function loadData() {
    const { data: ds } = await db.from("f4_divisions").select("*").order("id");
    if (ds?.length)
      rows = ds.map((x) => ({
        ...blankDivision({ number: x.id, squad_id: x.squad_id, whatsapp: x.whatsapp, capacity: x.capacity }),
        status: x.recruitment_status,
        needs: Array.isArray(x.role_needs) ? x.role_needs.map(String) : [],
        description: x.description || "",
        announcement: x.announcement || "",
        spotlight: x.spotlight,
        version: x.version,
      }));
    const { data: roster, error } = await db.rpc("f4_division_roster");
    rosterReady = !error;
    if (error) console.warn("Roster belum tersedia — jalankan supabase-division-roster.sql", error);
    rows.forEach((d) => {
      d.members = [];
      d.leader = null;
    });
    (roster || []).forEach((r) => {
      const d = rows.find((x) => x.number === Number(r.division_id));
      if (!d) return;
      const m = { ...r, id: r.profile_id, division: d.number };
      d.members.push(m);
      if (r.is_leader) d.leader = m;
    });
    rows.forEach((d) => d.members.sort((a, b) => (b.is_leader - a.is_leader) || nameOf(a).localeCompare(nameOf(b), "id")));
  }

  /* ================= page ================= */
  function renderSummary() {
    const counts = { total: 0, recruiting: 0, full: 0, closed: 0, noLeader: 0 };
    rows.forEach((d) => {
      counts.total += countOf(d);
      const s = statusOf(d);
      if (s === "RECRUITING") counts.recruiting++;
      if (s === "FULL") counts.full++;
      if (s === "CLOSED") counts.closed++;
      if (s === "LEADER NEEDED") counts.noLeader++;
    });
    $("summaryGrid").innerHTML = [
      ["TOTAL MEMBER", counts.total],
      ["RECRUITING", counts.recruiting],
      ["FULL", counts.full],
      ["CLOSED", counts.closed],
      ["TANPA LEADER", counts.noLeader],
    ]
      .map(([l, v]) => `<div class="summary-item"><strong>${v}</strong><span>${l}</span></div>`)
      .join("");
    $("lastUpdated").textContent = rosterReady
      ? `Roster akun · diperbarui ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB`
      : "Roster belum tersedia";
  }
  // "looking for" strip on a card: only while recruitment is open and there is still room
  function needsHtml(d) {
    if (statusOf(d) !== "RECRUITING") return "";
    const needs = d.needs || [];
    return `<div class="dv-needs"><small>MENCARI</small>${
      needs.length ? needs.map((r) => `<b class="role-badge ${GAME_CLASS[r] || "role-unknown"}">${esc(r)}</b>`).join("") : '<b class="role-badge role-unknown">SEMUA ROLE</b>'
    }</div>`;
  }
  function render() {
    const filter = $("divisionFilter").value,
      sort = $("divisionSort").value,
      list = rows.filter((d) => filter === "ALL" || statusOf(d) === filter);
    const slots = (d) => d.capacity - countOf(d);
    list.sort((a, b) => {
      let delta = 0;
      if (sort === "MOST_MEMBERS") delta = countOf(b) - countOf(a);
      else if (sort === "LEAST_MEMBERS") delta = countOf(a) - countOf(b);
      else if (sort === "MOST_SLOTS") delta = slots(b) - slots(a);
      else if (sort === "FEWEST_SLOTS") delta = slots(a) - slots(b);
      else if (sort === "RECRUITING_FIRST") delta = (statusOf(a) === "RECRUITING" ? -1 : 0) - (statusOf(b) === "RECRUITING" ? -1 : 0);
      return delta || a.number - b.number;
    });
    $("divisionGrid").innerHTML = list.length
      ? list
          .map((d) => {
            const s = statusOf(d),
              n = countOf(d),
              wa = d.whatsapp ? `https://wa.me/${d.whatsapp.replace(/\D/g, "")}` : "",
              fill = Math.min(100, Math.round((n / (d.capacity || 1)) * 100)),
              free = Math.max(0, d.capacity - n),
              L = d.leader;
            const leader = L
              ? `<button type="button" class="dv-leader dv-leader-link" data-profile="${esc(L.id)}" aria-label="Lihat akun leader ${esc(nameOf(L))}">${avatarHtml(L)}<div><small>LEADER</small><strong>${esc(nameOf(L))}</strong></div><em aria-hidden="true">↗</em></button>`
              : `<div class="dv-leader is-empty">${avatarHtml(null)}<div><small>LEADER</small><strong>LEADER NEEDED</strong></div></div>`;
            return `<article class="division-card ${statusClass(s)}" id="division-${d.number}" data-number="${d.number}">
          <div class="dv-card-top">
            <span class="dv-number">${pad(d.number)}</span>
            <span class="division-status ${statusClass(s)}">${s}</span>
            <button class="division-edit" data-edit="${d.number}" title="Edit divisi" aria-label="Edit divisi ${d.number}">✎</button>
          </div>
          <h3>F4NTASTIC DIV. ${pad(d.number)}</h3>
          ${leader}
          <div class="dv-capacity">
            <div class="dv-capacity-head"><small>KAPASITAS</small><b>${n}/${d.capacity}</b><em>${free ? `${free} slot` : "penuh"}</em></div>
            <div class="dv-bar"><i style="width:${fill}%"></i></div>
          </div>
          ${needsHtml(d)}
          <dl class="dv-facts"><div><dt>SQUAD ID</dt><dd>${esc(d.squad_id || "—")}</dd></div><div><dt>MEMBER</dt><dd>${n}</dd></div></dl>
          <div class="division-actions">
            <button class="dv-primary" data-members="${d.number}">LIHAT MEMBER</button>
            <a class="wa" href="${wa || "#"}" ${wa ? 'target="_blank" rel="noopener"' : 'aria-disabled="true"'} title="Hubungi divisi via WhatsApp">WA</a>
            <button data-share="${d.number}" title="Salin link divisi" aria-label="Salin link divisi ${d.number}">⧉</button>
          </div>
        </article>`;
          })
          .join("")
      : '<p class="activity-empty">Tidak ada divisi dengan status ini.</p>';
    $("quickDivision").innerHTML =
      '<option value="">BUKA DIVISI…</option>' +
      rows.map((d) => `<option value="${d.number}">DIV ${pad(d.number)}${d.leader ? ` — ${esc(nameOf(d.leader))}` : ""}</option>`).join("");
    applyEditPermissions();
  }
  function applyEditPermissions() {
    const roles = rolesList();
    const canAll = roles.some((r) => ["developer", "owner", "admin"].includes(r));
    document.querySelectorAll("[data-edit]").forEach((b) => {
      const d = rows.find((x) => x.number === Number(b.dataset.edit));
      b.classList.toggle("visible", canAll || (authUser && d?.leader?.id === authUser.id));
    });
  }
  async function init() {
    try {
      if (window.getF4GalleryClient) {
        db = window.getF4GalleryClient();
        const { data: { session } } = await db.auth.getSession();
        authUser = session?.user || null;
        if (authUser) {
          const { data } = await db.from("profiles").select("role,roles").eq("id", authUser.id).maybeSingle();
          profile = data || null;
          if (data) await loadData();
        }
      }
    } catch (e) {
      console.warn("Auth status unavailable", e);
    }
    const allowed = Boolean(authUser) && rolesList().some((r) => ["member", "leader_squad", "admin", "developer", "owner"].includes(r));
    if (!allowed) {
      $("divisionGrid").innerHTML = `<div class="directory-error"><h3>AKSES DIREKTORI DIBATASI</h3><p>Halaman ini hanya dapat diakses oleh Member F4NTASTIC atau role pengelola yang berwenang.</p><a href="${ROOT}login.html">MASUK KE AKUN</a></div>`;
      document.querySelector(".directory-summary").hidden = true;
      document.querySelector(".directory-toolbar").hidden = true;
      document.querySelector(".member-search-wrap").hidden = true;
      return false;
    }
    renderSummary();
    render();
    return true;
  }

  /* ================= division popup ================= */
  const modal = $("divisionModal");
  let modalNumber = null,
    modalRole = "ALL",
    modalHighlight = null,
    lastFocus = null;
  function openModal(n, opts = {}) {
    const d = rows.find((x) => x.number === n);
    if (!d || !modal) return;
    modalNumber = n;
    modalRole = "ALL";
    modalHighlight = opts.highlight || null;
    $("dvMemberFilter").value = "";
    $("dvModalStatus").textContent = "";
    $("dvAddSearch").value = "";
    $("dvAddResults").innerHTML = "";
    if (modal.hidden) lastFocus = document.activeElement;
    renderModal();
    modal.hidden = false;
    document.documentElement.classList.add("dv-modal-open");
    history.replaceState(null, "", `${location.pathname}?id=${pad(n)}`);
    setTimeout(() => {
      const hit = modalHighlight && $("dvMemberList").querySelector(".is-highlight");
      if (hit) hit.scrollIntoView({ block: "center" });
      else $("dvMemberFilter").focus({ preventScroll: true });
    }, 60);
  }
  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (pf.hidden) document.documentElement.classList.remove("dv-modal-open");
    history.replaceState(null, "", location.pathname);
    lastFocus?.focus?.();
  }
  function renderModal() {
    const d = rows.find((x) => x.number === modalNumber);
    if (!d) return;
    const s = statusOf(d),
      n = countOf(d),
      manage = isStaff(),
      lead = !manage && canManageDiv(d.number),
      wa = d.whatsapp ? `https://wa.me/${d.whatsapp.replace(/\D/g, "")}` : "";
    $("dvModalKicker").innerHTML = `<span></span> DIVISI ${pad(d.number)} · <b class="division-status ${statusClass(s)}">${s}</b>`;
    $("dvModalTitle").textContent = `F4NTASTIC DIV. ${pad(d.number)}`;
    $("dvModalMeta").innerHTML = `
      <div><small>LEADER</small><strong>${esc(d.leader ? nameOf(d.leader) : "LEADER NEEDED")}</strong></div>
      <div><small>KAPASITAS</small><strong>${n}/${d.capacity}</strong></div>
      <div><small>SQUAD ID</small><strong>${esc(d.squad_id || "—")}</strong></div>
      ${s === "RECRUITING" ? `<div class="dv-meta-needs"><small>MENCARI ROLE</small><strong>${(d.needs || []).length ? d.needs.map((r) => `<b class="role-badge ${GAME_CLASS[r] || "role-unknown"}">${esc(r)}</b>`).join("") : "SEMUA ROLE"}</strong></div>` : ""}
      ${wa ? `<a class="dv-wa" href="${wa}" target="_blank" rel="noopener">HUBUNGI VIA WA ↗</a>` : ""}`;
    const roles = [...new Set(d.members.map((m) => gameRole(m) || "ROLE ?"))].sort();
    $("dvRoleChips").innerHTML = ["ALL", ...roles]
      .map((r) => `<button type="button" class="dv-chip${r === modalRole ? " is-active" : ""}" data-role="${esc(r)}">${r === "ALL" ? `SEMUA <b>${n}</b>` : esc(r)}</button>`)
      .join("");
    const note = $("dvManageNote");
    note.hidden = !manage && !lead;
    note.innerHTML = manage
      ? `Tambah member di kolom bawah atau lewat <a href="${ROOT}manage-role.html">Manage Role → Divisi</a> (untuk pilih leader). Pindahkan member lewat tombol ⇄ PINDAH.`
      : lead
        ? `Kamu pengelola DIV ${pad(d.number)}: bisa menambah member (akun Member yang belum punya divisi) dan mengeluarkan member — di sini atau di <a href="${ROOT}manage-division.html">Manage Devisi</a>.`
        : "";
    $("dvAdd").hidden = !manage && !lead;
    const q = $("dvMemberFilter").value.trim().toLowerCase();
    const options = rows
      .filter((x) => x.number !== d.number)
      .map((x) => {
        const full = countOf(x) >= x.capacity;
        return `<option value="${x.number}"${full ? " disabled" : ""}>DIV ${pad(x.number)} · ${countOf(x)}/${x.capacity}${full ? " (PENUH)" : ""}</option>`;
      })
      .join("");
    const list = d.members.filter(
      (m) =>
        (modalRole === "ALL" || (gameRole(m) || "ROLE ?") === modalRole) &&
        (!q || [m.username, m.full_name].some((v) => String(v || "").toLowerCase().includes(q))),
    );
    $("dvMemberList").innerHTML = list.length
      ? list
          .map((m) => {
            const hl = modalHighlight && String(m.id) === String(modalHighlight);
            return `<article class="dv-member${m.is_leader ? " is-leader" : ""}${hl ? " is-highlight" : ""}" data-pid="${esc(m.id)}">
                <button type="button" class="dv-member-open" data-profile="${esc(m.id)}" aria-label="Lihat akun ${esc(nameOf(m))}">
                  ${avatarHtml(m)}
                  <span class="dv-member-copy"><strong>${esc(nameOf(m))}</strong><small>${m.full_name && m.username ? esc(m.full_name) + " · " : ""}${m.is_leader ? "Leader divisi" : m.main_hero ? "Main " + esc(m.main_hero) : "Lihat akun"}</small></span>
                </button>
                <div class="member-role-list">${m.is_leader ? '<b class="role-badge role-leader">LEADER</b>' : ""}${gameBadge(m)}${manage && m.in_roster !== false ? `<button type="button" class="dv-move-toggle" data-toggle-move aria-expanded="false">⇄ PINDAH</button>` : ""}${lead && !m.is_leader && String(m.id) !== String(authUser.id) ? `<button type="button" class="dv-remove" data-remove="${esc(m.id)}">KELUARKAN</button>` : ""}</div>
                ${manage ? `<div class="dv-move"><select data-move-target aria-label="Pindahkan ${esc(nameOf(m))} ke divisi"><option value="">Pindah ke divisi…</option><option value="0">— Keluarkan dari divisi</option>${options}</select><button type="button" data-move="${esc(m.id)}">SIMPAN</button></div>` : ""}
              </article>`;
          })
          .join("")
      : `<p class="dv-empty">${
          d.members.length
            ? "Tidak ada member yang cocok."
            : rosterReady
              ? "Belum ada member di divisi ini. Admin bisa menambahkan lewat Manage Role."
              : "Roster divisi belum aktif."
        }</p>`;
  }
  async function moveMember(fromNumber, pid, toNumber) {
    const from = rows.find((x) => x.number === fromNumber);
    const to = toNumber ? rows.find((x) => x.number === toNumber) : null;
    const m = from?.members.find((x) => String(x.id) === String(pid));
    if (!from || !m || (toNumber && !to)) return;
    const say = (text, kind = "") => {
      $("dvModalStatus").textContent = text;
      $("dvModalStatus").className = `dv-modal-status ${kind}`;
    };
    if (to && countOf(to) >= to.capacity) return say(`DIV ${pad(to.number)} sudah penuh (${countOf(to)}/${to.capacity}).`, "is-error");
    const what = to ? `ke DIV ${pad(to.number)}` : "keluar dari divisi";
    if (!confirm(`Pindahkan ${nameOf(m)} dari DIV ${pad(from.number)} ${what}?${m.is_leader ? "\n\nStatus LEADER-nya tidak berubah (atur leader lewat Manage Role)." : ""}`)) return;
    say("Menyimpan…");
    try {
      const { error } = await db.rpc("f4_set_profile_division", { p_target_id: m.id, p_division_id: to ? to.number : null, p_is_leader: false });
      if (error) throw error;
      await loadData();
      renderSummary();
      render();
      renderModal();
      say(`✓ ${nameOf(m)} ${to ? `dipindah ke DIV ${pad(to.number)}` : "dikeluarkan dari divisi"}.`, "is-success");
    } catch (err) {
      const msg = String(err?.message || err);
      say(/permission|row-level|Hanya admin/i.test(msg) ? "Hanya admin, developer, atau owner yang bisa memindahkan member." : `Gagal: ${msg}`, "is-error");
    }
  }

  /* ================= add / remove (staff + leaders of this division) ================= */
  const modalSay = (text, kind = "") => {
    $("dvModalStatus").textContent = text;
    $("dvModalStatus").className = `dv-modal-status ${kind}`;
  };
  const friendly = (err) => {
    const msg = String(err?.message || err || "");
    if (/42501|permission|row-level|izin/i.test(msg) && !/sudah|hanya/i.test(msg)) return "Kamu tidak punya izin mengelola divisi ini.";
    if (/function .* does not exist|Could not find the function/i.test(msg)) return "Fitur ini belum aktif — admin perlu menjalankan supabase-division-leader-manage.sql.";
    return msg || "Terjadi kesalahan. Coba lagi.";
  };
  async function refreshAll() {
    await loadData();
    renderSummary();
    render();
    renderModal();
  }
  let addTimer = 0,
    addSeq = 0;
  async function searchCandidates() {
    const q = $("dvAddSearch").value.trim().replace(/^@/, ""),
      box = $("dvAddResults"),
      seq = ++addSeq;
    if (q.length < 2) {
      box.innerHTML = q ? '<p class="dv-add-empty">Ketik minimal 2 huruf.</p>' : "";
      return;
    }
    box.innerHTML = '<p class="dv-add-empty">Mencari akun…</p>';
    const { data, error } = await db.rpc("f4_division_candidates", { p_division: modalNumber, p_query: q });
    if (seq !== addSeq) return;
    if (error) {
      box.innerHTML = `<p class="dv-add-empty is-error">${esc(friendly(error))}</p>`;
      return;
    }
    box.innerHTML = (data || []).length
      ? data
          .map(
            (a) =>
              `<div class="dv-add-row">${avatarHtml(a)}<span><b>${esc(nameOf(a))}</b><small>${a.full_name && a.username ? esc(a.full_name) : "Belum punya divisi"}</small></span><button type="button" data-add="${esc(a.id)}" data-name="${esc(nameOf(a))}">+ TAMBAH</button></div>`,
          )
          .join("")
      : '<p class="dv-add-empty">Tidak ada akun Member tanpa divisi yang cocok. Akun yang sudah di divisi lain hanya bisa dipindah admin.</p>';
  }
  async function addMember(pid, name) {
    const d = rows.find((x) => x.number === modalNumber);
    if (!d) return;
    if (countOf(d) >= d.capacity) return modalSay(`DIV ${pad(d.number)} sudah penuh (${countOf(d)}/${d.capacity}).`, "is-error");
    if (!confirm(`Tambahkan ${name} ke DIV ${pad(d.number)}?`)) return;
    modalSay("Menambahkan…");
    const { error } = await db.rpc("f4_division_add_member", { p_division: d.number, p_target_id: pid });
    if (error) return modalSay(friendly(error), "is-error");
    $("dvAddSearch").value = "";
    $("dvAddResults").innerHTML = "";
    await refreshAll();
    modalSay(`✓ ${name} masuk ke DIV ${pad(d.number)}.`, "is-success");
  }
  async function removeMember(pid) {
    const d = rows.find((x) => x.number === modalNumber);
    const m = d?.members.find((x) => String(x.id) === String(pid));
    if (!m) return;
    if (!confirm(`Keluarkan ${nameOf(m)} dari DIV ${pad(d.number)}?`)) return;
    modalSay("Menyimpan…");
    const { error } = await db.rpc("f4_division_remove_member", { p_division: d.number, p_target_id: m.id });
    if (error) return modalSay(friendly(error), "is-error");
    await refreshAll();
    modalSay(`✓ ${nameOf(m)} dikeluarkan dari DIV ${pad(d.number)}.`, "is-success");
  }
  $("dvAddSearch")?.addEventListener("input", () => {
    clearTimeout(addTimer);
    addTimer = setTimeout(searchCandidates, 250);
  });
  $("dvAddResults")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (b) addMember(b.dataset.add, b.dataset.name);
  });

  /* ================= account preview popup ================= */
  const pf = $("dvProfile");
  let pfMember = null,
    pfLastFocus = null;
  const findMember = (pid) => {
    for (const d of rows) {
      const m = d.members.find((x) => String(x.id) === String(pid));
      if (m) return m;
    }
    return null;
  };
  function openProfile(pid) {
    // one account can lead several divisions: collect every entry, the "home" one is the membership row
    const all = rows.flatMap((d) => d.members.filter((x) => String(x.id) === String(pid)));
    const m = all.find((x) => x.in_roster !== false) || all[0];
    if (!m || !pf) return;
    const led = all.filter((x) => x.is_leader).map((x) => x.division).sort((a, b) => a - b);
    const home = m.in_roster !== false ? m.division : null;
    pfMember = m;
    if (pf.hidden) pfLastFocus = document.activeElement;
    $("pfAvatar").outerHTML = avatarHtml(m, "pf-avatar").replace('class="pf-avatar"', 'class="pf-avatar" id="pfAvatar"');
    $("pfKicker").innerHTML = `<span></span> ${home ? `DIV. ${pad(home)} · ` : ""}${led.length ? `LEADER ${led.length > 1 ? `${led.length} DIVISI` : ""}`.trim() : "MEMBER"}`;
    $("pfName").textContent = m.full_name || m.username || "Tanpa nama";
    $("pfHandle").textContent = m.username ? "@" + m.username : "";
    const siteRoles = SITE_RANK.filter((r) => (m.roles || []).map((x) => String(x).toLowerCase()).includes(r));
    $("pfRoles").innerHTML =
      led.map((n) => `<b class="role-badge role-leader">LEADER DIV. ${pad(n)}</b>`).join("") +
      siteRoles.map((r) => `<b class="pf-site-role pf-role-${r}">${SITE_ROLES[r]}</b>`).join("") +
      (gameRole(m) ? gameBadge(m) : "");
    const facts = [
      ...(led.length ? [["LEADER DI", led.map((n) => `DIV. ${pad(n)}`).join(", ")]] : []),
      ["DIVISI (ANGGOTA)", home ? `F4NTASTIC DIV. ${pad(home)}` : led.length ? "Hanya sebagai leader" : "—"],
      ["ROLE IN-GAME", gameRole(m) || "Belum diisi"],
      ["MAIN HERO", m.main_hero || "Belum diisi"],
      ["MASUK DIVISI", fmtDate(m.assigned_at)],
      ["MEMBER SEJAK", fmtDate(m.member_since)],
    ];
    $("pfFacts").innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
    const shots = (m.profile_gallery || []).map(safeUrl).filter(Boolean).slice(0, 3);
    $("pfShowcase").innerHTML = shots.length
      ? shots.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener" aria-label="Buka showcase ${i + 1}"><img src="${esc(u)}" alt="Showcase ${i + 1}" loading="lazy"></a>`).join("")
      : '<p class="pf-empty">Belum ada foto showcase.</p>';
    $("pfShowcase").querySelectorAll("img").forEach((img) => img.addEventListener("error", () => img.parentElement.remove()));
    // when several divisions are linked, "back" goes to the one currently open (if any)
    if (!modal.hidden && all.some((x) => x.division === modalNumber)) pfMember = all.find((x) => x.division === modalNumber);
    $("pfBack").hidden = !modal.hidden && all.some((x) => x.division === modalNumber);
    $("pfBack").textContent = `LIHAT DIV. ${pad(pfMember.division)} →`;
    pf.hidden = false;
    document.documentElement.classList.add("dv-modal-open");
    setTimeout(() => pf.querySelector(".dv-modal-close")?.focus({ preventScroll: true }), 40);
  }
  function closeProfile() {
    if (!pf || pf.hidden) return;
    pf.hidden = true;
    if (modal.hidden) document.documentElement.classList.remove("dv-modal-open");
    pfLastFocus?.focus?.({ preventScroll: true });
  }

  /* ================= events ================= */
  pf?.addEventListener("click", (e) => {
    if (e.target.closest("[data-pf-close]")) return closeProfile();
    if (e.target.closest("#pfBack") && pfMember) {
      const n = pfMember.division,
        id = pfMember.id;
      pf.hidden = true;
      openModal(n, { highlight: id });
    }
  });
  modal?.addEventListener("click", (e) => {
    if (e.target.closest("[data-dv-close]")) return closeModal();
    const open = e.target.closest("[data-profile]");
    if (open) return openProfile(open.dataset.profile);
    const rm = e.target.closest("[data-remove]");
    if (rm) return removeMember(rm.dataset.remove);
    const chip = e.target.closest("[data-role]");
    if (chip) {
      modalRole = chip.dataset.role;
      return renderModal();
    }
    const tg = e.target.closest("[data-toggle-move]");
    if (tg) {
      const row = tg.closest(".dv-member");
      const willOpen = !row.classList.contains("is-moving");
      $("dvMemberList").querySelectorAll(".dv-member.is-moving").forEach((r) => {
        r.classList.remove("is-moving");
        r.querySelector("[data-toggle-move]")?.setAttribute("aria-expanded", "false");
      });
      row.classList.toggle("is-moving", willOpen);
      tg.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) row.querySelector("[data-move-target]")?.focus();
      return;
    }
    const mv = e.target.closest("[data-move]");
    if (mv) {
      const sel = mv.parentElement.querySelector("[data-move-target]");
      if (sel.value === "") {
        sel.focus();
        $("dvModalStatus").textContent = "Pilih divisi tujuan dulu.";
        $("dvModalStatus").className = "dv-modal-status is-error";
        return;
      }
      moveMember(modalNumber, mv.dataset.move, Number(sel.value));
    }
  });
  $("dvMemberFilter")?.addEventListener("input", renderModal);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (pf && !pf.hidden) closeProfile();
    else if (modal && !modal.hidden) closeModal();
  });

  $("divisionFilter").addEventListener("change", render);
  $("divisionSort").addEventListener("change", render);
  $("quickDivision").addEventListener("change", (e) => {
    if (e.target.value) {
      openModal(Number(e.target.value));
      e.target.value = "";
    }
  });
  $("divisionGrid").addEventListener("click", async (e) => {
    const p = e.target.closest("[data-profile]"),
      m = e.target.closest("[data-members]"),
      sh = e.target.closest("[data-share]"),
      ed = e.target.closest("[data-edit]");
    if (p) return openProfile(p.dataset.profile);
    if (m) openModal(Number(m.dataset.members));
    if (sh) {
      const url = `${location.origin}${location.pathname}?id=${pad(sh.dataset.share)}`;
      try {
        await navigator.clipboard.writeText(url);
        alert("LINK DIVISI BERHASIL DISALIN!");
      } catch {
        prompt("Salin link divisi ini:", url);
      }
    }
    if (ed) location.href = `${ROOT}division-editor.html?id=${pad(ed.dataset.edit)}`;
  });
  function search(q) {
    q = q.trim().toLowerCase().replace(/^@/, "");
    if (!q) {
      $("memberResults").innerHTML = "";
      return;
    }
    const matches = rows.flatMap((d) => d.members.filter((m) => [m.username, m.full_name].some((v) => String(v || "").toLowerCase().includes(q))));
    $("memberResults").innerHTML = matches.length
      ? matches
          .slice(0, 30)
          .map(
            (m) =>
              `<button type="button" class="member-result" data-profile="${esc(m.id)}">${avatarHtml(m)}<span><b>${esc(nameOf(m))}</b><small>${m.full_name && m.username ? esc(m.full_name) + " · " : ""}${m.is_leader ? "LEADER" : gameRole(m) || "MEMBER"}</small></span><em>DIV ${pad(m.division)} →</em></button>`,
          )
          .join("")
      : '<p class="activity-empty">MEMBER TIDAK DITEMUKAN · Periksa kembali nama atau username.</p>';
  }
  $("memberSearch").addEventListener("input", (e) => search(e.target.value));
  $("heroSearch").addEventListener("input", (e) => {
    $("memberSearch").value = e.target.value;
    search(e.target.value);
    $("member-search").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $("memberResults").addEventListener("click", (e) => {
    const x = e.target.closest("[data-profile]");
    if (x) openProfile(x.dataset.profile);
  });
  $("yearNow").textContent = new Date().getFullYear();
  const top = $("backTop");
  window.addEventListener("scroll", () => top.classList.toggle("show", scrollY > 450), { passive: true });
  top.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const id = Number(new URLSearchParams(location.search).get("id"));
  init().then((ok) => {
    if (ok && id >= 1 && id <= 41) openModal(id);
  });
})();
