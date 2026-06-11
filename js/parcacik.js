/* ============================================================
   TEDxGültepe 2026 — "Kelimeler" interlüdü (particle text)
   handoff/particle/* (R3F) mantığının vanilla three.js portu.
   Kelimeler parçacıklardan toplanır, dağılarak birbirine
   dönüşür, imleçten kaçar. three@0.160 CDN'den (hero3d.js
   deseni); R3F/gsap bağımlılıkları kaldırıldı (enerji darbesi
   üstel sönümle). Lazy init + IntersectionObserver duraklatma.
   ============================================================ */

const sec = document.querySelector("[data-ptext]");
const canvas = sec?.querySelector("[data-pt-canvas]");

const WORDS = ["CESARET", "FİKİR", "TOPLULUK", "EŞİK", "TEDxGÜLTEPE"];

/* Fizik ayarları — handoff değerleri */
const STIFFNESS = 9.0;
const SCATTER_AMP = 4.2;
const MOUSE_AMP = 3.0;
const MOUSE_RADIUS = 2.6;
const IDLE_WOBBLE = 0.05;
const CYCLE_MS = 3600;

const vertexShader = /* glsl */ `
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vSeed;
  void main() {
    vSeed = aSeed;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uPixelRatio * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vSeed;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.04, d);
    float core = smoothstep(0.34, 0.0, d);
    vec3 col = mix(uColorA, uColorB, vSeed);
    // kırmızıların arasına serpiştirilmiş beyaz noktalar (~%12)
    if (vSeed > 0.88) col = vec3(1.0, 0.97, 0.94);
    col += core * 0.55;
    gl_FragColor = vec4(col, alpha * uOpacity);
  }
`;

/* TEDx marka yazımı: kelimedeki küçük "x"i daha küçük puntoyla ve
   yukarı kaydırarak (üst simge) çizer; x yoksa normal fillText */
function fillWordBrand(ctx, text, cx, cy, fontSize, fontFamily) {
  const xi = text.indexOf("x");
  if (xi === -1) {
    ctx.fillText(text, cx, cy);
    return;
  }
  const pre = text.slice(0, xi);
  const post = text.slice(xi + 1);
  const mainFont = `${fontSize}px ${fontFamily}`;
  const xFont = `${Math.max(1, Math.round(fontSize * 0.62))}px ${fontFamily}`;
  ctx.font = mainFont;
  const wPre = ctx.measureText(pre).width;
  const wPost = ctx.measureText(post).width;
  ctx.font = xFont;
  const wX = ctx.measureText("x").width;
  const left = cx - (wPre + wX + wPost) / 2;
  ctx.textAlign = "left";
  ctx.font = mainFont;
  ctx.fillText(pre, left, cy);
  ctx.font = xFont;
  ctx.fillText("x", left + wPre, cy - fontSize * 0.3);
  ctx.font = mainFont;
  ctx.fillText(post, left + wPre + wX, cy);
  ctx.textAlign = "center";
}

/* Yazıyı offscreen canvas'ta örnekleyip dünya-uzayı noktalarına çevirir
   (handoff/textToPoints.ts portu) */
function sampleTextToPoints(text, opts) {
  const { count, width, height, fontFamily, worldWidth, worldHeight } = opts;
  const cv = document.createElement("canvas");
  cv.width = width;
  cv.height = height;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const result = new Float32Array(count * 3);
  if (!ctx) return randomCloud(result, count, worldWidth, worldHeight);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Tavan hem yüksekliğe hem genişliğe bağlı: dar (mobil) tuvalde kısa
  // kelimeler (EŞİK, FİKİR) dev olup taşmasın, boyutlar birbirine yakın kalsın.
  let fontSize = Math.floor(Math.min(height * 0.38, width * 0.28));
  ctx.font = `${fontSize}px ${fontFamily}`;
  const maxWidth = width * 0.78;
  const measured = ctx.measureText(text).width;
  if (measured > maxWidth && measured > 0) {
    fontSize = Math.floor(fontSize * (maxWidth / measured));
    ctx.font = `${fontSize}px ${fontFamily}`;
  }
  fillWordBrand(ctx, text, width / 2, height / 2, fontSize, fontFamily);

  const data = ctx.getImageData(0, 0, width, height).data;
  const filled = [];
  const stride = 3;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      if (data[(y * width + x) * 4 + 3] > 128) filled.push(x, y);
    }
  }

  const found = filled.length / 2;
  if (found === 0) return randomCloud(result, count, worldWidth, worldHeight);

  const oversampled = found < count;
  for (let i = 0; i < count; i++) {
    let idx = Math.floor((i / count) * found);
    if (idx >= found) idx = found - 1;
    const px = filled[idx * 2];
    const py = filled[idx * 2 + 1];
    const jx = oversampled ? (Math.random() - 0.5) * stride * 2 : 0;
    const jy = oversampled ? (Math.random() - 0.5) * stride * 2 : 0;
    result[i * 3] = ((px + jx) / width - 0.5) * worldWidth;
    result[i * 3 + 1] = -((py + jy) / height - 0.5) * worldHeight;
    result[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }
  return result;
}

