"use client";

import { useEffect, useRef } from "react";

/* ================================================================== *
 * KirilmaCanvas — interactive engine on two <canvas>:
 *   • bg : full-screen low-poly TRIANGULAR mesh (jittered grid → 2 tris
 *          per cell) with faint faceted shading + slow-moving red glow
 *          pockets, gently reacting to the cursor.
 *   • fx : the custom cursor + falling glass — clicking detaches the mesh
 *          triangles around the cursor and drops them like broken glass
 *          (gravity + rotation + fade); the gap stays permanently broken.
 * Pure 2D canvas + requestAnimationFrame.
 * ================================================================== */

type Vtx = {
  hx: number;
  hy: number;
  px: number;
  py: number;
  phx: number;
  phy: number;
  ax: number;
  ay: number;
};
type Tri = { a: number; b: number; c: number; seed: number; broken: boolean; onScreen: boolean };
type FallingShard = {
  cx: number;
  cy: number;
  o: { x: number; y: number }[]; // 3 vertex offsets relative to centroid
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  life: number;
  maxLife: number;
  red: number;
};

const CELL = 122; // mesh cell size (px)
const BREAK_RADIUS = 300; // click shatter radius (large → clears fast)
const GRAVITY = 0.3;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function KirilmaCanvas({
  onProgress,
}: {
  onProgress?: (fraction: number) => void;
}) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    const bg = bgRef.current;
    const fx = fxRef.current;
    if (!bg || !fx) return;
    const bctx = bg.getContext("2d");
    const fctx = fx.getContext("2d");
    if (!bctx || !fctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;

    let W = 0;
    let H = 0;
    let DPR = 1;

    let verts: Vtx[] = [];
    let tris: Tri[] = [];
    let cols = 0;
    let reachableTotal = 0; // on-screen tiles (so 100% is reachable)
    let brokenReachable = 0;
    let cleared = false; // one-shot guard for the 100% auto-clear
    const falling: FallingShard[] = [];

    const mouse = { x: innerWidth / 2, y: innerHeight / 2, inside: false };
    const cur = { x: mouse.x, y: mouse.y, scale: 1 };

    // ---------- setup ----------
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
            ax: reduced ? 0 : rand(4, 12),
            ay: reduced ? 0 : rand(4, 12),
          });
        }
      }
      const id = (i: number, j: number) => j * cols + i;
      const onScreen = (a: number, b: number, c: number) => {
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
      onProgressRef.current?.(0);
    }

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = innerWidth;
      H = innerHeight;
      for (const c of [bg, fx] as HTMLCanvasElement[]) {
        c.width = Math.floor(W * DPR);
        c.height = Math.floor(H * DPR);
        c.style.width = `${W}px`;
        c.style.height = `${H}px`;
      }
      bctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
      fctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
      buildMesh();
    }

    // Redness comes ONLY from cursor proximity (no static pockets).
    function redAt(x: number, y: number) {
      let r = 0;
      if (mouse.inside) {
        r += Math.max(0, 1 - Math.hypot(x - cur.x, y - cur.y) / 230) * 1.5;
      }
      return Math.min(1, r);
    }

    // ---------- break the mesh ----------
    // When progress hits 100%, clear every remaining tile (incl. off-screen
    // overscan at the edges) so no glass is left anywhere.
    function breakAllRemaining() {
      for (const tr of tris) {
        if (tr.broken) continue;
        tr.broken = true;
        const A = verts[tr.a];
        const B = verts[tr.b];
        const C = verts[tr.c];
        const cx = (A.px + B.px + C.px) / 3;
        const cy = (A.py + B.py + C.py) / 3;
        if (cx < -80 || cx > W + 80 || cy < -80 || cy > H + 80) continue;
        falling.push({
          cx,
          cy,
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

    function breakAt(x: number, y: number) {
      const R2 = BREAK_RADIUS * BREAK_RADIUS;
      let broke = 0;
      let brokeReach = 0;
      for (const tr of tris) {
        if (tr.broken) continue;
        const A = verts[tr.a];
        const B = verts[tr.b];
        const C = verts[tr.c];
        const cx = (A.px + B.px + C.px) / 3;
        const cy = (A.py + B.py + C.py) / 3;
        const dx = cx - x;
        const dy = cy - y;
        if (dx * dx + dy * dy > R2) continue;

        tr.broken = true;
        broke++;
        if (tr.onScreen) brokeReach++;
        const d = Math.hypot(dx, dy) || 1;
        falling.push({
          cx,
          cy,
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
          onProgressRef.current?.(1);
        } else {
          onProgressRef.current?.(Math.min(1, brokenReachable / reachableTotal));
        }
      }
    }

    // ---------- mesh ----------
    function drawMesh(ts: number) {
      bctx!.clearRect(0, 0, W, H);
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

      // Frosted glass tiles ON TOP of the content. Each intact triangle is a
      // semi-opaque dark frost that dims the content behind; broken tiles are
      // skipped → transparent holes that reveal the vivid content. Red tint
      // (from redAt) marks the glowing pockets; those areas read a touch clearer.
      bctx!.lineWidth = 1;
      for (const tr of tris) {
        if (tr.broken) continue;
        const A = verts[tr.a];
        const B = verts[tr.b];
        const C = verts[tr.c];
        const cx = (A.px + B.px + C.px) / 3;
        const cy = (A.py + B.py + C.py) / 3;
        const red = redAt(cx, cy);

        bctx!.beginPath();
        bctx!.moveTo(A.px, A.py);
        bctx!.lineTo(B.px, B.py);
        bctx!.lineTo(C.px, C.py);
        bctx!.closePath();

        // frost: opaque enough to fade the content; a bit thinner where red glows.
        const fa = 0.56 + tr.seed * 0.1 - red * 0.16;
        bctx!.fillStyle = `rgba(${(12 + red * 150) | 0},${(13 + red * 10) | 0},${(18 + red * 14) | 0},${fa})`;
        bctx!.fill();

        // edge sheen — makes the tiling read as glass
        const ea = 0.1 + red * 0.3;
        bctx!.strokeStyle = `rgba(${(150 + red * 85) | 0},${(160 - red * 110) | 0},${(185 - red * 110) | 0},${ea})`;
        bctx!.stroke();
      }
    }

    // ---------- falling glass + cursor ----------
    function drawFx() {
      fctx!.clearRect(0, 0, W, H);

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
        fctx!.save();
        fctx!.translate(f.cx, f.cy);
        fctx!.rotate(f.rot);
        fctx!.beginPath();
        fctx!.moveTo(f.o[0].x, f.o[0].y);
        fctx!.lineTo(f.o[1].x, f.o[1].y);
        fctx!.lineTo(f.o[2].x, f.o[2].y);
        fctx!.closePath();
        const rr = (200 + f.red * 35) | 0;
        const gg = (214 - f.red * 120) | 0;
        const bb = (240 - f.red * 120) | 0;
        fctx!.fillStyle = `rgba(${rr},${gg},${bb},${0.14 * al})`;
        fctx!.fill();
        fctx!.lineWidth = 1.1;
        fctx!.strokeStyle =
          f.red > 0.4 ? `rgba(255,90,80,${0.6 * al})` : `rgba(225,235,255,${0.55 * al})`;
        fctx!.stroke();
        fctx!.restore();
      }

      // custom cursor
      if (fine) {
        cur.x += (mouse.x - cur.x) * 0.18;
        cur.y += (mouse.y - cur.y) * 0.18;
        cur.scale += (1 - cur.scale) * 0.15;
        if (mouse.inside) {
          fctx!.globalCompositeOperation = "lighter";
          const halo = fctx!.createRadialGradient(cur.x, cur.y, 0, cur.x, cur.y, 52);
          halo.addColorStop(0, "rgba(235,20,45,0.30)");
          halo.addColorStop(1, "rgba(235,20,45,0)");
          fctx!.fillStyle = halo;
          fctx!.beginPath();
          fctx!.arc(cur.x, cur.y, 52, 0, Math.PI * 2);
          fctx!.fill();
          fctx!.globalCompositeOperation = "source-over";

          const R = 16 * cur.scale;
          fctx!.save();
          fctx!.translate(cur.x, cur.y);
          fctx!.lineWidth = 1.2;
          fctx!.strokeStyle = "rgba(255,255,255,0.65)";
          fctx!.beginPath();
          fctx!.arc(0, 0, R, 0, Math.PI * 2);
          fctx!.stroke();
          fctx!.strokeStyle = "rgba(235,0,40,0.95)";
          fctx!.lineWidth = 1.6;
          fctx!.beginPath();
          fctx!.arc(0, 0, R, -0.45, 0.45);
          fctx!.stroke();
          fctx!.strokeStyle = "rgba(255,255,255,0.85)";
          fctx!.lineWidth = 1.2;
          fctx!.beginPath();
          fctx!.moveTo(-4, 0);
          fctx!.lineTo(4, 0);
          fctx!.moveTo(0, -4);
          fctx!.lineTo(0, 4);
          fctx!.stroke();
          fctx!.fillStyle = "rgba(255,255,255,0.9)";
          fctx!.beginPath();
          fctx!.arc(R + 6, 0, 1.6, 0, Math.PI * 2);
          fctx!.fill();
          fctx!.restore();
        }
      }
    }

    let raf = 0;
    function loop(ts: number) {
      drawMesh(ts);
      drawFx();
      raf = requestAnimationFrame(loop);
    }

    // ---------- events ----------
    function onMove(e: PointerEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.inside = true;
    }
    function onDown(e: PointerEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.inside = true;
      cur.scale = 1.85;
      const target = e.target as HTMLElement | null;
      if (target?.closest("a, button, [data-no-shatter]")) return; // keep nav/CTA usable
      breakAt(e.clientX, e.clientY);
    }
    function onLeave() {
      mouse.inside = false;
    }

    resize();
    raf = requestAnimationFrame(loop);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerleave", onLeave);
    document.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <>
      {/* glass sits ABOVE the content (z-10); falling pieces + cursor on z-20 */}
      <canvas ref={bgRef} className="pointer-events-none absolute inset-0 z-10" />
      <canvas ref={fxRef} className="pointer-events-none absolute inset-0 z-20" />
    </>
  );
}
