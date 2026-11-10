/* Admin panel → Manage Devisi.
   - admin / developer / owner: every division (picker), every admin menu.
   - Leader Squad (or the official leader of a division): ONLY their own division, and only this menu.
   All writes go through RPCs in supabase-division-leader-manage.sql, which enforce the same rules server-side. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pad = (n) => String(n).padStart(2, "0");
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "")) ? String(u) : "");
  const nameOf = (m) => m.username || m.full_name || "Tanpa nama";
  const GAME_ROLE = { jungler: "JUNG", gold: "GOLD", exp: "EXP", roam: "ROAM", mid: "MID" };
  const db = window.getF4GalleryClient?.();

  let me = null,
    staff = false,
    divisions = [],
    roster = [],
    current = null, // division number being managed
    allowed = []; // divisions this account may manage (all for staff)

  const gate = (title, copy) => {
    $("gateTitle").innerHTML = title;
    $("gateCopy").textContent = copy;
    $("gateHome").hidden = false;
  };
  const say = (text, ok = false) => {
    const el = $("mdStatus");
    el.textContent = text || "";
    el.className = `role-status-message ${text ? (ok ? "is-success" : "is-error") : ""}`;
  };
  const friendly = (err) => {
    const msg = String(err?.message || err || "");
    if (/Could not find the function|does not exist/i.test(msg)) return "Fitur belum aktif — admin perlu menjalankan supabase-division-leader-manage.sql di Supabase.";
    return msg || "Terjadi kesalahan. Coba lagi.";
  };
  const avatar = (m) => {
    const url = safeUrl(m.avatar_url),
      initial = esc(nameOf(m).charAt(0).toUpperCase());
    return `<span class="role-avatar">${url ? `<img class="role-avatar-img" src="${esc(url)}" alt="" loading="lazy" data-fallback="${initial}">` : `<span class="role-avatar-letter">${initial}</span>`}</span>`;
  };
  // broken avatar → initial (error doesn't bubble, so capture)
  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (img instanceof HTMLImageElement && img.dataset.fallback !== undefined)
        img.replaceWith(Object.assign(document.createElement("span"), { className: "role-avatar-letter", textContent: img.dataset.fallback }));
    },
    true,
  );

  async function loadRoster() {
    const [{ data: ds }, { data: rs, error }] = await Promise.all([
      db.from("f4_divisions").select("id,squad_id,capacity").order("id"),
      db.rpc("f4_division_roster"),
    ]);
    if (error) throw error;
    divisions = (ds || []).map((d) => ({ id: Number(d.id), squad_id: d.squad_id || "", capacity: Number(d.capacity) || 25 }));
    roster = (rs || []).map((r) => ({ ...r, division_id: Number(r.division_id) }));
  }

  async function boot() {
    if (!db) return gate("KONFIGURASI<br /><b>BELUM ADA.</b>", "Konfigurasi Supabase tidak tersedia.");
    const { data: { session } } = await db.auth.getSession();
    if (!session?.user) return location.replace("login.html?redirect=manage-division.html");
    me = session.user;
    const [{ data: profile }, { data: manager }] = await Promise.all([
      db.from("profiles").select("role,roles").eq("id", me.id).maybeSingle(),
      db.from("gallery_managers").select("role").eq("id", me.id).maybeSingle(),
    ]);
    const roles = [...(Array.isArray(profile?.roles) ? profile.roles : []), profile?.role, manager?.role].map((r) => String(r || "").toLowerCase());
    staff = roles.some((r) => ["admin", "developer", "owner"].includes(r));
    try {
      await loadRoster();
    } catch (e) {
      console.warn(e);
      return gate("ROSTER<br /><b>BELUM AKTIF.</b>", "Admin perlu menjalankan supabase-division-roster.sql di Supabase terlebih dahulu.");
    }
    // Mirrors f4_can_manage_roster(): every division I lead + (as Leader Squad) the division I'm a member of
    const mineAll = roster.filter((r) => String(r.profile_id) === String(me.id));
    const home = mineAll.find((r) => r.in_roster !== false);
    const wanted = Number(new URLSearchParams(location.search).get("id"));
    if (staff) allowed = divisions.map((d) => d.id);
    else {
      allowed = [...new Set([
        ...mineAll.filter((r) => r.is_leader).map((r) => r.division_id),
        ...(roles.includes("leader_squad") && home ? [home.division_id] : []),
      ])].sort((a, b) => a - b);
      if (!roles.includes("leader_squad") && !allowed.length) return gate("AKSES<br /><b>DITOLAK.</b>", "Halaman ini hanya untuk Leader Squad dan admin.");
      if (!allowed.length) return gate("BELUM ADA<br /><b>DIVISI.</b>", "Akun kamu belum dimasukkan ke divisi mana pun. Minta admin memasukkan kamu ke divisimu lewat Manage Role.");
    }
    current = allowed.includes(wanted) ? wanted : home && allowed.includes(home.division_id) ? home.division_id : allowed[0] || 1;
    document.querySelectorAll("[data-staff-only]").forEach((a) => (a.hidden = !staff));
    $("divisionPickerWrap").hidden = allowed.length < 2;
    $("accessCopy").textContent = staff
      ? "Akses admin: kelola anggota semua divisi. Untuk memindah member antar divisi atau memilih leader, pakai Manage Role."
      : `Akses Leader: kamu hanya bisa mengelola ${allowed.map((n) => `DIV ${pad(n)}`).join(", ")}. Tambah akun Member yang belum punya divisi, atau keluarkan anggota.`;
    $("loginScreen").hidden = true;
    $("dashboard").hidden = false;
    render();
  }

  const membersOf = (n) =>
    roster
      .filter((r) => r.division_id === n)
      .sort((a, b) => (b.is_leader - a.is_leader) || nameOf(a).localeCompare(nameOf(b), "id"));

  function render() {
    const d = divisions.find((x) => x.id === current) || { id: current, squad_id: "", capacity: 25 };
    const list = membersOf(current),
      leader = list.find((m) => m.is_leader);
    if (allowed.length > 1) {
      $("divisionPicker").innerHTML = divisions
        .filter((x) => allowed.includes(x.id))
        .map((x) => `<option value="${x.id}"${x.id === current ? " selected" : ""}>DIV ${pad(x.id)} · ${membersOf(x.id).length}/${x.capacity}</option>`)
        .join("");
    }
    $("statDivision").textContent = `DIV ${pad(current)}`;
    $("statSquad").textContent = `SQUAD ID ${d.squad_id || "—"}`;
    $("statCount").textContent = `${list.length}/${d.capacity}`;
    $("statSlots").textContent = list.length >= d.capacity ? "DIVISI PENUH" : `${d.capacity - list.length} SLOT TERSISA`;
    $("statLeader").textContent = leader ? nameOf(leader) : "BELUM ADA";
    $("addTitle").textContent = `TAMBAH KE DIV ${pad(current)}`;
    $("rosterNote").textContent = staff
      ? "Admin bisa mengeluarkan siapa pun, termasuk leader."
      : "Kamu tidak bisa mengeluarkan dirimu sendiri atau leader divisi. Hubungi admin untuk itu.";
    const canRemove = (m) => staff || (!m.is_leader && String(m.profile_id) !== String(me.id));
    const wrap = $("rosterTable");
    if (!list.length) {
      wrap.innerHTML = '<p class="empty">Belum ada anggota di divisi ini.</p>';
      return;
    }
    wrap.innerHTML = `<table><thead><tr><th>AKUN</th><th>ROLE IN-GAME</th><th>STATUS</th><th>MASUK DIVISI</th><th>AKSI</th></tr></thead><tbody>${list
      .map(
        (m) => `<tr>
          <td><div class="role-account">${avatar(m)}<div><strong class="candidate-name">${esc(nameOf(m))}</strong><span class="ign">${m.full_name && m.username ? esc(m.full_name) : ""}${String(m.profile_id) === String(me.id) ? " · KAMU" : ""}</span></div></div></td>
          <td>${esc(GAME_ROLE[m.game_role] || "—")}</td>
          <td>${m.is_leader ? '<span class="role-division-chip is-leader">★ LEADER</span>' : '<span class="role-division-chip">MEMBER</span>'}</td>
          <td>${m.assigned_at ? new Date(m.assigned_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
          <td>${canRemove(m) ? `<button type="button" class="md-remove" data-remove="${esc(m.profile_id)}" data-name="${esc(nameOf(m))}">KELUARKAN</button>` : '<span class="role-division-none">—</span>'}</td>
        </tr>`,
      )
      .join("")}</tbody></table>`;
  }

  let timer = 0,
    seq = 0;
  async function searchCandidates() {
    const q = $("candidateSearch").value.trim().replace(/^@/, ""),
      box = $("candidateResults"),
      mySeq = ++seq;
    if (q.length < 2) {
      box.innerHTML = q ? '<p class="md-hint">Ketik minimal 2 huruf.</p>' : "";
      return;
    }
    box.innerHTML = '<p class="md-hint">Mencari akun…</p>';
    const { data, error } = await db.rpc("f4_division_candidates", { p_division: current, p_query: q });
    if (mySeq !== seq) return;
    if (error) {
      box.innerHTML = `<p class="md-hint is-error">${esc(friendly(error))}</p>`;
      return;
    }
    box.innerHTML = (data || []).length
      ? data
          .map(
            (a) =>
              `<div class="md-candidate">${avatar(a)}<div><strong>${esc(nameOf(a))}</strong><small>${a.full_name && a.username ? esc(a.full_name) : "Belum punya divisi"}</small></div><button type="button" data-add="${esc(a.id)}" data-name="${esc(nameOf(a))}">+ TAMBAH</button></div>`,
          )
          .join("")
      : '<p class="md-hint">Tidak ada akun Member tanpa divisi yang cocok. Akun yang sudah di divisi lain hanya bisa dipindah admin.</p>';
  }

  async function addMember(id, name) {
    const d = divisions.find((x) => x.id === current);
    if (d && membersOf(current).length >= d.capacity) return say(`DIV ${pad(current)} sudah penuh.`);
    if (!confirm(`Tambahkan ${name} ke DIV ${pad(current)}?`)) return;
    say("Menambahkan…", true);
    const { error } = await db.rpc("f4_division_add_member", { p_division: current, p_target_id: id });
    if (error) return say(friendly(error));
    $("candidateSearch").value = "";
    $("candidateResults").innerHTML = "";
    await loadRoster();
    render();
    say(`✓ ${name} masuk ke DIV ${pad(current)}.`, true);
  }
  async function removeMember(id, name) {
    if (!confirm(`Keluarkan ${name} dari DIV ${pad(current)}?`)) return;
    const { error } = await db.rpc("f4_division_remove_member", { p_division: current, p_target_id: id });
    if (error) return say(friendly(error));
    await loadRoster();
    render();
    say(`✓ ${name} dikeluarkan dari DIV ${pad(current)}.`, true);
  }

  $("candidateSearch").addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(searchCandidates, 250);
  });
  $("candidateResults").addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (b) addMember(b.dataset.add, b.dataset.name);
  });
  $("rosterTable").addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]");
    if (b) removeMember(b.dataset.remove, b.dataset.name);
  });
  $("divisionPicker").addEventListener("change", (e) => {
    const n = Number(e.target.value);
    if (!allowed.includes(n)) return;
    current = n;
    history.replaceState(null, "", `?id=${pad(current)}`);
    $("candidateSearch").value = "";
    $("candidateResults").innerHTML = "";
    say("");
    render();
  });
  $("refresh").addEventListener("click", async () => {
    await loadRoster().catch((e) => say(friendly(e)));
    render();
  });
  boot().catch((e) => {
    console.error(e);
    gate("GAGAL<br /><b>MEMUAT.</b>", String(e?.message || e));
  });
})();
