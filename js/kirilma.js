/* ============================================================
   TEDxGültepe 2026 — "Kırılma" interlüdü
   handoff/kirilma/KirilmaCanvas.tsx motorunun vanilla portu.
   Buzlu low-poly cam, tıklayınca kırılıp dökülür; altından
   Eşik manifestosu çıkar. Saf 2D canvas — bağımlılık yok.
   Uyarlamalar: section'a kapsamalı koordinatlar/dinleyiciler,
   IntersectionObserver ile duraklatma, "Hepsini kır" butonu,
   reduced-motion'da camsız statik içerik.
   ============================================================ */
(() => {
  "use strict";

  const sec = document.querySelector("[data-kirilma]");
  if (!sec) return;

  const bg = sec.querySelector("[data-kirilma-bg]");
  const fx = sec.querySelector("[data-kirilma-fx]");
  const barEl = sec.querySelector("[data-kr-bar]");
  const pctEl = sec.querySelector("[data-kr-pct]");
  const labelEl = sec.querySelector("[data-kr-label]");
  const allBtn = sec.querySelector("[data-kr-all]");

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !bg || !fx) {
    sec.classList.add("kirilma--static");
    return;
  }

  const bctx = bg.getContext("2d");
  const fctx = fx.getContext("2d");
  if (!bctx || !fctx) {
    sec.classList.add("kirilma--static");
    return;
  }

  const fine = window.matchMedia("(pointer: fine)").matches;

  /* ---------- "Eşiği Geç" cam kırılmadan kilitli (tek yönlü kilit) ---------- */
  const cta = sec.querySelector(".kirilma__cta");
  let ctaUnlocked = false;
  if (cta) {
    cta.setAttribute("aria-disabled", "true");
    cta.setAttribute("tabindex", "-1");
    cta.title = "Önce camı kır";
  }
  function unlockCta() {
    if (!cta || ctaUnlocked) return;
    ctaUnlocked = true;
    cta.removeAttribute("aria-disabled");
    cta.removeAttribute("tabindex");
    cta.removeAttribute("title");
    cta.classList.add("is-unlocked");
  }

  const CELL = 122;
  const BREAK_RADIUS = 300;
  const GRAVITY = 0.3;
  const rand = (a, b) => a + Math.random() * (b - a);

  let W = 0;
  let H = 0;
  let DPR = 1;

  let verts = [];
  let tris = [];
  let cols = 0;
  let reachableTotal = 0;
  let brokenReachable = 0;
  let cleared = false;
  const falling = [];

  const mouse = { x: 0, y: 0, inside: false };
  const cur = { x: 0, y: 0, scale: 1 };

  /* ---------- progress → DOM ---------- */
  function setProgress(p) {
    const pct = Math.round(p * 100);
    if (barEl) barEl.style.width = pct + "%";
    if (pctEl) pctEl.textContent = "%" + pct;
    if (labelEl) labelEl.textContent = pct >= 100 ? "Eşik aşıldı" : "İlerleme";
    sec.style.setProperty("--kr-glow", String(p));
    if (pct >= 100) unlockCta();
  }

  /* ---------- mesh kurulum ---------- */
  function buildMesh() {
    cols = Math.ceil(W / CELL) + 3;
    const rows = Math.ceil(H / CELL) + 3;
    const jit = CELL * 0.4;
    verts = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        verts.push({
          hx: (i - 1) * CELL + rand(-jit, jit),
          hy: (j - 1) * CELL + rand(-jit, jit),
          px: 0,
          py: 0,
          phx: rand(0, Math.PI * 2),
          phy: rand(0, Math.PI * 2),
          ax: rand(4, 12),
          ay: rand(4, 12),
        });
      }
    }
    const id = (i, j) => j * cols + i;
    const onScreen = (a, b, c) => {
      const cx = (verts[a].hx + verts[b].hx + verts[c].hx) / 3;
      const cy = (verts[a].hy + verts[b].hy + verts[c].hy) / 3;
      return cx >= 0 && cx <= W && cy >= 0 && cy <= H;
    };
    tris = [];
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a1 = id(i, j), b1 = id(i + 1, j), c1 = id(i, j + 1);
        const a2 = id(i + 1, j), b2 = id(i + 1, j + 1), c2 = id(i, j + 1);
        tris.push({ a: a1, b: b1, c: c1, seed: Math.random(), broken: false, onScreen: onScreen(a1, b1, c1) });
        tris.push({ a: a2, b: b2, c: c2, seed: Math.random(), broken: false, onScreen: onScreen(a2, b2, c2) });
      }
    }
    reachableTotal = tris.reduce((n, t) => n + (t.onScreen ? 1 : 0), 0);
    brokenReachable = 0;
    cleared = false;
    setProgress(0);
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = sec.clientWidth;
    H = sec.clientHeight;
    for (const c of [bg, fx]) {
      c.width = Math.floor(W * DPR);
      c.height = Math.floor(H * DPR);
      c.style.width = W + "px";
      c.style.height = H + "px";
    }
    bctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    mouse.x = W / 2;
    mouse.y = H / 2;
    cur.x = mouse.x;
    cur.y = mouse.y;
    buildMesh();
  }

  /* Kırmızılık yalnızca imleç yakınlığından gelir */
  function redAt(x, y) {
    let r = 0;
    if (mouse.inside) {
      r += Math.max(0, 1 - Math.hypot(x - cur.x, y - cur.y) / 230) * 1.5;
    }
    return Math.min(1, r);
  }

  /* ---------- kırma ---------- */
  function breakAllRemaining() {
    for (const tr of tris) {
      if (tr.broken) continue;
      tr.broken = true;
      const A = verts[tr.a], B = verts[tr.b], C = verts[tr.c];
      const cx = (A.px + B.px + C.px) / 3;
      const cy = (A.py + B.py + C.py) / 3;
      if (cx < -80 || cx > W + 80 || cy < -80 || cy > H + 80) continue;
      falling.push({
        cx, cy,
        o: [
          { x: A.px - cx, y: A.py - cy },
          { x: B.px - cx, y: B.py - cy },
          { x: C.px - cx, y: C.py - cy },
        ],
        vx: rand(-1.2, 1.2),
        vy: rand(0, 1.2),
        rot: 0,
        vrot: rand(-0.14, 0.14),
        life: 170,
        maxLife: 170,
        red: redAt(cx, cy),
      });
    }
    if (falling.length > 400) falling.splice(0, falling.length - 400);
  }

  function finishAll() {
    if (cleared) return;
    cleared = true;
    brokenReachable = reachableTotal;
    breakAllRemaining();
    setProgress(1);
  }

  function breakAt(x, y) {
    const R2 = BREAK_RADIUS * BREAK_RADIUS;
    let brokeReach = 0;
    for (const tr of tris) {
      if (tr.broken) continue;
      const A = verts[tr.a], B = verts[tr.b], C = verts[tr.c];
      const cx = (A.px + B.px + C.px) / 3;
      const cy = (A.py + B.py + C.py) / 3;
      const dx = cx - x;
      const dy = cy - y;
      if (dx * dx + dy * dy > R2) continue;

      tr.broken = true;
      if (tr.onScreen) brokeReach++;
      const d = Math.hypot(dx, dy) || 1;
      falling.push({
        cx, cy,
        o: [
          { x: A.px - cx, y: A.py - cy },
          { x: B.px - cx, y: B.py - cy },
          { x: C.px - cx, y: C.py - cy },
        ],
        vx: (dx / d) * rand(0.4, 2.2) + rand(-0.6, 0.6),
        vy: (dy / d) * rand(0.2, 1.0) + rand(0, 1.6),
        rot: 0,
        vrot: rand(-0.14, 0.14),
        life: 170,
        maxLife: 170,
        red: redAt(cx, cy),
      });
    }
    if (falling.length > 400) falling.splice(0, falling.length - 400);
    if (brokeReach > 0 && reachableTotal > 0) {
      brokenReachable += brokeReach;
      if (brokenReachable >= reachableTotal && !cleared) {
        cleared = true;
        breakAllRemaining();
        setProgress(1);
      } else {
        setProgress(Math.min(1, brokenReachable / reachableTotal));
      }
    }
  }

  /* ---------- cam mozaiği ---------- */
  function drawMesh(ts) {
    bctx.clearRect(0, 0, W, H);
    const t = ts * 0.001;

    for (const v of verts) {
      let x = v.hx + Math.sin(t * 0.6 + v.phx) * v.ax;
      let y = v.hy + Math.cos(t * 0.5 + v.phy) * v.ay;
      if (mouse.inside) {
        const dx = x - cur.x;
        const dy = y - cur.y;
        const d2 = dx * dx + dy * dy;
        const R = 165;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) + 0.01;
          const f = (1 - d / R) * 16;
          x += (dx / d) * f;
          y += (dy / d) * f;
        }
      }
      v.px = x;
      v.py = y;
    }

    bctx.lineWidth = 1;
    for (const tr of tris) {
      if (tr.broken) continue;
      const A = verts[tr.a], B = verts[tr.b], C = verts[tr.c];
      const cx = (A.px + B.px + C.px) / 3;
      const cy = (A.py + B.py + C.py) / 3;
      const red = redAt(cx, cy);

      bctx.beginPath();
      bctx.moveTo(A.px, A.py);
      bctx.lineTo(B.px, B.py);
      bctx.lineTo(C.px, C.py);
      bctx.closePath();

      const fa = 0.56 + tr.seed * 0.1 - red * 0.16;
      bctx.fillStyle = `rgba(${(12 + red * 150) | 0},${(13 + red * 10) | 0},${(18 + red * 14) | 0},${fa})`;
      bctx.fill();

      const ea = 0.1 + red * 0.3;
      bctx.strokeStyle = `rgba(${(150 + red * 85) | 0},${(160 - red * 110) | 0},${(185 - red * 110) | 0},${ea})`;
      bctx.stroke();
    }
  }

  /* ---------- dökülen cam + özel imleç ---------- */
  function drawFx() {
    fctx.clearRect(0, 0, W, H);

    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      f.vy += GRAVITY;
      f.vx *= 0.99;
      f.cx += f.vx;
      f.cy += f.vy;
      f.rot += f.vrot;
      f.life -= 1;
      if (f.life <= 0 || f.cy - 120 > H) {
        falling.splice(i, 1);
        continue;
      }
      const al = f.life > 50 ? 1 : f.life / 50;
      fctx.save();
      fctx.translate(f.cx, f.cy);
      fctx.rotate(f.rot);
      fctx.beginPath();
      fctx.moveTo(f.o[0].x, f.o[0].y);
      fctx.lineTo(f.o[1].x, f.o[1].y);
      fctx.lineTo(f.o[2].x, f.o[2].y);
      fctx.closePath();
      const rr = (200 + f.red * 35) | 0;
      const gg = (214 - f.red * 120) | 0;
      const bb = (240 - f.red * 120) | 0;
      fctx.fillStyle = `rgba(${rr},${gg},${bb},${0.14 * al})`;
      fctx.fill();
      fctx.lineWidth = 1.1;
      fctx.strokeStyle =
        f.red > 0.4 ? `rgba(255,90,80,${0.6 * al})` : `rgba(225,235,255,${0.55 * al})`;
      fctx.stroke();
      fctx.restore();
    }

    if (fine) {
      cur.x += (mouse.x - cur.x) * 0.18;
      cur.y += (mouse.y - cur.y) * 0.18;
      cur.scale += (1 - cur.scale) * 0.15;
      if (mouse.inside) {
        fctx.globalCompositeOperation = "lighter";
        const halo = fctx.createRadialGradient(cur.x, cur.y, 0, cur.x, cur.y, 52);
        halo.addColorStop(0, "rgba(235,20,45,0.30)");
        halo.addColorStop(1, "rgba(235,20,45,0)");
        fctx.fillStyle = halo;
        fctx.beginPath();
        fctx.arc(cur.x, cur.y, 52, 0, Math.PI * 2);
        fctx.fill();
        fctx.globalCompositeOperation = "source-over";

        const R = 16 * cur.scale;
        fctx.save();
        fctx.translate(cur.x, cur.y);
        fctx.lineWidth = 1.2;
        fctx.strokeStyle = "rgba(255,255,255,0.65)";
        fctx.beginPath();
        fctx.arc(0, 0, R, 0, Math.PI * 2);
        fctx.stroke();
        fctx.strokeStyle = "rgba(235,0,40,0.95)";
        fctx.lineWidth = 1.6;
        fctx.beginPath();
        fctx.arc(0, 0, R, -0.45, 0.45);
        fctx.stroke();
        fctx.strokeStyle = "rgba(255,255,255,0.85)";
        fctx.lineWidth = 1.2;
        fctx.beginPath();
        fctx.moveTo(-4, 0);
        fctx.lineTo(4, 0);
        fctx.moveTo(0, -4);
        fctx.lineTo(0, 4);
        fctx.stroke();
        fctx.fillStyle = "rgba(255,255,255,0.9)";
        fctx.beginPath();
        fctx.arc(R + 6, 0, 1.6, 0, Math.PI * 2);
        fctx.fill();
        fctx.restore();
      }
    }
  }

  /* ---------- döngü + görünürlük ---------- */
  let raf = null;
  let visible = false;

  function loop(ts) {
    if (!visible || document.hidden) {
      raf = null;
      return;
    }
    drawMesh(ts);
    drawFx();
    raf = requestAnimationFrame(loop);
  }

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && raf === null) raf = requestAnimationFrame(loop);
    },
    { threshold: 0 }
  );
  io.observe(sec);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && visible && raf === null) {
      raf = requestAnimationFrame(loop);
    }
  });

  /* ---------- olaylar (section'a kapsamalı) ---------- */
  const local = (e) => {
    const r = sec.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  sec.addEventListener(
    "pointermove",
    (e) => {
      const p = local(e);
      mouse.x = p.x;
      mouse.y = p.y;
      mouse.inside = true;
    },
    { passive: true }
  );

  sec.addEventListener("pointerdown", (e) => {
    const p = local(e);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.inside = true;
    cur.scale = 1.85;
    const target = e.target;
    if (target && target.closest("a, button, [data-no-shatter]")) return;
    breakAt(p.x, p.y);
  });

  sec.addEventListener("pointerleave", () => {
    mouse.inside = false;
  });

  allBtn?.addEventListener("click", finishAll);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  resize();
})();
