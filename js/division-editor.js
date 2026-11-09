(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    id = Number(new URLSearchParams(location.search).get("id"));
  const roles = ["ROAM", "ROAM SUP", "EXP", "GOLD", "JUNG", "MM", "MID"];
  let db,
    user,
    profile,
    division,
    members = [],
    canEdit = false,
    canMembers = false;
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
  function fillRoles() {
    ["memberRole1", "memberRole2"].forEach(
      (key, i) =>
        ($(key).innerHTML =
          (i
            ? '<option value="">—</option>'
            : '<option value="">Pilih role</option>') +
          roles.map((r) => `<option>${r}</option>`).join("")),
    );
  }
  function preview() {
    $("previewCard").innerHTML =
      `<div class="preview-line"><img src="assets/logo-default.png"><div><strong>F4NTASTIC DIV. ${String(id).padStart(2, "0")} · ${esc($("leaderName").value)}</strong><small>${esc($("recruitment").value)} · ${members.length + 1}/${$("capacity").value}</small></div></div>`;
  }
  function drawMembers() {
    $("memberCount").textContent =
      `${members.length + 1}/${division.capacity} termasuk Leader`;
    $("memberRows").innerHTML = members.length
      ? members
          .map(
            (m) =>
              `<tr><td>${esc(m.nickname)}</td><td>${esc(m.ml_id)}</td><td>${esc((m.roles || []).join(" / "))}</td><td>${canMembers ? `<button data-delete="${m.id}">HAPUS</button>` : "—"}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="4" class="editor-empty">BELUM ADA DATA ANGGOTA</td></tr>';
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
    canMembers = dev || !!leader || !!ap?.can_manage_members;
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
    let { data: ms, error: me } = await db
      .from("f4_division_members")
      .select("*")
      .eq("division_id", id)
      .order("nickname");
    if (me) {
      say(
        "Data divisi terbaca, tetapi data anggota gagal dimuat: " + me.message,
        true,
      );
      return;
    }
    members = ms || [];
    $("editorTitle").textContent =
      `KELOLA DIVISI ${String(id).padStart(2, "0")}`;
    $("editorAccess").textContent = dev
      ? "AKSES DEVELOPER · SEMUA DIVISI"
      : leader
        ? "AKSES LEADER · DIVISI SENDIRI"
        : "AKSES ADMIN · SESUAI IZIN";
    $("leaderName").value = d.leader_name || "";
    $("squadId").value = d.squad_id || "";
    $("whatsapp").value = d.whatsapp || "";
    $("capacity").value = d.capacity;
    $("recruitment").value = d.recruitment_status;
    $("spotlight").value = String(!!d.spotlight);
    $("description").value = d.description || "";
    $("announcement").value = d.announcement || "";
    if (!canMembers) $("memberForm").hidden = true;
    $("divisionForm").hidden = false;
    $("membersPanel").hidden = false;
    fillRoles();
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
    let cap = Number($("capacity").value),
      count = members.length + 1;
    if (cap < 1 || cap > 25 || count > cap)
      return say(
        "Kapasitas tidak valid atau lebih kecil dari jumlah anggota.",
        true,
      );
    let payload = {
      leader_name: $("leaderName").value.trim(),
      squad_id: $("squadId").value.trim() || null,
      whatsapp: $("whatsapp").value.replace(/[^0-9+]/g, ""),
      capacity: cap,
      recruitment_status: $("recruitment").value,
      spotlight: $("spotlight").value === "true",
      description: $("description").value.trim(),
      announcement: $("announcement").value.trim(),
      member_count: count,
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
  $("memberForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!canMembers) return;
    let nick = $("memberNick").value.trim(),
      ml = $("memberId").value.trim(),
      r1 = $("memberRole1").value,
      r2 = $("memberRole2").value;
    if (!nick || !/^[0-9]{1,25}$/.test(ml) || !r1 || r1 === r2)
      return say("Periksa nickname, ID ML, dan role.", true);
    if (members.length + 1 >= division.capacity)
      return say("KAPASITAS DIVISI SUDAH PENUH.", true);
    let { error } = await db
      .from("f4_division_members")
      .insert({
        division_id: id,
        nickname: nick,
        ml_id: ml,
        roles: [r1, ...(r2 ? [r2] : [])],
      });
    if (error) return say("GAGAL MENAMBAH MEMBER: " + error.message, true);
    $("memberForm").reset();
    let { data } = await db
      .from("f4_division_members")
      .select("*")
      .eq("division_id", id)
      .order("nickname");
    members = data || [];
    let { data: upd, error: ue } = await db
      .from("f4_divisions")
      .update({
        member_count: members.length + 1,
        version: division.version + 1,
      })
      .eq("id", id)
      .eq("version", division.version)
      .select()
      .single();
    if (ue)
      return say(
        "Member tersimpan, tetapi sinkronisasi kapasitas gagal. Hubungi Developer.",
        true,
      );
    division = upd;
    drawMembers();
    preview();
    say("MEMBER BERHASIL DITAMBAHKAN.");
  });
  $("memberRows").addEventListener("click", async (e) => {
    let b = e.target.closest("[data-delete]");
    if (!b || !canMembers) return;
    if (!confirm("Hapus data anggota ini secara permanen?")) return;
    let { error } = await db
      .from("f4_division_members")
      .delete()
      .eq("id", b.dataset.delete);
    if (error) return say("GAGAL MENGHAPUS: " + error.message, true);
    let { data } = await db
      .from("f4_division_members")
      .select("*")
      .eq("division_id", id)
      .order("nickname");
    members = data || [];
    let { data: upd, error: ue } = await db
      .from("f4_divisions")
      .update({
        member_count: members.length + 1,
        version: division.version + 1,
      })
      .eq("id", id)
      .eq("version", division.version)
      .select()
      .single();
    if (ue)
      return say(
        "Anggota terhapus, tetapi kapasitas belum tersinkron. Hubungi Developer.",
        true,
      );
    division = upd;
    drawMembers();
    preview();
    say("ANGGOTA BERHASIL DIHAPUS.");
  });
  boot().catch((e) => say("GAGAL MEMUAT EDITOR: " + e.message, true));
})();
