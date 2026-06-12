/* ============================================================
   TEDxGültepe 2026 — interaction & motion
   GSAP 3.13 + ScrollTrigger + SplitText + Lenis
   ============================================================ */
(() => {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const loader = $(".loader");

  /* ---------- Year stamp (always) ---------- */
  const yearEl = $("[data-year]");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Hard fallback: no GSAP → static page ---------- */
  if (!window.gsap) {
    loader?.remove();
    $$("[data-count]").forEach((el) => (el.textContent = el.dataset.count));
    initCountdown(false);
    initContactForm();
    initVideoModal(null);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);

  /* ---------- Reduced motion: static, accessible page ---------- */
  if (reduced) {
    loader?.remove();
    $$("[data-count]").forEach((el) => (el.textContent = el.dataset.count));
    initCountdown(true);
    initContactForm();
    initVideoModal(null);
    initMenu(null);
    initHeader();
    return;
  }

  /* ---------- Smooth scroll (Lenis) ---------- */
  let lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- Anchor scrolling ---------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = $(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      closeMenu();
      if (lenis) lenis.scrollTo(target, { duration: 1.4 });
      else target.scrollIntoView({ behavior: "smooth" });
    });
  });

  /* ---------- Initial hidden states (loader covers the paint) ---------- */
  gsap.set(".hero .mask__inner", { yPercent: 130 });
  gsap.set(".hero__eyebrow", { autoAlpha: 0, y: 14 });
  gsap.set(".site-head", { yPercent: -120, autoAlpha: 0 });
  gsap.set(".hero__canvas, .hero__glow", { autoAlpha: 0 });
  gsap.set(".hero__bottom > *", { autoAlpha: 0, y: 16 });
  gsap.set(".hero__cards .hcard", { autoAlpha: 0, y: 32 });
  gsap.set("[data-reveal]", { autoAlpha: 0, y: 36 });

  /* ============================================================
     PRELOADER
     ============================================================ */
  const loaderDone = new Promise((resolve) => {
    const countEl = $("[data-loader-count]");
    const wordEl = $("[data-loader-word]");
    const words = ["Gültepe", "EŞİK", "BATMAN", "TEDxGültepe"];
    /* TEDx marka yazımı: TEDx kalın (resmî logo), x küçük ve üst simge */
    const fmtWord = (w) => w.replace("TEDx", '<b>TED<span class="tedx-x">x</span></b>');
    const num = { v: 0 };
    let wi = 0;

    const tl = gsap.timeline({ onComplete: resolve });
    tl.to(num, {
      v: 100,
      duration: 1.7,
      ease: "power2.inOut",
      onUpdate() {
        countEl.textContent = String(Math.round(num.v)).padStart(3, "0");
        const idx = Math.min(words.length - 1, Math.floor((num.v / 100) * words.length));
        if (idx !== wi) {
          wi = idx;
          wordEl.innerHTML = fmtWord(words[wi]);
        }
      },
    });
  });

  const fontsReady = Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((r) => setTimeout(r, 2500)),
  ]);

  Promise.all([loaderDone, fontsReady]).then(() => {
    const intro = gsap.timeline({ defaults: { ease: "power4.out" } });

    intro
      .to(loader, {
        yPercent: -100,
        duration: 0.9,
        ease: "power4.inOut",
        onComplete: () => loader.remove(),
      })
      .to(".hero__canvas, .hero__glow", { autoAlpha: 1, duration: 1.6, ease: "power2.out" }, "-=0.45")
      .to(".hero .mask__inner", { yPercent: 0, duration: 1.15, stagger: 0.09 }, "-=1.2")
      .to(".hero__eyebrow", { autoAlpha: 1, y: 0, duration: 0.7 }, "-=1.0")
      .to(".site-head", { yPercent: 0, autoAlpha: 1, duration: 0.9 }, "-=0.8")
      .to(".hero__bottom > *", { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08 }, "-=0.7")
      .to(
        ".hero__cards .hcard",
        { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.13, onComplete: startCardFloat },
        "-=0.75"
      )
      .fromTo("[data-tix-bar]", { width: "0%" }, { width: "72%", duration: 1.2, ease: "power3.inOut" }, "-=0.5");

    initScrollAnimations();
    initCountdown(true);
    initSpeakerRotator();
  });

  /* ============================================================
     SCROLL ANIMATIONS
     ============================================================ */
  function initScrollAnimations() {
    /* --- Split headings: masked line reveals --- */
    if (window.SplitText) {
      $$("[data-split]").forEach((el) => {
        const split = new SplitText(el, { type: "lines", linesClass: "st-line" });
        // Custom padded masks so Turkish diacritics (Ü, Ş, Ğ) aren't clipped
        split.lines.forEach((line) => {
          const mask = document.createElement("div");
          mask.className = "st-mask";
          line.parentNode.insertBefore(mask, line);
          mask.appendChild(line);
        });
        gsap.from(split.lines, {
          yPercent: 130,
          duration: 1.1,
          ease: "power4.out",
          stagger: 0.09,
          scrollTrigger: { trigger: el, start: "top 82%", once: true },
        });
      });

      /* --- Theme lead: word-by-word scrubbed ink-up --- */
      const lead = $("[data-words]");
      if (lead) {
        const split = new SplitText(lead, { type: "words", wordsClass: "w" });
        gsap.fromTo(
          split.words,
          { opacity: 0.13 },
          {
            opacity: 1,
            stagger: 0.04,
            ease: "none",
            scrollTrigger: { trigger: lead, start: "top 78%", end: "bottom 45%", scrub: true },
          }
        );
      }
    } else {
      gsap.utils.toArray("[data-split], [data-words]").forEach((el) => {
        gsap.from(el, {
          autoAlpha: 0,
          y: 30,
          duration: 1,
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        });
      });
    }

    /* --- Generic reveals, batched for stagger --- */
    ScrollTrigger.batch("[data-reveal]", {
      start: "top 88%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.09,
          overwrite: true,
        }),
    });

    /* --- Stat counters --- */
    $$("[data-count]").forEach((el) => {
      const target = parseInt(el.dataset.count, 10);
      const num = { v: 0 };
      gsap.to(num, {
        v: target,
        duration: 1.6,
        ease: "power2.out",
        snap: { v: 1 },
        onUpdate: () => (el.textContent = num.v),
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    });

    /* --- Hero: gentle parallax exit of the big type --- */
    gsap.to(".hero__inner", {
      yPercent: -8,
      autoAlpha: 0.25,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "bottom 90%", end: "bottom 30%", scrub: true },
    });
    gsap.to(".hero__cards", {
      yPercent: -6,
      autoAlpha: 0,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "bottom 95%", end: "bottom 50%", scrub: true },
    });

    /* --- Highlights: pinned horizontal gallery (desktop only) --- */
    const mm = gsap.matchMedia();
    mm.add("(min-width: 901px)", () => {
      const pinEl = $("[data-hl]");
      const track = $("[data-hl-track]");
      if (!pinEl || !track) return;

      const amount = () => track.scrollWidth - window.innerWidth;

      const tween = gsap.to(track, {
        x: () => -amount(),
        ease: "none",
        scrollTrigger: {
          trigger: pinEl,
          start: "center center",
          end: () => "+=" + amount(),
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        gsap.set(track, { clearProps: "x" });
      };
    });

    ScrollTrigger.refresh();
  }

  /* ============================================================
     HEADER STATE
     ============================================================ */
  function initHeader() {
    const head = $("[data-header]");
    if (!head) return;
    const onScroll = () => head.classList.toggle("is-solid", window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
  initHeader();

  /* ============================================================
     FULLSCREEN MENU
     ============================================================ */
  let menuOpen = false;
  let menuTl = null;

  function initMenu(scroller) {
    const burger = $("[data-burger]");
    const menu = $("[data-menu]");
    if (!burger || !menu) return;

    menuTl = gsap.timeline({ paused: true });
    menuTl
      .set(menu, { visibility: "visible" })
      .fromTo(
        menu,
        { clipPath: "inset(0 0 100% 0)" },
        { clipPath: "inset(0 0 0% 0)", duration: 0.7, ease: "power4.inOut" }
      )
      .from(
        ".menu__nav a",
        { yPercent: 60, autoAlpha: 0, duration: 0.6, stagger: 0.06, ease: "power3.out" },
        "-=0.25"
      )
      .from(".menu__foot", { autoAlpha: 0, y: 14, duration: 0.45 }, "-=0.3");

    burger.addEventListener("click", () => {
      menuOpen ? closeMenu() : openMenu();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menuOpen) closeMenu();
    });

    function openMenu() {
      menuOpen = true;
      burger.setAttribute("aria-expanded", "true");
      burger.setAttribute("aria-label", "Menüyü kapat");
      menu.setAttribute("aria-hidden", "false");
      document.body.classList.add("menu-open");
      scroller?.stop();
      menuTl.timeScale(1).play();
    }

    window.__closeMenu = () => {
      if (!menuOpen) return;
      menuOpen = false;
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Menüyü aç");
      menu.setAttribute("aria-hidden", "true");
      document.body.classList.remove("menu-open");
      scroller?.start();
      menuTl.timeScale(1.6).reverse();
    };
  }

  function closeMenu() {
    window.__closeMenu?.();
  }

  initMenu(lenis);

  /* ============================================================
     HERO: UÇAN KARTLAR
     ============================================================ */
  const FEATURED = [
    {
      img: "img/speakers/mehmet-hilmi-eren.png",
      name: "Mehmet Hilmi Eren",
      role: "Psikolojik Danışman & Eğitimci",
      talk: "“Bir baba, geleceği değiştirebilir.”",
    },
    {
      img: "img/speakers/aysegul-aksu.png",
      name: "Ayşegül Aksu",
      role: "Sağlık Yöneticisi & Yazar",
      talk: "“Acıdan doğan umut.”",
    },
    {
      img: "img/speakers/serhan-yilmaz.png",
      name: "Dr. Serhan Yılmaz",
      role: "İş İnsanı & Hikâye Anlatıcısı",
      talk: "“Kendime söz verdim!”",
    },
    {
      img: "img/speakers/ahmet-gorguc.png",
      name: "Ahmet Görgüç",
      role: "Gault&Millau Ödüllü Şef",
      talk: "“Köklerden gelen modern tat.”",
    },
  ];

  function initSpeakerRotator() {
    const card = $("[data-spk-card]");
    if (!card) return;
    const img = $("[data-spk-img]", card);
    const name = $("[data-spk-name]", card);
    const role = $("[data-spk-role]", card);
    const talk = $("[data-spk-talk]", card);
    const dotsWrap = $("[data-spk-dots]", card);
    const parts = [$(".hcard__person", card), talk];

    const dots = FEATURED.map((_, i) => {
      const dot = document.createElement("i");
      if (i === 0) dot.classList.add("is-on");
      dotsWrap.appendChild(dot);
      return dot;
    });

    // Geçişlerde takılma olmasın diye portreleri önceden yükle
    FEATURED.forEach((s) => {
      const pre = new Image();
      pre.src = s.img;
    });

    let idx = 0;
    let paused = false;
    card.addEventListener("mouseenter", () => (paused = true));
    card.addEventListener("mouseleave", () => (paused = false));

    setInterval(() => {
      if (paused || document.hidden) return;
      idx = (idx + 1) % FEATURED.length;
      const s = FEATURED[idx];
      gsap.to(parts, {
        autoAlpha: 0,
        y: -6,
        duration: 0.28,
        ease: "power2.in",
        onComplete() {
          img.src = s.img;
          name.textContent = s.name;
          role.textContent = s.role;
          talk.textContent = s.talk;
          dots.forEach((d, i) => d.classList.toggle("is-on", i === idx));
          gsap.fromTo(
            parts,
            { autoAlpha: 0, y: 10 },
            { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.06 }
          );
        },
      });
    }, 3500);
  }

  function startCardFloat() {
    // Dar ekranda kartlar akışta alt alta durur — süzülme animasyonu yok
    if (window.matchMedia("(max-width: 1099px)").matches) return;
    $$(".hero__cards .hcard").forEach((el, i) => {
      gsap.to(el, {
        y: i % 2 ? 10 : -12,
        rotation: i % 2 ? -1.2 : 1,
        duration: 3.2 + i * 0.7,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    });
  }

  /* ============================================================
     İLETİŞİM FORMU — mailto ile gönderir, backend yok
     ============================================================ */
  function initContactForm() {
    const form = $("[data-contact-form]");
    if (!form) return;

    const fields = {
      ad: { el: $("#cf-ad", form), check: (v) => (!v.trim() ? "Bu alan zorunlu." : "") },
      eposta: {
        el: $("#cf-eposta", form),
        check: (v) =>
          !v.trim()
            ? "Bu alan zorunlu."
            : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
            ? "Geçerli bir e-posta adresi girin."
            : "",
      },
      konu: { el: $("#cf-konu", form), check: (v) => (!v ? "Bir konu seçin." : "") },
      mesaj: {
        el: $("#cf-mesaj", form),
        check: (v) =>
          !v.trim()
            ? "Bu alan zorunlu."
            : v.trim().length < 20
            ? `En az 20 karakter yazın (şu an ${v.trim().length}).`
            : "",
      },
    };

    const setError = (key, msg) => {
      const wrap = fields[key].el.closest(".cf-field");
      let err = wrap.querySelector(".cf-err");
      if (msg) {
        wrap.classList.add("has-err");
        if (!err) {
          err = document.createElement("p");
          err.className = "cf-err";
          err.setAttribute("role", "alert");
          wrap.appendChild(err);
        }
        err.textContent = msg;
      } else {
        wrap.classList.remove("has-err");
        err?.remove();
      }
    };

    Object.keys(fields).forEach((key) => {
      fields[key].el.addEventListener("input", () => setError(key, ""));
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let valid = true;
      Object.keys(fields).forEach((key) => {
        const msg = fields[key].check(fields[key].el.value);
        setError(key, msg);
        if (msg) valid = false;
      });
      if (!valid) return;

      const ad = fields.ad.el.value.trim();
      const to = fields.konu.el.value; // option value = alıcı adres
      const konuText = fields.konu.el.options[fields.konu.el.selectedIndex].text;
      const subject = `TEDxGültepe — İletişim — ${ad}`;
      const body = [
        `Ad Soyad: ${ad}`,
        `E-posta: ${fields.eposta.el.value.trim()}`,
        `Konu: ${konuText}`,
        "",
        fields.mesaj.el.value.trim(),
      ].join("\n");

      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      const done = $("[data-cf-done]", form);
      if (done) done.hidden = false;
    });
  }
  initContactForm();
  initVideoModal(lenis);

  /* ---------- Video lightbox (Sahneden) ---------- */
  function initVideoModal(lenisRef) {
    const modal = $("[data-vmodal]");
    if (!modal) return;
    const frame = $("[data-vmodal-frame]", modal);
    const closeBtn = $("[data-vmodal-close]", modal);
    let lastFocus = null;

    const open = (id) => {
      frame.innerHTML =
        '<iframe src="https://www.youtube-nocookie.com/embed/' + id +
        '?autoplay=1&rel=0" title="TEDxGültepe konuşması" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      lastFocus = document.activeElement;
      if (lenisRef) lenisRef.stop();
      closeBtn.focus();
    };
    const close = () => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      frame.innerHTML = ""; // iframe kaldırılınca ses de durur
      if (lenisRef) lenisRef.start();
      if (lastFocus) lastFocus.focus();
    };

    $$("[data-video]").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return; // yeni sekme isteğine karışma
        e.preventDefault();
        open(card.dataset.video);
      });
    });
    closeBtn.addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) close();
    });
  }

  function initCountdown(live) {
    const d = $("[data-cd-days]");
    const h = $("[data-cd-hours]");
    const m = $("[data-cd-mins]");
    const badge = $("[data-cd-days-badge]"); // mobil hero rozeti
    if (!d || !h || !m) return;
    const target = new Date("2026-10-17T10:00:00+03:00").getTime();

    const render = () => {
      const diff = Math.max(0, target - Date.now());
      d.textContent = Math.floor(diff / 86400000);
      if (badge) badge.textContent = Math.floor(diff / 86400000);
      h.textContent = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, "0");
      m.textContent = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
    };
    render();
    if (live) setInterval(render, 30000);
  }

  /* ============================================================
     MAGNETIC BUTTONS (fine pointers only)
     ============================================================ */
  if (window.matchMedia("(pointer: fine)").matches) {
    $$("[data-magnetic]").forEach((el) => {
      const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });

      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.25);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.25);
      });
      el.addEventListener("mouseleave", () => {
        xTo(0);
        yTo(0);
      });
    });
  }
})();
