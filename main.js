/* ============================================================
   main.js — motion system + UI
   Stack: GSAP, ScrollTrigger, Lenis, Lucide
   ============================================================ */
(() => {
  "use strict";

  /* ---------- Lucide icons ---------- */
  if (window.lucide) lucide.createIcons();

  const q = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const body = document.body;

  /* ---------- URL param: ?motion=fast|slow|off ---------- */
  const urlSpeed = new URLSearchParams(location.search).get("motion");
  if (urlSpeed) body.classList.add("motion-" + urlSpeed);

  /* ---------- Read RESOLVED token values through a probe ----------
     JS always follows the CSS tokens (and --motion-speed). */
  const probe = body.appendChild(
    Object.assign(document.createElement("i"), {
      style: "position:absolute;visibility:hidden"
    })
  );
  const tok = (name) => {
    probe.style.transitionDuration = `var(${name})`;
    return parseFloat(getComputedStyle(probe).transitionDuration) || 0;
  };
  const num = (name) =>
    parseFloat(getComputedStyle(root).getPropertyValue(name));

  const reduce =
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    tok("--duration-slow") === 0;

  /* ---------- Smooth anchor scrolling (works with or without Lenis) ---------- */
  q('a[href^="#"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      const t = document.querySelector(a.getAttribute("href"));
      if (t && window.lenis) {
        e.preventDefault();
        lenis.scrollTo(t, { duration: 1 });
      }
    })
  );

  /* ---------- Reduced-motion / no-GSAP fallback ----------
     Static final states, no Lenis, no parallax, no nav-hide. */
  if (reduce || !window.gsap) {
    document.documentElement.classList.add("reduced");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* GSAP equivalents of the CSS easing tokens */
  const E = {
    expo:   "expo.out",
    quart:  "power3.out",
    inout:  "power2.inOut",
    spring: "back.out(1)"
  };

  /* Read scaled durations from CSS */
  const D = {
    slow:    tok("--duration-slow"),
    slower:  tok("--duration-slower"),
    slowest: tok("--duration-slowest")
  };
  const ST = {
    tight:  tok("--stagger-tight"),
    normal: tok("--stagger-normal"),
    loose:  tok("--stagger-loose")
  };
  const dist    = num("--scroll-reveal-distance");
  const settleS = num("--settle-scale");
  const settleR = num("--settle-rotate");

  /* ---------- Lenis synced to ScrollTrigger (single RAF loop) ---------- */
  window.lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  /* ---------- Pattern: sticker-stick-on (+ pin drop) ---------- */
  const hide = (els) =>
    els.forEach((el) => {
      el._r = gsap.getProperty(el, "rotation");
      gsap.set(el, {
        opacity: 0,
        y: 24,
        scale: settleS,
        rotation: el._r + settleR
      });
      const p = el.querySelector(".pin");
      if (p) gsap.set(p, { opacity: 0, y: -12, scale: 1.15 });
    });

  const show = (els, each = 0, delay = 0) =>
    els.forEach((el, i) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        scale: 1,
        rotation: el._r,
        duration: D.slow,
        ease: E.spring,
        delay: delay + i * each,
        clearProps: "transform,opacity"
      });
      const p = el.querySelector(".pin");
      if (p)
        gsap.to(p, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: D.slow,
          ease: E.spring,
          delay: delay + i * each + ST.loose,
          clearProps: "transform,opacity"
        });
    });

  /* ---------- Pattern 1: hero entrance ---------- */
  const board  = q("[data-board]");
  const title  = q("[data-title]");
  const heroIn = q("[data-hero-in]");
  const orn    = q("[data-orn]");

  hide(orn);

  gsap.timeline({ defaults: { ease: E.expo, clearProps: "transform,opacity" } })
    .from("#nav",    { opacity: 0, y: -20, duration: D.slower }, 0)
    .from(board,     { opacity: 0, y: dist, rotation: "-=3", duration: D.slowest }, 0)
    .from(title,     { opacity: 0, scale: settleS, duration: D.slower, ease: E.spring }, ST.loose)
    .from(heroIn,    { opacity: 0, y: 20, duration: D.slower, stagger: ST.normal }, `> -${D.slower * 0.6}`)
    .add(() => {
      show(orn, ST.loose);
      /* starburst unwinds -12° → -4° on scroll once it has settled */
      gsap.delayedCall(D.slow + ST.loose * 2 + 0.05, () => {
        const s = q(".starburst")[0];
        if (!s) return;
        gsap.fromTo(
          s,
          { rotation: -12 },
          {
            rotation: -4,
            ease: "none",
            scrollTrigger: {
              trigger: s.closest(".scene"),
              start: "top top",
              end: "bottom top",
              scrub: true
            }
          }
        );
      });
    }, "> -0.1");

  /* ---------- Pattern 2: scroll-reveal-section ---------- */
  q("[data-reveal]").forEach((el) =>
    gsap.from(el, {
      opacity: 0,
      y: dist,
      duration: D.slower,
      ease: E.expo,
      clearProps: "transform,opacity",
      scrollTrigger: { trigger: el, start: "top 82%", once: true }
    })
  );

  /* ---------- Pattern 3: stagger-grid-items ---------- */
  const items = q("[data-stagger] > *, [data-stick]");
  hide(items);

  ScrollTrigger.batch(items, {
    start: "top 90%",
    once: true,
    onEnter: (els) => {
      const each = Math.min(
        els.length > 6 ? ST.tight : ST.normal,
        0.48 / Math.max(els.length - 1, 1)
      );
      show(els, each);
    }
  });

  /* ---------- Pattern 4: backdrop parallax ---------- */
  const p = num("--scroll-parallax-factor") * 50; // ±4% travel of an oversized layer
  q("[data-bg]").forEach((bg) =>
    gsap.fromTo(
      bg,
      { yPercent: -p },
      {
        yPercent: p,
        ease: "none",
        scrollTrigger: {
          trigger: bg.parentElement,
          start: "top bottom",
          end: "bottom top",
          scrub: true
        }
      }
    )
  );

  /* ---------- Pattern 5: nav-scroll-hide ---------- */
  const nav = q("#nav")[0];
  let hidden = false;
  const setNav = (h) => {
    if (h === hidden) return;
    hidden = h;
    gsap.to(nav, {
      yPercent: h ? -110 : 0,
      duration: D.slow,
      ease: E.inout,
      overwrite: true
    });
  };
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (s) => setNav(s.direction === 1 && s.scroll() > 80)
  });
  nav.addEventListener("focusin", () => setNav(false));

  /* ---------- Refresh once fonts are ready ---------- */
  document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());

  /* ---------- Motion speed control UI ---------- */
  const speedBtns = q(".speed button");
  const applySpeed = (val) => {
    body.classList.remove("motion-fast", "motion-slow", "motion-off");
    if (val === "off") body.classList.add("motion-off");
    else if (val === "0.5") body.classList.add("motion-fast");
    else if (val === "1.5") body.classList.add("motion-slow");
    /* else 1× = no class */

    speedBtns.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.speed === val))
    );

    /* Re-read the scaled durations and rebuild scroll animations
       so newly created tweens use the new speed. */
    if (window.ScrollTrigger) {
      const newSlow = tok("--duration-slow");
      if (newSlow === 0) {
        /* Motion turned off live → hard refresh */
        ScrollTrigger.getAll().forEach((t) => t.kill());
        gsap.globalTimeline.clear();
        location.reload();
      }
    }
  };
  speedBtns.forEach((b) =>
    b.addEventListener("click", () => applySpeed(b.dataset.speed))
  );

  /* Honour URL param on the UI */
  if (urlSpeed) {
    const map = { fast: "0.5", slow: "1.5", off: "off" };
    applySpeed(map[urlSpeed] || "1");
  }
})();