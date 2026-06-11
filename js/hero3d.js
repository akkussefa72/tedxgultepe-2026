/* ============================================================
   TEDxGültepe 2026 — hero particle field
   A 14k-point "X" that breathes, tilts with the pointer,
   and disperses as you cross the threshold (scroll).
   ============================================================ */

const canvas = document.getElementById("hero-canvas");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let THREE;
try {
  THREE = await import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js");
} catch (err) {
  document.body.classList.add("no-webgl");
}

if (THREE && canvas) {
  try {
    init(THREE);
  } catch (err) {
    document.body.classList.add("no-webgl");
    canvas.style.display = "none";
  }
} else if (canvas) {
  canvas.style.display = "none";
}

function init(THREE) {
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const COUNT = isMobile ? 6500 : 14000;
  const AMBIENT = isMobile ? 700 : 1600;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
  camera.position.z = 30;

  /* ---------- Geometry: two crossing bars + ambient dust ---------- */
  const total = COUNT + AMBIENT;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const rands = new Float32Array(total);
  const sizes = new Float32Array(total);

  const red = new THREE.Color("#EB0028");
  const deep = new THREE.Color("#7A0014");
  const white = new THREE.Color("#FFF4EE");
  const tmp = new THREE.Color();

  const BAR_LEN = 26, BAR_TH = 2.6, BAR_DEPTH = 5;

  for (let i = 0; i < total; i++) {
    const i3 = i * 3;
    let x, y, z;

    if (i < COUNT) {
      // Point in a horizontal slab, then rotate ±45° → X
      const u = (Math.random() - 0.5) * BAR_LEN;
      // Cluster density toward the center of the X
      const squeeze = 1 - Math.pow(Math.abs(u) / (BAR_LEN / 2), 1.6) * 0.35;
      const v = (Math.random() - 0.5) * BAR_TH * squeeze;
      const w = (Math.random() - 0.5) * BAR_DEPTH;
      const ang = i % 2 === 0 ? Math.PI / 4 : -Math.PI / 4;
      x = u * Math.cos(ang) - v * Math.sin(ang);
      y = u * Math.sin(ang) + v * Math.cos(ang);
      z = w;
    } else {
      // Ambient dust on a loose sphere shell
      const r = 16 + Math.random() * 22;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      x = r * Math.sin(phi) * Math.cos(theta);
      y = r * Math.sin(phi) * Math.sin(theta);
      z = r * Math.cos(phi) - 6;
    }

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    const roll = Math.random();
    if (roll > 0.9) tmp.copy(white);
    else tmp.copy(deep).lerp(red, 0.5 + Math.random() * 0.5);
    colors[i3] = tmp.r;
    colors[i3 + 1] = tmp.g;
    colors[i3 + 2] = tmp.b;

    rands[i] = Math.random();
    sizes[i] = i < COUNT ? 0.85 + Math.random() * 2.2 : 0.4 + Math.random() * 1.0;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rands, 1));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uPx: { value: renderer.getPixelRatio() },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uScroll;
      uniform float uPx;
      attribute vec3 aColor;
      attribute float aRand;
      attribute float aSize;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec3 p = position;
        float t = uTime * 0.55 + aRand * 6.2831;

        // Organic drift — cheap layered trig noise
        p.x += sin(t + position.y * 0.32) * 0.42;
        p.y += cos(t * 0.83 + position.x * 0.27) * 0.42;
        p.z += sin(t * 0.67 + aRand * 9.0) * 0.55;

        // Scroll: scatter outward along each point's radial direction
        vec3 dir = normalize(position + vec3(0.0001));
        p += dir * uScroll * (5.0 + aRand * 18.0);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * uPx * (30.0 / -mv.z);
        gl_Position = projectionMatrix * mv;

        vColor = aColor;
        float twinkle = 0.85 + 0.22 * sin(uTime * (1.0 + aRand * 2.0) + aRand * 40.0);
        vAlpha = twinkle * (1.0 - uScroll * 0.95);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.06, d) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
      }
    `,
  });

  const points = new THREE.Points(geo, material);
  const group = new THREE.Group();
  group.add(points);
  group.rotation.z = 0.06;
  scene.add(group);

  /* ---------- Sizing ---------- */
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the X fully in frame on narrow screens.
    // Portrede z, X'in yarı genişliği (~10.5 birim + pay) görüş alanına
    // sığacak şekilde aspect'ten hesaplanır: halfW = tan(fov/2)·z·aspect
    camera.position.z =
      camera.aspect < 0.9
        ? Math.min(72, Math.max(44, 24.7 / camera.aspect))
        : camera.aspect < 1.4
          ? 36
          : 30;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  /* ---------- Inputs: pointer + scroll ---------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!isMobile) {
    window.addEventListener(
      "mousemove",
      (e) => {
        pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
      },
      { passive: true }
    );
  }
  // Dokunmatikte X başparmağı izler — masaüstündeki eğilmeyle aynı hedefler
  window.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      pointer.tx = (t.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (t.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true }
  );

  let scrollT = 0;
  window.addEventListener(
    "scroll",
    () => {
      scrollT = Math.min(1, window.scrollY / (window.innerHeight * 1.05));
    },
    { passive: true }
  );

  /* ---------- Render loop with visibility guards ---------- */
  let visible = true;
  let rafId = null;
  const clock = new THREE.Clock();

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && rafId === null && !reduced) loop();
    },
    { threshold: 0 }
  );
  io.observe(canvas);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!document.hidden && visible && rafId === null && !reduced) {
      loop();
    }
  });

  function frame() {
    const t = clock.getElapsedTime();
    material.uniforms.uTime.value = t;
    material.uniforms.uScroll.value += (scrollT - material.uniforms.uScroll.value) * 0.08;

    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;

    group.rotation.y = pointer.x * 0.28 + Math.sin(t * 0.08) * 0.05;
    group.rotation.x = -pointer.y * 0.16 + Math.cos(t * 0.07) * 0.04;

    renderer.render(scene, camera);
  }

  function loop() {
    if (!visible || document.hidden) {
      rafId = null;
      return;
    }
    frame();
    rafId = requestAnimationFrame(loop);
  }

  if (reduced) {
    // One elegant still frame — no motion
    material.uniforms.uTime.value = 2.0;
    canvas.style.opacity = "1";
    renderer.render(scene, camera);
  } else {
    loop();
  }
}
