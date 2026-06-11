/* ============================================================
   TEDxGültepe — özel imleç: "canlı katı X".
   Yükleyici/favicon X'iyle aynı biçim dili: dolu, yuvarlak uçlu
   kırmızı X + altta yumuşak kor halesi. Hareket yönüne yaylı
   yatar, linkte büyüyüp parlar, tıklamada 90° fiske döner.
   Metin alanları ve Kırılma bölümünde gizlenir (Kırılma kendi
   canvas retikülünü çizer). Yalnız fare/trackpad + hareket
   azaltma kapalıyken kurulur; JS çalışmazsa html'e sınıf
   eklenmez, native ok aynen kalır.
   ============================================================ */
(() => {
  "use strict";

  const fine = window.matchMedia("(pointer: fine)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine || reduced) return;

  const SIZE = 44; // kutu; hotspot merkez

  const box = document.createElement("div");
  box.className = "imlecx";
  box.setAttribute("aria-hidden", "true");
  box.innerHTML =
    '<i class="imlecx__halo"></i>' +
    '<svg class="imlecx__x" viewBox="0 0 64 64">' +
    '<path d="M16 16 48 48M48 16 16 48"/></svg>';
  document.body.appendChild(box);
  const xEl = box.querySelector(".imlecx__x");
  const haloEl = box.querySelector(".imlecx__halo");
  document.documentElement.classList.add("imlec-js");

  /* ---------- durum ---------- */
  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const cur = { x: pos.x, y: pos.y };
  let tilt = 0;        // hız bazlı eğim (derece)
  let spin = 0;        // tıklama dönüşü — mevcut
  let spinT = 0;       // tıklama dönüşü — hedef
  let scale = 1;
  let scaleT = 1;
  let halo = 0.35;
  let haloT = 0.35;
  let shown = false;
  let hidden = true;
  let op = 0;

  const HOT =
    "a, button, [role='button'], label, select, summary, " +
    "input[type='checkbox'], input[type='radio'], input[type='submit']";
  const COLD =
    "input:not([type='checkbox']):not([type='radio']):not([type='submit']):not([type='button']), " +
    "textarea, .kirilma";

  function retarget(target) {
    if (!(target instanceof Element)) return;
    if (target.closest(COLD)) {
      hidden = true;
      return;
    }
    hidden = false;
    const hot = !!target.closest(HOT);
    scaleT = hot ? 1.4 : 1;
    haloT = hot ? 0.8 : 0.35;
  }

  window.addEventListener(
    "pointermove",
    (e) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (!shown) {
        shown = true;
        cur.x = pos.x;
        cur.y = pos.y;
      }
      retarget(e.target);
    },
    { passive: true }
  );
  window.addEventListener("pointerover", (e) => retarget(e.target), { passive: true });
  window.addEventListener("pointerdown", () => {
    spinT += 90; // X 90°'de simetrik: fiske atıp aynı görünümde durur
  });
  document.documentElement.addEventListener("pointerleave", () => {
    hidden = true;
  });
  window.addEventListener("blur", () => {
    hidden = true;
  });

  /* ---------- döngü: yalnız transform/opacity ---------- */
  function frame() {
    const dxv = pos.x - cur.x;
    cur.x += dxv * 0.5;
    cur.y += (pos.y - cur.y) * 0.5;

    /* hız → yaylı eğim; durunca sıfıra süzülür */
    const tiltTarget = Math.max(-18, Math.min(18, dxv * 0.6));
    tilt += (tiltTarget - tilt) * 0.14;
    spin += (spinT - spin) * 0.16;
    scale += (scaleT - scale) * 0.18;
    halo += (haloT - halo) * 0.12;
    op += ((shown && !hidden ? 1 : 0) - op) * 0.35;

    box.style.transform = `translate(${cur.x - SIZE / 2}px, ${cur.y - SIZE / 2}px)`;
    box.style.opacity = op.toFixed(3);
    xEl.style.transform = `rotate(${(tilt + spin).toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    haloEl.style.opacity = (halo * op).toFixed(3);
    haloEl.style.transform = `scale(${(0.9 + scale * 0.35).toFixed(3)})`;

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
