(() => {
  "use strict";
  const P = document.getElementById("petals");
  for (let n = 0; n < 16; n++) {
    const i = document.createElement("i");
    i.style.left = Math.random() * 100 + "%";
    i.style.animationDuration = 9 + Math.random() * 9 + "s";
    i.style.animationDelay = -Math.random() * 14 + "s";
    P.append(i);
  }
  const K = window.__ornKit, D = window.__orn;
  if (!K || !D) return;
  const stage = document.getElementById("stage"), candle = document.getElementById("candle"), mirror = document.getElementById("mirror");
  const { f, m, i } = K.form("tiga katamu…", async (v) => {
    try {
      const r = await K.dec(v, D.s3);
      f.remove(); m.remove();
      stage.replaceChildren(K.el("h1", "", "Selamat datang"), ...r.paras.map((t, k) => { const p = K.el("p", "", t); p.style.animationDelay = k * 0.9 + "s"; return p; }));
      mirror.classList.add("is-clear");
      return true;
    } catch (e) {
      candle.classList.remove("is-out"); void candle.offsetWidth; candle.classList.add("is-out");
      setTimeout(() => candle.classList.remove("is-out"), 1700);
      return false;
    }
  }, "BISIKKAN");
  f.dataset.no = "Apinya padam. Aku belum mengenalimu…";
  stage.append(f, m);
  i.focus();
})();
