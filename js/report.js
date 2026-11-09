(() => {
  "use strict";
  const SUPABASE_URL = "https://uxkieyunztzhiwrocnei.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4a2lleXVuenR6aGl3cm9jbmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDQwODIsImV4cCI6MjEwNzg4MDA4Mn0.nlWhlGbagxwZ2-XeHEa195n5sQmRtXn3xutTISDXR70";
  const $ = (s) => document.querySelector(s);
  const CATEGORY_LABELS = {
    bullying: "Perundungan",
    scam: "Penipuan",
    toxic: "Toxic behavior",
    agreement: "Pelanggaran kesepakatan",
    internal: "Masalah internal",
    rw: "RW — Room Wangi",
    dk: "DK — Dukun / Cheat lainnya",
    other: "Lainnya",
  };
  const STATUS_LABELS = {
    new: "BARU",
    in_review: "DITINJAU",
    need_info: "PERLU INFO",
    resolved: "SELESAI",
    dismissed: "DITOLAK",
  };
  const app = $("#reportApp"),
    gate = $("#reportGate");
  const form = $("#reportForm"),
    formStatus = $("#formStatus"),
    listEl = $("#reportList"),
    submitBtn = $("#submitReport");
  const yearEl = $("#reportYear");
  if (!app || !gate) return;
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  });
  window.__f4reportDb = db;
  const group = (text, ok = false) => {
    if (!gate) return;
    gate.hidden = false;
    gate.textContent = text;
    gate.style.color = ok ? "#8fca9b" : "";
  };
  const esc = (v) =>
    String(v ?? "").replace(
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

  /* Scroll-reveal for report panels; safe under reduced motion. */
  const revealEls = [...document.querySelectorAll(".report-reveal")];
  revealEls.forEach((el, i) =>
    el.style.setProperty("--d", String(Math.min(i, 5))),
  );
  const motionOff = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (motionOff || !("IntersectionObserver" in window))
    revealEls.forEach((el) => el.classList.add("is-visible"));
  else {
    const revealObserver = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("is-visible");
            revealObserver.unobserve(en.target);
          }
        }),
      { threshold: 0.12 },
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  }

  /* Character counter for kronologi */
  const descriptionEl = $("#description"),
    charCountEl = $("#charCount");
  if (descriptionEl && charCountEl)
    descriptionEl.addEventListener("input", () => {
      charCountEl.textContent = `${descriptionEl.value.length} / 5000`;
    });

  /* Upload box UX */
  const uploadBox = $("#uploadBox"),
    evidenceInput = $("#evidence"),
    fileList = $("#fileList");
  if (uploadBox && evidenceInput) {
    uploadBox.addEventListener("click", (e) => {
      e.preventDefault();
      evidenceInput.click();
    });
    uploadBox.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadBox.classList.add("is-drag");
    });
    uploadBox.addEventListener("dragleave", () =>
      uploadBox.classList.remove("is-drag"),
    );
    uploadBox.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadBox.classList.remove("is-drag");
      if (e.dataTransfer?.files?.length)
        evidenceInput.files = e.dataTransfer.files;
    });
    evidenceInput.addEventListener("change", () => {
      const files = [...(evidenceInput.files || [])];
      if (fileList)
        fileList.innerHTML = files
          .slice(0, 3)
          .map(
            (f) =>
              `<div class="report-file-item"><span>${esc(f.name)}</span><em>${(f.size / 1024 / 1024).toFixed(1)} MB</em></div>`,
          )
          .join("");
    });
  }

  async function requireMember() {
    const {
      data: { session },
      error,
    } = await db.auth.getSession();
    if (error || !session?.user) {
      group(
        "Kamu belum login. Silakan masuk terlebih dahulu untuk mengirim laporan.",
      );
      const link = document.createElement("a");
      link.href = "login.html?redirect=pengaduan.html";
      link.style.cssText = "color:var(--gold);margin-left:8px;font-weight:800";
      link.textContent = "MASUK SEKARANG →";
      gate.append(link);
      return null;
    }
    const { data: profile } = await db
      .from("profiles")
      .select("role,username,full_name,phone,ml_id,ml_server,gender,birth_date")
      .eq("id", session.user.id)
      .maybeSingle();
    if (!profile) {
      group("Akun member belum ditemukan. Lengkapi profil lalu coba lagi.");
      return null;
    }
    if (
      !["member", "admin", "developer"].includes(
        String(profile.role).toLowerCase(),
      )
    ) {
      group("Hanya member F4NTASTIC yang dapat menggunakan Posko Pengaduan.");
      return null;
    }
    const required = [
      "full_name",
      "phone",
      "ml_id",
      "ml_server",
      "gender",
      "birth_date",
    ];
    const incomplete = required.filter(
      (key) => !String(profile[key] ?? "").trim(),
    );
    if (incomplete.length) {
      group(
        "Data diri kamu belum lengkap. Lengkapi dulu agar laporan bisa diproses.",
      );
      const link = document.createElement("a");
      link.href = "profile.html?redirect=pengaduan.html";
      link.style.cssText = "color:var(--gold);margin-left:8px;font-weight:800";
      link.textContent = "LENGKAPI PROFIL SEKARANG →";
      gate.append(link);
      return null;
    }
    return { user: session.user, profile };
  }

  function renderList(reports) {
    if (!listEl) return;
    if (!reports.length) {
      listEl.innerHTML =
        '<p class="empty-report">Belum ada laporan dari kamu. Ketika kamu mengirim, riwayatnya muncul di sini.</p>';
      return;
    }
    listEl.innerHTML = reports
      .map(
        (r, i) => `
      <article class="report-item" style="--i:${Math.min(i, 6)}">
        <div class="report-item-top"><strong title="${esc(r.target_player)}">${esc(r.target_player)}</strong><span class="report-badge ${esc(r.status)}">${STATUS_LABELS[r.status] || esc(r.status)}</span></div>
        <small>${CATEGORY_LABELS[r.category] || esc(r.category)} · ${r.incident_date ? esc(r.incident_date) : "tanggal tidak diisi"} · ${new Date(r.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</small>
        <p>${esc((r.description || "").slice(0, 180))}${(r.description || "").length > 180 ? "…" : ""}</p>
        ${r.admin_note ? `<p class="report-note">Catatan admin: ${esc(r.admin_note)}</p>` : ""}
      </article>`,
      )
      .join("");
  }

  async function loadMyReports(user) {
    const { data, error } = await db
      .from("reports")
      .select(
        "id,target_player,category,incident_date,description,evidence_paths,status,admin_note,created_at",
      )
      .eq("reporter_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      if (listEl)
        listEl.innerHTML = `<p class="empty-report">Gagal memuat riwayat: ${esc(error.message)}</p>`;
      return;
    }
    renderList(data || []);
  }

  /* Autocomplete member F4NTASTIC: cari saat user mengetik, dengan feedback yang selalu terlihat. */
  function loadMemberOptions() {
    const input = $("#targetPlayer"),
      suggestions = $("#memberSuggestions"),
      status = $("#memberSearchStatus"),
      clear = $("#clearMemberSearch");
    if (!input || !suggestions) return;
    let timer = null,
      requestId = 0;
    const setStatus = (text) => {
      if (status) status.textContent = text;
    };
    const close = () => {
      suggestions.hidden = true;
      suggestions.replaceChildren();
    };
    const note = (html, onClick) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "member-suggestion member-suggestion-note";
      row.innerHTML = html;
      if (onClick) row.addEventListener("click", onClick);
      suggestions.replaceChildren(row);
      suggestions.hidden = false;
      return row;
    };
    const renderSuggestion = (member) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "member-suggestion";
      button.setAttribute("role", "option");
      const avatar = member.avatar_url
        ? `<img src="${esc(member.avatar_url)}" alt="" loading="lazy">`
        : `<span>${esc((member.full_name || member.username || "M").charAt(0).toUpperCase())}</span>`;
      button.innerHTML = `<span class="member-suggestion-avatar">${avatar}</span><span class="member-suggestion-copy"><strong>@${esc(member.username)}</strong><small>${esc(member.full_name || "Member F4NTASTIC")}</small></span>`;
      button.addEventListener("click", () => choose(member));
      suggestions.append(button);
    };
    const choose = (member) => {
      input.value = member.username || member.full_name || "";
      input.dataset.memberId = member.id || "";
      if (clear) clear.hidden = !input.value;
      close();
      setStatus(
        member.full_name
          ? `${member.username} — ${member.full_name}`
          : `Member @${member.username} dipilih.`,
      );
    };
    const renderRows = (rows) => {
      suggestions.replaceChildren();
      if (!rows.length) {
        note(
          `<strong>Tidak ada member dengan nama itu</strong><small>Kamu tetap bisa lanjut menulis nama ini sebagai laporan manual.</small>`,
        );
        setStatus(
          "Member tidak ditemukan. Nama yang diketik akan dipakai manual.",
        );
        return;
      }
      rows.slice(0, 8).forEach(renderSuggestion);
      suggestions.hidden = false;
      setStatus("Klik hasil untuk memilih, atau lanjutkan dengan nama manual.");
    };
    const loadAll = async () => {
      try {
        const res = await Promise.race([
          db.rpc("f4_member_list"),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Waktu muat habis")), 6000),
          ),
        ]);
        if (res.error) throw new Error(res.error.message || "RPC error");
        console.log("[Posko] f4_member_list", res.data);
        renderRows(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("[Posko] f4_member_list gagal", err);
        note(
          `<strong>Gagal memuat daftar member: ${esc(err.message || "")}</strong><small>Jalankan ulang supabase-reports.sql, lalu refresh halaman.</small>`,
        );
      }
    };
    const search = async () => {
      const query = input.value.trim();
      input.dataset.memberId = "";
      if (query.length < 2) {
        close();
        setStatus("Ketik minimal 2 karakter untuk mencari member.");
        return;
      }
      const current = ++requestId;
      setStatus("Mencari member…");
      try {
        const res = await Promise.race([
          db.rpc("f4_member_search", { p_query: query }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Pencarian timeout — cek koneksi")),
              6000,
            ),
          ),
        ]);
        if (current !== requestId) return;
        if (res.error) throw new Error(res.error.message || "RPC error");
        console.log("[Posko] f4_member_search", query, res.data);
        renderRows(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("[Posko] Pencarian member gagal", err);
        note(
          `<strong>Pencarian gagal: ${esc(err.message || "kesalahan tak dikenal")}</strong><small>Klik di sini untuk memuat semua member sebagai cadangan.</small>`,
          loadAll,
        );
        setStatus(
          "Pencarian gagal — bisa pakai nama manual, atau muat semua member.",
        );
      }
    };
    input.addEventListener("input", () => {
      if (clear) clear.hidden = !input.value;
      clearTimeout(timer);
      timer = setTimeout(search, 280);
    });
    input.addEventListener("focus", () => {
      if (input.value.trim().length >= 2) search();
    });
    clear?.addEventListener("click", () => {
      input.value = "";
      input.dataset.memberId = "";
      clear.hidden = true;
      close();
      setStatus("Ketik minimal 2 karakter untuk mencari member.");
      input.focus();
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".member-search-wrap")) close();
    });
  }

  async function uploadEvidence(user, files) {
    const paths = [];
    for (const file of files.slice(0, 3)) {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Satu file melebihi 10 MB.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
      const path = `${user.id}/${Date.now()}-${safeName}`;
      const { error } = await db.storage
        .from("complaint-evidence")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw new Error("Bukti gagal diunggah: " + error.message);
      paths.push(path);
    }
    return paths;
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const targetSel = $("#targetPlayer");
    const target = targetSel ? targetSel.value.trim() : "";
    const targetMemberId = targetSel?.dataset?.memberId || null;
    const category = $("#category").value,
      description = descriptionEl ? descriptionEl.value.trim() : "",
      agreement = $("#agreement").checked;
    if (!target || !category || !description) {
      formStatus.className = "report-status is-error";
      formStatus.textContent =
        "Lengkapi player yang dilaporkan, kategori, dan kronologi.";
      return;
    }
    if (!agreement) {
      formStatus.className = "report-status is-error";
      formStatus.textContent = "Kamu harus menyetujui pernyataan itikad baik.";
      return;
    }
    const member = await requireMember();
    if (!member) return;
    submitBtn.disabled = true;
    formStatus.className = "report-status";
    formStatus.textContent = "Mengirim laporan…";
    try {
      const files = [...(evidenceInput?.files || [])];
      if (files.length > 3) {
        formStatus.className = "report-status is-error";
        formStatus.textContent = "Maksimal 3 file bukti.";
        return;
      }
      const evidence = files.length
        ? await uploadEvidence(member.user, files)
        : [];
      const insert = {
        reporter_id: member.user.id,
        target_player: target,
        target_member_id: targetMemberId,
        target_contact: $("#targetContact").value.trim() || null,
        category,
        incident_date: $("#incidentDate").value || null,
        description,
        evidence_paths: evidence,
      };
      let { error } = await db.from("reports").insert([insert]);
      if (error && /target_member_id/i.test(error.message)) {
        delete insert.target_member_id;
        ({ error } = await db.from("reports").insert([insert]));
      }
      if (error) throw error;
      form.reset();
      if (charCountEl) charCountEl.textContent = "0 / 5000";
      if (fileList) fileList.innerHTML = "";
      formStatus.className = "report-status is-success";
      formStatus.textContent =
        "Laporan terkirim. Terima kasih sudah menjaga komunitas.";
      loadMyReports(member.user);
    } catch (err) {
      formStatus.className = "report-status is-error";
      formStatus.textContent = err.message || "Gagal mengirim laporan.";
    } finally {
      submitBtn.disabled = false;
    }
  });

  requireMember().then((member) => {
    if (!member) return;
    gate.hidden = true;
    app.hidden = false;
    Promise.all([loadMyReports(member.user), loadMemberOptions()]);
  });
})();
