/* Nettsnekkeren — meny, inntoning, ingresser som lyser opp ord for ord og prosesslinjen */
(function () {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nav = document.querySelector(".nav");

  /* myk scrolling med musehjul og styreflate: siden glir mot målet i stedet for å hoppe.
     Lerretet kaller window.nsTick først i hver ramme, så figurene og teksten alltid er i takt. */
  if (matchMedia("(pointer: fine)").matches && !reduce) {
    let target = window.scrollY, cur = target, active = false, last = 0, loop = false;
    const maxY = () => document.documentElement.scrollHeight - window.innerHeight;
    const tick = (now) => {
      if (!active || now === last) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      cur += (target - cur) * (1 - Math.exp(-dt * 6.2));
      if (Math.abs(target - cur) < 0.35) { cur = target; active = false; }
      window.scrollTo({ top: cur, behavior: "instant" });
    };
    const run = (now) => { tick(now); if (active) requestAnimationFrame(run); else loop = false; };
    window.nsTick = tick;
    window.addEventListener("wheel", (e) => {
      if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (!active) { target = cur = window.scrollY; last = 0; }
      const d = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1);
      target = Math.max(0, Math.min(maxY(), target + d));
      active = true;
      if (!loop) { loop = true; requestAnimationFrame(run); }
    }, { passive: false });
    // tastatur, rullefelt og lenker scroller som vanlig; vi fortsetter derfra
    window.addEventListener("scroll", () => { if (!active) target = cur = window.scrollY; }, { passive: true });
  }

  /* overskrift der ordene reiser seg ved lasting */
  document.querySelectorAll("[data-words]").forEach((el) => {
    const text = el.textContent.trim();
    el.setAttribute("aria-label", text);
    el.innerHTML = text.split(/\s+/).map((w, i) => `<span class="wd" aria-hidden="true"><span style="animation-delay:${0.15 + i * 0.07}s">${w}</span></span>`).join(" ");
  });

  /* overskrifter: ordene glir opp bak en maske, ett og ett, når de kommer til syne */
  document.querySelectorAll(".h2[data-reveal]").forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", el.textContent.trim());
    el.innerHTML = words.map((w, i) => `<span class="rw" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`).join(" ");
    el.classList.add("h2--words");
  });

  /* ingresser som lyser opp ord for ord mens de scrolles inn */
  const scrubs = Array.from(document.querySelectorAll("[data-scrub]")).map((el) => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(" ");
    return { el, words: Array.from(el.querySelectorAll(".w")), lit: -1 };
  });

  /* prosesslinjen fylles steg for steg mens du scroller */
  const stepLists = Array.from(document.querySelectorAll(".steps"));
  let ticking = false;
  const heroInner = document.querySelector(".hero > .wrap");
  // menyen viser hvilken del av siden du er i
  const navLinks = Array.from(document.querySelectorAll('.nav__links a[href^="#"]')).map((a) => ({ a, sec: document.querySelector(a.getAttribute("href")) })).filter((x) => x.sec);
  let navOn = null;
  function update() {
    ticking = false;
    if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 8);
    const vh = window.innerHeight;
    let on = null;
    for (const l of navLinks) { const r = l.sec.getBoundingClientRect(); if (r.top < vh * 0.5 && r.bottom > vh * 0.5) on = l.a; }
    if (on !== navOn) {
      if (navOn) navOn.removeAttribute("aria-current");
      if (on) on.setAttribute("aria-current", "location");
      navOn = on;
    }
    if (heroInner && !reduce) {                             // heroens tekst tones ut og henger litt igjen mens du scroller forbi
      const y = window.scrollY, t = Math.min(1, Math.max(0, (y - vh * 0.06) / (vh * 0.42)));
      if (y < vh * 1.2) { heroInner.style.opacity = (1 - t * t * (3 - 2 * t)).toFixed(3); heroInner.style.transform = `translate3d(0, ${(y * 0.18).toFixed(1)}px, 0)`; }
    }
    for (const sc of scrubs) {
      const r = sc.el.getBoundingClientRect();
      // dempingen finnes bare mens ingressen er i nærheten; ellers står teksten i full kontrast
      // ordene tennes fra avsnittet kommer inn nederst til hele avsnittet står godt synlig på skjermen
      const start = vh * 1.02, end = Math.min(vh * 0.9 - r.height, vh * 0.7);
      const p = reduce || r.top > vh * 1.6 ? 1 : Math.min(1, Math.max(0, (start - r.top) / (start - end)));
      const lit = Math.round(p * sc.words.length);
      if (lit === sc.lit) continue;
      sc.lit = lit;
      sc.words.forEach((w, i) => w.classList.toggle("on", i < lit));
    }
    for (const list of stepLists) {
      const r = list.getBoundingClientRect(), items = list.children;
      const p = Math.min(1, Math.max(0, (vh * 0.8 - r.top) / (vh * 0.55)));
      for (let i = 0; i < items.length; i++) {
        const f = reduce ? 1 : Math.min(1, Math.max(0, p * items.length - i));
        items[i].style.setProperty("--f", f.toFixed(3));
        items[i].classList.toggle("on", f > 0.05);
      }
    }
  }
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener("resize", update);
  update();

  /* inntoning når innholdet kommer til syne */
  const items = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window) || reduce) { items.forEach((el) => el.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  items.forEach((el) => io.observe(el));
})();
