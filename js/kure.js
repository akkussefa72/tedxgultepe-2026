/* ============================================================
   TEDxGültepe — KÜRE GALERİSİ (Kareler bölümü)
   2025 fotoğrafları bir kürenin yüzeyine dizilir; küre yavaşça
   döner, sürüklenince elle döndürülür. Küreye tıklayınca kamera
   içine süzülür: fotoğraflar artık çepeçevre — sürükleyerek
   etrafına bakınılır. ESC ya da "çık" ile dışarı dönülür.
   three@0.160 CDN'den (hero3d.js ile aynı, modül önbelleğe alınır).
   WebGL yoksa / hareket azaltma açıksa hiç kurulmaz — film şeridi
   (fallback) görünür kalır.
   ============================================================ */

const wrap = document.querySelector("[data-kure]");
const canvas = document.querySelector("[data-kure-canvas]");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (wrap && canvas && !reduced) {
  /* DİKKAT: wrap başlangıçta hidden (display:none) — IO hiç tetiklenmez.
     Bu yüzden görünür olan bölüm gözlemlenir. */
  const sectionEl = wrap.closest(".snaps") || wrap.parentElement;
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        boot();
      }
    },
    { rootMargin: "600px" }
  );
  io.observe(sectionEl);
}

async function boot() {
  let THREE;
  try {
    THREE = await import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js");
  } catch {
    return; // şerit fallback olarak kalır
  }
  try {
    init(THREE);
  } catch {
    wrap.hidden = true;
    wrap.closest(".snaps")?.classList.remove("snaps--kure");
  }
}

