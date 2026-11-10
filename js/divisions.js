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
    leaders: [], // up to 2
    leader: null, // = leaders[0]
  });
  let rows = (window.F4_DIVISION_SEED || []).map(blankDivision);
  let myRequest = null, // my pending join request { id, division_id, created_at }
    requestsReady = false,
    reqCounts = new Map(); // division → pending requests (only divisions I manage)
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
    if (d?.leaders.some((L) => String(L.id) === String(authUser.id))) return true;
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
  // division photo (logo_url) or the division number as fallback
  const logoHtml = (d, cls = "dv-logo") => {
    const url = safeUrl(d.logo_url);
    return `<span class="${cls}${url ? " has-img" : ""}">${url ? `<img src="${esc(url)}" alt="" loading="lazy" data-fallback="${pad(d.number)}">` : `<b>${pad(d.number)}</b>`}</span>`;
  };
  // divisions I belong to (member or leader) are listed first
  const isMine = (d) => Boolean(authUser) && d.members.some((m) => String(m.id) === String(authUser.id));
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
        logo_url: x.logo_url || "",
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
      d.leaders = [];
      d.leader = null;
    });
    (roster || []).forEach((r) => {
      const d = rows.find((x) => x.number === Number(r.division_id));
      if (!d) return;
      const m = { ...r, id: r.profile_id, division: d.number };
      d.members.push(m);
      if (r.is_leader) d.leaders.push(m);
    });
    rows.forEach((d) => (d.leader = d.leaders[0] || null));
    rows.forEach((d) => d.members.sort((a, b) => (b.is_leader - a.is_leader) || nameOf(a).localeCompare(nameOf(b), "id")));
    await loadRequests();
  }
  async function loadRequests() {
    myRequest = null;
    reqCounts = new Map();
    if (!authUser) return;
    const [mine, counts] = await Promise.all([
      db.from("f4_division_requests").select("id,division_id,created_at").eq("profile_id", authUser.id).eq("status", "pending").maybeSingle(),
      db.rpc("f4_division_request_counts"),
    ]);
    requestsReady = !mine.error;
    if (mine.error) console.warn("Permintaan divisi belum aktif — jalankan supabase-division-requests.sql", mine.error);
    myRequest = mine.data || null;
    (counts.data || []).forEach((r) => reqCounts.set(Number(r.division_id), Number(r.pending) || 0));
  }
  // can I ask to join a division? (logged in, no membership division yet)
  const canRequest = () => Boolean(authUser) && requestsReady && !isStaff() && myDivision() == null;

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
      return (isMine(b) - isMine(a)) || delta || a.number - b.number;
    });
    $("divisionGrid").innerHTML = list.length
      ? list
          .map((d) => {
            const s = statusOf(d),
              n = countOf(d),
              wa = d.whatsapp ? `https://wa.me/${d.whatsapp.replace(/\D/g, "")}` : "",
              fill = Math.min(100, Math.round((n / (d.capacity || 1)) * 100)),
              free = Math.max(0, d.capacity - n),
              Ls = d.leaders;
            const leader = Ls.length
              ? `<div class="dv-leaders${Ls.length > 1 ? " is-duo" : ""}">${Ls.map(
                  (L) =>
                    `<button type="button" class="dv-leader dv-leader-link" data-profile="${esc(L.id)}" aria-label="Lihat akun leader ${esc(nameOf(L))}">${avatarHtml(L)}<div><small>LEADER</small><strong>${esc(nameOf(L))}</strong></div><em aria-hidden="true">↗︎</em></button>`,
                ).join("")}</div>`
              : `<div class="dv-leader is-empty">${avatarHtml(null)}<div><small>LEADER</small><strong>LEADER NEEDED</strong></div></div>`;
            return `<article class="division-card ${statusClass(s)}${isMine(d) ? " is-mine" : ""}" id="division-${d.number}" data-number="${d.number}">
          <div class="dv-card-top">
            ${safeUrl(d.logo_url) ? logoHtml(d, "dv-card-logo") : `<span class="dv-number">${pad(d.number)}</span>`}
            <span class="division-status ${statusClass(s)}">${s}</span>
            ${isMine(d) ? '<span class="dv-mine">DIVISIMU</span>' : ""}
            ${myRequest && Number(myRequest.division_id) === d.number ? '<span class="dv-requested">DIAJUKAN</span>' : ""}
            <button class="division-edit" data-edit="${d.number}" title="Edit divisi" aria-label="Edit divisi ${d.number}">✎${reqCounts.get(d.number) ? `<i class="dv-req-badge" title="Permintaan masuk">${reqCounts.get(d.number)}</i>` : ""}</button>
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
      rows.map((d) => `<option value="${d.number}">DIV ${pad(d.number)}${d.leaders.length ? ` — ${esc(d.leaders.map(nameOf).join(" & "))}` : ""}</option>`).join("");
    applyEditPermissions();
  }
  // pencil: admin+ on every division, Leader Squad / official leader only on the divisions they manage
  function applyEditPermissions() {
    document.querySelectorAll("[data-edit]").forEach((b) => b.classList.toggle("visible", canManageDiv(Number(b.dataset.edit))));
  }
  async function init() {
    try {
      if (window.getF4GalleryClient) {
        db = window.getF4GalleryClient();
        const { data: { session } } = await db.auth.getSession();
        authUser = session?.user || null;
        if (authUser) {
          const { data } = await db.from("profiles").select("role,roles,full_name,phone,ml_id,ml_server,gender,birth_date").eq("id", authUser.id).maybeSingle();
          profile = data || null;
          if (data) await loadData();
        }
      }
    } catch (e) {
      console.warn("Auth status unavailable", e);
    }
    const allowed = Boolean(authUser) && rolesList().some((r) => ["calon_member", "member", "leader_squad", "admin", "developer", "owner"].includes(r));
    const REQUIRED = ["full_name", "phone", "ml_id", "ml_server", "gender", "birth_date"];
    if (allowed && !REQUIRED.every((k) => String(profile?.[k] ?? "").trim())) {
      $("divisionGrid").innerHTML = `<div class="directory-error"><h3>LENGKAPI PROFIL DULU</h3><p>Halaman Devisi terbuka setelah 6 data wajib di profil kamu terisi: nama lengkap, no. HP, jenis kelamin, tanggal lahir, ID ML, dan server ML.</p><a href="${ROOT}profile.html?complete=1&redirect=devisi/">LENGKAPI PROFIL</a></div>`;
      document.querySelector(".directory-summary").hidden = true;
      document.querySelector(".directory-toolbar").hidden = true;
      document.querySelector(".member-search-wrap").hidden = true;
      return false;
    }
    if (!allowed) {
      $("divisionGrid").innerHTML = `<div class="directory-error"><h3>AKSES DIREKTORI DIBATASI</h3><p>Halaman ini hanya dapat diakses oleh Calon Member, Member F4NTASTIC, atau role pengelola yang berwenang.</p><a href="${ROOT}login.html">MASUK KE AKUN</a></div>`;
      document.querySelector(".directory-summary").hidden = true;
      document.querySelector(".directory-toolbar").hidden = true;
      document.querySelector(".member-search-wrap").hidden = true;
      return false;
    }
    renderSummary();
    render();
    return true;
  }

  /* ================= division popup (view only) ================= */
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
  const anyPopupOpen = () => [modal, pf, editor].some((m) => m && !m.hidden);
  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (!anyPopupOpen()) document.documentElement.classList.remove("dv-modal-open");
    history.replaceState(null, "", location.pathname);
    lastFocus?.focus?.();
  }
  // "request to join" box inside the view popup (only for accounts without a division)
  function renderJoinBox(d) {
    const box = $("dvJoin");
    if (!box) return;
    if (!canRequest()) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    const mineHere = myRequest && Number(myRequest.division_id) === d.number;
    if (mineHere) {
      box.className = "dv-join is-pending";
      box.innerHTML = `<div><b>⏳ Permintaan kamu sedang ditinjau</b><small>Leader DIV ${pad(d.number)} akan menerima atau menolak permintaanmu.</small></div><button type="button" class="dv-join-cancel" data-join-cancel>BATALKAN</button>`;
    } else if (myRequest) {
      box.className = "dv-join is-other";
      box.innerHTML = `<div><b>Kamu sudah mengajukan ke DIV ${pad(Number(myRequest.division_id))}</b><small>Satu permintaan aktif per akun. Batalkan dulu kalau mau pindah tujuan.</small></div><button type="button" class="dv-join-cancel" data-join-open="${Number(myRequest.division_id)}">LIHAT</button>`;
    } else if (countOf(d) >= d.capacity) {
      box.className = "dv-join is-full";
      box.innerHTML = `<div><b>Divisi ini sedang penuh</b><small>Pilih divisi lain yang masih punya slot.</small></div>`;
    } else {
      box.className = "dv-join";
      box.innerHTML = `<div><b>Belum punya divisi?</b><small>Ajukan masuk ke DIV ${pad(d.number)}. Leader divisi akan meninjau permintaanmu.</small></div>
        <textarea id="dvJoinMsg" maxlength="300" rows="2" placeholder="Pesan untuk leader (opsional): role, jam main, dll."></textarea>
        <button type="button" class="dv-primary" data-join="${d.number}">AJUKAN MASUK DIVISI</button>`;
    }
  }
  async function requestJoin(n, btn) {
    const d = rows.find((x) => x.number === n);
    if (!d) return;
    if (!confirm(`Ajukan masuk ke DIV ${pad(n)}?`)) return;
    btn.disabled = true;
    const { error } = await db.rpc("f4_division_request_join", { p_division: n, p_message: $("dvJoinMsg")?.value || "" });
    btn.disabled = false;
    if (error) return alert(friendly(error));
    await refreshAll();
    alert(`Permintaan masuk DIV ${pad(n)} terkirim. Tunggu leader divisi meninjau.`);
  }
  async function cancelJoin() {
    if (!myRequest || !confirm(`Batalkan permintaan masuk DIV ${pad(Number(myRequest.division_id))}?`)) return;
    const { error } = await db.rpc("f4_division_request_cancel");
    if (error) return alert(friendly(error));
    await refreshAll();
  }
  function renderModal() {
    const d = rows.find((x) => x.number === modalNumber);
    if (!d) return;
    const s = statusOf(d),
      n = countOf(d),
      wa = d.whatsapp ? `https://wa.me/${d.whatsapp.replace(/\D/g, "")}` : "";
    $("dvModalKicker").innerHTML = `<span></span> DIVISI ${pad(d.number)} · <b class="division-status ${statusClass(s)}">${s}</b>`;
    $("dvModalTitle").textContent = `F4NTASTIC DIV. ${pad(d.number)}`;
    $("dvModalLogo").innerHTML = logoHtml(d);
    $("dvModalMeta").innerHTML = `
      <div><small>${d.leaders.length > 1 ? "LEADER (2)" : "LEADER"}</small><strong>${esc(d.leaders.length ? d.leaders.map(nameOf).join(" & ") : "LEADER NEEDED")}</strong></div>
      <div><small>KAPASITAS</small><strong>${n}/${d.capacity}</strong></div>
      <div><small>SQUAD ID</small><strong>${esc(d.squad_id || "—")}</strong></div>
      ${s === "RECRUITING" ? `<div class="dv-meta-needs"><small>MENCARI ROLE</small><strong>${(d.needs || []).length ? d.needs.map((r) => `<b class="role-badge ${GAME_CLASS[r] || "role-unknown"}">${esc(r)}</b>`).join("") : "SEMUA ROLE"}</strong></div>` : ""}
      ${canManageDiv(d.number) ? `<button type="button" class="dv-edit-open" data-edit-open="${d.number}">✎ EDIT DIVISI${reqCounts.get(d.number) ? ` · ${reqCounts.get(d.number)} PERMINTAAN` : ""}</button>` : ""}
      ${wa ? `<a class="dv-wa" href="${wa}" target="_blank" rel="noopener">HUBUNGI VIA WA ↗︎</a>` : ""}`;
    renderJoinBox(d);
    $("dvModalDesc").textContent = d.description || "";
    $("dvModalDesc").hidden = !d.description;
    const roles = [...new Set(d.members.map((m) => gameRole(m) || "ROLE ?"))].sort();
    $("dvRoleChips").innerHTML = ["ALL", ...roles]
      .map((r) => `<button type="button" class="dv-chip${r === modalRole ? " is-active" : ""}" data-role="${esc(r)}">${r === "ALL" ? `SEMUA <b>${n}</b>` : esc(r)}</button>`)
      .join("");
    const q = $("dvMemberFilter").value.trim().toLowerCase();
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
                <div class="member-role-list">${m.is_leader ? '<b class="role-badge role-leader">LEADER</b>' : ""}${gameBadge(m)}</div>
              </article>`;
          })
          .join("")
      : `<p class="dv-empty">${d.members.length ? "Tidak ada member yang cocok." : rosterReady ? "Belum ada member di divisi ini." : "Roster divisi belum aktif."}</p>`;
  }

  /* ================= edit popup (leader of this division / admin+) ================= */
  const editor = $("dvEditor");
  const NEED_ROLES = [["EXP", "EXP Lane"], ["JUNG", "Jungler"], ["GOLD", "Gold Lane"], ["MID", "Mid Lane"], ["ROAM", "Roamer"]];
  const LOGO_BUCKET = "f4ntastic-division-logos";
  let edRequests = [];
  let edNumber = null,
    edDraft = null,
    edLastFocus = null;
  const edSay = (text, kind = "") => {
    $("edStatusMsg").textContent = text;
    $("edStatusMsg").className = `dv-modal-status ${kind}`;
  };
  const friendly = (err) => {
    const msg = String(err?.message || err || "");
    if (/f4_division_request|f4_division_requests/i.test(msg) && /Could not find|does not exist|schema cache/i.test(msg)) return "Fitur permintaan divisi belum aktif — admin perlu menjalankan supabase-division-requests.sql di Supabase.";
    if (/Could not find the function|does not exist|schema cache/i.test(msg)) return "Fitur ini belum aktif — admin perlu menjalankan supabase-division-edit.sql di Supabase.";
    if (/Bucket not found/i.test(msg)) return "Penyimpanan foto belum aktif — admin perlu menjalankan supabase-division-edit.sql.";
    if (/42501|permission|row-level|izin|Unauthorized/i.test(msg) && !/sudah|hanya|Kapasitas/i.test(msg)) return "Kamu tidak punya izin mengedit divisi ini.";
    return msg || "Terjadi kesalahan. Coba lagi.";
  };
  function openEditor(n) {
    const d = rows.find((x) => x.number === n);
    if (!d || !editor || !canManageDiv(n)) return;
    edNumber = n;
    edDraft = { status: d.status === "RECRUITING" ? "RECRUITING" : "CLOSED", needs: new Set(d.needs || []), logoFile: null, logoUrl: d.logo_url || "" };
    $("edTitle").textContent = `DIV. ${pad(n)}`;
    $("edSquad").value = d.squad_id || "";
    $("edWa").value = d.whatsapp || "";
    $("edCap").value = d.capacity;
    $("edCap").min = Math.max(1, countOf(d));
    $("edDesc").value = d.description || "";
    $("edLogoFile").value = "";
    $("edAddSearch").value = "";
    $("edAddResults").innerHTML = "";
    edSay("");
    edRequests = [];
    renderEditor();
    loadEditorRequests();
    if (editor.hidden) edLastFocus = document.activeElement;
    editor.hidden = false;
    document.documentElement.classList.add("dv-modal-open");
    setTimeout(() => $("edSquad").focus({ preventScroll: true }), 60);
  }
  function closeEditor() {
    if (!editor || editor.hidden) return;
    editor.hidden = true;
    if (edDraft?.logoFile && $("edLogo").querySelector("img")) URL.revokeObjectURL($("edLogo").querySelector("img").src);
    if (!anyPopupOpen()) document.documentElement.classList.remove("dv-modal-open");
    edLastFocus?.focus?.({ preventScroll: true });
  }
  function renderEditor() {
    const d = rows.find((x) => x.number === edNumber);
    if (!d || !edDraft) return;
    const open = edDraft.status === "RECRUITING";
    // logo preview: new file (object URL) > current URL > number
    const src = edDraft.logoFile ? URL.createObjectURL(edDraft.logoFile) : safeUrl(edDraft.logoUrl);
    $("edLogo").innerHTML = src ? `<img src="${esc(src)}" alt="Foto DIV ${pad(d.number)}">` : `<b>${pad(d.number)}</b>`;
    $("edLogoRemove").hidden = !src;
    $("edStatus").querySelectorAll("[data-status]").forEach((b) => {
      const on = b.dataset.status === edDraft.status;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", String(on));
    });
    $("edNeedsWrap").hidden = !open;
    $("edRoles").innerHTML = NEED_ROLES.map(
      ([k, label]) => `<button type="button" class="ed-role${edDraft.needs.has(k) ? " is-on" : ""}" data-need="${k}" aria-pressed="${edDraft.needs.has(k)}"><b>${k}</b><small>${label}</small></button>`,
    ).join("");
    $("edNeedsHint").textContent = edDraft.needs.size ? `Kartu divisi akan tampil: MENCARI ${[...edDraft.needs].join(" · ")}` : "Belum dipilih → tampil sebagai \"SEMUA ROLE\".";
    renderEditorMembers();
  }
  function renderEditorMembers() {
    const d = rows.find((x) => x.number === edNumber);
    if (!d) return;
    const staff = isStaff();
    $("edCount").textContent = `${countOf(d)}/${d.capacity}`;
    const canRemove = (m) => staff || (!m.is_leader && String(m.id) !== String(authUser.id));
    const options = rows
      .filter((x) => x.number !== d.number)
      .map((x) => {
        const full = countOf(x) >= x.capacity;
        return `<option value="${x.number}"${full ? " disabled" : ""}>DIV ${pad(x.number)} · ${countOf(x)}/${x.capacity}${full ? " (PENUH)" : ""}</option>`;
      })
      .join("");
    $("edMemberList").innerHTML = d.members.length
      ? d.members
          .map(
            (m) => `<div class="ed-member${m.is_leader ? " is-leader" : ""}" data-pid="${esc(m.id)}">
              ${avatarHtml(m)}
              <span class="ed-member-copy"><b>${esc(nameOf(m))}</b><small>${m.is_leader ? "LEADER" : gameRole(m) || "MEMBER"}${String(m.id) === String(authUser.id) ? " · KAMU" : ""}</small></span>
              <span class="ed-member-actions">
                ${staff && m.in_roster !== false ? `<select data-move-target aria-label="Pindahkan ${esc(nameOf(m))}"><option value="">⇄ Pindah…</option>${options}</select>` : ""}
                ${canRemove(m) ? `<button type="button" class="dv-remove" data-remove="${esc(m.id)}">KELUARKAN</button>` : ""}
              </span>
            </div>`,
          )
          .join("")
      : '<p class="dv-empty">Belum ada anggota. Tambahkan lewat kolom di atas.</p>';
  }
  async function loadEditorRequests() {
    const n = edNumber;
    const box = $("edRequests");
    if (!box) return;
    const { data, error } = await db.rpc("f4_division_requests_pending", { p_division: n });
    if (n !== edNumber) return;
    edRequests = error ? [] : data || [];
    if (error) console.warn("Permintaan divisi belum aktif", error);
    renderEditorRequests();
  }
  function renderEditorRequests() {
    const wrap = $("edRequestsWrap"),
      box = $("edRequests");
    if (!wrap || !box) return;
    wrap.hidden = !edRequests.length;
    $("edReqCount").textContent = edRequests.length ? String(edRequests.length) : "";
    box.innerHTML = edRequests
      .map((r) => {
        const role = String(r.role || "tamu").toLowerCase(),
          promote = ["tamu", "calon_member"].includes(role),
          when = r.created_at ? new Date(r.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "";
        return `<div class="ed-request" data-req="${esc(r.id)}">
          <div class="ed-request-who">${avatarHtml(r)}<span><b>${esc(nameOf(r))}</b><small>${esc(ROLE_NAME[role] || role)}${promote ? " → akan jadi Member" : ""}${gameRole(r) ? " · " + gameRole(r) : ""}${when ? " · " + when : ""}</small></span></div>
          ${r.message ? `<p class="ed-request-msg">“${esc(r.message)}”</p>` : ""}
          <span class="ed-request-actions"><button type="button" class="dv-remove" data-req-reject="${esc(r.id)}">TOLAK</button><button type="button" class="ed-accept" data-req-accept="${esc(r.id)}">TERIMA</button></span>
        </div>`;
      })
      .join("");
  }
  async function decideRequest(id, approve) {
    const d = rows.find((x) => x.number === edNumber);
    const r = edRequests.find((x) => String(x.id) === String(id));
    if (!d || !r) return;
    const name = nameOf(r);
    if (approve && countOf(d) >= d.capacity) return edSay(`DIV ${pad(d.number)} sudah penuh (${countOf(d)}/${d.capacity}).`, "is-error");
    const promote = ["tamu", "calon_member"].includes(String(r.role || "").toLowerCase());
    const msg = approve
      ? promote
        ? `${name} masih belum Member.\n\nJadikan ${name} MEMBER F4NTASTIC dan masukkan ke DIV ${pad(d.number)}?`
        : `Terima ${name} masuk ke DIV ${pad(d.number)}?`
      : `Tolak permintaan ${name}?`;
    if (!confirm(msg)) return;
    edSay("Menyimpan…");
    const { data, error } = await db.rpc("f4_division_request_decide", { p_request: Number(id), p_approve: approve });
    if (error) {
      edSay(friendly(error), "is-error");
      return loadEditorRequests();
    }
    await refreshAll();
    await loadEditorRequests();
    edSay(approve ? `✓ ${name}${data ? " sekarang Member dan" : ""} masuk ke DIV ${pad(d.number)}.` : `Permintaan ${name} ditolak.`, "is-success");
  }
  async function refreshAll() {
    await loadData();
    renderSummary();
    render();
    if (modal && !modal.hidden) renderModal();
    if (editor && !editor.hidden) renderEditorMembers();
  }
  async function saveEditor(e) {
    e.preventDefault();
    const d = rows.find((x) => x.number === edNumber);
    if (!d || !edDraft) return;
    const cap = Number($("edCap").value);
    if (!Number.isInteger(cap) || cap < 1 || cap > 25) return edSay("Kapasitas harus 1 sampai 25.", "is-error");
    if (cap < countOf(d)) return edSay(`Kapasitas tidak boleh lebih kecil dari jumlah anggota sekarang (${countOf(d)}).`, "is-error");
    const btn = $("edSave");
    btn.disabled = true;
    try {
      let logo = edDraft.logoUrl || "";
      if (edDraft.logoFile) {
        edSay("Mengunggah foto divisi…");
        const f = edDraft.logoFile;
        const ext = ({ "image/png": "png", "image/webp": "webp" })[f.type] || "jpg";
        const path = `${d.number}/logo-${Date.now()}.${ext}`;
        const up = await db.storage.from(LOGO_BUCKET).upload(path, f, { contentType: f.type, upsert: false });
        if (up.error) throw up.error;
        logo = db.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
      }
      edSay("Menyimpan data divisi…");
      const roles = edDraft.status === "RECRUITING" ? NEED_ROLES.map(([k]) => k).filter((k) => edDraft.needs.has(k)) : [];
      const { error } = await db.rpc("f4_update_division", {
        p_division: d.number,
        p_squad_id: $("edSquad").value.trim(),
        p_whatsapp: $("edWa").value.trim(),
        p_capacity: cap,
        p_status: edDraft.status,
        p_roles: roles,
        p_description: $("edDesc").value.trim(),
        p_logo_url: logo,
      });
      if (error) throw error;
      edDraft.logoFile = null;
      edDraft.logoUrl = logo;
      await refreshAll();
      renderEditor();
      edSay(`✓ Data DIV ${pad(d.number)} tersimpan.`, "is-success");
    } catch (err) {
      edSay(friendly(err), "is-error");
    } finally {
      btn.disabled = false;
    }
  }
  /* members (inside the edit popup) */
  let addTimer = 0,
    addSeq = 0;
  async function searchCandidates() {
    const q = $("edAddSearch").value.trim().replace(/^@/, ""),
      box = $("edAddResults"),
      seq = ++addSeq;
    if (q.length < 2) {
      box.innerHTML = q ? '<p class="dv-add-empty">Ketik minimal 2 huruf.</p>' : "";
      return;
    }
    box.innerHTML = '<p class="dv-add-empty">Mencari akun…</p>';
    // digits only (spaces allowed) → exact Mobile Legends ID lookup
    const ml = q.replace(/\s+/g, "");
    if (/^\d{5,}$/.test(ml)) return searchByMl(ml, box, seq);
    const { data, error } = await db.rpc("f4_division_candidates", { p_division: edNumber, p_query: q });
    if (seq !== addSeq) return;
    if (error) {
      box.innerHTML = `<p class="dv-add-empty is-error">${esc(friendly(error))}</p>`;
      return;
    }
    box.innerHTML = (data || []).length
      ? data
          .map(
            (a) =>
              (() => {
                const role = String(a.role || "tamu").toLowerCase(),
                  promote = ["tamu", "calon_member"].includes(role);
                return `<div class="dv-add-row">${avatarHtml(a)}<span><b>${esc(nameOf(a))}</b><small>${a.full_name && a.username ? esc(a.full_name) + " · " : ""}${esc(ROLE_NAME[role] || role)}${promote ? " → akan jadi Member" : ""}</small></span><button type="button" data-add="${esc(a.id)}" data-name="${esc(nameOf(a))}" data-promote="${promote ? 1 : ""}">${promote ? "+ JADIKAN MEMBER" : "+ TAMBAH"}</button></div>`;
              })(),
          )
          .join("")
      : '<p class="dv-add-empty">Tidak ada akun tanpa divisi yang cocok. Akun yang sudah di divisi lain hanya bisa dipindah admin.</p>';
  }
  const ROLE_NAME = { tamu: "Tamu", calon_member: "Calon Member", member: "Member", leader_squad: "Leader Squad", admin: "Admin", developer: "Developer", owner: "Owner" };
  async function searchByMl(ml, box, seq) {
    const { data, error } = await db.rpc("f4_division_find_by_ml", { p_division: edNumber, p_ml_id: ml });
    if (seq !== addSeq) return;
    if (error) {
      box.innerHTML = `<p class="dv-add-empty is-error">${esc(friendly(error))}</p>`;
      return;
    }
    const list = data || [];
    if (!list.length) {
      box.innerHTML = '<p class="dv-add-empty">Tidak ada akun dengan ID ML itu. Pastikan pemiliknya sudah daftar di website &amp; mengisi ID ML di profilnya.</p>';
      return;
    }
    if (list.length > 1) {
      box.innerHTML = '<p class="dv-add-empty is-error">ID ML ini dipakai lebih dari satu akun. Minta admin untuk mengecek.</p>';
      return;
    }
    const a = list[0];
    const role = String(a.role || "tamu").toLowerCase();
    const promote = ["tamu", "calon_member"].includes(role);
    const other = a.in_division ? Number(a.in_division) : null;
    box.innerHTML = `<div class="dv-add-row is-ml">${avatarHtml(a)}<span><b>${esc(nameOf(a))}</b><small>ID ML cocok · ${esc(ROLE_NAME[role] || role)}${promote ? " → akan jadi Member" : ""}</small></span>${
      other
        ? `<em class="dv-add-note">Sudah di DIV ${pad(other)}</em>`
        : `<button type="button" data-add-ml="${esc(ml)}" data-name="${esc(nameOf(a))}" data-promote="${promote ? 1 : ""}">${promote ? "+ JADIKAN MEMBER" : "+ TAMBAH"}</button>`
    }</div>`;
  }
  async function addMemberByMl(ml, name, promote) {
    const d = rows.find((x) => x.number === edNumber);
    if (!d) return;
    if (countOf(d) >= d.capacity) return edSay(`DIV ${pad(d.number)} sudah penuh (${countOf(d)}/${d.capacity}).`, "is-error");
    const msg = promote
      ? `${name} masih belum Member.\n\nJadikan ${name} MEMBER F4NTASTIC dan masukkan ke DIV ${pad(d.number)}?`
      : `Tambahkan ${name} ke DIV ${pad(d.number)}?`;
    if (!confirm(msg)) return;
    edSay("Menambahkan…");
    const { data, error } = await db.rpc("f4_division_add_member_by_ml", { p_division: d.number, p_ml_id: ml });
    if (error) return edSay(/Could not find the function/i.test(String(error.message)) ? "Fitur ID ML belum aktif — admin perlu menjalankan supabase-division-add-by-ml.sql." : friendly(error), "is-error");
    const row = Array.isArray(data) ? data[0] : data;
    $("edAddSearch").value = "";
    $("edAddResults").innerHTML = "";
    await refreshAll();
    edSay(`✓ ${name}${row?.promoted ? " sekarang Member dan" : ""} masuk ke DIV ${pad(d.number)}.`, "is-success");
  }
  async function addMember(pid, name, promote) {
    const d = rows.find((x) => x.number === edNumber);
    if (!d) return;
    if (countOf(d) >= d.capacity) return edSay(`DIV ${pad(d.number)} sudah penuh (${countOf(d)}/${d.capacity}).`, "is-error");
    const msg = promote
      ? `${name} masih belum Member.\n\nJadikan ${name} MEMBER F4NTASTIC dan masukkan ke DIV ${pad(d.number)}?`
      : `Tambahkan ${name} ke DIV ${pad(d.number)}?`;
    if (!confirm(msg)) return;
    edSay("Menambahkan…");
    const { data, error } = await db.rpc("f4_division_add_member", { p_division: d.number, p_target_id: pid });
    if (error) return edSay(friendly(error), "is-error");
    $("edAddSearch").value = "";
    $("edAddResults").innerHTML = "";
    await refreshAll();
    await loadEditorRequests();
    edSay(`✓ ${name}${data === true ? " sekarang Member dan" : ""} masuk ke DIV ${pad(d.number)}.`, "is-success");
  }
  async function removeMember(pid) {
    const d = rows.find((x) => x.number === edNumber);
    const m = d?.members.find((x) => String(x.id) === String(pid));
    if (!m) return;
    if (!confirm(`Keluarkan ${nameOf(m)} dari DIV ${pad(d.number)}?`)) return;
    edSay("Menyimpan…");
    const { error } = await db.rpc("f4_division_remove_member", { p_division: d.number, p_target_id: m.id });
    if (error) return edSay(friendly(error), "is-error");
    await refreshAll();
    edSay(`✓ ${nameOf(m)} dikeluarkan dari DIV ${pad(d.number)}.`, "is-success");
  }
  async function moveMember(pid, toNumber) {
    const from = rows.find((x) => x.number === edNumber);
    const to = rows.find((x) => x.number === toNumber);
    const m = from?.members.find((x) => String(x.id) === String(pid));
    if (!from || !to || !m) return;
    if (countOf(to) >= to.capacity) return edSay(`DIV ${pad(to.number)} sudah penuh (${countOf(to)}/${to.capacity}).`, "is-error");
    if (!confirm(`Pindahkan ${nameOf(m)} dari DIV ${pad(from.number)} ke DIV ${pad(to.number)}?${m.is_leader ? "\n\nStatus LEADER-nya tidak berubah (atur leader lewat Manage Role)." : ""}`)) return renderEditorMembers();
    edSay("Memindahkan…");
    const { error } = await db.rpc("f4_set_profile_division", { p_target_id: m.id, p_division_id: to.number, p_is_leader: false });
    if (error) return edSay(friendly(error), "is-error");
    await refreshAll();
    edSay(`✓ ${nameOf(m)} dipindah ke DIV ${pad(to.number)}.`, "is-success");
  }
  if (editor) {
    $("edForm").addEventListener("submit", saveEditor);
    editor.addEventListener("click", (e) => {
      if (e.target.closest("[data-ed-close]")) return closeEditor();
      const st = e.target.closest("#edStatus [data-status]");
      if (st) {
        edDraft.status = st.dataset.status;
        return renderEditor();
      }
      const nd = e.target.closest("[data-need]");
      if (nd) {
        if (edDraft.needs.has(nd.dataset.need)) edDraft.needs.delete(nd.dataset.need);
        else edDraft.needs.add(nd.dataset.need);
        return renderEditor();
      }
      if (e.target.closest("#edLogoRemove")) {
        edDraft.logoFile = null;
        edDraft.logoUrl = "";
        $("edLogoFile").value = "";
        return renderEditor();
      }
      const add = e.target.closest("[data-add]");
      if (add) return addMember(add.dataset.add, add.dataset.name, Boolean(add.dataset.promote));
      const ra = e.target.closest("[data-req-accept]");
      if (ra) return decideRequest(ra.dataset.reqAccept, true);
      const rr = e.target.closest("[data-req-reject]");
      if (rr) return decideRequest(rr.dataset.reqReject, false);
      const addMl = e.target.closest("[data-add-ml]");
      if (addMl) return addMemberByMl(addMl.dataset.addMl, addMl.dataset.name, Boolean(addMl.dataset.promote));
      const rm = e.target.closest("[data-remove]");
      if (rm) return removeMember(rm.dataset.remove);
    });
    editor.addEventListener("change", (e) => {
      const mv = e.target.closest("[data-move-target]");
      if (mv && mv.value) return moveMember(mv.closest("[data-pid]").dataset.pid, Number(mv.value));
      if (e.target.id === "edLogoFile") {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return edSay("Foto harus JPG, PNG, atau WEBP.", "is-error");
        if (f.size > 3 * 1048576) return edSay("Foto maksimal 3 MB.", "is-error");
        edDraft.logoFile = f;
        edSay("Foto baru belum tersimpan — klik SIMPAN DATA DIVISI.");
        renderEditor();
      }
    });
    $("edAddSearch").addEventListener("input", () => {
      clearTimeout(addTimer);
      addTimer = setTimeout(searchCandidates, 250);
    });
  }

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
    if (!anyPopupOpen()) document.documentElement.classList.remove("dv-modal-open");
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
    const eo = e.target.closest("[data-edit-open]");
    if (eo) return openEditor(Number(eo.dataset.editOpen));
    const jn = e.target.closest("[data-join]");
    if (jn) return requestJoin(Number(jn.dataset.join), jn);
    if (e.target.closest("[data-join-cancel]")) return cancelJoin();
    const jo = e.target.closest("[data-join-open]");
    if (jo) return openModal(Number(jo.dataset.joinOpen));
    const chip = e.target.closest("[data-role]");
    if (chip) {
      modalRole = chip.dataset.role;
      return renderModal();
    }
  });
  $("dvMemberFilter")?.addEventListener("input", renderModal);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (pf && !pf.hidden) closeProfile();
    else if (editor && !editor.hidden) closeEditor();
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
    if (ed) openEditor(Number(ed.dataset.edit));
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
