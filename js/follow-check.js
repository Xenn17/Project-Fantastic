/* Automatic follow check from official follower exports (admin.html).
   Instagram / TikTok don't offer an API that lists who follows an account, but both let the account owner
   download their data ("Download your information"), which includes the follower list. The admin uploads that
   export here; it is parsed in this browser only (never sent anywhere) and matched against every applicant's
   username. Only the match result (instagram_verified / tiktok_verified / follow_verified) is written to the DB.
   Relies on globals from js/admin.js: db, apps, render, esc. */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const CACHE_KEY = "f4nt-follower-cache";
  const norm = (u) => String(u || "").trim().replace(/^@+/, "").toLowerCase();
  const isFollowing = (name) => /following/i.test(name); // the list of accounts WE follow — never use it

  /* ---------- minimal ZIP reader (stored + deflate) using the browser's DecompressionStream ---------- */
  async function readZip(file) {
    const tailSize = Math.min(file.size, 66000);
    const tail = new DataView(await file.slice(file.size - tailSize).arrayBuffer());
    let eocd = -1;
    for (let i = tail.byteLength - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("File ZIP tidak valid.");
    const entries = tail.getUint16(eocd + 10, true);
    const cdSize = tail.getUint32(eocd + 12, true);
    const cdOffset = tail.getUint32(eocd + 16, true);
    if (cdOffset === 0xffffffff || entries === 0xffff)
      throw new Error("Export terlalu besar (ZIP64). Saat download, pilih hanya \"Followers and following\" / \"Follower list\".");
    const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
    const out = [];
    let p = 0;
    for (let n = 0; n < entries && p + 46 <= cd.byteLength; n++) {
      if (cd.getUint32(p, true) !== 0x02014b50) break;
      const method = cd.getUint16(p + 10, true);
      const compSize = cd.getUint32(p + 20, true);
      const nameLen = cd.getUint16(p + 28, true);
      const extraLen = cd.getUint16(p + 30, true);
      const commentLen = cd.getUint16(p + 32, true);
      const localOffset = cd.getUint32(p + 42, true);
      const name = new TextDecoder().decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
      p += 46 + nameLen + extraLen + commentLen;
      if (name.endsWith("/")) continue;
      out.push({
        name,
        async text() {
          const lh = new DataView(await file.slice(localOffset, localOffset + 30).arrayBuffer());
          const start = localOffset + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
          const blob = file.slice(start, start + compSize);
          if (method === 0) return blob.text();
          if (method !== 8) throw new Error(`Kompresi ZIP tidak didukung (${method}).`);
          return new Response(blob.stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
        },
      });
    }
    return out;
  }
  async function filesFrom(file) {
    if (/\.zip$/i.test(file.name) || file.type.includes("zip")) return readZip(file);
    return [{ name: file.name, text: () => file.text() }];
  }

  /* ---------- parsers ---------- */
  const IG_URL = /instagram\.com\/(?:_u\/)?([A-Za-z0-9._]{1,30})/gi;
  function parseInstagram(name, text) {
    const users = new Set();
    if (/\.json$/i.test(name)) {
      const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node.string_list_data)) {
          node.string_list_data.forEach((d) => {
            if (d?.value) users.add(norm(d.value));
            else if (d?.href) for (const m of String(d.href).matchAll(IG_URL)) users.add(norm(m[1]));
          });
          if (node.title && !node.string_list_data.some((d) => d?.value)) users.add(norm(node.title));
          return;
        }
        Object.entries(node).forEach(([k, v]) => !isFollowing(k) && walk(v));
      };
      walk(JSON.parse(text));
    } else {
      for (const m of text.matchAll(IG_URL)) users.add(norm(m[1]));
    }
    users.delete("");
    return users;
  }
  function parseTiktok(name, text) {
    const users = new Set();
    if (/\.json$/i.test(name)) {
      // Only collect usernames under a "Follower"/"Fans" key, never under "Following".
      const walk = (node, inFollowers) => {
        if (Array.isArray(node)) return node.forEach((x) => walk(x, inFollowers));
        if (!node || typeof node !== "object") return;
        for (const [k, v] of Object.entries(node)) {
          if (isFollowing(k)) continue;
          const here = inFollowers || /follower|fans/i.test(k);
          if (here && /^user\s*name$|^username$/i.test(k) && typeof v === "string") users.add(norm(v));
          else walk(v, here);
        }
      };
      walk(JSON.parse(text), false);
    } else {
      for (const m of text.matchAll(/user\s*name\s*:\s*@?([A-Za-z0-9._]{2,24})/gi)) users.add(norm(m[1]));
    }
    users.delete("");
    return users;
  }
  async function extract(file, network) {
    const files = await filesFrom(file);
    const pick =
      network === "instagram"
        ? files.filter((f) => /followers(_\d+)?\.(json|html)$/i.test(f.name.split("/").pop()) && !isFollowing(f.name.split("/").pop()))
        : files.filter((f) => {
            const base = f.name.split("/").pop();
            return (/user_data.*\.json$/i.test(base) || (/follower/i.test(base) && /\.(txt|json)$/i.test(base))) && !isFollowing(base);
          });
    if (!pick.length)
      throw new Error(
        network === "instagram"
          ? "File followers tidak ditemukan. Upload ZIP export Instagram atau file followers_1.json / followers_1.html."
          : "Daftar follower tidak ditemukan. Upload ZIP export TikTok, user_data_tiktok.json, atau Follower.txt.",
      );
    const all = new Set();
    for (const f of pick) {
      const text = await f.text();
      const set = network === "instagram" ? parseInstagram(f.name, text) : parseTiktok(f.name, text);
      set.forEach((u) => all.add(u));
    }
    if (!all.size) throw new Error("File terbaca, tapi tidak ada username follower di dalamnya.");
    return all;
  }

  /* ---------- cache (admin's browser only) ---------- */
  const loadCache = () => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
  };
  const saveCache = (network, set) => {
    const c = loadCache();
    c[network] = { at: Date.now(), users: [...set] };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
  };

  /* ---------- matching + DB update ---------- */
  async function applyMatches(sets) {
    const now = new Date().toISOString();
    const stamp = {};
    const log = [];
    for (const network of ["instagram", "tiktok"]) {
      const set = sets[network];
      if (!set) continue;
      const ids = apps.filter((a) => a[network] && !a[`${network}_verified`] && set.has(norm(a[network]))).map((a) => a.id);
      if (ids.length) {
        const { error } = await db.from("applications").update({ [`${network}_verified`]: true, [`${network}_verified_at`]: now }).in("id", ids);
        if (error) throw new Error(/column|schema cache/i.test(error.message) ? "Kolom verifikasi belum ada. Jalankan supabase-application-socials.sql terbaru di Supabase." : error.message);
        apps.forEach((a) => { if (ids.includes(a.id)) { a[`${network}_verified`] = true; a[`${network}_verified_at`] = now; } });
      }
      stamp[network] = ids.length;
    }
    const both = apps.filter((a) => a.instagram_verified && a.tiktok_verified && !a.follow_verified).map((a) => a.id);
    if (both.length) {
      const { error } = await db.from("applications").update({ follow_verified: true, follow_verified_at: now }).in("id", both);
      if (error) throw new Error(error.message);
      apps.forEach((a) => { if (both.includes(a.id)) { a.follow_verified = true; a.follow_verified_at = now; } });
    }
    for (const a of apps) {
      if (!a.instagram && !a.tiktok) continue;
      const mark = (network) => (!a[network] ? "–" : a[`${network}_verified`] ? "✓" : sets[network] ? "✗" : "?");
      log.push({ a, ig: mark("instagram"), tt: mark("tiktok") });
    }
    return { stamp, both: both.length, log };
  }

  /* ---------- UI ---------- */
  const modal = $("#followCheck");
  const result = $("#followCheckResult");
  const status = $("#followCheckStatus");
  const pending = {};
  function cacheInfo() {
    const c = loadCache();
    const line = (n, label) => (c[n] ? `${label}: ${c[n].users.length.toLocaleString("id-ID")} follower · diupload ${new Date(c[n].at).toLocaleString("id-ID")}` : `${label}: belum ada data`);
    $("#followCheckCache").textContent = `${line("instagram", "Instagram")}  |  ${line("tiktok", "TikTok")}`;
    $("#followCheckRerun").disabled = !c.instagram && !c.tiktok;
  }
  $("#followCheckOpen").onclick = () => {
    modal.hidden = false;
    cacheInfo();
  };
  const close = () => (modal.hidden = true);
  $("#followCheckClose").onclick = close;
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });

  document.querySelectorAll("[data-follow-file]").forEach((input) => {
    const network = input.dataset.followFile;
    const zone = input.closest(".fc-drop");
    const label = zone.querySelector(".fc-file");
    const take = async (file) => {
      if (!file) return;
      label.textContent = `Membaca ${file.name}…`;
      zone.classList.remove("is-ok", "is-error");
      try {
        const set = await extract(file, network);
        pending[network] = set;
        saveCache(network, set);
        label.textContent = `✓ ${file.name} — ${set.size.toLocaleString("id-ID")} follower terbaca`;
        zone.classList.add("is-ok");
        cacheInfo();
      } catch (err) {
        delete pending[network];
        label.textContent = `✗ ${err.message}`;
        zone.classList.add("is-error");
      }
      $("#followCheckRun").disabled = !pending.instagram && !pending.tiktok;
    };
    input.addEventListener("change", () => take(input.files[0]));
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("is-drag"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-drag"));
    zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("is-drag"); take(e.dataTransfer.files[0]); });
  });

  async function run(sets) {
    status.textContent = "Mencocokkan & menyimpan…";
    $("#followCheckRun").disabled = $("#followCheckRerun").disabled = true;
    try {
      const { stamp, both, log } = await applyMatches(sets);
      const parts = [];
      if (sets.instagram) parts.push(`${stamp.instagram} baru terverifikasi di Instagram`);
      if (sets.tiktok) parts.push(`${stamp.tiktok} baru terverifikasi di TikTok`);
      status.textContent = `Selesai: ${parts.join(", ")}. ${both} pendaftar sekarang ✓ FOLLOW (IG + TikTok).`;
      log.sort((x, y) => (x.ig + x.tt).localeCompare(y.ig + y.tt));
      result.innerHTML = log.length
        ? `<table><thead><tr><th>PENDAFTAR</th><th>INSTAGRAM</th><th>TIKTOK</th></tr></thead><tbody>${log
            .map(({ a, ig, tt }) => `<tr><td>${esc(a.name)} <small>@${esc(a.ign)}</small></td><td class="fc-${ig === "✓" ? "ok" : ig === "✗" ? "no" : "na"}">${ig} ${a.instagram ? "@" + esc(a.instagram) : ""}</td><td class="fc-${tt === "✓" ? "ok" : tt === "✗" ? "no" : "na"}">${tt} ${a.tiktok ? "@" + esc(a.tiktok) : ""}</td></tr>`)
            .join("")}</tbody></table><p class="fc-legend">✓ ditemukan di followers · ✗ tidak ditemukan · ? belum ada file untuk jaringan ini · – username tidak diisi</p>`
        : `<p class="fc-legend">Belum ada pendaftar yang mengisi username IG/TikTok.</p>`;
      render();
    } catch (err) {
      status.textContent = `Gagal: ${err.message}`;
    }
    $("#followCheckRun").disabled = !pending.instagram && !pending.tiktok;
    cacheInfo();
  }
  $("#followCheckRun").onclick = () => run({ ...pending });
  $("#followCheckRerun").onclick = () => {
    const c = loadCache();
    const sets = {};
    if (c.instagram) sets.instagram = new Set(c.instagram.users);
    if (c.tiktok) sets.tiktok = new Set(c.tiktok.users);
    run(sets);
  };
})();