function init(THREE) {
  const section = wrap.closest(".snaps");
  const hintEl = wrap.querySelector("[data-kure-hint]");
  const exitBtn = wrap.querySelector("[data-kure-exit]");

  /* Fotoğraflar şeritteki gerçek karelerden toplanır (tek kaynak) */
  const srcs = [...document.querySelectorAll('.snaps__strip img[src*="img/galeri"]')].map((i) => i.src);
  if (srcs.length < 4) return;

  /* ---------- sahne ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 60);
  /* Dış kamera mesafesi hem dikey hem yatay sığdırmayla hesaplanır:
     dar ekranda yatay, geniş bantta dikey kazanır. Dikeyde ipucu çipi
     için ekstra pay bırakılır — küre hiçbir cihazda çipe binmez. */
  const OUT_Y = -0.35; // küre kadrajda hafif yukarı otursun (alt boşluk çipe)
  let outZ = 9.7;
  function fitOutZ() {
    const halfFov = Math.tan((camera.fov * Math.PI) / 360);
    const reach = 3.95; // küre + kart taşması
    const vFit = (reach * 1.28) / halfFov;
    const hFit = reach / (halfFov * camera.aspect) + 0.5;
    outZ = Math.max(vFit, hFit);
  }
  camera.position.set(0, OUT_Y, outZ);

  const group = new THREE.Group();
  scene.add(group);

  /* Küre yüzeyine fibonacci dağılımıyla kart yerleşimi.
     Fotoğraflar iki tur kullanılır — küre dolu görünsün. */
  const R = 3;
  const tiles = [...srcs, ...srcs];
  const loader = new THREE.TextureLoader();
  const golden = Math.PI * (3 - Math.sqrt(5));
  tiles.forEach((src, i) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
    const t = loader.load(src, (tex) => {
      /* Kart oranı fotoğrafın kendi oranına uyar — yatay kare ezilmesin */
      const a = tex.image.width / tex.image.height;
      const h = a >= 1 ? 1.12 : 1.5;
      mesh.scale.set(h * Math.min(a, 1.7), h, 1);
    });
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const mat = new THREE.MeshBasicMaterial({
      map: t,
      side: THREE.DoubleSide,
      transparent: true,
    });
    mat.color.setScalar(0.85); // dışarıdan hafif loş; içeride aydınlanır
    mesh.material = mat;
    mesh.scale.set(1.16, 1.5, 1);

    const y = 1 - (2 * (i + 0.5)) / tiles.length;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    mesh.position.set(Math.cos(th) * rad * R, y * R, Math.sin(th) * rad * R);
    mesh.lookAt(0, 0, 0);
    mesh.rotateY(Math.PI); // yüzü dışarı baksın (DoubleSide: içeriden de görünür)
    group.add(mesh);
  });

  /* ---------- hero3d ile aynı parçacık dili ----------
     Merkezdeki X ve çevre tozu, hero'daki X'in reçetesiyle üretilir:
     aynı renk paleti, aynı drift+parıltı shader'ı, additive yumuşak
     diskler. X içeri girerken uOpacity ile söner (içinden geçilir). */
  const isMobile = window.matchMedia("(max-width: 768px)").matches;

  function makeCloudMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uAlphaBase: { value: 0.85 },
        uPx: { value: renderer.getPixelRatio() },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uPx;
        uniform float uAlphaBase;
        attribute vec3 aColor;
        attribute float aRand;
        attribute float aSize;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float t = uTime * 0.55 + aRand * 6.2831;
          p.x += sin(t + position.y * 1.6) * 0.05;
          p.y += cos(t * 0.83 + position.x * 1.4) * 0.05;
          p.z += sin(t * 0.67 + aRand * 9.0) * 0.06;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = aSize * uPx * (9.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
          vColor = aColor;
          vAlpha = uAlphaBase + 0.22 * sin(uTime * (1.0 + aRand * 2.0) + aRand * 40.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.06, d) * vAlpha * uOpacity;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor, a);
        }
      `,
    });
  }

  const RED = new THREE.Color("#EB0028");
  const DEEP = new THREE.Color("#7A0014");
  const WHITE = new THREE.Color("#FFF4EE");
  const tmpC = new THREE.Color();

  function buildCloud(count, fillPoint, sizeMin, sizeMax) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const rnd = new Float32Array(count);
    const siz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      fillPoint(i, pos, i3);
      const roll = Math.random();
      if (roll > 0.9) tmpC.copy(WHITE);
      else tmpC.copy(DEEP).lerp(RED, 0.5 + Math.random() * 0.5);
      col[i3] = tmpC.r; col[i3 + 1] = tmpC.g; col[i3 + 2] = tmpC.b;
      rnd[i] = Math.random();
      siz[i] = sizeMin + Math.random() * (sizeMax - sizeMin);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aRand", new THREE.BufferAttribute(rnd, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
    return new THREE.Points(g, makeCloudMaterial());
  }

  /* X bulutu — hero'daki üretimle (şerit ±45°, merkezde yoğunlaşma).
     Kamera uzaklaştığı için nokta sayısı/boyu artırıldı: X net okunur. */
  const X_LEN = 3.4, X_TH = 0.4, X_DEPTH = 0.6;
  const xCloud = buildCloud(isMobile ? 2000 : 3200, (i, pos, i3) => {
    const u = (Math.random() - 0.5) * X_LEN;
    const squeeze = 1 - Math.pow(Math.abs(u) / (X_LEN / 2), 1.6) * 0.35;
    const v = (Math.random() - 0.5) * X_TH * squeeze;
    const w = (Math.random() - 0.5) * X_DEPTH;
    const ang = i % 2 === 0 ? Math.PI / 4 : -Math.PI / 4;
    pos[i3] = u * Math.cos(ang) - v * Math.sin(ang);
    pos[i3 + 1] = u * Math.sin(ang) + v * Math.cos(ang);
    pos[i3 + 2] = w;
  }, 1.3, 4.4);
  xCloud.material.uniforms.uAlphaBase.value = 0.95; // X belirgin okunsun
  const xGroup = new THREE.Group();
  xGroup.add(xCloud);
  scene.add(xGroup);

  /* Ambient kabuk — hero'daki gevşek toz kabuğu gibi */
  const dust = buildCloud(isMobile ? 450 : 700, (i, pos, i3) => {
    const r = 3.6 + Math.random() * 4.2;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i3 + 2] = r * Math.cos(phi);
  }, 0.4, 1.4);
  scene.add(dust);

  /* Kare sayacı (vizör HUD) gerçek sayıyla */
  const countEl = wrap.querySelector("[data-kure-count]");
  if (countEl) countEl.textContent = srcs.length + " Kare";

  /* ---------- durum ---------- */
  let inside = false;
  let animating = false;
  let rotX = 0, rotY = 0, tRotX = 0, tRotY = 0;
  let dragging = false, moved = 0, px = 0, py = 0;
  let visible = true;
  let brightness = 0.85;

  /* ---------- etkileşim ---------- */
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    moved = 0;
    px = e.clientX;
    py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - px;
    const dy = e.clientY - py;
    px = e.clientX;
    py = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    const k = inside ? 0.0035 : 0.005;
    tRotY += dx * k * (inside ? -1 : 1);
    tRotX += dy * k * (inside ? -1 : 1);
    const lim = inside ? 1.2 : 0.55;
    tRotX = Math.max(-lim, Math.min(lim, tRotX));
  });
  canvas.addEventListener("pointerup", () => {
    dragging = false;
    if (moved < 8 && !inside && !animating) enter();
  });
  canvas.addEventListener("pointercancel", () => (dragging = false));

  exitBtn?.addEventListener("click", exit);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && inside) exit();
  });

  /* ---------- içeri / dışarı ---------- */
  function tween(from, to, dur, onUpdate, onDone) {
    const t0 = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      onUpdate(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
      else onDone?.();
    })(performance.now());
  }

  function enter() {
    inside = true;
    animating = true;
    /* Kartlar içeri baksın — karşı yüzler ayna gibi ters okunmasın */
    group.children.forEach((m) => m.rotateY(Math.PI));
    wrap.classList.add("kure--acik");
    document.documentElement.classList.add("kure-kilit");
    window.siteLenis?.stop?.();
    exitBtn.hidden = false;
    if (hintEl) hintEl.textContent = "Sürükle — etrafına bakın · ESC ile çık";
    onResize();
    tween(camera.position.z, 0.12, 1150, (v) => {
      camera.position.z = v;
    }, () => (animating = false));
    tween(camera.position.y, 0, 1150, (v) => {
      camera.position.y = v; // içeride bakış merkezde
    });
    tween(camera.fov, 72, 1150, (v) => {
      camera.fov = v;
      camera.updateProjectionMatrix();
    });
    tween(brightness, 1, 1150, (v) => setBrightness(v));
    /* X'in içinden geçilir: yaklaşırken erir */
    tween(xCloud.material.uniforms.uOpacity.value, 0, 800, (v) => {
      xCloud.material.uniforms.uOpacity.value = v;
    });
  }

  function exit() {
    inside = false;
    animating = true;
    group.children.forEach((m) => m.rotateY(Math.PI)); // yüzler tekrar dışarı
    exitBtn.hidden = true;
    /* Önce banda dön (oran değişsin), uçuş bandın kadrajında bitsin */
    wrap.classList.remove("kure--acik");
    document.documentElement.classList.remove("kure-kilit");
    window.siteLenis?.start?.();
    onResize();
    tween(camera.position.z, outZ, 950, (v) => {
      camera.position.z = v;
    }, () => {
      animating = false;
      if (hintEl) hintEl.textContent = "Sürükle — döndür · Tıkla — içine gir";
      tRotX = Math.max(-0.55, Math.min(0.55, tRotX));
    });
    tween(camera.position.y, OUT_Y, 950, (v) => {
      camera.position.y = v;
    });
    tween(camera.fov, 55, 950, (v) => {
      camera.fov = v;
      camera.updateProjectionMatrix();
    });
    tween(brightness, 0.85, 950, (v) => setBrightness(v));
    tween(xCloud.material.uniforms.uOpacity.value, 1, 950, (v) => {
      xCloud.material.uniforms.uOpacity.value = v;
    });
  }

  function setBrightness(v) {
    brightness = v;
    group.children.forEach((m) => m.material.color.setScalar(v));
  }

  /* ---------- boyut + görünürlük ---------- */
  function onResize() {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitOutZ();
    if (!inside && !animating) camera.position.z = outZ;
  }
  window.addEventListener("resize", onResize);
  onResize();

  new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting);
  }).observe(wrap);

  /* ---------- döngü ---------- */
  (function frame() {
    if (visible || inside) {
      if (!inside && !dragging) tRotY += 0.0012; // kendi kendine süzülme
      rotY += (tRotY - rotY) * 0.07;
      rotX += (tRotX - rotX) * 0.07;
      group.rotation.set(rotX, rotY, 0);
      xGroup.rotation.y -= 0.004; // X ters yöne süzülür
      dust.rotation.y += 0.0005;
      const t = performance.now() / 1000;
      xCloud.material.uniforms.uTime.value = t;
      dust.material.uniforms.uTime.value = t;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  })();

  /* Küre hazır: şeridi gizle (fallback görevini tamamladı).
     Boyutlandırma görünür olduktan SONRA yapılmalı (hidden'da ölçü 0). */
  wrap.hidden = false;
  section?.classList.add("snaps--kure");
  onResize();
}
