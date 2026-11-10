(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    id = Number(new URLSearchParams(location.search).get("id"));
  const GAME_ROLE = { jungler: "JUNG", gold: "GOLD", exp: "EXP", roam: "ROAM", mid: "MID" };
  let db,
    user,
    profile,
    division,
    members = [],
    canEdit = false;
  const say = (msg, error = false) => {
    $("editorNotice").textContent = msg;
    $("editorNotice").className = "editor-notice" + (error ? " error" : "");
  };
  const esc = (s) =>
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
  function preview() {
    $("previewCard").innerHTML =
      `<div class="preview-line"><img src="assets/logo-default.png"><div><strong>F4NTASTIC DIV. ${String(id).padStart(2, "0")} · ${esc(leaderName())}</strong><small>${esc($("recruitment").value)} · ${members.length}/${$("capacity").value}</small></div></div>`;
  }
  const nameOf = (m) => m.username || m.full_name || "Tanpa nama";
  const leaderName = () => {
    const l = members.find((m) => m.is_leader);
    return l ? nameOf(l) : "LEADER NEEDED";
  };
  function drawMembers() {
    $("memberCount").textContent = `${members.length}/${division.capacity} termasuk Leader`;
    $("memberRows").innerHTML = members.length
      ? members
          .map(
            (m) =>
              `<tr><td><strong>${esc(nameOf(m))}</strong>${m.full_name && m.username ? `<br><small>${esc(m.full_name)}</small>` : ""}</td><td>${esc(GAME_ROLE[m.game_role] || "—")}</td><td>${m.is_leader ? "LEADER" : "MEMBER"}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="3" class="editor-empty">BELUM ADA ANGGOTA · TAMBAHKAN LEWAT MANAGE ROLE</td></tr>';
  }
  async function boot() {
    if (!Number.isInteger(id) || id < 1 || id > 41)
      return say("ID DIVISI TIDAK VALID.", true);
    if (!window.getF4GalleryClient)
      return say("Konfigurasi Supabase tidak tersedia.", true);
    db = window.getF4GalleryClient();
    const {
      data: { session },
    } = await db.auth.getSession();
    user = session?.user;
    if (!user) {
      say("Silakan masuk menggunakan akun F4NTASTIC terlebih dahulu.", true);
      return;
    }
    let { data: p, error: pe } = await db
      .from("profiles")
      .select("role,roles")
      .eq("id", user.id)
      .maybeSingle();
    if (pe || !p) {
      say("Profil akun tidak dapat diverifikasi.", true);
      return;
    }
    profile = p;
    let rr = p.roles || [p.role];
    let dev = rr.some((x) => ["developer", "owner"].includes(x));
    let admin = rr.includes("admin");
    let { data: leader } = await db
      .from("f4_division_leaders")
      .select("division_id")
      .eq("division_id", id)
      .eq("profile_id", user.id)
      .maybeSingle();
    let { data: ap } = admin
      ? await db
          .from("f4_division_admin_permissions")
          .select("can_edit_divisions,can_manage_members")
          .eq("profile_id", user.id)
          .maybeSingle()
      : { data: null };
    canEdit = dev || !!leader || !!ap?.can_edit_divisions;
    if (!canEdit) {
      say(
        "AKSES DITOLAK. Akun ini tidak memiliki izin mengelola divisi ini.",
        true,
      );
      return;
    }
    let { data: d, error } = await db
      .from("f4_divisions")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !d) {
      say(
        "Data divisi belum tersedia di database. Jalankan migrasi dan seed SQL Directory terlebih dahulu.",
        true,
      );
      return;
    }
    division = d;
    let { data: ms, error: me } = await db.rpc("f4_division_roster");
    if (me) console.warn("Roster belum tersedia — jalankan supabase-division-roster.sql", me);
    ms = (ms || []).filter((m) => Number(m.division_id) === id);
    members = ms || [];
    $("editorTitle").textContent =
      `KELOLA DIVISI ${String(id).padStart(2, "0")}`;
    $("editorAccess").textContent = dev
      ? "AKSES DEVELOPER · SEMUA DIVISI"
      : leader
        ? "AKSES LEADER · DIVISI SENDIRI"
        : "AKSES ADMIN · SESUAI IZIN";
    $("squadId").value = d.squad_id || "";
    $("whatsapp").value = d.whatsapp || "";
    $("capacity").value = 25;
    $("recruitment").value = d.recruitment_status;
    $("spotlight").value = String(!!d.spotlight);
    $("description").value = d.description || "";
    $("announcement").value = d.announcement || "";
    $("divisionForm").hidden = false;
    $("membersPanel").hidden = false;
    drawMembers();
    preview();
    say(
      "Data berhasil dimuat. Perubahan belum tersimpan sampai tombol SIMPAN PERUBAHAN ditekan.",
    );
  }
  $("divisionForm").addEventListener("input", preview);
  $("divisionForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    // every division has a fixed 25 slots (set in supabase-division-capacity.sql)
    let cap = 25;
    let payload = {
      squad_id: $("squadId").value.trim() || null,
      whatsapp: $("whatsapp").value.replace(/[^0-9+]/g, ""),
      capacity: cap,
      recruitment_status: $("recruitment").value,
      spotlight: $("spotlight").value === "true",
      description: $("description").value.trim(),
      announcement: $("announcement").value.trim(),
      version: division.version,
    };
    let { data: current } = await db
      .from("f4_divisions")
      .select("version")
      .eq("id", id)
      .single();
    if (!current || current.version !== division.version)
      return say(
        "DATA BERUBAH DI TEMPAT LAIN. Muat ulang halaman sebelum menyimpan agar tidak menimpa perubahan.",
        true,
      );
    let { data, error } = await db
      .from("f4_divisions")
      .update({
        ...payload,
        version: division.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("version", division.version)
      .select()
      .single();
    if (error || !data)
      return say(
        "GAGAL MENYIMPAN: " +
          (error?.message || "Konflik perubahan. Coba muat ulang."),
        true,
      );
    await db
      .from("f4_division_audit")
      .insert({
        division_id: id,
        actor_id: user.id,
        action: "UPDATE_DIVISION",
        before_data: division,
        after_data: data,
      });
    division = data;
    say("PERUBAHAN BERHASIL DISIMPAN.");
    preview();
  });
  boot().catch((e) => say("GAGAL MEMUAT EDITOR: " + e.message, true));
})();
