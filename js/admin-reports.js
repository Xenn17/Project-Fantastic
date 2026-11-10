const db = window.supabase.createClient(
  "https://uxkieyunztzhiwrocnei.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4a2lleXVuenR6aGl3cm9jbmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDQwODIsImV4cCI6MjEwNzg4MDA4Mn0.nlWhlGbagxwZ2-XeHEa195n5sQmRtXn3xutTISDXR70",
);
const $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v ?? "—").replace(
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
const REPORT_CAT = {
    bullying: "Perundungan",
    scam: "Penipuan",
    toxic: "Toxic",
    agreement: "Kesepakatan",
    internal: "Internal",
    rw: "RW — Room Wangi",
    dk: "DK — Dukun/Cheat",
    other: "Lainnya",
  },
  REPORT_STATUS = {
    new: "BARU",
    in_review: "DITINJAU",
    need_info: "PERLU INFO",
    resolved: "SELESAI",
    dismissed: "DITOLAK",
  };
let reports = [],
  activeReport = null;
const loginScreen = $("#loginScreen"),
  dashboard = $("#dashboard");
const adminWatchdog = setTimeout(() => {
  if (dashboard.hidden) {
    console.error("Report center access check did not finish");
    window.location.replace(
      "login.html?redirect=admin-reports.html&error=timeout",
    );
  }
}, 8000);
const redirectToLogin = () => {
  window.location.replace("login.html?redirect=admin-reports.html");
};
async function requireDeveloper() {
  try {
    const result = await Promise.race([
      db.auth.getSession(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Supabase tidak merespons")), 6000),
      ),
    ]);
    const {
      data: { session },
      error,
    } = result;
    if (error || !session?.user) {
      redirectToLogin();
      return false;
    }
    const roleCheck = await Promise.race([
      Promise.all([
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
      ]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Pengecekan role timeout")), 6000),
      ),
    ]);
    const profile = roleCheck[0]?.data,
      manager = roleCheck[1]?.data;
    const isManager = [profile?.role, manager?.role].some((role) =>
      ["admin", "developer", "owner"].includes(
        String(role || "").toLowerCase(),
      ),
    );
    if (!isManager) {
      // Leader Squad manages their division on /devisi
      if (/leader_squad/.test(JSON.stringify(profile || {}))) window.location.replace("devisi/");
      else redirectToLogin();
      return false;
    }
    return true;
  } catch (error) {
    console.error("Report center access check failed", error);
    window.location.replace(
      "login.html?redirect=admin-reports.html&error=access-check",
    );
    return false;
  }
}
async function enter() {
  clearTimeout(adminWatchdog);
  loginScreen.hidden = true;
  dashboard.hidden = false;
  await reportInit();
}
if ($("#logout")) $("#logout").onclick = async () => {
  await db.auth.signOut();
  redirectToLogin();
};
requireDeveloper().then((ok) => {
  if (ok) enter();
});
async function reportInit() {
  $("#reportSearch").oninput = reportRender;
  $("#reportStatusFilter").onchange = reportRender;
  $("#reportCategoryFilter").onchange = reportRender;
  $("#reportRefresh").onclick = reportLoad;
  $("#reportClose").onclick = () => ($("#reportOverlay").hidden = true);
  $("#reportOverlay").onclick = (e) => {
    if (e.target.id === "reportOverlay") e.currentTarget.hidden = true;
  };
  $("#reportSave").onclick = reportSave;
  $("#reportDelete").onclick = reportDelete;
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#reportOverlay").hidden)
      $("#reportOverlay").hidden = true;
  });
  await reportLoad();
}
async function reportLoad() {
  $("#reportRows").innerHTML =
    '<tr><td colspan="7" class="empty">Mengambil laporan...</td></tr>';
  const { data, error } = await db
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    $("#reportRows").innerHTML =
      `<tr><td colspan="7" class="empty">Gagal memuat laporan: ${esc(error.message)}</td></tr>`;
    return;
  }
  const rows = data || [];
  const cols =
    "id,username,full_name,role,email,phone,ml_id,ml_server,gender,birth_date";
  const need = [
    ...new Set([
      ...rows.map((r) => r.reporter_id).filter(Boolean),
      ...rows.map((r) => r.target_member_id).filter(Boolean),
    ]),
  ];
  let profilesById = {};
  if (need.length) {
    const { data: profs } = await db
      .from("profiles")
      .select(cols)
      .in("id", need);
    (profs || []).forEach((p) => {
      profilesById[p.id] = p;
    });
  }
  reports = rows.map((r) => ({
    ...r,
    status: r.status || "new",
    profiles: profilesById[r.reporter_id] || null,
    targetProfile: profilesById[r.target_member_id] || null,
  }));
  reportRender();
}
function reportRender() {
  const q = $("#reportSearch").value.toLowerCase(),
    st = $("#reportStatusFilter").value,
    cat = $("#reportCategoryFilter").value,
    f = reports.filter(
      (r) =>
        (!st || r.status === st) &&
        (!cat || r.category === cat) &&
        [r.target_player, r.profiles?.username, r.profiles?.full_name].some(
          (v) =>
            String(v || "")
              .toLowerCase()
              .includes(q),
        ),
    );
  $("#reportCount").textContent = `${f.length} dari ${reports.length} laporan`;
  $("#reportRows").innerHTML = f.length
    ? f
        .map(
          (r, i) =>
            `<tr class="candidate-row" data-ridx="${i}"><td>#${String(r.id).padStart(3, "0")}</td><td><button class="candidate candidate-button" data-ridx="${i}">@ ${esc(r.profiles?.username || "Member")}</button>${r.profiles?.full_name ? `<span class="ign">${esc(r.profiles.full_name)}</span>` : ""}</td><td>${esc(r.target_player)}</td><td><span class="pill">${REPORT_CAT[r.category] || esc(r.category)}</span></td><td><span class="pill status-${esc(r.status)}">${REPORT_STATUS[r.status] || esc(r.status)}</span></td><td>${new Date(r.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td><td><button class="view" data-ridx="${i}">BUKA</button></td></tr>`,
        )
        .join("")
    : '<tr><td colspan="7" class="empty">Tidak ada laporan yang cocok.</td></tr>';
  document
    .querySelectorAll("#reportRows [data-ridx]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        reportDetail(f[Number(b.dataset.ridx)]),
      ),
    );
}
function reportDetail(r) {
  if (!r) return;
  activeReport = r;
  $("#reportNumber").textContent = "#" + String(r.id).padStart(3, "0");
  $("#reportTarget").textContent = r.target_player || "Tanpa target";
  const roleName = (role) =>
    ({
      tamu: "Tamu",
      calon_member: "Calon Member",
      member: "Member",
      leader_squad: "Leader Squad",
      admin: "Admin",
      developer: "Developer",
      owner: "Owner",
    })[String(role || "tamu").toLowerCase()] || "Tamu";
  const profileBlock = (title, prof, fallback) => {
    if (!prof)
      return `<div class="detail-grid-title">${title}</div><div><small>STATUS</small><strong>${esc(fallback || "Data tidak tersedia")}</strong></div>`;
    return `<div class="detail-grid-title">${title}</div><div><small>USERNAME</small><strong>@${esc(prof.username || "—")}</strong></div><div><small>NAMA LENGKAP</small><strong>${esc(prof.full_name || "—")}</strong></div><div><small>ROLE</small><strong>${roleName(prof.role)}</strong></div><div><small>EMAIL</small><strong>${esc(prof.email || "—")}</strong></div><div><small>TELEPON</small><strong>${esc(prof.phone || "—")}</strong></div><div><small>ML ID / SERVER</small><strong>${esc(prof.ml_id || "—")} (${esc(prof.ml_server || "—")})</strong></div><div><small>GENDER</small><strong>${esc(prof.gender || "—")}</strong></div><div><small>TANGGAL LAHIR</small><strong>${esc(prof.birth_date || "—")}</strong></div>`;
  };
  // Evidence lives in a private bucket: thumbnails render immediately as placeholders, then signed URLs for
  // every file are requested in one go and filled in (click → in-page viewer, see js/admin-media.js).
  const evidencePaths = Array.isArray(r.evidence_paths) ? r.evidence_paths.filter(Boolean) : [];
  const evidenceGroup = `evidence-${r.id}`;
  const evidenceHtml = evidencePaths.length
    ? window.F4Media
      ? F4Media.thumbs(evidencePaths.map((p, i) => ({ path: p, label: `Bukti ${i + 1}` })), { group: evidenceGroup })
      : evidencePaths.map((p, i) => `<button class="report-evidence" data-path="${esc(p)}">Buka bukti ${i + 1}</button>`).join(" ")
    : "Tidak ada";
  $("#reportMeta").textContent =
    `#${String(r.id).padStart(3, "0")} · ${REPORT_CAT[r.category] || r.category} · ${r.incident_date || "tanggal tidak diisi"}`;
  $("#reportDetails").innerHTML =
    profileBlock("DATA PELAPOR", r.profiles, r.profiles?.username || "Member") +
    profileBlock("DATA YANG DILAPORKAN", r.targetProfile, r.target_player) +
    `<div class="detail-grid-title">DETAIL LAPORAN</div><div><small>KRONOLOGI</small><strong>${esc(r.description || "—")}</strong></div><div><small>IDENTITAS TAMBAHAN</small><strong>${esc(r.target_contact || "—")}</strong></div><div class="detail-wide"><small>BUKTI${evidencePaths.length ? ` · ${evidencePaths.length} FILE` : ""}</small><strong>${evidenceHtml}</strong></div>`;
  if (window.F4Media && evidencePaths.length)
    db.storage
      .from("complaint-evidence")
      .createSignedUrls(evidencePaths, 3600)
      .then(({ data, error }) => {
        evidencePaths.forEach((p, i) => {
          const url = !error && data?.[i]?.signedUrl;
          if (url) F4Media.resolve(evidenceGroup, i, url);
          else F4Media.fail(evidenceGroup, i, "Gagal dimuat");
        });
      })
      .catch(() => evidencePaths.forEach((_, i) => F4Media.fail(evidenceGroup, i, "Gagal dimuat")));
  $("#reportNote").value = r.admin_note || "";
  $("#reportStatus").value = r.status;
  document.querySelectorAll(".report-evidence").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        const { data, error } = await db.storage
          .from("complaint-evidence")
          .createSignedUrl(b.dataset.path, 3600);
        if (error || !data?.signedUrl) {
          alert(
            "Bukti tidak dapat dibuka: " +
              (error?.message || "signed URL gagal"),
          );
          return;
        }
        window.open(data.signedUrl, "_blank", "noopener");
      } catch (err) {
        alert("Bukti tidak dapat dibuka: " + err.message);
      }
    }),
  );
  $("#reportOverlay").hidden = false;
}
async function reportSave() {
  if (!activeReport) return;
  const note = $("#reportNote").value.trim() || null,
    status = $("#reportStatus").value;
  const { error } = await db
    .from("reports")
    .update({ status, admin_note: note })
    .eq("id", activeReport.id);
  if (error) {
    $("#reportActionStatus").textContent = "Gagal menyimpan: " + error.message;
    return;
  }
  $("#reportActionStatus").textContent = "Perubahan disimpan.";
  await reportLoad();
  $("#reportOverlay").hidden = true;
}
async function reportDelete() {
  if (!activeReport) return;
  if (
    !confirm(
      `Hapus laporan #${activeReport.id}? Tindakan ini tidak bisa dibatalkan.`,
    )
  )
    return;
  const { error } = await db.from("reports").delete().eq("id", activeReport.id);
  if (error) {
    $("#reportActionStatus").textContent = "Gagal menghapus: " + error.message;
    return;
  }
  activeReport = null;
  $("#reportOverlay").hidden = true;
  await reportLoad();
}
