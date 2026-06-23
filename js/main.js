/* ============================================================
   NOVA — scroll wiring, preloader, menu, marquee
   ============================================================ */
(function () {
  "use strict";
  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = matchMedia("(pointer: coarse)").matches;
  document.body.classList.add("is-loading");

  /* ---------------- Preloader ---------------- */
  const pre = document.getElementById("preloader");
  const preBar = document.getElementById("preloaderBar");
  const prePct = document.getElementById("preloaderPct");
  let pct = 0;
  const fakeLoad = setInterval(() => {
    pct += Math.random() * 14;
    if (pct >= 100) { pct = 100; clearInterval(fakeLoad); finishLoad(); }
    preBar.style.width = pct + "%";
    prePct.textContent = Math.floor(pct) + "%";
  }, 130);

  function finishLoad() {
    setTimeout(() => {
      pre.classList.add("done");
      document.body.classList.remove("is-loading");
      startReveals();
    }, 350);
  }

  /* ---------------- Lenis smooth scroll ---------------- */
  let lenis = null;
  // On touch devices, hijacking the scroll (syncTouch) fights the OS and stutters
  // hard alongside a full-screen WebGL canvas — let the phone scroll natively and
  // just read scrollY each frame. Lenis smoothing stays on desktop where it shines.
  if (window.Lenis && !prefersReduced && !isTouch) {
    // lerp-based smoothing = continuous, heavy, premium glide (like the reference)
    lenis = new Lenis({
      lerp: 0.045,         // smooth, heavy glide
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.7,
      touchMultiplier: 1.1,
    });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  /* ---------------- Drive particle progress from scroll ---------------- */
  // Cache the scrollable height — reading scrollHeight every frame forces a layout
  // reflow (the marquee loop calls pushProgress 60×/s), which is a big mobile stutter.
  let scrollMax = 0;
  function recalcMax() { scrollMax = document.documentElement.scrollHeight - window.innerHeight; }
  recalcMax();
  window.addEventListener("resize", recalcMax);
  window.addEventListener("load", recalcMax);
  function pushProgress() {
    const max = scrollMax;
    const p = max > 0 ? window.scrollY / max : 0;
    if (window.NOVA) window.NOVA.setProgress(p);
    const bar = document.getElementById("progressBar");
    if (bar) bar.style.width = (p * 100).toFixed(2) + "%";
    // horizontal marquee parallax
    if (marqueeTrack) marqueeTrack.style.transform = `translateX(${-p * 1400 - marqueeBase}px)`;
  }
  if (lenis) lenis.on("scroll", pushProgress);
  window.addEventListener("scroll", pushProgress, { passive: true });

  // ensure NOVA exists (module may load slightly later)
  if (!window.NOVA) window.addEventListener("nova:ready", pushProgress, { once: true });

  /* ---------------- Marquee auto-drift ---------------- */
  const marqueeTrack = document.getElementById("marqueeTrack");
  let marqueeBase = 0;
  if (marqueeTrack && !prefersReduced) {
    let last = performance.now();
    (function drift(now) {
      const dt = now - last; last = now;
      marqueeBase += dt * 0.04;
      const half = marqueeTrack.scrollWidth / 2;
      if (half && marqueeBase > half) marqueeBase -= half;
      pushProgress();
      requestAnimationFrame(drift);
    })(last);
  }

  /* ---------------- Smooth anchor scroll ---------------- */
  function scrollTo(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { duration: 1.4 });
    else el.scrollIntoView({ behavior: "smooth" });
  }
  document.querySelectorAll("[data-scroll-to]").forEach((a) =>
    a.addEventListener("click", (e) => { e.preventDefault(); closeMenu(); scrollTo(a.dataset.scrollTo); })
  );

  /* ---------------- Menu ---------------- */
  const burger = document.getElementById("navBurger");
  function closeMenu() { document.body.classList.remove("menu-open"); }
  burger && burger.addEventListener("click", () => document.body.classList.toggle("menu-open"));

  /* ---------------- Custom cursor ---------------- */
  const cursor = document.getElementById("cursor");
  if (cursor && matchMedia("(pointer:fine)").matches) {
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
    addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; });
    (function loop() {
      cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
      cursor.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll("a, button, .service-card").forEach((el) => {
      el.addEventListener("pointerenter", () => cursor.classList.add("cursor--hover"));
      el.addEventListener("pointerleave", () => cursor.classList.remove("cursor--hover"));
    });
  } else if (cursor) { cursor.style.display = "none"; }

  /* ---------------- Reveals (GSAP) ---------------- */
  function startReveals() {
    if (window.gsap && window.ScrollTrigger && !prefersReduced) {
      gsap.registerPlugin(ScrollTrigger);
      if (lenis) { lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
      gsap.utils.toArray("[data-reveal]").forEach((el) => {
        gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 86%", once: true } });
      });
      // word-by-word reveal for big statement text
      document.querySelectorAll("[data-split]").forEach((el) => {
        const words = el.textContent.trim().split(/\s+/);
        el.innerHTML = words.map((w) => `<span class="word"><span>${w}</span></span>`).join(" ");
        gsap.set(el, { opacity: 1 });
        gsap.from(el.querySelectorAll(".word > span"), {
          yPercent: 120, opacity: 0.15, duration: 0.9, ease: "power3.out", stagger: 0.045,
          scrollTrigger: { trigger: el, start: "top 78%", end: "bottom 60%", scrub: 1 },
        });
      });
      ScrollTrigger.refresh();
    } else {
      document.querySelectorAll("[data-reveal]").forEach((el) => { el.style.opacity = 1; el.style.transform = "none"; });
    }
    recalcMax();
    pushProgress();
  }
})();
