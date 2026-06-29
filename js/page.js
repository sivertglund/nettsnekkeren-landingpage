/* ============================================================
   Nettsnekkeren — subpage interactions (cursor, scroll, reveals)
   ============================================================ */
(function () {
  "use strict";
  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* custom cursor */
  const cursor = document.getElementById("cursor");
  if (cursor && matchMedia("(pointer:fine)").matches) {
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
    addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; });
    (function loop() {
      cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
      cursor.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll("a, button, .service-card, .pcard").forEach((el) => {
      el.addEventListener("pointerenter", () => cursor.classList.add("cursor--hover"));
      el.addEventListener("pointerleave", () => cursor.classList.remove("cursor--hover"));
    });
  } else if (cursor) { cursor.style.display = "none"; }

  /* Lenis smooth scroll — desktop only; native scroll on touch (no jank over WebGL) */
  const isTouch = matchMedia("(pointer: coarse)").matches;
  let lenis = null;
  if (window.Lenis && !prefersReduced && !isTouch) {
    lenis = new Lenis({ lerp: 0.08, smoothWheel: true, syncTouch: false, wheelMultiplier: 0.9 });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  /* in-page anchor smooth scroll */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href").slice(1);
      const el = document.getElementById(id);
      if (el) { e.preventDefault(); lenis ? lenis.scrollTo(el) : el.scrollIntoView({ behavior: "smooth" }); }
    });
  });

  /* GSAP reveals */
  if (window.gsap && window.ScrollTrigger && !prefersReduced) {
    gsap.registerPlugin(ScrollTrigger);
    if (lenis) { lenis.on("scroll", ScrollTrigger.update); gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
    gsap.utils.toArray("[data-reveal]").forEach((el) => {
      gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true } });
    });
  } else {
    document.querySelectorAll("[data-reveal]").forEach((el) => { el.style.opacity = 1; el.style.transform = "none"; });
  }
})();