function randomCloud(out, count, w, h) {
  for (let i = 0; i < count; i++) {
    out[i * 3] = (Math.random() - 0.5) * w;
    out[i * 3 + 1] = (Math.random() - 0.5) * h;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }
  return out;
}

if (sec && canvas) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Lazy init: bölüm viewport'a ~1 ekran yaklaşınca sahne kurulur.
  const lazy = new IntersectionObserver(
    async ([entry]) => {
      if (!entry.isIntersecting) return;
      lazy.disconnect();
      let THREE;
      try {
        THREE = await import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js");
        init(THREE);
      } catch (err) {
        sec.classList.add("ptext--fallback");
      }
    },
    { rootMargin: "100% 0px" }
  );
  lazy.observe(sec);

  function init(THREE) {
    const captionEl = sec.querySelector("[data-pt-caption]");
    const dotsWrap = sec.querySelector("[data-pt-dots]");
    const liveEl = sec.querySelector("[data-pt-live]");

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 18);

    const count = window.innerWidth < 640 ? 4200 : 7200;

    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 34;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = Math.random();
    const dirs = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      dirs[i * 3] = Math.sin(phi) * Math.cos(theta);
      dirs[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
      dirs[i * 3 + 2] = Math.cos(phi) * 0.4;
    }

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", posAttr);
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uSize: { value: 0.26 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uColorA: { value: new THREE.Color("#EB0028") },
        uColorB: { value: new THREE.Color("#FF7A45") },
        uOpacity: { value: 1.0 },
      },
    });

    const points = new THREE.Points(geo, material);
    points.frustumCulled = false;
    scene.add(points);

    /* ---------- dünya-uzayı ölçüleri ---------- */
    let worldW = 0;
    let worldH = 0;
    function fitCamera() {
      const w = sec.clientWidth;
      const h = sec.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      worldH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
      worldW = worldH * camera.aspect;
    }
    fitCamera();

    /* ---------- kelime home'ları ---------- */
    let homes = [];
    let target = positions;
    let built = false;
    let index = 0;
    const energy = { value: 0 };

    function buildHomes() {
      const cw = Math.min(Math.round(sec.clientWidth), 1600);
      const ch = Math.max(1, Math.round((cw * sec.clientHeight) / sec.clientWidth));
      const opts = {
        count,
        width: cw,
        height: ch,
        fontFamily: '"Anton", "Arial Narrow", sans-serif',
        worldWidth: worldW,
        worldHeight: worldH,
      };
      homes = WORDS.map((w) => sampleTextToPoints(w, opts));
      target = homes[index];
      if (!built) {
        built = true;
        if (reduced) {
          positions.set(target);
          posAttr.needsUpdate = true;
          renderer.render(scene, camera);
        } else {
          energy.value = 1; // rastgele buluttan ilk toplanma
        }
      }
    }

    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    fontsReady.then(() => setTimeout(buildHomes, 60));

    /* ---------- caption / noktalar / canlı bölge ---------- */
    const dots = WORDS.map((_, i) => {
      const d = document.createElement("i");
      if (i === 0) d.classList.add("is-on");
      dotsWrap?.appendChild(d);
      return d;
    });

    function renderCaption() {
      const word = WORDS[index];
      if (captionEl) {
        if (word === "TEDxGÜLTEPE") captionEl.innerHTML = '<b>TED<span class="tedx-x">x</span></b>GÜLTEPE';
        else captionEl.textContent = word;
      }
      if (liveEl) liveEl.textContent = "Aktif kelime: " + word;
      dots.forEach((d, i) => d.classList.toggle("is-on", i === index));
    }
    renderCaption();

    function advanceWord() {
      index = (index + 1) % WORDS.length;
      target = homes[index] || target;
      energy.value = 1;
      renderCaption();
      if (window.gsap && captionEl) {
        window.gsap.fromTo(
          captionEl,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" }
        );
      }
    }

    /* ---------- imleç ---------- */
    const vMouse = new THREE.Vector3();
    const vDir = new THREE.Vector3();
    const mouseWorld = new THREE.Vector3();
    let pointerActive = false;

    sec.addEventListener(
      "pointermove",
      (e) => {
        const r = canvas.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * 2 - 1;
        const py = -(((e.clientY - r.top) / r.height) * 2 - 1);
        vMouse.set(px, py, 0.5).unproject(camera);
        vDir.copy(vMouse).sub(camera.position).normalize();
        const dist = -camera.position.z / vDir.z;
        mouseWorld.copy(camera.position).addScaledVector(vDir, dist);
        pointerActive = true;
      },
      { passive: true }
    );
    sec.addEventListener("pointerleave", () => (pointerActive = false));

    /* ---------- döngü + görünürlük ---------- */
    let visible = false;
    let raf = null;
    let last = performance.now();
    let cycleTimer = null;

    function frame(now) {
      if (!visible || document.hidden) {
        raf = null;
        return;
      }
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const t = now * 0.001;

      if (built) {
        // enerji: üstel sönüm (gsap tween'inin yerine — görsel olarak eşdeğer)
        if (energy.value > 0.005) energy.value *= Math.exp(-dt * 2.0);
        else energy.value = 0;

        const ease = 1 - Math.exp(-STIFFNESS * dt);
        const settled = 1 - Math.min(1, energy.value);
        const r2 = MOUSE_RADIUS * MOUSE_RADIUS;
        const home = target;
        const pos = positions;

        for (let i = 0; i < count; i++) {
          const ix = i * 3;
          const iy = ix + 1;
          const iz = ix + 2;
          const seed = seeds[i];

          const amp = SCATTER_AMP * (0.4 + seed) * energy.value;
          let tx = home[ix] + dirs[ix] * amp;
          let ty = home[iy] + dirs[iy] * amp;
          let tz = home[iz] + dirs[iz] * amp;

          if (settled > 0.01) {
            tx += Math.sin(t * 1.6 + seed * 30) * IDLE_WOBBLE * settled;
            ty += Math.cos(t * 1.4 + seed * 22) * IDLE_WOBBLE * settled;
          }

          if (pointerActive) {
            const mdx = pos[ix] - mouseWorld.x;
            const mdy = pos[iy] - mouseWorld.y;
            const d2 = mdx * mdx + mdy * mdy;
            if (d2 < r2) {
              const d = Math.sqrt(d2) + 1e-4;
              const fall = 1 - d / MOUSE_RADIUS;
              tx += (mdx / d) * fall * MOUSE_AMP;
              ty += (mdy / d) * fall * MOUSE_AMP;
            }
          }

          pos[ix] += (tx - pos[ix]) * ease;
          pos[iy] += (ty - pos[iy]) * ease;
          pos[iz] += (tz - pos[iz]) * ease;
        }
        posAttr.needsUpdate = true;
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }

    function play() {
      if (raf === null && visible && !document.hidden && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
      if (cycleTimer === null && visible && !document.hidden && !reduced) {
        cycleTimer = setInterval(() => {
          if (built) advanceWord();
        }, CYCLE_MS);
      }
    }
    function pause() {
      if (cycleTimer !== null) {
        clearInterval(cycleTimer);
        cycleTimer = null;
      }
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        visible ? play() : pause();
      },
      { threshold: 0 }
    );
    io.observe(sec);

    document.addEventListener("visibilitychange", () => {
      document.hidden ? pause() : play();
    });

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        fitCamera();
        if (built) buildHomes();
      }, 180);
    });
  }
} else if (sec) {
  sec.classList.add("ptext--fallback");
}
