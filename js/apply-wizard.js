/* Join-team application wizard (join-form.html).
   Presentation layer on top of the existing inline submit logic: 6 steps with per-step validation, progress,
   live application card, profile prefill, local draft autosave and a review step.
   The inline script still owns validation of the whole form, upload, duplicate check and the Supabase insert. */
(() => {
  "use strict";
  const form = document.getElementById("joinForm");
  if (!form) return;
  const $ = (id) => document.getElementById(id);
  const steps = [...form.querySelectorAll(".apply-step")];
  const stepButtons = [...document.querySelectorAll("#applySteps [data-goto]")];
  const prev = $("applyPrev");
  const next = $("applyNext");
  const bar = $("applyProgressBar");
  const DRAFT_KEY = "f4nt-application-draft";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let current = 1;
  let furthest = 1;

  const refreshSubmit = () => window.f4ntUpdateSubmitState?.();
  const fieldsOf = (n) => [...steps[n - 1].querySelectorAll("input, select, textarea")];

  /* ---------- validation ---------- */
  const fieldOk = (f) => {
    if (!f.required) return true;
    if (f.type === "checkbox") return f.checked;
    if (f.type === "radio") return Boolean(form.querySelector(`input[name="${f.name}"]:checked`));
    if (f.type === "file") return f.files.length > 0;
    return f.value.trim() !== "" && f.checkValidity();
  };
  const stepOk = (n) => fieldsOf(n).every(fieldOk);
  const markInvalid = (n) => {
    let first = null;
    fieldsOf(n).forEach((f) => {
      const bad = !fieldOk(f);
      const holder = f.closest(".required-field, .field-group") || f;
      holder.classList.toggle("is-invalid", bad);
      if (bad && !first) first = f;
    });
    if (first) {
      first.focus({ preventScroll: true });
      first.closest(".required-field, .field-group, label")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      if (first.type !== "radio" && first.type !== "checkbox" && first.type !== "file") first.reportValidity?.();
    }
    return !first;
  };
  form.addEventListener("input", (e) => {
    const holder = e.target.closest(".is-invalid");
    if (holder && fieldOk(e.target)) holder.classList.remove("is-invalid");
  });
  form.addEventListener("change", (e) => {
    const holder = e.target.closest(".is-invalid");
    if (holder && fieldOk(e.target)) holder.classList.remove("is-invalid");
  });

  /* ---------- navigation ---------- */
  function show(n, { focus = true } = {}) {
    n = Math.max(1, Math.min(steps.length, n));
    if (n === steps.length) {
      // e.g. files lost after a reload: send the user to the first incomplete step instead of a dead submit
      const bad = steps.slice(0, -1).findIndex((_, i) => !stepOk(i + 1));
      if (bad >= 0) {
        n = bad + 1;
        setTimeout(() => markInvalid(n), 60);
      }
    }
    current = n;
    furthest = Math.max(furthest, current);
    steps.forEach((s, i) => {
      const on = i + 1 === current;
      s.hidden = !on;
      if (on && !reduced) {
        s.classList.remove("is-entering");
        void s.offsetWidth;
        s.classList.add("is-entering");
      }
    });
    stepButtons.forEach((b, i) => {
      const n2 = i + 1;
      b.parentElement.classList.toggle("is-current", n2 === current);
      b.parentElement.classList.toggle("is-done", n2 < current || (n2 <= furthest && stepOk(n2) && n2 !== current));
      b.disabled = n2 > furthest;
      if (n2 === current) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    bar.style.transform = `scaleX(${(current - 1) / (steps.length - 1)})`;
    prev.hidden = current === 1;
    next.hidden = current === steps.length;
    if (current === steps.length) renderReview();
    if (focus) {
      const top = form.getBoundingClientRect().top + scrollY - 96;
      if (Math.abs(form.getBoundingClientRect().top - 96) > 40) scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
      steps[current - 1].querySelector("legend")?.setAttribute("tabindex", "-1");
      steps[current - 1].querySelector("legend")?.focus({ preventScroll: true });
    }
    saveDraft();
  }
  next.addEventListener("click", () => {
    if (!markInvalid(current)) return;
    show(current + 1);
  });
  prev.addEventListener("click", () => show(current - 1));
  stepButtons.forEach((b, i) =>
    b.addEventListener("click", () => {
      const target = i + 1;
      if (target > current) {
        // jumping forward: every step in between must be valid
        for (let n = current; n < target; n++) if (!stepOk(n)) { show(n); markInvalid(n); return; }
      }
      show(target);
    }),
  );
  // Enter in a text field moves to the next step instead of submitting the whole form.
  form.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.target.tagName === "TEXTAREA" || e.target.type === "submit") return;
    if (current < steps.length) {
      e.preventDefault();
      next.click();
    }
  });

  /* ---------- live application card ---------- */
  const val = (name) => {
    const el = form.elements[name];
    if (!el) return "";
    if (el instanceof RadioNodeList) return el.value || "";
    return (el.value || "").trim();
  };
  const set = (id, text) => {
    const el = $(id);
    if (el && el.textContent !== text) el.textContent = text;
  };
  function renderPreview() {
    const ign = val("ign");
    set("pvIgn", ign || "IGN KAMU");
    set("pvName", val("name") || "Nama lengkap");
    set("pvInitial", (ign || val("name") || "?").charAt(0).toUpperCase());
    set("pvRole", val("role") || "ROLE");
    set("pvRole2", val("secondaryRole") || "CADANGAN");
    set("pvHigh", val("highestRank") || "—");
    set("pvCurrent", val("currentRank") || "—");
    set("pvHero", val("mainHero") || "—");
    const wr = parseFloat(String(val("heroWinRate")).replace(",", "."));
    set("pvWr", Number.isFinite(wr) ? `${wr}%` : "—");
    $("pvWrBar").style.transform = `scaleX(${Number.isFinite(wr) ? Math.min(1, Math.max(0, wr / 100)) : 0})`;
    $("pvWrBar").classList.toggle("is-good", Number.isFinite(wr) && wr >= 65);
    let done = 0;
    document.querySelectorAll("#pvChecklist [data-check]").forEach((li) => {
      const ok = stepOk(Number(li.dataset.check));
      li.classList.toggle("is-done", ok);
      done += ok;
    });
    const ready = done === 5;
    set("pvStatus", ready ? "SIAP DIKIRIM" : `${done}/5`);
    $("applyCard").classList.toggle("is-ready", ready);
    stepButtons.forEach((b, i) => {
      const n = i + 1;
      if (n !== current && n <= furthest) b.parentElement.classList.toggle("is-done", stepOk(n));
    });
  }
  form.addEventListener("input", renderPreview);
  form.addEventListener("change", renderPreview);

  /* ---------- review ---------- */
  const REVIEW = [
    ["Nama lengkap", "name"], ["Nama in-game", "ign"], ["Usia", "age"], ["Jenis kelamin", "gender"],
    ["Role utama", "role"], ["Role cadangan", "secondaryRole"], ["Rank tertinggi", "highestRank"],
    ["Rank season sekarang", "currentRank"], ["Hero andalan", "mainHero"], ["WR hero season sekarang", "heroWinRate"],
    ["Hero lain", "otherHeroes"], ["ID ML", "mlId"], ["WhatsApp", "whatsapp"], ["Discord", "discord"],
  ];
  const STEP_OF = { name: 2, ign: 2, age: 2, gender: 2, role: 3, secondaryRole: 3, highestRank: 3, currentRank: 3, mainHero: 4, heroWinRate: 4, otherHeroes: 4, mlId: 4, whatsapp: 5, discord: 5 };
  function renderReview() {
    const dl = $("applyReview");
    const rows = REVIEW.map(([label, name]) => {
      const wrap = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = val(name) || "—";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "review-edit";
      edit.textContent = "Ubah";
      edit.setAttribute("aria-label", `Ubah ${label}`);
      edit.addEventListener("click", () => {
        show(STEP_OF[name]);
        setTimeout(() => form.elements[name]?.[0]?.focus?.() || form.elements[name]?.focus?.(), 50);
      });
      wrap.append(dt, dd, edit);
      return wrap;
    });
    const fileRow = (label, name) => {
      const files = form.elements[name]?.files || [];
      const wrap = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = files.length ? `${files.length} file dipilih` : "— (belum diupload)";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "review-edit";
      edit.textContent = "Ubah";
      edit.addEventListener("click", () => show(name === "screenshots" ? 5 : 1));
      wrap.append(dt, dd, edit);
      return wrap;
    };
    dl.replaceChildren(
      ...rows,
      fileRow("Screenshot profil ML", "screenshots"),
      fileRow("Bukti follow Instagram", "instagramProof"),
      fileRow("Bukti follow TikTok", "tiktokProof"),
    );
  }

  /* ---------- draft autosave (text + choices; files cannot be stored) ---------- */
  const DRAFT_FIELDS = ["name", "ign", "age", "gender", "role", "secondaryRole", "highestRank", "currentRank", "mainHero", "heroWinRate", "otherHeroes", "mlId", "whatsapp", "discord", "followInstagram", "followTiktok"];
  let draftTimer = null;
  let draftPaused = false; // after a successful submit: no draft until the user types again
  function saveDraft() {
    clearTimeout(draftTimer);
    if (draftPaused) return;
    draftTimer = setTimeout(() => {
      const data = { step: current, furthest };
      DRAFT_FIELDS.forEach((n) => {
        const el = form.elements[n];
        if (!el) return;
        data[n] = el.type === "checkbox" ? el.checked : el instanceof RadioNodeList ? el.value : el.value;
      });
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
        set("applyDraft", "Draft tersimpan otomatis");
      } catch {}
    }, 400);
  }
  const resumeDraft = (e) => { if (e.isTrusted) draftPaused = false; };
  form.addEventListener("input", resumeDraft);
  form.addEventListener("change", resumeDraft);
  form.addEventListener("input", saveDraft);
  form.addEventListener("change", saveDraft);
  function restoreDraft() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch {}
    if (!data) return false;
    DRAFT_FIELDS.forEach((n) => {
      const el = form.elements[n];
      if (!el || data[n] === undefined) return;
      if (el.type === "checkbox") el.checked = Boolean(data[n]);
      else el.value = data[n];
    });
    furthest = Math.min(Number(data.furthest) || 1, steps.length - 1);
    // Files (follow proofs in step 1, ML screenshot in step 5) can't be stored in a draft → re-pick them.
    return 1;
  }
  document.addEventListener("f4:apply-submitted", () => {
    draftPaused = true;
    clearTimeout(draftTimer);
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    furthest = 1;
    $("uploadPreview").replaceChildren();
    form.querySelectorAll("[data-preview-for]").forEach((p) => p.replaceChildren());
    form.querySelectorAll(".upload-field.has-file").forEach((f) => f.classList.remove("has-file"));
    renderPreview();
    show(1, { focus: false });
    set("applyDraft", "");
  });

  /* ---------- prefill from the member profile (only empty fields) ---------- */
  // The session can resolve before this script runs (event already fired) or after (event still coming).
  let prefilled = false;
  async function prefill(user) {
    const db = window.f4ntSupabase;
    if (prefilled || !db || !user?.id) return;
    prefilled = true;
    const { data: p } = await db
      .from("profiles")
      .select("full_name,phone,ml_id,gender,birth_date,main_hero,game_role")
      .eq("id", user.id)
      .maybeSingle();
    if (!p) return;
    const filled = [];
    const fill = (name, value, label) => {
      const el = form.elements[name];
      if (!el || value === undefined || value === null || value === "") return;
      if (el instanceof RadioNodeList ? el.value : el.value.trim()) return;
      el.value = String(value);
      filled.push(label);
    };
    fill("ign", p.full_name, "IGN");
    fill("mlId", p.ml_id, "ID ML");
    fill("whatsapp", p.phone, "WhatsApp");
    fill("gender", { "Laki-laki": "Cowok", Perempuan: "Cewek" }[p.gender], "jenis kelamin");
    if (p.birth_date) {
      const b = new Date(p.birth_date + "T00:00:00");
      const now = new Date();
      let age = now.getFullYear() - b.getFullYear();
      if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age--;
      if (age >= 13 && age <= 99) fill("age", age, "usia");
    }
    fill("mainHero", p.main_hero, "hero andalan");
    fill("role", { jungler: "JUNG", gold: "MM", exp: "XP", roam: "ROAM", mid: "MID" }[p.game_role], "role");
    if (!filled.length) return;
    const note = $("applyPrefill");
    const msg = `✦ Diisi otomatis dari profilmu: ${filled.join(", ")}. Cek lagi sebelum kirim ya.`;
    note.textContent = note.hidden ? msg : `${note.textContent} ${msg}`;
    note.hidden = false;
    renderPreview();
    refreshSubmit();
    saveDraft();
  }
  document.addEventListener("f4:apply-user", (e) => prefill(e.detail));
  if (window.f4ntApplicationUser) prefill(window.f4ntApplicationUser);

  /* ---------- follow-proof previews ---------- */
  form.querySelectorAll("[data-preview-for]").forEach((preview) => {
    const input = form.elements[preview.dataset.previewFor];
    input?.addEventListener("change", () => {
      preview.replaceChildren(
        ...[...input.files].map((file) => {
          const item = document.createElement("span");
          item.className = "upload-preview-item";
          const img = document.createElement("img");
          img.src = URL.createObjectURL(file);
          img.alt = file.name;
          const name = document.createElement("small");
          name.textContent = file.name;
          item.append(img, name);
          return item;
        }),
      );
      input.closest(".upload-field")?.classList.toggle("has-file", input.files.length > 0);
    });
  });

  /* ---------- upload box: drag & drop highlight ---------- */
  form.querySelectorAll(".upload-field").forEach((uploadField) => {
    ["dragenter", "dragover"].forEach((t) => uploadField.addEventListener(t, () => uploadField.classList.add("is-dragging")));
    ["dragleave", "drop"].forEach((t) => uploadField.addEventListener(t, () => uploadField.classList.remove("is-dragging")));
  });

  /* ---------- init ---------- */
  const startStep = restoreDraft();
  renderPreview();
  refreshSubmit();
  if (startStep) {
    set("applyDraft", "Draft dipulihkan — upload ulang bukti follow");
    const note = $("applyPrefill");
    note.textContent = "✦ Data kamu sebelumnya sudah dipulihkan. File tidak bisa disimpan otomatis, jadi upload ulang screenshot bukti follow (dan screenshot profil ML di langkah 05).";
    note.hidden = false;
    show(1, { focus: false });
  } else show(1, { focus: false });
})();
