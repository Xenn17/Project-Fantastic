(() => {
  "use strict";
  // Site root from this script's URL (/js/divisions.js → /): the page lives at /devisi/.
  const ROOT = (() => {
    try { return new URL("../", document.currentScript.src).href; } catch { return ""; }
  })();
  const pad = (n) => String(n).padStart(2, "0");
  const seed = window.F4_DIVISION_SEED || [],
    $ = (id) => document.getElementById(id),
    esc = (s) =>
      String(s ?? "").replace(
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
  let memberSeed = window.F4_DIVISION_MEMBER_SEED || {};
  let rows = seed.map((x) => ({
    ...x,
    status: x.reported_members >= x.capacity ? "FULL" : "CLOSED",
    members: (memberSeed[String(x.number)] || []).map((m, i) => ({
      id: "seed-" + x.number + "-" + i,
      nick: m.nickname,
      ml_id: m.ml_id || "BELUM DIISI",
      role: m.role || "BELUM DIKONFIRMASI",
    })),
    description:
      "Informasi divisi akan dilengkapi oleh Leader setelah data resmi dikonfirmasi.",
    announcement:
      "Informasi rekrutmen akan diumumkan melalui pengelola divisi.",
  }));
  let db = null,
    profile = null,
    authUser = null,
    leaderDivisions = [],
    adminPerm = null;
  function statusOf(d) {
    if (!d.leader) return "LEADER NEEDED";
    if (Number(d.reported_members) >= Number(d.capacity)) return "FULL";
    return d.status === "RECRUITING" ? "RECRUITING" : "CLOSED";
  }
  function statusClass(s) {
    return s === "RECRUITING"
      ? "status-recruiting"
      : s === "FULL"
        ? "status-full"
        : s === "CLOSED"
          ? "status-closed"
          : "status-leader-needed";
  }
  function roleBadges(value) {
    const raw = String(value ?? "BELUM DIKONFIRMASI").trim();
    if (!raw)
      return '<b class="role-badge role-unknown">BELUM DIKONFIRMASI</b>';
    return raw
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const key = part.toUpperCase().replace(/\s+/g, " ").trim();
        const known = {
          EXP: "role-exp",
          JUNG: "role-jung",
          GOLD: "role-gold",
          MID: "role-mid",
          ROAM: "role-roam",
          "ROAM SUP": "role-roam-sup",
          "ROAM SUPP": "role-roam-sup",
          "ROAM SUPPORT": "role-roam-sup",
          MM: "role-mm",
          MAGE: "role-mage",
          FLEX: "role-flex",
          ALLROLE: "role-allrole",
          "ALL ROLE FINAL": "role-allrole",
          ROSM: "role-unknown",
        };
        const cls = known[key] || "role-unknown";
        const label = ["ROAM SUPPORT", "ROAM SUPP"].includes(key)
          ? "ROAM SUP"
          : part;
        return `<b class="role-badge ${cls}">${esc(label)}</b>`;
      })
      .join("");
  }
  function renderSummary() {
    let counts = {
      total: rows.reduce((n, d) => n + d.reported_members, 0),
      recruiting: 0,
      full: 0,
      closed: 0,
      noLeader: 0,
    };
    rows.forEach((d) => {
      let s = statusOf(d);
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
      .map(
        ([l, v]) =>
          `<div class="summary-item"><strong>${v}</strong><span>${l}</span></div>`,
      )
      .join("");
    $("lastUpdated").textContent = "Snapshot roster awal · WIB";
  }
  function render() {
    let filter = $("divisionFilter").value,
      sort = $("divisionSort").value,
      list = rows.filter((d) => filter === "ALL" || statusOf(d) === filter);
    list.sort((a, b) => {
      let delta = 0;
      if (sort === "MOST_MEMBERS")
        delta = b.reported_members - a.reported_members;
      else if (sort === "LEAST_MEMBERS")
        delta = a.reported_members - b.reported_members;
      else if (sort === "MOST_SLOTS")
        delta =
          b.capacity - b.reported_members - (a.capacity - a.reported_members);
      else if (sort === "FEWEST_SLOTS")
        delta =
          a.capacity - a.reported_members - (b.capacity - b.reported_members);
      else if (sort === "RECRUITING_FIRST")
        delta =
          (statusOf(a) === "RECRUITING" ? -1 : 0) -
          (statusOf(b) === "RECRUITING" ? -1 : 0);
      return delta || a.number - b.number;
    });
    $("divisionGrid").innerHTML = list
      .map((d) => {
        let s = statusOf(d),
          wa = d.whatsapp
            ? `https://wa.me/${d.whatsapp.replace(/\D/g, "")}`
            : "";
        const fill = Math.min(100, Math.round((Number(d.reported_members) / Number(d.capacity || 1)) * 100));
        const slots = Math.max(0, Number(d.capacity) - Number(d.reported_members));
        return `<article class="division-card ${statusClass(s)}" id="division-${d.number}" data-number="${d.number}">
          <div class="dv-card-top">
            <span class="dv-number">${pad(d.number)}</span>
            <span class="division-status ${statusClass(s)}">${s}</span>
            <button class="division-edit" data-edit="${d.number}" title="Edit divisi" aria-label="Edit divisi ${d.number}">✎</button>
          </div>
          <h3>F4NTASTIC DIV. ${pad(d.number)}</h3>
          <div class="dv-leader"><span class="dv-avatar">${esc((d.leader || "?").charAt(0).toUpperCase())}</span><div><small>LEADER</small><strong>${esc(d.leader || "LEADER NEEDED")}</strong></div></div>
          <div class="dv-capacity">
            <div class="dv-capacity-head"><small>KAPASITAS</small><b>${d.reported_members}/${d.capacity}</b><em>${slots ? `${slots} slot` : "penuh"}</em></div>
            <div class="dv-bar"><i style="width:${fill}%"></i></div>
          </div>
          <dl class="dv-facts"><div><dt>SQUAD ID</dt><dd>${esc(d.squad_id || "—")}</dd></div><div><dt>MEMBER TERDATA</dt><dd>${d.members.length}</dd></div></dl>
          <div class="division-actions">
            <button class="dv-primary" data-members="${d.number}">LIHAT MEMBER</button>
            <a class="wa" href="${wa || "#"}" ${wa ? 'target="_blank" rel="noopener"' : 'aria-disabled="true"'} title="Hubungi leader">WA</a>
            <button data-share="${d.number}" title="Salin link divisi" aria-label="Salin link divisi ${d.number}">⧉</button>
          </div>
        </article>`;
      })
      .join("");
    $("quickDivision").innerHTML =
      '<option value="">BUKA DIVISI…</option>' +
      rows
        .map(
          (d) =>
            `<option value="${d.number}">DIV ${pad(d.number)} — ${esc(d.leader || "")}</option>`,
        )
        .join("");
    applyEditPermissions();
  }
  function applyEditPermissions() {
    let roles = profile?.roles || [profile?.role || "tamu"];
    let canAll = roles.some((r) => ["developer", "owner"].includes(r));
    let canAdmin = roles.includes("admin");
    document.querySelectorAll("[data-edit]").forEach((b) => {
      let n = Number(b.dataset.edit),
        d = rows.find((x) => x.number === n);
      let own = leaderDivisions.includes(n);
      b.classList.toggle("visible", canAll || canAdmin || own);
    });
  }
  async function init() {
    try {
      if (window.getF4GalleryClient) {
        db = window.getF4GalleryClient();
        let {
          data: { session },
        } = await db.auth.getSession();
        authUser = session?.user || null;
        if (authUser) {
          let { data } = await db
            .from("profiles")
            .select("role,roles")
            .eq("id", authUser.id)
            .maybeSingle();
          profile = data || null;
          let { data: ld } = await db
            .from("f4_division_leaders")
            .select("division_id")
            .eq("profile_id", authUser.id);
          leaderDivisions = (ld || []).map((x) => Number(x.division_id));
          let { data: perm } = await db
            .from("f4_division_admin_permissions")
            .select("can_manage_members,can_edit_divisions")
            .eq("profile_id", authUser.id)
            .maybeSingle();
          adminPerm = perm || null;
          let { data: ds } = await db
            .from("f4_divisions")
            .select("*")
            .order("id");
          if (ds?.length) {
            rows = ds.map((x) => ({
              number: x.id,
              leader: x.leader_name,
              squad_id: x.squad_id,
              whatsapp: x.whatsapp || "",
              reported_members: x.member_count,
              capacity: x.capacity,
              status: x.recruitment_status,
              description: x.description || "",
              announcement: x.announcement || "",
              spotlight: x.spotlight,
              version: x.version,
              members: (memberSeed[String(x.id)] || []).map((m, i) => ({
                id: "seed-" + x.id + "-" + i,
                nick: m.nickname,
                ml_id: m.ml_id || "BELUM DIISI",
                role: m.role || "BELUM DIKONFIRMASI",
              })),
            }));
            let { data: mem } = await db
              .from("f4_division_members")
              .select("*")
              .order("nickname");
            // The database is the source of truth: a DB row replaces the seed entry with the same ML ID
            // (wherever it was), which is what makes "pindah divisi" work for seed members too.
            const dbMl = new Set((mem || []).map((m) => String(m.ml_id)));
            rows.forEach((d) => {
              d.members = d.members.filter((x) => !dbMl.has(String(x.ml_id)));
            });
            (mem || []).forEach((m) => {
              let d = rows.find((x) => x.number === m.division_id);
              if (d)
                d.members.push({
                  id: m.id,
                  nick: m.nickname,
                  ml_id: m.ml_id,
                  role: (m.roles || []).join("/"),
                  fromDb: true,
                });
            });
          }
        }
      }
    } catch (e) {
      console.warn("Auth status unavailable", e);
    }
    let roles = profile?.roles || [profile?.role || "tamu"];
    let allowed =
      Boolean(authUser) &&
      roles.some((r) =>
        ["member", "leader_squad", "admin", "developer", "owner"].includes(r),
      );
    if (!allowed) {
      $("divisionGrid").innerHTML =
        `<div class="directory-error"><h3>AKSES DIREKTORI DIBATASI</h3><p>Halaman ini hanya dapat diakses oleh Member F4NTASTIC atau role pengelola yang berwenang.</p><a href="${ROOT}login.html">MASUK KE AKUN</a></div>`;
      document.querySelector(".directory-summary").hidden = true;
      document.querySelector(".directory-toolbar").hidden = true;
      document.querySelector(".member-search-wrap").hidden = true;
      return;
    }
    renderSummary();
    render();
  }
  /* ================= Member popup + move member to another division ================= */
  const modal = $("divisionModal");
  let modalNumber = null,
    modalRole = "ALL",
    modalHighlight = null,
    lastFocus = null;
  const rolesList = () => profile?.roles || [profile?.role || "tamu"];
  const isDeveloper = () => rolesList().some((r) => ["developer", "owner"].includes(r));
  // Mirrors f4_directory_can_manage_members(): developer/owner, the division's leader, or an admin with
  // can_manage_members. RLS enforces the same rule server-side; this only decides what to show.
  const canManage = (n) => Boolean(authUser) && (isDeveloper() || leaderDivisions.includes(n) || Boolean(adminPerm?.can_manage_members));
  const roleKey = (r) => String(r || "").split("/")[0].trim().toUpperCase() || "BELUM";
  function parseRoles(value) {
    const parts = String(value || "")
      .split("/")
      .map((x) => x.trim().toUpperCase())
      .filter((x) => x && !/BELUM/.test(x));
    return parts.length ? parts.slice(0, 2) : ["FLEX"];
  }
  function openModal(n, opts = {}) {
    const d = rows.find((x) => x.number === n);
    if (!d || !modal) return;
    modalNumber = n;
    modalRole = "ALL";
    modalHighlight = opts.highlight || null;
    $("dvMemberFilter").value = "";
    $("dvModalStatus").textContent = "";
    lastFocus = document.activeElement;
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
    document.documentElement.classList.remove("dv-modal-open");
    history.replaceState(null, "", location.pathname);
    lastFocus?.focus?.();
  }
  function renderModal() {
    const d = rows.find((x) => x.number === modalNumber);
    if (!d) return;
    const s = statusOf(d);
    const manage = canManage(d.number);
    const wa = d.whatsapp ? `https://wa.me/${d.whatsapp.replace(/\D/g, "")}` : "";
    $("dvModalKicker").innerHTML = `<span></span> DIVISI ${pad(d.number)} · <b class="division-status ${statusClass(s)}">${s}</b>`;
    $("dvModalTitle").textContent = `F4NTASTIC DIV. ${pad(d.number)}`;
    $("dvModalMeta").innerHTML = `
      <div><small>LEADER</small><strong>${esc(d.leader || "LEADER NEEDED")}</strong></div>
      <div><small>KAPASITAS</small><strong>${d.reported_members}/${d.capacity}</strong></div>
      <div><small>SQUAD ID</small><strong>${esc(d.squad_id || "—")}</strong></div>
      ${wa ? `<a class="dv-wa" href="${wa}" target="_blank" rel="noopener">HUBUNGI LEADER ↗</a>` : ""}`;
    const roles = [...new Set(d.members.map((m) => roleKey(m.role)))].sort();
    $("dvRoleChips").innerHTML = ["ALL", ...roles]
      .map((r) => `<button type="button" class="dv-chip${r === modalRole ? " is-active" : ""}" data-role="${esc(r)}">${r === "ALL" ? `SEMUA <b>${d.members.length}</b>` : esc(r)}</button>`)
      .join("");
    const note = $("dvManageNote");
    note.hidden = !manage;
    note.textContent = manage ? "Kamu bisa memindahkan member dari divisi ini ke divisi lain lewat tombol PINDAH di tiap baris." : "";
    const q = $("dvMemberFilter").value.trim().toLowerCase();
    const options = rows
      .filter((x) => x.number !== d.number)
      .map((x) => {
        const full = Number(x.reported_members) >= Number(x.capacity);
        return `<option value="${x.number}"${full ? " disabled" : ""}>DIV ${pad(x.number)} · ${esc(x.leader || "")} · ${x.reported_members}/${x.capacity}${full ? " (PENUH)" : ""}</option>`;
      })
      .join("");
    const list = d.members
      .slice()
      .sort((a, b) => a.nick.localeCompare(b.nick, "id"))
      .filter((m) => (modalRole === "ALL" || roleKey(m.role) === modalRole) && (!q || m.nick.toLowerCase().includes(q) || String(m.ml_id).includes(q)));
    const leaderRow = `<article class="dv-member is-leader"><span class="dv-avatar">${esc((d.leader || "?").charAt(0).toUpperCase())}</span><div class="dv-member-copy"><strong>${esc(d.leader || "LEADER NEEDED")}</strong><small>Leader divisi</small></div><div class="member-role-list"><b class="role-badge role-leader">LEADER</b></div></article>`;
    $("dvMemberList").innerHTML =
      (modalRole === "ALL" && !q ? leaderRow : "") +
      (list.length
        ? list
            .map((m) => {
              const idx = d.members.indexOf(m);
              const hl = modalHighlight && String(m.ml_id) === String(modalHighlight);
              return `<article class="dv-member${hl ? " is-highlight" : ""}" data-idx="${idx}">
                <span class="dv-avatar">${esc(m.nick.charAt(0).toUpperCase())}</span>
                <div class="dv-member-copy"><strong>${esc(m.nick)}</strong><small>ID ML · ${esc(m.ml_id)}</small></div>
                <div class="member-role-list">${roleBadges(m.role)}${manage ? `<button type="button" class="dv-move-toggle" data-toggle-move aria-expanded="false">⇄ PINDAH</button>` : ""}</div>
                ${manage ? `<div class="dv-move"><select data-move-target aria-label="Pindahkan ${esc(m.nick)} ke divisi"><option value="">Pindah ke divisi…</option>${options}</select><button type="button" data-move="${idx}">PINDAH</button></div>` : ""}
              </article>`;
            })
            .join("")
        : `<p class="dv-empty">${d.members.length ? "Tidak ada member yang cocok." : "Belum ada member terdata di divisi ini."}</p>`);
  }
  async function bumpCount(d, delta) {
    const next = Math.max(1, Math.min(Number(d.capacity), Number(d.reported_members) + delta));
    let q = db.from("f4_divisions").update({ member_count: next, ...(d.version ? { version: d.version + 1 } : {}) }).eq("id", d.number);
    if (d.version) q = q.eq("version", d.version);
    const { data, error } = await q.select().maybeSingle();
    if (error || !data) return false;
    d.reported_members = data.member_count ?? next;
    d.version = data.version ?? d.version;
    return true;
  }
  async function moveMember(fromNumber, idx, toNumber) {
    const from = rows.find((x) => x.number === fromNumber);
    const to = rows.find((x) => x.number === toNumber);
    const m = from?.members[idx];
    if (!from || !to || !m) return;
    const say = (text, kind = "") => {
      $("dvModalStatus").textContent = text;
      $("dvModalStatus").className = `dv-modal-status ${kind}`;
    };
    if (Number(to.reported_members) >= Number(to.capacity)) return say(`DIV ${pad(to.number)} sudah penuh (${to.reported_members}/${to.capacity}).`, "is-error");
    if (!/^[0-9]{1,25}$/.test(String(m.ml_id))) return say(`${m.nick} belum punya ID ML yang valid, jadi belum bisa dipindah. Lengkapi lewat editor divisi.`, "is-error");
    if (!confirm(`Pindahkan ${m.nick} dari DIV ${pad(from.number)} ke DIV ${pad(to.number)} (${to.leader})?`)) return;
    say("Memindahkan member…");
    try {
      let res;
      if (m.fromDb)
        res = await db.from("f4_division_members").update({ division_id: to.number, updated_at: new Date().toISOString() }).eq("id", m.id).select().maybeSingle();
      else
        // seed-only member → create the DB row in the target division (the DB row now overrides the seed entry)
        res = await db.from("f4_division_members").insert({ division_id: to.number, nickname: m.nick.slice(0, 30), ml_id: String(m.ml_id), roles: parseRoles(m.role) }).select().maybeSingle();
      if (res.error) throw res.error;
      from.members.splice(idx, 1);
      to.members.push({ ...m, id: res.data?.id || m.id, fromDb: true });
      const okFrom = await bumpCount(from, -1);
      const okTo = await bumpCount(to, +1);
      renderSummary();
      render();
      renderModal();
      say(
        okFrom && okTo
          ? `✓ ${m.nick} dipindah ke DIV ${pad(to.number)}.`
          : `✓ ${m.nick} dipindah ke DIV ${pad(to.number)}, tapi angka kapasitas belum tersinkron (butuh izin edit divisi).`,
        okFrom && okTo ? "is-success" : "is-warn",
      );
    } catch (err) {
      const msg = String(err?.message || err);
      say(/row-level security|permission/i.test(msg) ? "Kamu tidak punya izin mengelola member di divisi ini atau divisi tujuan." : `Gagal memindah: ${msg}`, "is-error");
    }
  }
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target.closest("[data-dv-close]")) return closeModal();
      const chip = e.target.closest("[data-role]");
      if (chip) {
        modalRole = chip.dataset.role;
        renderModal();
        return;
      }
      const tg = e.target.closest("[data-toggle-move]");
      if (tg) {
        const row = tg.closest(".dv-member");
        const open = !row.classList.contains("is-moving");
        $("dvMemberList").querySelectorAll(".dv-member.is-moving").forEach((r) => {
          r.classList.remove("is-moving");
          r.querySelector("[data-toggle-move]")?.setAttribute("aria-expanded", "false");
        });
        row.classList.toggle("is-moving", open);
        tg.setAttribute("aria-expanded", String(open));
        if (open) row.querySelector("[data-move-target]")?.focus();
        return;
      }
      const mv = e.target.closest("[data-move]");
      if (mv) {
        const sel = mv.parentElement.querySelector("[data-move-target]");
        if (!sel.value) {
          sel.focus();
          $("dvModalStatus").textContent = "Pilih divisi tujuan dulu.";
          $("dvModalStatus").className = "dv-modal-status is-error";
          return;
        }
        moveMember(modalNumber, Number(mv.dataset.move), Number(sel.value));
      }
    });
    $("dvMemberFilter").addEventListener("input", renderModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });
  }

  $("divisionFilter").addEventListener("change", render);
  $("divisionSort").addEventListener("change", render);
  $("quickDivision").addEventListener("change", (e) => {
    if (e.target.value) {
      openModal(Number(e.target.value));
      e.target.value = "";
    }
  });
  $("divisionGrid").addEventListener("click", async (e) => {
    let m = e.target.closest("[data-members]"),
      sh = e.target.closest("[data-share]"),
      ed = e.target.closest("[data-edit]");
    if (m) openModal(Number(m.dataset.members));
    if (sh) {
      let url = `${location.origin}${location.pathname}?id=${String(sh.dataset.share).padStart(2, "0")}`;
      try {
        await navigator.clipboard.writeText(url);
        alert("LINK DIVISI BERHASIL DISALIN!");
      } catch {
        prompt("Salin link divisi ini:", url);
      }
    }
    if (ed) {
      location.href = `${ROOT}division-editor.html?id=${pad(ed.dataset.edit)}`;
    }
  });
  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) {
      $("memberResults").innerHTML = "";
      return;
    }
    let matches = [];
    rows.forEach((d) =>
      d.members.forEach((m) => {
        if (m.nick.toLowerCase().includes(q) || m.ml_id.includes(q))
          matches.push({ ...m, division: d.number });
      }),
    );
    $("memberResults").innerHTML = matches.length
      ? matches
          .map(
            (m) =>
              `<button type="button" class="member-result" data-go="${m.division}" data-ml="${esc(m.ml_id)}"><span class="dv-avatar">${esc(m.nick.charAt(0).toUpperCase())}</span><span><b>${esc(m.nick)}</b><small>ID ${esc(m.ml_id)} · ${esc(m.role)}</small></span><em>DIV ${pad(m.division)} →</em></button>`,
          )
          .join("")
      : '<p class="activity-empty">MEMBER TIDAK DITEMUKAN · Periksa kembali nickname atau ID ML.</p>';
  }
  $("memberSearch").addEventListener("input", (e) => search(e.target.value));
  $("heroSearch").addEventListener("input", (e) => {
    $("memberSearch").value = e.target.value;
    search(e.target.value);
    $("member-search").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $("memberResults").addEventListener("click", (e) => {
    let x = e.target.closest("[data-go]");
    if (x) openModal(Number(x.dataset.go), { highlight: x.dataset.ml });
  });
  $("yearNow").textContent = new Date().getFullYear();
  let top = $("backTop");
  window.addEventListener("scroll", () =>
    top.classList.toggle("show", scrollY > 450),
  );
  top.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  let id = Number(new URLSearchParams(location.search).get("id"));
  init().then(() => {
    if (id >= 1 && id <= 41) openModal(id);
  });
})();
