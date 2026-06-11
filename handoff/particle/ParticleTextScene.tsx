"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { sampleTextToPoints } from "./textToPoints";
import { particleVertex, particleFragment } from "./particleShaders";
import { display } from "@/lib/fonts";

export const PARTICLE_WORDS = ["INNOVATION", "PASSION", "COMMUNITY", "TEDxGÜLTEPE"];

// Tunable physics — kept here so the feel is easy to adjust.
// Target-based exponential motion: each frame we build a per-particle target
// (home + scatter + cursor repulsion) and ease toward it. This guarantees the
// letters settle crisply between morphs instead of perpetually drifting.
const STIFFNESS = 9.0; // approach rate toward the target (higher = snappier)
const SCATTER_AMP = 4.2; // world-units the particles bulge out during a morph
const MOUSE_AMP = 3.0; // world-units repulsion offset near the cursor
const MOUSE_RADIUS = 2.6; // world-units radius of cursor influence
const IDLE_WOBBLE = 0.05; // tiny living shimmer once settled

function Particles({
  wordIndex,
  reduced,
}: {
  wordIndex: number;
  reduced: boolean;
}) {
  const { size, viewport } = useThree();
  const pointsRef = useRef<THREE.Points>(null);

  // Particle count is fixed for the session (chosen from initial width) so the
  // geometry never needs to be re-allocated; resizes only refit the homes.
  const count = useMemo(
    () => (typeof window !== "undefined" && window.innerWidth < 640 ? 4200 : 7200),
    []
  );

  // --- Static per-particle buffers (allocated once) ---
  const positions = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a[i * 3] = (Math.random() - 0.5) * 34;
      a[i * 3 + 1] = (Math.random() - 0.5) * 20;
      a[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return a;
  }, [count]);

  const seeds = useMemo(() => {
    const a = new Float32Array(count);
    for (let i = 0; i < count; i++) a[i] = Math.random();
    return a;
  }, [count]);

  // Seeded outward unit vectors — give the scatter a non-uniform, organic burst.
  const dirs = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      a[i * 3] = Math.sin(phi) * Math.cos(theta);
      a[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
      a[i * 3 + 2] = Math.cos(phi) * 0.4;
    }
    return a;
  }, [count]);

  const homesRef = useRef<Float32Array[]>([]);
  const targetRef = useRef<Float32Array>(positions);
  const builtRef = useRef(false);
  const energyRef = useRef({ value: 0 });
  const wordIndexRef = useRef(wordIndex);

  const uniforms = useMemo(
    () => ({
      uSize: { value: 0.18 },
      uPixelRatio: { value: 1 },
      uColorA: { value: new THREE.Color("#EB0028") },
      uColorB: { value: new THREE.Color("#FF7A45") },
      uOpacity: { value: 0.92 },
    }),
    []
  );

  useEffect(() => {
    uniforms.uPixelRatio.value = Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio : 1,
      1.5
    );
  }, [uniforms]);

  // (Re)build the home positions for every word at the current viewport size.
  // Debounced and gated on fonts so the letters are shaped correctly.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const build = () => {
      if (cancelled) return;
      const cw = Math.min(Math.round(size.width), 1600);
      const ch = Math.max(1, Math.round((cw * size.height) / size.width));
      const opts = {
        count,
        width: cw,
        height: ch,
        fontFamily: display.style.fontFamily,
        worldWidth: viewport.width,
        worldHeight: viewport.height,
      };
      homesRef.current = PARTICLE_WORDS.map((w) => sampleTextToPoints(w, opts));
      targetRef.current = homesRef.current[wordIndexRef.current];

      if (!builtRef.current) {
        builtRef.current = true;
        if (reduced) {
          // Snap straight to the word for reduced-motion users.
          positions.set(targetRef.current);
          const geo = pointsRef.current?.geometry;
          if (geo) geo.attributes.position.needsUpdate = true;
        } else {
          // Animate the first assembly in from the random cloud.
          energyRef.current.value = 1;
          gsap.killTweensOf(energyRef.current);
          gsap.to(energyRef.current, {
            value: 0,
            duration: 1.8,
            ease: "power2.out",
          });
        }
      }
    };

    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    const ready = fonts?.ready ?? Promise.resolve();
    ready.then(() => {
      timer = setTimeout(build, 60);
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, size.width, size.height, viewport.width, viewport.height]);

  // React to word changes: retarget + fire the scatter→reform energy pulse.
  useEffect(() => {
    wordIndexRef.current = wordIndex;
    if (!builtRef.current) return;
    targetRef.current = homesRef.current[wordIndex];
    if (reduced) {
      positions.set(targetRef.current);
      const geo = pointsRef.current?.geometry;
      if (geo) geo.attributes.position.needsUpdate = true;
      return;
    }
    gsap.killTweensOf(energyRef.current);
    energyRef.current.value = 1;
    gsap.to(energyRef.current, { value: 0, duration: 1.5, ease: "power2.out" });
  }, [wordIndex, reduced, positions]);

  // Reusable scratch vectors (avoid per-frame allocation).
  const vMouse = useMemo(() => new THREE.Vector3(), []);
  const vDir = useMemo(() => new THREE.Vector3(), []);
  const mouseWorld = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const points = pointsRef.current;
    if (!points || !builtRef.current) return;
    const geo = points.geometry;
    const pos = positions;
    const home = targetRef.current;
    const n = count;

    if (reduced) {
      for (let i = 0; i < n * 3; i++) pos[i] += (home[i] - pos[i]) * 0.18;
      geo.attributes.position.needsUpdate = true;
      return;
    }

    const dt = Math.min(delta, 1 / 30);
    const ease = 1 - Math.exp(-STIFFNESS * dt); // frame-rate independent
    const energy = energyRef.current.value;
    const t = state.clock.elapsedTime;

    // Project the cursor onto the z=0 plane in world space.
    const px = state.pointer.x;
    const py = state.pointer.y;
    const pointerActive = Math.abs(px) > 0.0005 || Math.abs(py) > 0.0005;
    if (pointerActive) {
      vMouse.set(px, py, 0.5).unproject(state.camera);
      vDir.copy(vMouse).sub(state.camera.position).normalize();
      const dist = -state.camera.position.z / vDir.z;
      mouseWorld.copy(state.camera.position).add(vDir.multiplyScalar(dist));
    }

    const r = MOUSE_RADIUS;
    const r2 = r * r;
    const settled = 1 - Math.min(1, energy); // 1 when fully reformed

    for (let i = 0; i < n; i++) {
      const ix = i * 3;
      const iy = ix + 1;
      const iz = ix + 2;
      const seed = seeds[i];

      // Target = home, pushed outward while transition energy is high.
      const amp = SCATTER_AMP * (0.4 + seed) * energy;
      let tx = home[ix] + dirs[ix] * amp;
      let ty = home[iy] + dirs[iy] * amp;
      let tz = home[iz] + dirs[iz] * amp;

      // A faint shimmer once settled keeps the text alive (not frozen).
      if (settled > 0.01) {
        tx += Math.sin(t * 1.6 + seed * 30) * IDLE_WOBBLE * settled;
        ty += Math.cos(t * 1.4 + seed * 22) * IDLE_WOBBLE * settled;
      }

      // Cursor repulsion folded into the target → stable, springy "hole".
      if (pointerActive) {
        const mdx = pos[ix] - mouseWorld.x;
        const mdy = pos[iy] - mouseWorld.y;
        const d2 = mdx * mdx + mdy * mdy;
        if (d2 < r2) {
          const d = Math.sqrt(d2) + 1e-4;
          const fall = 1 - d / r;
          tx += (mdx / d) * fall * MOUSE_AMP;
          ty += (mdy / d) * fall * MOUSE_AMP;
        }
      }

      pos[ix] += (tx - pos[ix]) * ease;
      pos[iy] += (ty - pos[iy]) * ease;
      pos[iz] += (tz - pos[iz]) * ease;
    }

    geo.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          usage={THREE.DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-aSeed"
          count={count}
          array={seeds}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={particleVertex}
        fragmentShader={particleFragment}
        uniforms={uniforms}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent
      />
    </points>
  );
}

export default function ParticleTextScene({
  wordIndex,
  reduced,
}: {
  wordIndex: number;
  reduced: boolean;
}) {
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 18], fov: 45, near: 0.1, far: 100 }}
    >
      <Particles wordIndex={wordIndex} reduced={reduced} />
    </Canvas>
  );
}
