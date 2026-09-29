/* ============================================================================
   Nettsnekkeren — himmelen, landskapet og stjernestøvet (Canvas 2D)

   Siden er én oppstigning: morgenhimmel med fjell, skog og hytte → over skyene
   → verdensrommet. Landskapet er glatte silhuetter; figurene er bygget av små
   partikler som virvles mellom formene som stjernestøv.

   Scener: hver <section data-bg="sky|high|blue|night">. Himmelens farger glir
   over hele skjermen mellom scenene. Figuren hentes fra [data-dots] i seksjonen:
     text      data-text="ORD|LINJE"  data-text-small  data-accent="."  data-align="center"
     editor    redigeringsløsning med blinkende markør
     search    søkeresultater der bedriften ligger øverst
     network   bedriften koblet til KI-agenter
     agents    jordklode med bedriften i Norge og KI-agenter i bane rundt
     globe     jordklode med satellitt i bane
     rocket    rakett som skytes opp når du scroller forbi (data-hold="late")
     galaxy    stor spiralgalakse av stjernestøv i bakgrunnen av seksjonen (står fast, også på mobil)
   data-landscape  landskapet (skog, fjell, hytte, skyer) i første seksjon
   data-showcase   nettsidene vi har laget; de løses opp i stjernestøv
   data-fixed      figuren står fast på skjermen (desktop) mens teksten scroller

   Mykhet: fremdriften mellom scenene glattes i tid, prikker i bevegelse følger
   én felles fjær, og figurer som står i ro følger formen sin direkte.
   ============================================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("dots");
  const root = document.documentElement;
  if (!canvas || !canvas.getContext) { root.classList.add("dots-off"); return; }
  const ctx = canvas.getContext("2d");

  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SMALL = matchMedia("(max-width: 760px)").matches;
  const FINE = matchMedia("(pointer: fine)").matches;
  const NS = SMALL ? 3600 : 9000;                     // figurpartikler
  const NE = SMALL ? 1300 : 2600;                     // galakser, stjerner og rutenett
  const TAU = Math.PI * 2, DEG = 180 / Math.PI;
  // små bakgrunnsgalakser (x, y, radius, vinkel, flathet, spinn, type, antall) — ingen for øyeblikket
  const GALAXIES = [];
  const GAL = GALAXIES.reduce((n, g) => n + g[7], 0);  // de første miljøprikkene er galaksene
  const E0 = NS, COUNT = NS + NE;

  const SKY = {
    sky: { top: [183, 212, 245], bot: [246, 248, 249], dark: 0, cloud: 1 },
    high: { top: [24, 66, 176], bot: [122, 178, 238], dark: 1, cloud: 1 },   // over skyene
    blue: { top: [20, 44, 205], bot: [54, 94, 255], dark: 1, cloud: 0.3 },
    night: { top: [3, 4, 9], bot: [10, 15, 40], dark: 1, cloud: 0 },
  };
  const INK = [20, 21, 25], WHITE = [255, 255, 255], ACC_L = [31, 59, 232], ACC_D = [255, 205, 31];
  const STARCOL = [[255, 255, 255], [255, 224, 170], [178, 198, 255]];
  const DUST = [[236, 240, 255], [255, 214, 130], [176, 202, 255], [196, 160, 255], [150, 222, 255]];
  const GCOL = [[224, 232, 255], [255, 222, 172], [150, 176, 255], [196, 150, 255], [255, 172, 122]];   // galaksens farger
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = (x) => x * x * (3 - 2 * x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  const rgb = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
  const rgba = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
  const fract = (x) => x - Math.floor(x);
  const seeded = (n) => () => { n = (n * 16807) % 2147483647; return (n - 1) / 2147483646; };
  // fargene tegnes med 4 bit per kanal, så hver farge og gjennomsiktighet kan males i én bane
  const COLSTR = new Array(4096);
  const colStr = (i) => COLSTR[i] || (COLSTR[i] = `rgb(${((i >> 8) & 15) * 17},${((i >> 4) & 15) * 17},${(i & 15) * 17})`);

  /* ---------- tilstand per prikk ---------- */
  const px = new Float32Array(COUNT), py = new Float32Array(COUNT), ps = new Float32Array(COUNT), pa = new Float32Array(COUNT);
  const pr = new Float32Array(COUNT), pg = new Float32Array(COUNT), pb = new Float32Array(COUNT), seed = new Float32Array(COUNT);
  const starX = new Float32Array(COUNT), starY = new Float32Array(COUNT), starZ = new Float32Array(COUNT), starC = new Uint8Array(COUNT);
  const galG = new Uint8Array(GAL), galR = new Float32Array(GAL), galT = new Float32Array(GAL), galF = new Float32Array(GAL), galJ = new Float32Array(GAL), galK = new Uint8Array(GAL);
  {
    const rnd = seeded(3);
    for (let k = 0; k < COUNT; k++) {
      seed[k] = rnd(); starX[k] = rnd(); starY[k] = rnd(); starZ[k] = Math.pow(rnd(), 1.6);
      const c = rnd(); starC[k] = c < 0.07 ? 1 : c < 0.17 ? 2 : 0;          // hvit, varm eller blålig
    }
    let i = 0;
    GALAXIES.forEach((G, g) => {
      const type = G[6], n = G[7];
      for (let q = 0; q < n; q++, i++) {
        const u = rnd(), v = rnd(), w = rnd();
        let r, t, f = 1, core = 0;
        if (type === 0) {                                     // spiral: kjerne og to armer
          if (q < n * 0.25) { r = Math.pow(u, 1.7) * 0.24; t = v * TAU; core = 1; }
          else { r = 0.15 + Math.pow(u, 0.8) * 0.85; t = (q % 2) * Math.PI + r * 4.6 + (v - 0.5) * 0.7 * (1.2 - r); }
        } else if (type === 1) {                              // bjelkespiral: en rett bjelke med armer fra endene
          if (q < n * 0.3) { r = (u * 2 - 1) * 0.42; t = (v - 0.5) * 0.22; core = Math.abs(r) < 0.14 ? 1 : 0; }
          else { r = 0.4 + Math.pow(u, 0.9) * 0.6; t = (q % 2) * Math.PI + (r - 0.4) * 4.2 + (v - 0.5) * 0.5; }
        } else if (type === 2) {                              // elliptisk: en myk sky av gamle stjerner
          r = Math.pow(u, 1.8); t = v * TAU; core = r < 0.25 ? 1 : 0;
        } else {                                              // sett fra kanten: tynn skive med en bule i midten
          if (q < n * 0.22) { r = Math.pow(u, 1.5) * 0.25; t = v * TAU; f = 3.5; core = 1; }
          else { r = (u * 2 - 1) * (0.25 + 0.75 * w); t = (v - 0.5) * 0.35; }
        }
        galG[i] = g; galR[i] = r; galT[i] = t; galF[i] = f; galJ[i] = rnd(); galK[i] = core;
      }
    });
  }

  /* ---------- scener ---------- */
  const scenes = Array.from(document.querySelectorAll("section[data-bg]")).map((sec, index) => {
    const slot = sec.querySelector("[data-dots]");
    return {
      index, sec, slot, bg: sec.dataset.bg in SKY ? sec.dataset.bg : "sky",
      kind: sec.hasAttribute("data-showcase") ? "showcase" : slot ? slot.dataset.dots : "none",
      late: sec.dataset.hold === "late", fixed: sec.hasAttribute("data-fixed") && (!SMALL || (slot && slot.dataset.dots === "galaxy")),
      n: 0, n0: 0, ord: null, lx: null, ly: null, ls: null, la: null, lc: null,
      X: null, Y: null, S: null, A: null, C: null, R: null, G: null, B: null, D: null,
      w: 0, h: 0, ox: 0, oy: 0, fx: 0, fy: 0, vx: 0, vy: 0, top: 0, bottom: 0, aIn: 0, aOut: 0, want: "", key: "", built: false,
    };
  });
  if (!scenes.length) return;
  const nav = document.querySelector(".nav");
  const rocketIndex = scenes.findIndex((s) => s.kind === "rocket");
  const nightIndex = scenes.findIndex((s) => s.bg === "night");

  let vw = 0, vh = 0, vhC = 0, dpr = 1, gridN = 0, docH = 0, ready = false;
  let gridX = new Float32Array(0), gridY = new Float32Array(0);
  let SY = 0, T = 0, lastT = 0, mouseX = -1e4, mouseY = -1e4;

  /* ---------- Hilbert-rekkefølge: prikk j ligger på samme sted i hver figur ---------- */
  function hilbert(u, v) {
    const n = 1024;
    let x = Math.min(n - 1, Math.max(0, (u * n) | 0)), y = Math.min(n - 1, Math.max(0, (v * n) | 0)), d = 0;
    for (let s = n >> 1; s > 0; s >>= 1) {
      const rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0;
      d += s * s * ((3 * rx) ^ ry);
      if (ry === 0) { if (rx === 1) { x = n - 1 - x; y = n - 1 - y; } const t = x; x = y; y = t; }
    }
    return d;
  }

  /* ---------- tegneverktøy for figurene ---------- */
  function pen(w, h, sp) {
    const P = [], dot = sp * 0.56, push = (x, y, s, a, c) => P.push(x, y, s, a, c);
    const L = (x1, y1, x2, y2, s = 1, acc = 0, a = 1, skip = false) => {
      x1 *= w; x2 *= w; y1 *= h; y2 *= h;
      const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / sp));
      for (let i = skip ? 1 : 0; i <= n; i++) { const t = i / n; push(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, dot * s, a, acc); }
    };
    const F = (x1, y1, x2, y2, s = 1, acc = 0, a = 1) => {
      for (let y = y1 * h + sp / 2; y < y2 * h; y += sp) for (let x = x1 * w + sp / 2; x < x2 * w; x += sp) push(x, y, dot * s, a, acc);
    };
    const RR = (x1, y1, x2, y2, r = 0, s = 1, acc = 0, a = 1) => {
      const X1 = x1 * w, Y1 = y1 * h, X2 = x2 * w, Y2 = y2 * h, R = Math.min(r * w, (Y2 - Y1) / 2, (X2 - X1) / 2);
      const seg = (ax, ay, bx, by) => { const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / sp)); for (let i = 0; i < n; i++) { const t = i / n; push(ax + (bx - ax) * t, ay + (by - ay) * t, dot * s, a, acc); } };
      const arc = (cx, cy, a0) => { const n = Math.max(1, Math.round((Math.PI / 2) * R / sp)); for (let i = 0; i < n; i++) { const t = a0 + (i / n) * (Math.PI / 2); push(cx + Math.cos(t) * R, cy + Math.sin(t) * R, dot * s, a, acc); } };
      seg(X1 + R, Y1, X2 - R, Y1); arc(X2 - R, Y1 + R, -Math.PI / 2); seg(X2, Y1 + R, X2, Y2 - R); arc(X2 - R, Y2 - R, 0);
      seg(X2 - R, Y2, X1 + R, Y2); arc(X1 + R, Y2 - R, Math.PI / 2); seg(X1, Y2 - R, X1, Y1 + R); arc(X1 + R, Y1 + R, Math.PI);
    };
    const O = (cx, cy, r, s = 1, acc = 0, a = 1) => { const R = r * w, n = Math.max(5, Math.round(TAU * R / (sp * 0.9))); for (let i = 0; i < n; i++) { const t = (i / n) * TAU; push(cx * w + Math.cos(t) * R, cy * h + Math.sin(t) * R, dot * s, a, acc); } };
    const D = (cx, cy, r, s = 1, acc = 0, a = 1) => {
      const R = r * w, X = cx * w, Y = cy * h; let any = false;
      for (let y = Y - R; y <= Y + R; y += sp) for (let x = X - R; x <= X + R; x += sp) if (Math.hypot(x - X, y - Y) <= R) { push(x, y, dot * s, a, acc); any = true; }
      if (!any) push(X, Y, dot * s * 1.3, a, acc);
    };
    const IMG = (x1, y1, x2, y2, fn) => {
      const X1 = x1 * w, Y1 = y1 * h, X2 = x2 * w, Y2 = y2 * h;
      for (let y = Y1 + sp / 2; y < Y2; y += sp) for (let x = X1 + sp / 2; x < X2; x += sp) {
        const s = Math.sqrt(clamp01(fn((x - X1) / (X2 - X1), (y - Y1) / (Y2 - Y1)))) * 1.45;
        if (s > 0.28) push(x, y, dot * s, 1, 0);
      }
    };
    return { P, L, F, RR, O, D, IMG, dot, sp };
  }
  const spFor = (w, h, div) => Math.max(SMALL ? 3.6 : 4.4, Math.min(w, h * 1.33) / (div * 1.25));
  const landscapeFn = (u, v) => {
    const sun = Math.hypot((u - 0.7) * 1.5, v - 0.3);
    if (sun < 0.13) return 0.03;
    const r1 = 0.5 + 0.1 * Math.sin(u * 5.5 + 0.6) + 0.05 * Math.sin(u * 13 + 2), r2 = 0.68 + 0.07 * Math.sin(u * 4.2 + 2.2) + 0.035 * Math.sin(u * 11);
    if (v > r2) return 0.82 + 0.18 * (v - r2) / (1 - r2);
    if (v > r1) return 0.45 + 0.2 * (v - r1) / Math.max(0.01, r2 - r1);
    return (0.06 + 0.26 * (1 - v / r1)) * (sun < 0.22 ? 0.45 : 1);
  };
  const softFn = (u, v) => 0.12 + 0.22 * v + 0.08 * Math.sin(u * 7);

  function buildEditor(w, h) {
    const p = pen(w, h, spFor(w, h, 84));
    p.RR(0.02, 0.03, 0.98, 0.97, 0.022); p.L(0.02, 0.11, 0.98, 0.11, 0.8, 0, 0.8, true);
    p.D(0.05, 0.07, 0.008, 0.9); p.D(0.075, 0.07, 0.008, 0.9); p.D(0.1, 0.07, 0.008, 0.9);
    p.L(0.35, 0.11, 0.35, 0.97, 0.7, 0, 0.7, true);
    p.F(0.05, 0.155, 0.19, 0.195);
    for (let i = 0; i < 3; i++) {
      const y = 0.26 + i * 0.16, focus = i === 0, len = [0.17, 0.2, 0.12][i];
      p.L(0.05, y, 0.13, y, 0.55, 0, 0.7);
      p.RR(0.05, y + 0.025, 0.31, y + 0.095, 0.012, 0.75, focus ? 1 : 0);
      p.L(0.07, y + 0.06, 0.07 + len, y + 0.06, 0.65, 0, 0.9);
      if (focus) for (let q = -1; q <= 1; q++) p.P.push((0.07 + len + 0.018) * w, (y + 0.06) * h + q * p.sp * 0.7, p.dot * 0.8, -1, 1);
    }
    p.IMG(0.05, 0.74, 0.14, 0.82, landscapeFn);
    p.L(0.16, 0.765, 0.28, 0.765, 0.55, 0, 0.7); p.L(0.16, 0.795, 0.24, 0.795, 0.55, 0, 0.7);
    p.F(0.05, 0.87, 0.2, 0.92, 1, 1);
    p.F(0.4, 0.16, 0.47, 0.19, 0.8);
    p.L(0.72, 0.175, 0.76, 0.175, 0.6); p.L(0.79, 0.175, 0.83, 0.175, 0.6); p.RR(0.86, 0.155, 0.95, 0.195, 0.02, 0.7, 1);
    p.RR(0.385, 0.25, 0.685, 0.345, 0.006, 0.6, 1);
    p.F(0.4, 0.265, 0.67, 0.33); p.F(0.4, 0.36, 0.6, 0.41);
    p.L(0.4, 0.46, 0.62, 0.46, 0.55, 0, 0.7); p.L(0.4, 0.49, 0.6, 0.49, 0.55, 0, 0.7);
    p.F(0.4, 0.54, 0.5, 0.58, 0.9, 1);
    p.IMG(0.71, 0.25, 0.95, 0.58, landscapeFn);
    p.IMG(0.4, 0.66, 0.66, 0.9, softFn); p.IMG(0.69, 0.66, 0.95, 0.9, softFn);
    return p.P;
  }
  function buildSearch(w, h) {
    const p = pen(w, h, spFor(w, h, 84));
    p.RR(0.04, 0.05, 0.96, 0.17, 0.06);
    p.O(0.085, 0.105, 0.016, 0.8); p.L(0.097, 0.127, 0.108, 0.145, 0.8);
    p.L(0.14, 0.11, 0.5, 0.11, 0.7); p.L(0.04, 0.23, 0.96, 0.23, 0.5, 0, 0.45);
    for (let i = 0; i < 4; i++) {
      const y = 0.3 + i * 0.17, top = i === 0;
      if (top) p.D(0.065, y + 0.045, 0.02, 1, 1); else p.O(0.065, y + 0.045, 0.012, 0.6, 0, 0.6);
      p.L(0.11, y, 0.3, y, 0.5, top ? 1 : 0, 0.7);
      p.F(0.11, y + 0.025, top ? 0.66 : 0.52 - i * 0.03, y + 0.065, 1, top ? 1 : 0, top ? 1 : 0.85);
      p.L(0.11, y + 0.095, 0.9, y + 0.095, 0.55, 0, 0.65); p.L(0.11, y + 0.125, 0.72, y + 0.125, 0.55, 0, 0.65);
    }
    return p.P;
  }

  // Nettverk: bedriften i midten, KI-agenter rundt. Figuren roterer rolig og puster,
  // og datapakkene glir langs linjene inn mot bedriften.
  function buildNetwork(s) {
    const w = s.w, h = s.h, m = Math.min(w, h), cx = w / 2, cy = h / 2;
    const sp = Math.max(SMALL ? 4 : 4.8, m / 80), dot = sp * 0.6, P = [], rnd = seeded(11);
    const r0 = m * 0.08;
    for (let y = cy - r0; y <= cy + r0; y += sp) for (let x = cx - r0; x <= cx + r0; x += sp) if (Math.hypot(x - cx, y - cy) <= r0) P.push(x, y, dot * 1.05, 1, 1);
    const ring = (rad, sz, a, acc) => { const n = Math.round(TAU * rad / (sp * 1.4)); for (let i = 0; i < n; i++) { const t = (i / n) * TAU; P.push(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad, sz, a, acc); } };
    ring(r0 * 1.8, dot * 0.72, 1, 1); ring(r0 * 2.6, dot * 0.52, 0.6, 1);
    const n1 = [], n2 = [];
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i / 6) * TAU + 0.25; n1.push([cx + Math.cos(a) * m * 0.26, cy + Math.sin(a) * m * 0.26]); }
    for (let i = 0; i < 11; i++) { const a = (i / 11) * TAU + (rnd() - 0.5) * 0.3, r = m * (0.41 + rnd() * 0.05); n2.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    const edges = [], toward = (a, b, stop) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]); return [b[0] + (a[0] - b[0]) * stop / d, b[1] + (a[1] - b[1]) * stop / d]; };
    n1.forEach((p, i) => { edges.push([p, toward(p, [cx, cy], r0 * 1.9)]); edges.push([p, n1[(i + 1) % 6]]); });
    n2.forEach((p) => { let best = n1[0], bd = 1e9; for (const q of n1) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = q; } } edges.push([p, best]); });
    for (const [a, b] of edges) {
      const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / (sp * 1.35)));
      for (let i = 1; i < n; i++) { const t = i / n; P.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, dot * 0.72, 0.9, 0); }
    }
    const nodes = n1.concat(n2);
    for (const nd of nodes) P.push(nd[0], nd[1], dot * 2.1, 1, 0);
    s.net = { edges, nodes: nodes.length, ph: edges.map(() => rnd()), sp: edges.map(() => 0.13 + rnd() * 0.1), dot, cx, cy };
    return P;
  }

  function buildGlobe(s) {
    const N = SMALL ? 700 : 1300, golden = Math.PI * (3 - Math.sqrt(5)), pts = [];
    for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i; pts.push(Math.cos(th) * r, y, Math.sin(th) * r, i % 23 === 0 ? 1 : 0); }
    const ring = SMALL ? 70 : 120;
    s.globe = { N, ring, R: Math.min(s.w, s.h) * 0.36, pts: new Float32Array(pts), dot: Math.max(SMALL ? 2.2 : 2.6, Math.min(s.w, s.h) / 150) };
    return N + ring + 1;
  }

  /* ---------- jordkloden med KI-agentene ----------
     Kontinentene er prikker (landmaske 256×128 fra Natural Earth), havet er svakere prikker.
     Bedriften ligger i Norge; KI-agenter går i bane rundt kloden, og datapakker følger buer
     fra agentene inn til bedriften. Kloden svinger rolig fram og tilbake så Norge holder seg synlig. */
  const LAND = (() => {
    const b = atob("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/wAB/+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD////////zgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//////////AAAP4AH4AAAA/AAAAAAAAAAAAAAAAADP//////////AAAf/wAEAAAAB/wAAAAAAAAAAAAAAAHef/////////4AAAf8AAAAAAAAPwAAAAAAAAAAAAAAD/ef//h//////gAAAYAAAAH4AAO/+AAHgAAAAAAAAAAE/5//8AA////+AAAAAAAAH8AAf//8AAf/AAAAAAAAAB/53//4AA////4AAAAAAAA8AAf///+eAeAAAAAAAAAAP//f//8AD///+AAAAAAAAPAPf/////8j/gAADAD/wADP/+fP//AP///4AAAAB+AA+B///////////AAYAf////////v/+Af///gAAAB//AAD//////////////wH/////////+f8A///gAAAA///v////////////////8H/////////5/+H//AawAAH///////////////////////////////P/gP/4D/gAA////////////////////H////////////+A/8AH8AAP///////////////////8DP////////x//wA/AAAAAH/v//////////////////wB////////4Af4AD8AAAAAf+f/////////////////4AP/+//////gAfmAAwAAAAB/9///////////////+fkAAD/AD/////gD/8AAAAAAeDfj//////////////BnwAAADsAB/////wH/4AAAAAB4H8//////////////gA/gAAB8AAD/////8//4AAAAAPgf7/////////////8AD8AAAOAAAf/////3//4AAAAB/D///////////////9APgAAAAAABv/////v//gAAAAH/f///////////////8A8AAAAAAAA////////+AAAAAz/////////////////4BgAAAAAAAD////////cAAAAAf////////////////9gAAAAAAAAAD////////4AAAAA/////////////////+AAAAAAAAAAH////////gAAAAB//////j/////////+4AAAAAAAAAAf///////AAAAAAB/////4P/////////7gAAAAAAAAAB///////wAAAAACH///n/h/////////+PAAAAAAAAAAH//////EAAAAAAf/vf8A+D/////////x8AAAAAAAAAAf/////+AAAAAAB/5v///8H////////4HAAAAAAAAAAB//////AAAAAAAH+GP///4f////////AYAAAAAAAAAAD/////4AAAAAAAf4b7///B///////68BgAAAAAAAAAAP/////gAAAAAAB/f/Hf/8H////////4eAAAAAAAAAAAf////+AAAAAAAB//AeX//////////Hv4AAAAAAAAAAA/////wAAAAAAAH/8AY//////////8d/AAAAAAAAAAAB////8AAAAAAAB//8OA//////////4PgAAAAAAAAAAAD////gAAAAAAAH//8////////////gwAAAAAAAAAAAAH///+AAAAAAAAf//////////////+AAAAAAAAAAAAAAP/+YYAAAAAAAH//////+////////4AAAAAAAAAAAAAA//gB4AAAAAAA////////////////AAAAAAAAAAAAAAB/+AHwAAAAAAH///////7///////8AAAAAAAAAAAAAAD/4AKAAAAAAAf///////+d//////4AAAAAAAAAAAAAAH/gD4AAAAAAD//////f/+D/////9gAAAAAAAAOAAAAAD+D/wAAAAAAf////////4H/////EAAAAAAAAAMAAAAAP8eD8AAAAAB//////7//AP/x/9gAAAAAAAAAAQAAAAAf/wN/AAAAAD//////n/8Af+D/2BgAAAAAAAAAAAAAAAf/A38AAAAAP//////f/gB/wH/QHAAAAAAAAAAAAAAAAf/gAAAAAAA//////8/4AD+A/+AYAAAAAAAAAAAAAAAAD+AAAAAAAH///////+AAPgAf8BwAAAAAAAAAAAAAAAAH4AAAAAAAP///////gAAfAB/wHgAAAAAAAAAAAAAAAADgfAAAAAA///////zgAB4AH/AvAAAAAAAAAAAAAAAAAOD/4AAAAB///////+AADgAJ8D8AAAAAAAAAAAAAAAAAf//wAAAAD///////wAAPABzAZwAAAAAAAAAAAAAAAAAf//gAAAAP///////AAAeAHABPAAAAAAAAAAAAAAAAAAP//wAAAAf//////8AAA4AOAOsAAAAAAAAAAAAAAAAAA///wAAAA/x/////gAAAAHcB4QAAAAAAAAAAAAAAAAAD///AAAAAAA////8AAAAAPwfAAAAAAAAAAAAAAAAAAAf//+AAAAAAD////gAAAAAfn8PAAAAAAAAAAAAAAAAAB///4AAAAAAP///8AAAAAA+f/sAAAAAAAAAAAAAAAAAP///4AAAAAA////AAAAAAB5/8/AAAAAAAAAAAAAAAAA////8AAAAAD///8AAAAAAHz7xf4EAAAAAAAAAAAAAAD////+AAAAAH///gAAAAAAPPvf/4YAAAAAAAAAAAAAAP////+AAAAAP//+AAAAAAA8A8B/34AAAAAAAAAAAAAA/////8AAAAA///4AAAAAAA/hQE/8wAAAAAAAAAAAAAB/////wAAAAB///gAAAAAAB/9YH/B4AAAAAAAAAAAAAD/////AAAAAH//+AAAAAAAAF/gDOBgAAAAAAAAAAAAAP////wAAAAAf//4AAAAAAAABYIEcDAAAAAAAAAAAAAAf////AAAAAB///gwAAAAAAAAD8wAAAAAAAAAAAAAAAB////4AAAAAP//+DAAAAAAAAAvzgAAAAAAAAAAAAAAAH////gAAAAA///4cAAAAAAAAP+PAAIAgAAAAAAAAAAAH///+AAAAAD///nwAAAAAAAB/+8AAwEAAAAAAAAAAAAH///4AAAAAP//8fAAAAAAAAP//wAAAwAAAAAAAAAAAAf///AAAAAA///B4AAAAAAAB///gAACAAAAAAAAAAAAA///8AAAAAB//4HgAAAAAAA////ADAAAAAAAAAAAAAAD///gAAAAAH//w+AAAAAAAP////AGAAAAAAAAAAAAAAf//+AAAAAAP//DwAAAAAAA////8AAAAAAAAAAAAAAAB//+AAAAAAA//8HAAAAAAAD////4AAAAAAAAAAAAAAAH//wAAAAAAD//AYAAAAAAAP////gAAAAAAAAAAAAAAAf//AAAAAAAP/8AAAAAAAAAf////AAAAAAAAAAAAAAAB//8AAAAAAAf/wAAAAAAAAB////8AAAAAAAAAAAAAAAH//AAAAAAAA/8AAAAAAAAAH////gAAAAAAAAAAAAAAAf/8AAAAAAAD/wAAAAAAAAAP///+AAAAAAAAAAAAAAAB//gAAAAAAAP+AAAAAAAAAB/gf/4AAAAAAAAAAAAAAAP/+AAAAAAAA/gAAAAAAAAAH8A//AAMAAAAAAAAAAAAA//AAAAAAAAAAAAAAAAAAAAAAB/8AAYAAAAAAAAAAAAH/8AAAAAAAAAAAAAAAAAAAAAAB/gAB4AAAAAAAAAAAAf/gAAAAAAAAAAAAAAAAAAAAAAD4AAHgAAAAAAAAAAAB/wAAAAAAAAAAAAAAAAAAAAAAACAAA8AAAAAAAAAAAAH/AAAAAAAAAAAAAAAAAAAAAAAAPAADwAAAAAAAAAAAAf4AAAAAAAAAAAAAAAAAAAAAAAAcAA8AAAAAAAAAAAAB/AAAAAAAAAAAAAAAAAAAAAAAAAgAHwAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAABgAAAAAAAAAAAAD/AAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAPwAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAA/DgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD8MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAB4AAAABgwACAAAAAAAAAAAAAAAAAAfAAAAAAAAAAAAA/5AA///////8AAAAAAAAAAAAAAAADwAAAAAAAAAABh///gf////////4AAAAAAAAAAAAAAA/wAAAAAAAG/w/////P/////////+AAAAAAAAAAAQAAP/gAAAAA/////////////////////8AAAAAAAAAD8OA/+AAAAAf/////////////////////wAAAAAP//4P////4AAAAD/////////////////////+AAAAB/////////+AAAAD//////////////////////AAAAef/////////AAAAP//////////////////////4AAAf//////////AAD4P///////////////////////4AAA5/////////wAwfw////////////////////////gAAAP///////////H+f///////////////////////gAAAAP/////////////////////////////////////wAr4A//////////////////////////////////////+T//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////w=="), a = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return a;
  })();
  const isLand = (lat, lon) => {
    const x = Math.min(255, Math.max(0, Math.floor(((lon + 180) / 360) * 256))), y = Math.min(127, Math.max(0, Math.floor(((90 - lat) / 180) * 128)));
    return (LAND[y * 32 + (x >> 3)] >> (7 - (x & 7))) & 1;
  };
  const HUB = [61, 9];                                         // Norge
  const CITIES = [[51.5, -0.1], [50.1, 8.7], [48.9, 2.4], [40.4, -3.7], [59.3, 18.1], [41.9, 12.5], [52.2, 21], [30, 31.2], [25.2, 55.3], [19, 72.8], [-26.2, 28], [6.5, 3.4], [40.7, -74], [-1.3, 36.8], [1.35, 103.8], [55.8, 37.6], [39.9, 32.9], [-33.9, 18.4]];
  const RINGS = [[1.34, 64, 20, 0.03], [1.58, -50, -35, -0.022]];   // radius, helning, retning (grader), dreiing per sekund
  const AGENTS = [[0, 0.2, 0.15], [0, 2.3, 0.15], [0, 4.4, 0.15], [1, 0.9, -0.1], [1, 2.5, -0.1], [1, 4.1, -0.1], [1, 5.6, -0.1]];
  function buildAgents(s, earth) {
    const m = Math.min(s.w, s.h), N = SMALL ? 4200 : 10400, golden = Math.PI * (3 - Math.sqrt(5)), sp = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - ((i + 0.5) / N) * 2, r = Math.sqrt(1 - y * y), th = golden * i, x = Math.cos(th) * r, z = Math.sin(th) * r;
      if (isLand(Math.asin(y) * DEG, Math.atan2(z, x) * DEG)) sp.push(x, y, z, 1);
      else if (i % 4 === 0) sp.push(x, y, z, 0);
    }
    const hl = HUB[0] / DEG, hn = HUB[1] / DEG, H = [Math.cos(hl) * Math.cos(hn), Math.sin(hl), Math.cos(hl) * Math.sin(hn)];
    const e1 = [-Math.sin(hn), 0, Math.cos(hn)], e2 = [H[1] * e1[2] - H[2] * e1[1], H[2] * e1[0] - H[0] * e1[2], H[0] * e1[1] - H[1] * e1[0]];
    s.ag = {
      earth, R: m * 0.33, dot: SMALL ? 2 : 2.3, sp: new Float32Array(sp), ns: sp.length / 4, H, e1, e2,
      cities: CITIES.map(([la, lo]) => { const a = la / DEG, o = lo / DEG; return [Math.cos(a) * Math.cos(o), Math.sin(a), Math.cos(a) * Math.sin(o)]; }),
      rn: SMALL ? 110 : 190, an: SMALL ? 28 : 46, halo: 8, hubRing: 14, ping: SMALL ? 16 : 24, rim: SMALL ? 120 : 200,
    };
    const G = s.ag, na = earth ? CITIES.length : AGENTS.length;
    if (earth) G.rn = 0;
    return G.ns + RINGS.length * G.rn + na * (1 + G.halo + G.an + 2) + 1 + G.hubRing + G.ping + G.rim;
  }
  const V3 = new Float32Array(3), W3 = new Float32Array(3);
  function updateAgents(s) {
    const G = s.ag, R = G.R, cx = s.vx + s.w / 2, cy = s.vy + s.h / 2, t = REDUCE ? 0 : T, dot = G.dot;
    const a = (12 + 40 * Math.sin(t * 0.09) + ((SY + vh * 0.5 - s.aIn) / vh) * 10) / DEG, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(28 / DEG), sb = Math.sin(28 / DEG);   // dreier med scrollingen rundt seksjonen
    const view = (X, Y, Z) => {                                // verden → skjerm (x, y i R-enheter, z mot oss)
      const x1 = Z * ca - X * sa, z1 = X * ca + Z * sa;
      V3[0] = x1; V3[1] = Y * cb - z1 * sb; V3[2] = Y * sb + z1 * cb;
    };
    const hidden = () => V3[2] < 0 && V3[0] * V3[0] + V3[1] * V3[1] < 1;   // bak kloden
    const put = (i, x, y, S, A, C) => { s.X[i] = cx + x * R; s.Y[i] = cy - y * R; s.Z[i] = V3[2] * R; s.S[i] = S; s.A[i] = A; s.C[i] = C; s.D[i] = 1; };
    let i = 0;
    const P = G.sp;
    for (let n = 0; n < G.ns; n++, i++) {                      // land og hav
      view(P[n * 4], P[n * 4 + 1], P[n * 4 + 2]);
      const z = V3[2], f = (z + 1) / 2;
      if (P[n * 4 + 3]) put(i, V3[0], V3[1], z > 0 ? dot * (0.45 + 0.55 * f) : dot * 0.38, z > 0 ? 0.28 + 0.72 * f * f : 0.06, 0);
      else put(i, V3[0], V3[1], dot * 0.42, z > 0 ? 0.06 + 0.16 * f : 0, 0);
    }
    const ring = (k, ph) => {                                  // punkt på bane k i verdensrommet
      const [rr, inc, node, prec] = RINGS[k], ci = Math.cos(inc / DEG), si = Math.sin(inc / DEG), no = node / DEG + t * prec, cn = Math.cos(no), sn = Math.sin(no);
      const x = rr * Math.cos(ph), y = -rr * Math.sin(ph) * si, z = rr * Math.sin(ph) * ci;
      W3[0] = x * cn + z * sn; W3[1] = y; W3[2] = -x * sn + z * cn;
    };
    for (let k = 0; k < RINGS.length; k++) for (let q = 0; q < G.rn; q++, i++) {
      ring(k, (q / G.rn) * TAU); view(W3[0], W3[1], W3[2]);
      put(i, V3[0], V3[1], dot * 0.62, hidden() ? 0.04 : 0.3 + 0.34 * (V3[2] + 1.6) / 3.2, 0);
    }
    const H = G.H, e1 = G.e1, e2 = G.e2;
    view(H[0], H[1], H[2]);
    const hx = V3[0], hy = V3[1], hz = V3[2], hubVis = hz > 0 ? 1 : 0.25;
    const nodes = G.earth ? CITIES.length : AGENTS.length;
    for (let j = 0; j < nodes; j++) {
      let ph0 = 0;
      if (G.earth) { const c = G.cities[j]; W3[0] = c[0]; W3[1] = c[1]; W3[2] = c[2]; ph0 = j * 1.37; }   // en by på kloden
      else { const [k, p0, spd] = AGENTS[j]; ph0 = p0; ring(k, p0 + t * spd); }                        // en agent i bane
      const ax = W3[0], ay = W3[1], az = W3[2];
      view(ax, ay, az);
      const nx = V3[0], ny = V3[1], nz = V3[2], occ = G.earth ? nz < 0 : hidden(), nf = occ ? (G.earth ? 0 : 0.12) : 0.6 + 0.4 * (nz + 1.6) / 3.2;
      put(i++, nx, ny, dot * (G.earth ? 1.5 + 0.5 * Math.sin(t * 2 + j) : 2.7), nf, G.earth ? 1 : 0);   // agenten, eller byen
      for (let q = 0; q < G.halo; q++) {                        // en liten krans rundt agenten
        const an = (q / G.halo) * TAU + t * 0.7, rr = (dot * 4.6) / R;
        put(i++, nx + Math.cos(an) * rr, ny + Math.sin(an) * rr, dot * 0.55, nf * 0.7, 0);
      }
      // bue fra agenten inn til bedriften, løftet ut fra kloden
      const mx = (ax + H[0]) / 2, my = (ay + H[1]) / 2, mz = (az + H[2]) / 2, ml = Math.hypot(mx, my, mz) || 1;
      const lift = Math.max(1.28, (Math.hypot(ax, ay, az) + 1) * 0.58), qx = (mx / ml) * lift, qy = (my / ml) * lift, qz = (mz / ml) * lift;
      const bez = (u) => {
        const a0 = (1 - u) * (1 - u), a1 = 2 * (1 - u) * u, a2 = u * u;
        view(a0 * ax + a1 * qx + a2 * H[0], a0 * ay + a1 * qy + a2 * H[1], a0 * az + a1 * qz + a2 * H[2]);
      };
      for (let q = 0; q < G.an; q++) {
        bez((q + 0.5) / G.an);
        put(i++, V3[0], V3[1], dot * 0.7, hidden() ? 0.05 : 0.62, 0);
      }
      for (let q = 0; q < 2; q++) {                             // datapakker på vei inn, tones inn og ut i endene
        const u0 = REDUCE ? 0.5 : fract(ph0 * 0.37 + q * 0.5 + t * 0.2), u = G.earth ? 1 - u0 : u0;   // byene: pakkene går ut fra Norge
        bez(u);
        put(i++, V3[0], V3[1], dot * 1.7, (hidden() ? 0.1 : 1) * smooth(clamp01(u / 0.12)) * smooth(clamp01((0.95 - u) / 0.12)), 1);
      }
    }
    put(i++, hx, hy, dot * 2, hubVis, 1);                      // bedriften
    const onSurface = (rho, phi) => {
      const c = Math.cos(rho), sn = Math.sin(rho), u = Math.cos(phi) * sn, v = Math.sin(phi) * sn;
      view(H[0] * c + e1[0] * u + e2[0] * v, H[1] * c + e1[1] * u + e2[1] * v, H[2] * c + e1[2] * u + e2[2] * v);
    };
    for (let q = 0; q < G.hubRing; q++) { onSurface(3.4 / DEG, (q / G.hubRing) * TAU); put(i++, V3[0], V3[1], dot * 0.8, hubVis * 0.95, 1); }
    const pf = REDUCE ? 0.5 : fract(t * 0.45);                  // en ring som brer seg ut fra bedriften
    for (let q = 0; q < G.ping; q++) { onSurface((4 + 14 * pf) / DEG, (q / G.ping) * TAU); put(i++, V3[0], V3[1], dot * 0.65, hubVis * 0.85 * (1 - pf), 1); }
    for (let q = 0; q < G.rim; q++) {                          // atmosfæren: en svak kant rundt kloden
      const an = (q / G.rim) * TAU;
      put(i++, Math.cos(an) * 1.035, Math.sin(an) * 1.035, dot * 0.4, 0.2 + (REDUCE ? 0 : 0.06 * Math.sin(an * 3 + t)), 0);
    }
  }

  /* ---------- galaksen bak «Rask, synlig og lett å oppdatere.» ----------
     Tre armer av stjernestøv rundt en lysring med et mørkt hull i midten, som på originalsiden.
     Skiva står på skrå, snurrer rolig og dreier videre når du scroller. */
  function buildGalaxy(s) {
    const n = SMALL ? 3300 : 8400, ring = SMALL ? 120 : 220, rnd = seeded(41), P = new Float32Array((n + ring) * 7);
    for (let i = 0; i < n + ring; i++) {
      let x, y, z, c, sz, al;
      if (i >= n) {                                             // lysringen rundt hullet
        const a = ((i - n) / ring) * TAU, r = 0.064 + (rnd() - 0.5) * 0.006;
        x = Math.cos(a) * r; y = Math.sin(a) * r; z = 0; c = 1; sz = 1.1 + rnd() * 0.7; al = 0.72;
      } else {
        const core = i < n * 0.15;
        const t = core ? 0.078 + Math.pow(rnd(), 1.4) * 0.16 : 0.08 + Math.pow(rnd(), 0.72) * 0.92;
        const arm = (Math.floor(rnd() * 3) / 3) * TAU;
        const ang = core ? rnd() * TAU : arm + t * 4.3 + (rnd() - 0.5) * 0.4 * (1.1 - t * 0.6);
        const th = (1 - t) * 0.05 + 0.006;
        x = Math.cos(ang) * t + (rnd() - 0.5) * 2 * th; y = Math.sin(ang) * t + (rnd() - 0.5) * 2 * th; z = (rnd() - 0.5) * 2.6 * th;
        const q = rnd();
        c = core ? (q < 0.6 ? 1 : 0) : q < 0.6 ? 0 : q < 0.78 ? 2 : q < 0.88 ? 3 : q < 0.95 ? 1 : 4;
        sz = (core ? 1 : 0.75) + rnd() * (core ? 1.1 : 1); al = core ? 0.82 : 0.36 + 0.5 * (1 - t) + rnd() * 0.14;
      }
      P[i * 7] = x; P[i * 7 + 1] = y; P[i * 7 + 2] = z; P[i * 7 + 3] = c; P[i * 7 + 4] = sz; P[i * 7 + 5] = al; P[i * 7 + 6] = rnd();
    }
    s.gx = { n: n + ring, P };
    return n + ring;
  }
  function updateGalaxy(s) {
    const G = s.gx, P = G.P, cx = s.vx + s.w * (SMALL ? 0.5 : 0.62), cy = s.vy + s.h * (SMALL ? 0.52 : 0.7);   // kjernen i det tomme feltet under teksten
    const R = SMALL ? s.w * 0.66 : Math.min(s.w * 0.4, s.h * 1);
    const spin = (REDUCE ? 0 : T * 0.05) + (SY / vh) * 0.3, cs = Math.cos(spin), sn = Math.sin(spin);
    const tilt = SMALL ? 1 : 1.1, ct = Math.cos(tilt), st = Math.sin(tilt), roll = -0.3, cr = Math.cos(roll), sr = Math.sin(roll);
    s.cx = cx; s.cy = cy; s.gR = R; s.gT = ct;
    for (let i = 0; i < G.n; i++) {
      const o = i * 7, x0 = P[o], y0 = P[o + 1], z0 = P[o + 2];
      const x1 = x0 * cs - y0 * sn, y1 = x0 * sn + y0 * cs;            // snurr i skiveplanet
      const y2 = y1 * ct - z0 * st, z2 = y1 * st + z0 * ct;            // skiva vippet bakover
      s.X[i] = cx + (x1 * cr - y2 * sr) * R; s.Y[i] = cy + (x1 * sr + y2 * cr) * R; s.Z[i] = z2 * R;   // og litt på skrå
      s.S[i] = P[o + 4] * (1 + z2 * 0.7);
      s.A[i] = P[o + 5] * (SMALL ? 0.72 : 1) * (REDUCE ? 1 : 0.78 + 0.22 * Math.sin(T * 1.3 + P[o + 6] * 60));   // dempet på mobil, der teksten dekker skjermen
      const col = GCOL[P[o + 3]]; s.R[i] = col[0]; s.G[i] = col[1]; s.B[i] = col[2]; s.C[i] = 255; s.D[i] = 1;
    }
  }

  /* ---------- raketten: en punktsky i 3D, i samme stjernestøv som kloden og galaksen ----------
     Skroget er en omdreiningsflate (dyse, sylinder og spiss nese) med et bånd og et koøye,
     fire finner rundt foten, og eksos av glødende støv. Hvert punkt har en normal, så raketten
     får lys og skygge når den roterer rolig rundt sin egen akse. */
  function buildRocket(s) {
    const H = Math.min(s.h * 0.84, s.w * 1.02), rb = H * 0.128, rnd = seeded(5);
    const prof = (t) => t < 0.05 ? rb * (0.74 - (t / 0.05) * 0.18) : t < 0.08 ? rb * 0.68 : t < 0.58 ? rb : rb * Math.pow(Math.max(0, 1 - ((t - 0.58) / 0.42) ** 2), 0.58);
    const nb = SMALL ? 1900 : 4200, nfin = SMALL ? 140 : 300, nflame = SMALL ? 220 : 420, P = [];
    const wins = [[0.69 * H, Math.PI / 2], [0.69 * H, -Math.PI / 2]];   // to koøyer, ett på hver side
    while (P.length < nb * 9) {                                // skroget, jevnt fordelt etter areal
      const t = rnd(), r = prof(t);
      if (rnd() * rb > r + rb * 0.06) continue;
      const ph = rnd() * TAU, y = t * H, dr = (prof(Math.min(1, t + 0.01)) - prof(Math.max(0, t - 0.01))) / (0.02 * H);
      const nl = Math.hypot(1, dr);
      let wd = 1e9;
      for (const [wy, wp] of wins) { const wx = (((ph - wp + Math.PI) % TAU) + TAU) % TAU - Math.PI; wd = Math.min(wd, Math.hypot(wx * rb, y - wy)); }
      if (wd < H * 0.034) continue;                            // koøyene er mørke i midten
      const acc = wd < H * 0.05 || (t > 0.44 && t < 0.468) ? 1 : 0;   // ring rundt koøyene og et bånd rundt skroget
      const q = rnd(), col = acc ? 1 : q < 0.74 ? 0 : q < 0.88 ? 2 : q < 0.95 ? 3 : 1;
      P.push(Math.cos(ph) * r, y, Math.sin(ph) * r, Math.cos(ph) / nl, -dr / nl, Math.sin(ph) / nl, acc, col, t < 0.08 ? 0.55 : 1);
    }
    for (let f = 0; f < 4; f++) {                              // fire finner
      const phf = f * (Math.PI / 2) + Math.PI / 4, c = Math.cos(phf), sn = Math.sin(phf);
      for (let q = 0; q < nfin; ) {
        const t = rnd() * 0.34, out = rb + H * 0.17 * smooth(clamp01((0.34 - t) / 0.24)), rr = rb + rnd() * (out - rb);
        if (rr > out) continue;
        P.push(c * rr, t * H, sn * rr, -sn, 0, c, 2, 1, 1); q++;
      }
    }
    const n = P.length / 9, R = new Float32Array(nflame * 3);
    for (let i = 0; i < nflame * 3; i++) R[i] = rnd();
    s.rk = { H, rb, n, P: new Float32Array(P), nflame, R, dot: SMALL ? 1.9 : 2.2 };
    return n + nflame;
  }
  function updateRocket(s, lp) {
    const K = s.rk, P = K.P, H = K.H, dot = K.dot, t = REDUCE ? 0 : T;
    const spin = t * 0.32 + ((SY + vh * 0.5 - s.aIn) / vh) * 0.8, cs = Math.cos(spin), sn = Math.sin(spin);
    const tilt = 0.16, ct = Math.cos(tilt), st = Math.sin(tilt), lean = 0.07, cl = Math.cos(lean), sl = Math.sin(lean);
    const lift = lp * lp * vh * 0.28, bob = REDUCE ? 0 : Math.sin(T * 1.2) * 3 * (1 - lp);
    const cx = s.vx + s.w / 2, base = s.vy + s.h * 0.93 - lift + bob;
    s.cx = cx; s.cy = base - H * 0.5;
    const L0 = -0.45, L1 = 0.35, L2 = 0.82;                    // lys forfra, litt fra venstre og ovenfra
    let i = 0;
    for (let j = 0; j < K.n; j++, i++) {
      const o = j * 9, x0 = P[o], y0 = P[o + 1] - H * 0.5, z0 = P[o + 2];
      const x1 = x0 * cs + z0 * sn, z1 = -x0 * sn + z0 * cs;          // snurr rundt lengdeaksen
      const y2 = y0 * ct - z1 * st, z2 = y0 * st + z1 * ct;            // vippet litt mot oss
      const X = x1 * cl - y2 * sl, Y = x1 * sl + y2 * cl;              // og lent litt på skrå
      const nx0 = P[o + 3], ny0 = P[o + 4], nz0 = P[o + 5];
      const nx1 = nx0 * cs + nz0 * sn, nz1 = -nx0 * sn + nz0 * cs, ny2 = ny0 * ct - nz1 * st, nz2 = ny0 * st + nz1 * ct;
      const kind = P[o + 6], lit = kind === 2 ? Math.abs(nx1 * L0 + ny2 * L1 + nz2 * L2) : Math.max(0, nx1 * L0 + ny2 * L1 + nz2 * L2);
      const facing = kind === 2 || nz2 > -0.05, b = 0.18 + 0.82 * Math.pow(lit, 1.15);
      s.X[i] = cx + X; s.Y[i] = s.cy - Y; s.Z[i] = z2;
      s.S[i] = dot * P[o + 8] * (0.6 + 0.5 * b) * (1 + (z2 / H) * 0.4);
      s.A[i] = facing ? 0.2 + 0.8 * b : 0.07;
      const col = GCOL[P[o + 7]];
      if (kind) { s.C[i] = 1; } else { s.C[i] = 255; s.R[i] = col[0]; s.G[i] = col[1]; s.B[i] = col[2]; }
      s.D[i] = 1;
    }
    const flame = H * (0.24 + lp * 0.5), R = K.R;             // eksosen: glødende støv ut av dysa
    for (let j = 0; j < K.nflame; j++, i++) {
      const r1 = R[j * 3], r2 = R[j * 3 + 1], r3 = R[j * 3 + 2], u = REDUCE ? r1 : fract(r1 + T * (1.1 + r2 * 0.9));
      const spread = K.rb * (0.22 + u * (0.55 + lp)) * (r2 - 0.5) * 2 * (0.6 + 0.4 * r3), depth = (r3 - 0.5) * K.rb;
      const y0 = -H * 0.5 - u * flame;
      s.X[i] = cx + spread * cl - y0 * sl; s.Y[i] = s.cy - (spread * sl + y0 * cl); s.Z[i] = depth;
      s.S[i] = dot * (1.2 - u * 0.7);
      s.A[i] = Math.pow(1 - u, 1.4) * 0.95 * smooth(clamp01(u / 0.05));
      const hot = u < 0.2 ? [255, 250, 232] : u < 0.45 ? [255, 222, 140] : u < 0.7 ? [255, 176, 96] : [236, 120, 90];
      s.C[i] = 255; s.R[i] = hot[0]; s.G[i] = hot[1]; s.B[i] = hot[2]; s.D[i] = 1;
    }
  }

  /* ---------- rasterprøving av tekst og tegninger (rødt = aksentfarge) ---------- */
  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    return [c, c.getContext("2d", { willReadFrequently: true })];
  }
  const isAcc = (d, i) => d[i] > 150 && d[i + 1] < 90;
  function sampleText(lines, w, h, maxN, accent, center) {
    const [c, g] = makeCanvas(w, h), font = (fs) => `700 ${fs}px Oswald, "Arial Narrow", sans-serif`;
    g.font = font(100);
    let widest = 0;
    for (const l of lines) { const m = g.measureText(l); widest = Math.max(widest, (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width)); }
    const cap100 = g.measureText("H").actualBoundingBoxAscent || 72, gapR = 0.22, n = lines.length;
    const rings = lines.filter((l) => /[ÅÄÖÉÜ]/.test(l)).length * 0.26;
    let fs = 100 * w / widest;
    const block = (fs / 100) * cap100 * (n + rings + gapR * (n - 1));
    if (block > h * 0.97) fs *= (h * 0.97) / block;
    const cap = (fs / 100) * cap100, gap = cap * gapR, total = cap * n + gap * (n - 1);
    g.font = font(fs); g.textBaseline = "alphabetic"; g.textAlign = "left";
    const ring = lines.map((l) => (/[ÅÄÖÉÜ]/.test(l) ? 0.26 : 0));    // plass til ringen over Å
    const lift = ring.reduce((a, b) => a + b, 0) * cap;
    let y = (h - total - lift) / 2;
    const bands = lines.map((l, i) => {
      y += cap * (1 + ring[i]) + (i ? gap : 0);
      const base = y, lm = g.measureText(l);
      const ink = (lm.actualBoundingBoxLeft || 0) + (lm.actualBoundingBoxRight || lm.width);
      const x0 = (lm.actualBoundingBoxLeft || 0) + (center ? (w - ink) / 2 : 0);
      g.fillStyle = "#000"; g.fillText(l, x0, base);
      // aksenttegnet farges der det faktisk står: bredden til og med tegnet minus tegnets egen bredde tar med kerningen (f.eks. «T.»)
      if (accent) for (let j = l.indexOf(accent); j >= 0; j = l.indexOf(accent, j + 1)) {
        const ax = x0 + g.measureText(l.slice(0, j + 1)).width - g.measureText(accent).width;
        g.fillStyle = "#f00"; g.strokeStyle = "#f00"; g.lineWidth = 2; g.lineJoin = "round";
        g.strokeText(accent, ax, base); g.fillText(accent, ax, base);
      }
      return [base - cap * (1.02 + ring[i]), base + cap * 0.02];
    });
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let step = Math.max(SMALL ? 2.8 : 3.4, cap / (SMALL ? 18 : 28));
    for (;;) {
      const pts = [];
      for (const [top, bot] of bands) {
        const rows = Math.max(1, Math.round((bot - top) / step)), st = (bot - top) / rows;
        for (let r = 0; r < rows; r++) {
          const y = top + st * (r + 0.5);
          for (let x = step / 2; x < w; x += step) { const i = ((y | 0) * c.width + (x | 0)) * 4; if (d[i + 3] > 140) pts.push(x, y, step * 0.8, 1, isAcc(d, i) ? 1 : 0); }
        }
      }
      if (pts.length / 5 <= maxN) return pts;
      step *= 1.07;
    }
  }

  /* ---------- nettsidene vi har laget ----------
     Seksjonen scroller fritt, uten å låses. Vinduene reiser seg rolig fra skrått når de kommer inn
     nedenfra, og hvert vindu smuldrer opp i stjernestøv i det det når toppen av skjermen. Støvet blir
     hengende på himmelen, og ute i rommet virvles det sammen til kloden. */
  const show = document.querySelector("[data-showcase]");
  const works = show ? Array.from(show.querySelectorAll("[data-site]")) : [];
  const grid = show && show.querySelector(".work__list");
  const NCARD = works.length;
  const art = works.map(() => ({ ready: false }));
  const place = works.map(() => ({ x: 0, y: 0 }));             // vinduets plass på siden (x på skjermen, y i dokumentet)
  const cardE = new Float32Array(NCARD).fill(-1);               // hvor langt hvert vindu har smuldret opp, glattet i tid
  const workCache = works.map(() => ({ t: "", o: "", p: "" }));
  let showTop = 0, showH = 0, gridTop = 0, gridH = 0, siteW = 0, siteH = 0, barH = 0;
  // Vinduene smuldrer opp mens rutenettet står midt på skjermen, ett etter ett i rekkefølge (som før),
  // og er blitt støv før rutenettet har scrollet halvveis ut av skjermen.
  const D_START = 0.5, D_STEP = 0.07, D_LEN = 0.3;              // rutenettets midte på skjermen (andel av høyden)
  const dissolveRaw = (i) => REDUCE ? 0 : clamp01((vh * (D_START - i * D_STEP) - (gridTop + gridH / 2 - SY)) / (vh * D_LEN));

  function layoutShowcase() {
    if (!show || !NCARD) return;
    works.forEach((w) => { w.style.transform = "none"; });     // mål uten vippingen
    const r = show.getBoundingClientRect(), gr = grid.getBoundingClientRect();
    showTop = r.top + SY; showH = r.height; gridTop = gr.top + SY; gridH = gr.height;
    works.forEach((w, i) => { const b = w.querySelector(".site").getBoundingClientRect(); place[i].x = b.left; place[i].y = b.top + SY; siteW = b.width; siteH = b.height; });
    works.forEach((w, i) => { w.style.transform = workCache[i].t; });
    const bar = works[0].querySelector(".site__bar");
    barH = bar ? bar.offsetHeight : 0;
    buildArt();
  }
  // Skjermbildene dekodes utenfor hovedtråden før stjernestøvet leser fargene fra dem.
  const imgOf = (i) => works[i].querySelector("img");
  function buildArt() {
    if (!siteW) return;
    works.forEach((card, i) => {
      const img = imgOf(i);
      if (!img || art[i].ready || img.dataset.wait) return;
      img.dataset.wait = "1";
      const done = () => {
        art[i].ready = img.naturalWidth > 0;
        buildArt();
        const s = scenes.find((x) => x.kind === "showcase");
        if (s && art.every((x) => x.ready)) requeue(s);
      };
      const decode = () => (img.decode ? img.decode().then(done, done) : done());
      if (img.complete && img.naturalWidth) decode();
      else { img.addEventListener("load", decode, { once: true }); img.addEventListener("error", done, { once: true }); }
    });
  }
  function updateShowcaseDom(dt) {
    if (!show || !NCARD) return;
    if (SY + vh * 1.2 < showTop || SY - vh * 0.2 > showTop + showH) { cardE.fill(-1); return; }
    const kE = 1 - Math.exp(-dt * 6);
    works.forEach((w, i) => {
      const top = place[i].y - SY, raw = dissolveRaw(i);
      cardE[i] = cardE[i] < 0 ? raw : cardE[i] + (raw - cardE[i]) * kE;
      if (Math.abs(raw - cardE[i]) < 1e-4) cardE[i] = raw;
      // vinduene reiser seg fra skrått mens de kommer inn nedenfra, og tones ut når de blir støv
      const k = REDUCE ? 0 : smooth(clamp01((top - vh * 0.5) / (vh * 0.5))), e = cardE[i];
      const o = 1 - smooth(clamp01((e - 0.03) / 0.22)), C = workCache[i];
      const t = k > 0.0005 ? `translate3d(0,${(k * 60).toFixed(1)}px,0) rotateX(${(k * 30).toFixed(2)}deg) scale(${(1 - k * 0.06).toFixed(4)})` : "none";
      const os = o.toFixed(3), pe = e > 0.05 ? "none" : "";
      if (C.t !== t) { C.t = t; w.style.transform = t; }
      if (C.o !== os) { C.o = os; w.style.opacity = os; w.style.visibility = o < 0.004 ? "hidden" : ""; }
      if (C.p !== pe) { C.p = pe; w.style.pointerEvents = pe; }
    });
  }
  function buildShowcase(s) {
    const per = Math.floor(NS / NCARD), W = siteW, H = siteH;
    const cols = Math.max(4, Math.floor(Math.sqrt((per * W) / H))), rows = Math.max(3, Math.floor(per / cols)), sx = W / cols, sy = H / rows;
    const [small, sg] = makeCanvas(cols, rows), rnd = seeded(17);
    const S = { dot: Math.min(sx, sy) * 0.55, cards: [] };
    sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = "high";
    const barRows = (barH / H) * rows;
    art.forEach((A, n) => {
      const img = imgOf(n), iw = img.naturalWidth, ih = img.naturalHeight, sc = Math.max(W / iw, (H - barH) / ih);
      sg.fillStyle = "#16171b"; sg.fillRect(0, 0, cols, rows);
      if (iw) sg.drawImage(img, 0, 0, Math.min(iw, W / sc), Math.min(ih, (H - barH) / sc), 0, barRows, cols, rows - barRows);   // snittfargen i hver rute
      const d = sg.getImageData(0, 0, cols, rows).data, pts = new Float32Array(cols * rows * 10);
      for (let r = 0, q = 0; r < rows; r++) for (let c = 0; c < cols; c++, q += 10) {
        const i = (r * cols + c) * 4;
        pts[q] = (c + 0.5) * sx; pts[q + 1] = (r + 0.5) * sy; pts[q + 2] = d[i]; pts[q + 3] = d[i + 1]; pts[q + 4] = d[i + 2];
        for (let z = 5; z < 10; z++) pts[q + z] = rnd();
      }
      S.cards.push(pts);
    });
    s.show = S;
    return NCARD * cols * rows;
  }
  function updateShowcase(s) {
    const S = s.show;
    let i = 0;
    for (let c = 0; c < NCARD; c++) {
      const P = place[c], cd = S.cards[c], e = Math.max(0, cardE[c]), appear = smooth(clamp01(e / 0.08)), top = P.y - SY;
      const anchor = P.y - gridTop - gridH / 2 + vh * (D_START - c * D_STEP);   // vinduets topp på skjermen idet det begynner å smuldre
      for (let q = 0; q < cd.length; q += 10, i++) {
        const r1 = cd[q + 5], r2 = cd[q + 6], r3 = cd[q + 7], r4 = cd[q + 8], r5 = cd[q + 9];
        const x0 = P.x + cd[q], y0 = top + cd[q + 1], keep = r4 < 0.36;
        // hver partikkel løsner ovenfra og ned, litt tilfeldig, og legger seg fritt på himmelen (uavhengig av scrollingen)
        const b = e <= 0 ? 0 : smooth(clamp01((e - 0.03 - (cd[q + 1] / siteH) * 0.2 - r1 * 0.28) / 0.49));
        const xf = keep ? (0.03 + 0.94 * r2) * vw : x0 + (r2 - 0.5) * 160, yf = keep ? (0.06 + 0.86 * r3) * vh : anchor + cd[q + 1] - 120 - r3 * vh * 0.25;
        let x = lerp(x0, xf, b), y = lerp(y0, yf, b) - (SY - showTop) * 0.03 * (0.2 + r4) * b;
        const sw = Math.sin(Math.PI * b);
        x += sw * (r5 - 0.5) * 60; y -= sw * (20 + r5 * 50);
        if (b > 0 && !REDUCE) { x += Math.sin(T * 0.21 + r1 * 40) * 12 * b; y += Math.cos(T * 0.17 + r2 * 30) * 8 * b; }   // støvet bølger rolig
        const g = smooth(clamp01(b * 2.5)), tint = DUST[r5 < 0.12 ? 1 : r5 < 0.28 ? 2 : r5 < 0.34 ? 3 : r5 < 0.4 ? 4 : 0];   // lyser opp i det det løsner
        s.X[i] = x; s.Y[i] = y;
        s.S[i] = lerp(S.dot, 1.1 + r3 * 1.3, g);
        s.A[i] = appear * (keep ? lerp(1, 0.4 + 0.4 * r5, g) * (b > 0.5 && !REDUCE ? 0.82 + 0.18 * Math.sin(T * 1.4 + r1 * 60) : 1) : 1 - smooth(clamp01((b - 0.12) / 0.55)));
        s.R[i] = lerp(cd[q + 2], tint[0], g); s.G[i] = lerp(cd[q + 3], tint[1], g); s.B[i] = lerp(cd[q + 4], tint[2], g);
        s.C[i] = 255; s.D[i] = 1;
      }
    }
  }

  /* ---------- landskapet: glatte silhuetter med luftperspektiv ---------- */
  let land = null, landKey = "", skyTop = SKY.sky.top, skyBot = SKY.sky.bot, skyDark = 0, cloudVis = 1, nightVis = 0;
  function layerCanvas(w, h, res) {
    const k = res || dpr, cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.ceil(w * k)); cv.height = Math.max(1, Math.ceil(h * k));
    const g = cv.getContext("2d"); g.scale(k, k);
    return { cv, g, w, h };
  }
  function pine(g, cx, base, h, hw) {
    const tiers = 6, notch = h * 0.035, pt = (i) => { const t = i / tiers; return [hw * (0.22 + 0.78 * t), base - h + h * t]; };
    g.beginPath(); g.moveTo(cx, base - h);
    for (let i = 1; i <= tiers; i++) { const [w, y] = pt(i); g.lineTo(cx + w, y); if (i < tiers) g.lineTo(cx + w * 0.46, y - notch); }
    const tw = hw * 0.07, yT = pt(tiers)[1];
    g.lineTo(cx + tw, yT); g.lineTo(cx + tw, base + 2); g.lineTo(cx - tw, base + 2); g.lineTo(cx - tw, yT);
    for (let i = tiers; i >= 1; i--) { const [w, y] = pt(i); g.lineTo(cx - w, y); if (i > 1) { const [w2, y2] = pt(i - 1); g.lineTo(cx - w2 * 0.46, y2 - notch); } }
    g.closePath(); g.fill();
  }
  function forestLayer(w, h, count, rnd, valley, clear, color) {
    const L = layerCanvas(w, h), g = L.g, base = h - h * 0.1;
    g.fillStyle = color; g.fillRect(0, base - h * 0.05, w, h - base + h * 0.05);
    for (let i = 0; i < count; i++) {
      const cx = rnd() * w, e = Math.abs(cx / w - 0.5) * 2;
      if (clear && cx > clear[0] && cx < clear[1]) continue;
      const th = h * 0.94 * (valley ? 0.42 + 0.58 * Math.pow(e, 1.5) : 0.55 + 0.45 * rnd()) * (0.72 + 0.28 * rnd());
      pine(g, cx, base, th, th * (0.2 + 0.07 * rnd()));
    }
    return L;
  }
  function mountainLayer(w, h, shift, amp, colTop, colBot) {
    const L = layerCanvas(w, h), g = L.g;
    const ridge = (x) => {
      const u = x / w;
      return h - h * amp * (0.46 + 0.16 * Math.sin(u * 4.1 + shift) + 0.08 * Math.sin(u * 9.3 + shift * 2.1) + 0.26 * Math.pow(Math.abs(Math.sin(u * 6.7 + shift * 3.3)), 4) + 0.03 * Math.sin(u * 41 + shift));
    };
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w + 4; x += 3) g.lineTo(x, ridge(x));
    g.lineTo(w, h); g.closePath();
    const grad = g.createLinearGradient(0, h * (1 - amp), 0, h);
    grad.addColorStop(0, colTop); grad.addColorStop(1, colBot);
    g.fillStyle = grad; g.fill();
    g.save(); g.clip();                                        // snø på toppene
    const sg = g.createLinearGradient(0, h * (1 - amp * 0.98), 0, h * (1 - amp * 0.62));
    sg.addColorStop(0, "rgba(255,255,255,0.92)"); sg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = sg; g.fillRect(0, 0, w, h); g.restore();
    return L;
  }
  function cabinLayer() {
    const w = SMALL ? 140 : 230, h = w * 0.66, L = layerCanvas(w, h), g = L.g, ink = "#101318";
    g.save(); g.scale(w, h);
    g.fillStyle = ink;
    g.fillRect(0.05, 0.5, 0.45, 0.5);
    g.beginPath(); g.moveTo(0, 0.53); g.lineTo(0.275, 0.1); g.lineTo(0.55, 0.53); g.closePath(); g.fill();
    g.fillRect(0.35, 0.12, 0.07, 0.24);
    g.fillStyle = "#ffd27a"; g.fillRect(0.34, 0.62, 0.1, 0.13);   // lyst vindu
    g.fillStyle = "#1c2129"; g.fillRect(0.2, 0.7, 0.09, 0.3);     // dør
    g.strokeStyle = ink; g.lineCap = "square";
    const line = (x1, y1, x2, y2, lw) => { g.lineWidth = lw; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    for (let x = 0.57; x <= 0.97; x += 0.066) line(x, 0.6, x, 0.995, 0.014);
    line(0.56, 0.6, 0.97, 0.6, 0.016); line(0.56, 0.99, 0.97, 0.99, 0.016);
    line(0.56, 0.6, 0.765, 0.28, 0.014); line(0.765, 0.28, 0.97, 0.6, 0.014);
    line(0.66, 0.6, 0.72, 0.36, 0.01); line(0.87, 0.6, 0.81, 0.36, 0.01); line(0.6, 0.99, 0.72, 0.62, 0.009);
    line(1.0, 0.995, 0.9, 0.42, 0.012); line(0.975, 0.995, 0.875, 0.42, 0.012);
    for (let t = 0.12; t < 0.95; t += 0.14) line(0.9 + (1 - t) * 0.1 - 0.025, 0.42 + (1 - t) * 0.575, 0.9 + (1 - t) * 0.1, 0.42 + (1 - t) * 0.575, 0.008);
    g.restore();
    L.window = { x: 0.39 * w, y: 0.685 * h }; L.smoke = { x: 0.385 * w, y: 0.12 * h };
    return L;
  }
  function cloudLayer(rnd, w, h) {
    const L = layerCanvas(w, h, 1), g = L.g, n = 8 + ((rnd() * 5) | 0);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), r = h * (0.26 + 0.22 * rnd()) * (1 - Math.abs(u - 0.5) * 0.9);
      const x = w * (0.14 + 0.72 * u) + (rnd() - 0.5) * w * 0.06, y = h * 0.66 - r * 0.45 + (rnd() - 0.5) * h * 0.08;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, "rgba(255,255,255,0.95)"); rg.addColorStop(0.55, "rgba(255,255,255,0.75)"); rg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = "source-atop";                // skygge på undersiden
    const sh = g.createLinearGradient(0, h * 0.42, 0, h * 0.85);
    sh.addColorStop(0, "rgba(160,182,214,0)"); sh.addColorStop(1, "rgba(160,182,214,0.55)");
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
    return L;
  }
  function seaLayer(W, h) {
    const L = layerCanvas(W, h, 1), g = L.g, rnd = seeded(21);
    const base = g.createLinearGradient(0, h * 0.4, 0, h);
    base.addColorStop(0, "rgba(255,255,255,0)"); base.addColorStop(0.3, "rgba(255,255,255,0.96)"); base.addColorStop(1, "rgba(222,234,250,1)");
    g.fillStyle = base; g.fillRect(0, h * 0.4, W, h * 0.6);
    for (let i = 0; i < W / 26; i++) {                         // bølgende overflate av skytopper
      const x = rnd() * W, r = h * (0.18 + rnd() * 0.32), y = h * 0.5 - r * 0.25 + rnd() * h * 0.08;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, "rgba(255,255,255,0.95)"); rg.addColorStop(0.6, "rgba(255,255,255,0.7)"); rg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = "source-atop";
    const sh = g.createLinearGradient(0, h * 0.2, 0, h);
    sh.addColorStop(0, "rgba(150,178,222,0)"); sh.addColorStop(1, "rgba(150,178,222,0.45)");
    g.fillStyle = sh; g.fillRect(0, 0, W, h);
    return L;
  }
  function puffSprite() {
    const L = layerCanvas(64, 64, 1), g = L.g, rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, "rgba(236,240,246,0.9)"); rg.addColorStop(1, "rgba(236,240,246,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    return L;
  }
  function buildLand() {
    const rnd = seeded(7), W = vw + 80, sc = SMALL ? 0.8 : 1;
    const hFM = vh * 0.34 * sc, hNM = vh * 0.28 * sc, hB = vh * 0.24 * sc, hF = vh * 0.3 * sc;
    const cabW = SMALL ? 140 : 230, cabX = vw * (SMALL ? 0.58 : 0.66);
    const L = {
      farM: mountainLayer(W, hFM, 0.4, 0.95, "rgb(168,190,222)", "rgb(212,224,240)"),
      nearM: mountainLayer(W, hNM, 2.2, 0.82, "rgb(120,145,184)", "rgb(170,190,220)"),
      back: forestLayer(W, hB, Math.round(W / 13), rnd, false, null, "rgb(58,76,104)"),
      front: forestLayer(W, hF, Math.round(W / (SMALL ? 14 : 18)), rnd, true, [cabX + 40 - cabW * 0.3, cabX + 40 + cabW * 1.2], "rgb(15,18,23)"),
      cabin: cabinLayer(), cabX, hF, puff: puffSprite(), clouds: [], sea: show ? seaLayer(vw + 120, vh * 0.55) : null,
    };
    const add = (y0, k, scale, front, gone) => { const w = (SMALL ? 320 : 560) * scale; L.clouds.push({ L: cloudLayer(rnd, w, w * 0.42), x0: rnd(), y0, k, drift: 3 + rnd() * 8, front, gone }); };
    for (let i = 0; i < 6; i++) add(SMALL ? rnd() * 0.12 : 0.02 + rnd() * 0.34, 0.3 + rnd() * 0.2, SMALL ? 0.45 + rnd() * 0.3 : 0.45 + rnd() * 0.5, false, 0.5);
    for (let i = 0; i < 7; i++) add(-0.4 - rnd() * 0.5, 1.6 + rnd() * 0.3, 1.3 + rnd() * 0.7, true, 0);   // skylaget vi flyr gjennom
    return L;
  }
  function drawLayer(L, x, yBottom) { if (yBottom < 0 || yBottom - L.h > vhC) return; ctx.drawImage(L.cv, x, yBottom - L.h, L.w, L.h); }
  function drawClouds(front) {
    if (!land || cloudVis <= 0.02) return;
    for (const cl of land.clouds) {
      if (cl.front !== front) continue;
      const w = cl.L.w, h = cl.L.h, y = cl.y0 * vh + SY * cl.k, a = cl.gone ? cloudVis * (1 - smooth(clamp01((SY - vh * cl.gone) / (vh * 0.4)))) : cloudVis;
      if (y > vhC || y + h < 0 || a <= 0.01) continue;
      ctx.globalAlpha = a;
      const span = vw + w, x = (((cl.x0 * span + (REDUCE ? 0 : T * cl.drift)) % span) + span) % span - w;
      ctx.drawImage(cl.L.cv, x, y, w, h);
    }
    ctx.globalAlpha = 1;
  }
  function drawSea() {
    if (!land || !land.sea || !show) return;
    const r = clamp01((SY - (showTop - vh)) / vh), u = clamp01((SY - showTop) / Math.max(1, showH - vh));
    const top = vh * (0.3 + (SMALL ? 0.6 : 0.58) * smooth(r)) + vh * 0.12 * u + Math.max(0, SY - (showTop + showH - vh)) * 1.1;
    const a = smooth(clamp01((r - 0.08) / 0.4)) * cloudVis;
    if (a <= 0.02 || top > vhC) return;
    const mx = mouseX > -1e3 && !REDUCE ? mouseX / vw - 0.5 : 0;
    ctx.globalAlpha = a;
    ctx.drawImage(land.sea.cv, -60 - mx * 18 + (REDUCE ? 0 : Math.sin(T * 0.05) * 30), top, land.sea.w, land.sea.h);
    const below = top + land.sea.h - 1;                      // skyhavet fortsetter helt ned
    if (below < vhC) { ctx.fillStyle = "rgb(222,234,250)"; ctx.fillRect(0, below, vw, vhC - below); }
    ctx.globalAlpha = 1;
  }
  function computeSky(c) {
    const s0 = SKY[scenes[0].bg];
    let top = s0.top, bot = s0.bot, dark = s0.dark, cl = s0.cloud;
    const W = vh * 0.75;
    for (let j = 0; j < scenes.length - 1; j++) {
      if (scenes[j].bg === scenes[j + 1].bg) continue;
      const early = scenes[j].bg === "high" && scenes[j + 1].bg === "night" ? vh * 0.3 : 0;   // rommet kommer før kloden er ferdig
      const f = smooth(clamp01((c - (scenes[j].bottom - early - W / 2)) / W));
      if (f <= 0) break;
      const nx = SKY[scenes[j + 1].bg];
      top = mix(top, nx.top, f); bot = mix(bot, nx.bot, f); dark += (nx.dark - dark) * f; cl += (nx.cloud - cl) * f;
    }
    skyTop = top; skyBot = bot; skyDark = dark; cloudVis = cl;
    nightVis = smooth(clamp01((150 - skyTop[2]) / 135));      // hvor langt ute i rommet vi er
  }

  /* ---------- verdensrommet: stjerner som driver, små galakser, svak tåke og stjerneskudd ---------- */
  const galX = new Float32Array(GALAXIES.length), galY = new Float32Array(GALAXIES.length), galS = new Float32Array(GALAXIES.length);
  let agentsGlow = null, galaxyGlow = null, GLOW = null;
  function placeGalaxies() {
    const start = nightIndex >= 0 ? scenes[nightIndex].top - vh : 0, m = Math.min(vw, vh), drift = Math.max(0, SY - start) * 0.012;
    GALAXIES.forEach((G, g) => { galX[g] = G[0] * vw; galY[g] = G[1] * vh - drift; galS[g] = G[2] * m; });
  }
  function drawSpace() {
    if (nightVis <= 0.02) return;
    const R = Math.max(vw, vh);
    let g = ctx.createRadialGradient(vw * 0.82, vh * 0.2, 0, vw * 0.82, vh * 0.2, R * 0.34);
    g.addColorStop(0, `rgba(86,104,255,${0.08 * nightVis})`); g.addColorStop(1, "rgba(86,104,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vhC);
    g = ctx.createRadialGradient(vw * 0.06, vh * 0.96, 0, vw * 0.06, vh * 0.96, R * 0.46);
    g.addColorStop(0, `rgba(140,76,220,${0.07 * nightVis})`); g.addColorStop(1, "rgba(140,76,220,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vhC);
    GALAXIES.forEach((G, k) => {                                 // lyset fra hver galaksekjerne
      const r = galS[k] * (G[6] === 2 ? 0.75 : 0.5);
      ctx.save(); ctx.translate(galX[k], galY[k]); ctx.rotate(G[3]); ctx.scale(1, Math.min(1, G[4] * 1.5 + 0.1));
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(255,236,208,${0.3 * nightVis})`); g.addColorStop(0.4, `rgba(214,206,255,${0.08 * nightVis})`); g.addColorStop(1, "rgba(160,170,255,0)");
      ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    });
    if (galaxyGlow && galaxyGlow.a > 0.01) {                    // lyset fra galaksens kjerne og en svak skive
      const { x, y, r, t, a } = galaxyGlow;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.3); ctx.scale(1, Math.max(0.2, t));
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.95);
      g.addColorStop(0, `rgba(255,226,190,${0.2 * a})`); g.addColorStop(0.18, `rgba(200,180,255,${0.1 * a})`); g.addColorStop(0.6, `rgba(110,130,255,${0.04 * a})`); g.addColorStop(1, "rgba(110,130,255,0)");
      ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.06);   // det mørke hullet i midten
      g.addColorStop(0, `rgba(2,3,8,${0.9 * a})`); g.addColorStop(0.8, `rgba(2,3,8,${0.7 * a})`); g.addColorStop(1, "rgba(2,3,8,0)");
      ctx.fillStyle = g; ctx.fillRect(-r * 0.07, -r * 0.07, r * 0.14, r * 0.14);
      ctx.restore();
    }
    if (agentsGlow && agentsGlow.a > 0.01) {                    // svak atmosfære rundt kloden
      const { x, y, r, a } = agentsGlow;
      g = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.35);
      g.addColorStop(0, `rgba(96,140,255,${0.16 * a})`); g.addColorStop(1, "rgba(96,140,255,0)");
      ctx.fillStyle = g; ctx.fillRect(x - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8);
    }
    if (REDUCE) return;
    const P = 13, cyc = Math.floor(T / P), ph = T / P - cyc;      // et stjerneskudd av og til
    if (ph < 0.075) {
      const u = ph / 0.075, rx = fract(Math.sin(cyc * 91.7) * 4375.5), ry = fract(Math.sin(cyc * 47.3) * 9173.1);
      const x0 = vw * (0.25 + rx * 0.65), y0 = vh * (0.06 + ry * 0.3), dist = Math.min(vw, 900) * 0.32, hx = x0 - dist * u, hy = y0 + dist * 0.42 * u;
      const len = 150 * Math.sin(Math.PI * u), tx = hx + len, ty = hy - len * 0.42;
      const lg = ctx.createLinearGradient(hx, hy, tx, ty);
      lg.addColorStop(0, `rgba(255,255,255,${0.7 * nightVis * Math.sin(Math.PI * u)})`); lg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = lg; ctx.lineWidth = 1.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
    }
  }
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, vhC);
    g.addColorStop(0, rgb(skyTop)); g.addColorStop(1, rgb(skyBot));
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vhC);
    if (cloudVis > 0.05) {                                    // sola oppe til høyre
      const sun = ctx.createRadialGradient(vw * 0.8, vh * 0.12, 0, vw * 0.8, vh * 0.12, Math.max(vw, vh) * 0.55);
      sun.addColorStop(0, rgba([255, 250, 236], 0.55 * cloudVis)); sun.addColorStop(1, rgba([255, 250, 236], 0));
      ctx.fillStyle = sun; ctx.fillRect(0, 0, vw, vhC);
    }
    drawSpace();
    if (!land) return;
    const fade = 1 - clamp01((SY - vh * 0.3) / (vh * 0.9));
    const mx = mouseX > -1e3 && !REDUCE ? mouseX / vw - 0.5 : 0;
    drawClouds(false);                                       // himmelskyene ligger bak fjellene
    if (fade > 0) {
      ctx.globalAlpha = fade;
      drawLayer(land.farM, -40 - mx * 6, vh * 0.84 + SY * 0.15);
      drawLayer(land.nearM, -40 - mx * 12, vh * 0.92 + SY * 0.3);
      ctx.globalAlpha = 1;
    }
    drawSea();
    if (fade > 0) {
      drawLayer(land.back, -40 - mx * 20, vh * 1.0 + SY * 0.55);
      drawLayer(land.front, -40 - mx * 32, vh * 1.01 + SY * 0.95);
      const cb = land.cabin, cx = land.cabX - mx * 32, cyB = vh * 1.01 + SY * 0.95 - land.hF * 0.06;
      drawLayer(cb, cx, cyB);
      if (cyB - cb.h < vhC) {
        const wx = cx + cb.window.x, wy = cyB - cb.h + cb.window.y;   // varmt lys fra vinduet
        const glow = ctx.createRadialGradient(wx, wy, 0, wx, wy, cb.w * 0.28);
        glow.addColorStop(0, `rgba(255,196,90,${0.34 + (REDUCE ? 0 : 0.05 * Math.sin(T * 2.3))})`); glow.addColorStop(1, "rgba(255,196,90,0)");
        ctx.fillStyle = glow; ctx.fillRect(wx - cb.w * 0.3, wy - cb.w * 0.3, cb.w * 0.6, cb.w * 0.6);
        if (!REDUCE) for (let i = 0; i < 12; i++) {              // røyk fra pipa
          const u = fract(T * 0.09 + i / 12), sx = cx + cb.smoke.x + u * 50 + Math.sin(u * 5 + i) * 6, sy = cyB - cb.h + cb.smoke.y - u * 130, r = 6 + u * 26;
          ctx.globalAlpha = (1 - u) * 0.55 * Math.min(1, u * 5);
          ctx.drawImage(land.puff.cv, sx - r, sy - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  /* ---------- figurene bygges én om gangen, nærmeste først, så siden aldri henger ---------- */
  function setShape(s, P, extra) {
    const n0 = P.length / 5, n = n0 + (extra || 0);
    s.n0 = n0;
    s.lx = new Float32Array(n0); s.ly = new Float32Array(n0); s.ls = new Float32Array(n0); s.la = new Float32Array(n0); s.lc = new Uint8Array(n0);
    for (let i = 0; i < n0; i++) { s.lx[i] = P[i * 5]; s.ly[i] = P[i * 5 + 1]; s.ls[i] = P[i * 5 + 2]; s.la[i] = P[i * 5 + 3]; s.lc[i] = P[i * 5 + 4]; }
    s.X = new Float32Array(n); s.Y = new Float32Array(n); s.S = new Float32Array(n); s.A = new Float32Array(n);
    s.C = new Uint8Array(n); s.R = new Uint8Array(n); s.G = new Uint8Array(n); s.B = new Uint8Array(n); s.D = new Uint8Array(n); s.Z = new Float32Array(n);
    s.is3d = s.kind === "agents" || s.kind === "earth" || s.kind === "rocket" || s.kind === "galaxy";
    s.n = n;
  }
  function sortShape(s) {
    const key = new Float64Array(s.n);
    if (s.kind === "showcase") {                               // ordnet etter plassen på skjermen
      const span = Math.max(vw, gridH, 1);
      let i = 0;
      s.show.cards.forEach((cd, c) => { for (let q = 0; q < cd.length; q += 10, i++) key[i] = hilbert((place[c].x + cd[q]) / span, (place[c].y - gridTop + cd[q + 1]) / span); });
    } else {
      const T0 = T; T = 0; updateShape(s, 0); T = T0;           // rekkefølgen regnes på figuren i hvile
      const span = Math.max(s.w, s.h, 1);
      for (let i = 0; i < s.n; i++) key[i] = hilbert((s.X[i] - s.vx) / span + 0.25, (s.Y[i] - s.vy) / span + 0.25);
    }
    s.ord = Int32Array.from({ length: s.n }, (_, i) => i).sort((a, b) => key[a] - key[b] || a - b);
  }
  function buildScene(s) {
    const k = s.kind;
    if (k === "text") {
      const raw = (SMALL && s.slot.dataset.textSmall) || s.slot.dataset.text || "";
      setShape(s, sampleText(raw.split("|"), s.w, s.h, NS, s.slot.dataset.accent || "", s.slot.dataset.align === "center"));
    } else if (k === "editor") setShape(s, buildEditor(s.w, s.h));
    else if (k === "search") setShape(s, buildSearch(s.w, s.h));
    else if (k === "network") { const P = buildNetwork(s); setShape(s, P, s.net.edges.length); }
    else if (k === "agents" || k === "earth") setShape(s, [], buildAgents(s, k === "earth"));
    else if (k === "galaxy") setShape(s, [], buildGalaxy(s));
    else if (k === "globe") setShape(s, [], buildGlobe(s));
    else if (k === "rocket") setShape(s, [], buildRocket(s));
    else if (k === "showcase") { if (!art.length || !art.every((x) => x.ready)) return; setShape(s, [], buildShowcase(s)); }
    else return;
    sortShape(s);
    s.key = s.want; s.built = true;
  }
  let queue = [], queueTimer = 0;
  function pump() {
    queueTimer = 0;
    const s = queue.shift();
    if (s) buildScene(s);
    if (queue.length) queueTimer = setTimeout(pump, 16);
  }
  function requeue(s) {
    if (!queue.includes(s)) queue.push(s);
    if (!queueTimer) queueTimer = setTimeout(pump, 16);
  }
  function layout() {
    vw = window.innerWidth; vh = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    const cw = canvas.clientWidth || vw; vhC = canvas.clientHeight || vh;
    const cwP = Math.round(cw * dpr), chP = Math.round(vhC * dpr);
    if (canvas.width !== cwP || canvas.height !== chP) { canvas.width = cwP; canvas.height = chP; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    docH = document.documentElement.scrollHeight; SY = window.scrollY;
    const g = Math.max(SMALL ? 24 : 28, vw / (SMALL ? 15 : 50)), cols = Math.floor(vw / g), rows = Math.floor(vhC / g) + 1;
    gridN = Math.min(cols * rows, NE - GAL); gridX = new Float32Array(gridN); gridY = new Float32Array(gridN);
    for (let i = 0; i < gridN; i++) { gridX[i] = (vw - (cols - 1) * g) / 2 + (i % cols) * g; gridY[i] = g / 2 + Math.floor(i / cols) * g; }
    layoutShowcase();
    for (const s of scenes) {
      const r = s.sec.getBoundingClientRect();
      s.top = r.top + SY; s.bottom = r.bottom + SY;
      if (s.slot) { const rr = s.slot.getBoundingClientRect(); s.w = rr.width; s.h = rr.height; s.ox = rr.left; s.oy = rr.top + SY; s.fx = rr.left; s.fy = (vh - rr.height) / 2; }
      if (s.kind === "galaxy") { s.w = vw; s.h = vh; s.ox = 0; s.fx = 0; s.fy = 0; s.oy = (s.top + s.bottom) / 2 - vh / 2; }   // bakgrunn: hele skjermen
      if (s.kind === "showcase") {
        s.w = vw; s.h = vh;
        s.aIn = gridTop + gridH * 0.5;                          // vinduene er midt på skjermen
        s.aOut = Math.max(s.aIn, showTop + showH - vh * 0.55);  // støvet begynner å samles når anmeldelsene er lest, og er kloden først ute i rommet
        s.want = `${Math.round(siteW)}x${Math.round(siteH)}x${Math.round(vw)}x${Math.round(vh)}`;
      } else if (s.kind === "galaxy") {                         // bakgrunnen står ferdig mens hele seksjonen er på skjermen
        s.aIn = s.top + vh * 0.4; s.aOut = Math.max(s.aIn, s.bottom - vh * 0.35); s.range = true;
        s.want = `${Math.round(vw)}x${Math.round(vh)}`;
      } else if (s.fixed && s.slot) {                           // figuren står ferdig og rolig så lenge seksjonen er på skjermen
        s.aIn = s.top + vh * 0.15; s.range = true;
        s.aOut = s.late ? Math.max(s.aIn, (s.top + s.bottom) / 2) : Math.max(s.aIn, s.bottom - vh * 0.3);   // raketten slipper når teksten står på linje med den
        s.want = `${Math.round(s.w)}x${Math.round(s.h)}`;
      } else {
        s.aIn = s.aOut = Math.min(s.slot ? s.oy + s.h / 2 : (s.top + s.bottom) / 2, docH - vh * 0.5 - 1);
        s.want = `${Math.round(s.w)}x${Math.round(s.h)}`;
      }
      const buildable = s.kind === "showcase" ? siteW > 0 : s.slot && s.kind !== "none" && s.w > 0 && s.h > 0;
      if (buildable && s.want !== s.key && !queue.includes(s)) queue.push(s);
    }
    const c = SY + vh * 0.5;
    queue.sort((a, b) => Math.abs(a.aIn - c) - Math.abs(b.aIn - c));
    if (queue.length && !queueTimer) queueTimer = setTimeout(pump, 16);
    const lk = `${vw}x${vh}`;
    if (lk !== landKey) { landKey = lk; land = scenes.some((sc) => sc.sec.hasAttribute("data-landscape")) ? buildLand() : null; }
    ready = true;
    root.classList.add("dots-on");
  }

  /* ---------- figurene i skjermkoordinater, hver ramme ---------- */
  function updateShape(s, lp) {
    if (s.kind === "showcase") { s.cx = vw * 0.5; s.cy = vh * 0.5; updateShowcase(s); return; }
    s.vx = s.fixed ? s.fx : s.ox; s.vy = s.fixed ? s.fy : s.oy - SY;
    s.cx = s.vx + s.w / 2; s.cy = s.vy + s.h / 2;
    if (s.kind === "agents" || s.kind === "earth") { updateAgents(s); return; }
    if (s.kind === "galaxy") { updateGalaxy(s); return; }
    const n0 = s.n0;
    if (s.kind === "network") {
      const N = s.net, cx = s.vx + N.cx, cy = s.vy + N.cy;
      const ang = REDUCE ? 0 : T * 0.05 + Math.sin(T * 0.23) * 0.05, sc = 1 + (REDUCE ? 0 : Math.sin(T * 0.55) * 0.022);
      const ca = Math.cos(ang) * sc, sa = Math.sin(ang) * sc, nodes0 = n0 - N.nodes;
      for (let i = 0; i < n0; i++) {
        const x = s.lx[i] - N.cx, y = s.ly[i] - N.cy;
        s.X[i] = cx + x * ca - y * sa; s.Y[i] = cy + x * sa + y * ca;
        s.S[i] = i >= nodes0 && !REDUCE ? s.ls[i] * (1 + 0.16 * Math.sin(T * 1.4 + i * 1.7)) : s.ls[i];
        s.A[i] = s.la[i]; s.C[i] = s.lc[i]; s.D[i] = 1;
      }
      const e = N.edges;
      for (let j = 0; j < e.length; j++) {                     // datapakkene tones inn og ut i endene, så de aldri hopper
        const i = n0 + j, u = REDUCE ? 0.5 : fract(N.ph[j] + T * N.sp[j]), a = e[j][0], b = e[j][1];
        const x = a[0] + (b[0] - a[0]) * u - N.cx, y = a[1] + (b[1] - a[1]) * u - N.cy;
        s.X[i] = cx + x * ca - y * sa; s.Y[i] = cy + x * sa + y * ca; s.S[i] = N.dot * 1.25;
        s.A[i] = smooth(clamp01((u - 0.04) / 0.18)) * smooth(clamp01((0.92 - u) / 0.2)); s.C[i] = 1; s.D[i] = 1;
      }
      return;
    }
    const blink = REDUCE || Math.sin(T * 6) > -0.2 ? 1 : 0;
    const tight = s.kind === "text" ? 1 : 0;                  // tekst følger scrollingen tett, så den aldri glir over avsnittet under
    for (let i = 0; i < n0; i++) { s.X[i] = s.vx + s.lx[i]; s.Y[i] = s.vy + s.ly[i]; s.S[i] = s.ls[i]; s.C[i] = s.lc[i]; const a = s.la[i]; s.A[i] = a < 0 ? blink : a; s.D[i] = tight; }
    if (tight && !REDUCE) {                                  // et svakt lys glir over bokstavene med jevne mellomrom
      const ph = fract(T / 7) * 1.8 - 0.4;
      for (let i = 0; i < n0; i++) { const d = s.lx[i] / s.w - ph - (s.ly[i] / s.h) * 0.12, glow = Math.exp(-d * d * 90); s.A[i] *= 0.84 + 0.16 * glow; s.S[i] *= 1 + 0.14 * glow; }
    }
    if (s.kind === "globe") updateGlobe(s);
    else if (s.kind === "rocket") updateRocket(s, lp);
  }
  function updateGlobe(s) {
    const G = s.globe, R = G.R, cx = s.vx + s.w / 2, cy = s.vy + s.h / 2, q = G.pts;
    const a = (REDUCE ? 0.6 : T * 0.18) + (SY / vh) * 0.25, ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(0.38), st = Math.sin(0.38);
    let i = 0;
    for (let n = 0; n < G.N; n++, i++) {
      const x = q[n * 4], y = q[n * 4 + 1], z = q[n * 4 + 2], edge = q[n * 4 + 3];
      const xr = x * ca + z * sa, zr = -x * sa + z * ca, yr = y * ct - zr * st, zz = y * st + zr * ct, front = (zz + 1) / 2;
      s.X[i] = cx + xr * R; s.Y[i] = cy - yr * R; s.D[i] = 1;
      if (edge && zz > 0) { const pulse = REDUCE ? 0.6 : 0.5 + 0.5 * Math.sin(T * 3 + n); s.S[i] = G.dot * (1.4 + pulse * 1.1); s.A[i] = 1; s.C[i] = 1; }
      else { s.S[i] = G.dot * (0.45 + front * 0.75); s.A[i] = zz < 0 ? 0.18 : 0.35 + front * 0.65; s.C[i] = 0; }
    }
    for (let n = 0; n < G.ring; n++, i++) {
      const t = (n / G.ring) * TAU, rx = Math.cos(t) * R * 1.45, rz = Math.sin(t) * R * 1.45;
      s.X[i] = cx + rx; s.Y[i] = cy + rz * 0.28 - rx * 0.12; s.S[i] = G.dot * 0.5; s.A[i] = 0.45; s.C[i] = 0; s.D[i] = 1;
    }
    const t = REDUCE ? 1 : T * 0.6, rx = Math.cos(t) * R * 1.45, rz = Math.sin(t) * R * 1.45;
    s.X[i] = cx + rx; s.Y[i] = cy + rz * 0.28 - rx * 0.12; s.S[i] = G.dot * 2.4; s.A[i] = 1; s.C[i] = 1; s.D[i] = 1;
  }
  const PAL = [[0, 0, 0], [0, 0, 0]];                          // 0 grunnfarge, 1 aksent — følger himmelen
  // Figurer med færre punkter enn partikler: overskuddet legger seg usynlig oppå et punkt,
  // så figuren ser lik ut uansett antall (og smelter sammen når det lander i en overgang).
  function shapeInto(s, j, out) {
    const idx = ((j * s.n) / NS) | 0, i = s.ord[idx];
    out[0] = s.X[i]; out[1] = s.Y[i]; out[2] = s.S[i]; out[7] = s.D[i]; out[8] = s.Z[i];
    out[3] = j > 0 && (((j - 1) * s.n) / NS | 0) === idx ? 0 : s.A[i];
    if (s.C[i] === 255) { out[4] = s.R[i]; out[5] = s.G[i]; out[6] = s.B[i]; }
    else { const p = PAL[s.C[i]]; out[4] = p[0]; out[5] = p[1]; out[6] = p[2]; }
  }
  // stjernestøv rundt en figur: der partiklene kommer fra når teksten skrives frem
  function scatter(out, k) {
    out[0] += (seed[k] - 0.5) * vw * 0.7; out[1] += (fract(seed[k] * 7.31) - 0.5) * vh * 0.8; out[2] = 1.2; out[3] = 0;
  }
  function starInto(k, out) {
    const z = starZ[k], span = vhC * 1.3, sd = seed[k];
    let y = starY[k] * span - SY * (0.04 + 0.1 * z) + (REDUCE ? 0 : T * (1.2 + z * 2.6));   // driver sakte nedover
    y = ((y % span) + span) % span - vhC * 0.15;
    let x = starX[k] * (vw + 40) + (REDUCE ? 0 : T * (0.5 + z * 1.4));                      // og litt sidelengs
    x = ((x % (vw + 40)) + vw + 40) % (vw + 40) - 20;
    out[0] = x + (mouseX > -1e3 ? (mouseX / vw - 0.5) * -14 * z : 0); out[1] = y;
    out[2] = (SMALL ? 0.9 : 1.1) + z * z * (SMALL ? 2.2 : 2.8) * (sd > 0.97 ? 1.5 : 1);
    out[3] = (0.3 + 0.7 * z) * (REDUCE ? 1 : 0.6 + 0.4 * Math.sin(T * (0.6 + sd * 1.8) + sd * 40)) * nightVis;
    const c = STARCOL[starC[k]]; out[4] = c[0]; out[5] = c[1]; out[6] = c[2]; out[7] = 0;
  }
  function envInto(s, k, out) {
    const e = k - E0;
    if (s.bg === "night") {
      if (e < GAL) {                                           // galaksene
        const g = galG[e], G = GALAXIES[g], R = galS[g], r = galR[e], t = galT[e] + (REDUCE ? 0 : T * G[5]), core = galK[e];
        const x = Math.cos(t) * r * R, y = Math.sin(t) * r * R * G[4] * galF[e], c = Math.cos(G[3]), sn = Math.sin(G[3]);
        out[0] = galX[g] + x * c - y * sn; out[1] = galY[g] + x * sn + y * c;
        out[2] = (SMALL ? 0.8 : 0.85) + galJ[e] * (core ? 0.9 : 0.7);
        out[3] = (core ? 0.8 : 0.22 + 0.5 * (1 - Math.abs(r))) * (REDUCE ? 1 : 0.78 + 0.22 * Math.sin(T * 1.1 + galJ[e] * 30)) * nightVis;
        const col = core ? STARCOL[1] : galJ[e] < 0.45 ? STARCOL[2] : STARCOL[0];
        out[4] = col[0]; out[5] = col[1]; out[6] = col[2]; out[7] = 0;
        return;
      }
      starInto(k, out);
      return;
    }
    if (s.bg === "blue" && e >= GAL && e - GAL < gridN) { out[0] = gridX[e - GAL]; out[1] = gridY[e - GAL]; out[2] = 2.1; out[3] = 0.3; out[4] = out[5] = out[6] = 255; out[7] = 0; return; }
    starInto(k, out); out[2] = 0; out[3] = 0;
  }

  /* ---------- tegning: tellesortert etter farge og gjennomsiktighet ---------- */
  const LEVELS = 16, KEYS = 4096 * LEVELS;
  const counts = new Uint32Array(KEYS), starts = new Uint32Array(KEYS), keyOf = new Uint16Array(COUNT), order = new Int32Array(COUNT), sorted = new Int32Array(COUNT);
  const TA = new Float32Array(9), TB = new Float32Array(9), glowList = new Int32Array(COUNT);
  let navTheme = "", navBg = "", Ps = -1, lpS = 0, shapeLive = true, envLive = true;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!ready) return;
    if (window.nsTick) window.nsTick(now);                     // myk scrolling oppdateres før vi leser posisjonen
    T = now / 1000;
    const dt = Math.min(0.05, Math.max(0.001, T - (lastT || T - 0.016))); lastT = T;
    SY = window.scrollY; vh = window.innerHeight;
    const c = SY + vh * 0.5;

    computeSky(c);
    const theme = skyDark > 0.5 ? "dark" : "light";
    if (theme !== navTheme) { navTheme = theme; root.dataset.theme = theme; if (nav) nav.dataset.theme = theme; }
    const nb = rgb(skyTop);
    if (nav && nb !== navBg) { navBg = nb; nav.style.setProperty("--nav-bg", nb); }
    PAL[0] = mix(INK, WHITE, skyDark); PAL[1] = mix(ACC_L, ACC_D, skyDark);
    placeGalaxies();
    updateShowcaseDom(dt);

    // hvor i scenerekka vi er (scene + andel av overgangen), glattet i tid
    const L = scenes.length;
    let ri = 0;
    while (ri < L - 1 && c >= scenes[ri + 1].aIn) ri++;
    const Ar = scenes[ri], Br = scenes[Math.min(ri + 1, L - 1)], span = Br.aIn - Ar.aOut;
    const tr = Ar === Br ? 0 : span <= 0 ? 1 : clamp01((c - Ar.aOut) / span);
    const mr = Ar.kind === "showcase" ? clamp01((tr - 0.02) / 0.88)         // støvet samles mens himmelen blir rom
      : Br.kind === "text" ? clamp01((tr - 0.05) / 0.8)                      // teksten skrives frem over lang tid
      : Br.kind === "galaxy" ? clamp01(tr / 0.94)                            // raketten løses sakte opp i galaksen mens den løfter seg
      : Ar.late ? clamp01((tr - 0.62) / 0.3)
      : Ar.range || Br.range ? clamp01((tr - 0.06) / 0.88)                   // mellom to faste figurer: hele mellomrommet brukes
      : clamp01((tr - 0.25) / 0.5);
    const kP = REDUCE ? 1 : 1 - Math.exp(-dt * 5.5), Praw = ri + mr;
    Ps = Ps < 0 ? Praw : Ps + (Praw - Ps) * kP;
    if (Math.abs(Praw - Ps) < 5e-4) Ps = Praw;
    const lpRaw = rocketIndex < 0 ? 0 : ri < rocketIndex ? 0 : ri > rocketIndex ? 1 : clamp01(tr / 0.8);
    lpS += (lpRaw - lpS) * kP;
    const iS = Math.min(L - 1, Math.floor(Ps)), m = iS >= L - 1 ? 0 : Ps - iS;
    const A = scenes[iS], B = scenes[Math.min(iS + 1, L - 1)];
    const hasA = A.built && A.n > 0, hasB = B !== A && B.built && B.n > 0;
    if (hasA) updateShape(A, A.kind === "rocket" ? lpS : 0);
    if (hasB) updateShape(B, B.kind === "rocket" ? lpS : 0);
    const settled = B === A || m <= 0;
    const isEarth = (x) => x.kind === "agents" || x.kind === "earth";
    const ag = hasA && isEarth(A) ? A : hasB && isEarth(B) ? B : null;
    agentsGlow = ag ? { x: ag.cx, y: ag.cy, r: ag.ag.R, a: (ag === A ? 1 - (settled ? 0 : smooth(m)) : smooth(m)) * nightVis } : null;
    const gx = hasA && A.kind === "galaxy" ? A : hasB && B.kind === "galaxy" ? B : null;
    galaxyGlow = gx ? { x: gx.cx, y: gx.cy, r: gx.gR, t: gx.gT, a: (gx === A ? 1 - (settled ? 0 : smooth(m)) : smooth(m)) * nightVis } : null;
    const swarm = A.kind === "showcase";                       // fra nettsidene: støvet samles i en myk bue
    const spin3 = hasA && hasB && !swarm && (A.is3d || B.is3d);  // kloden, raketten og galaksen: én rolig runde i 3D
    const dustIn = !hasA && hasB && B.kind === "text", dustOut = hasA && !hasB && A.kind === "text";
    // Figurene står aldri stille rett før et bytte: jo lenger du scroller fra en figurs anker mot neste,
    // jo mer løsner partiklene og driver som støv. Etter byttet legger den nye figuren seg gradvis til ro.
    const looseTarget = (sc) => {
      if (REDUCE || sc.kind === "showcase" || sc.kind === "none") return 0;
      const nx = scenes[sc.index + 1], pv = scenes[sc.index - 1];
      let d = 0;
      if (c > sc.aOut && nx && sc.kind !== "rocket") d = (c - sc.aOut) / Math.max(1, nx.aIn - sc.aOut);   // raketten skytes opp i stedet
      else if (c < sc.aIn && pv) d = (sc.aIn - c) / Math.max(1, sc.aIn - pv.aOut);
      return smooth(clamp01(d / 0.35)) * 0.6;
    };
    for (const sc of B === A ? [A] : [A, B]) { const tg = looseTarget(sc); sc.fz = sc.fz === undefined ? tg : sc.fz + (tg - sc.fz) * kP; }
    const fzA = hasA ? A.fz : 0, fzB = hasB ? B.fz : 0, flowing = !REDUCE && (fzA > 0.002 || fzB > 0.002 || !settled);

    const kPos = REDUCE ? 1 : 1 - Math.exp(-dt * (SMALL ? 10 : 8.5)), kFade = REDUCE ? 1 : 1 - Math.exp(-dt * 7);
    const kDir = REDUCE ? 1 : 1 - Math.exp(-dt * 40);
    const repel = FINE && !REDUCE && mouseX > -1e3;
    const jumpX = vw * 0.4, jumpY = vhC * 0.4;

    drawBackground();
    counts.fill(0);
    let nDraw = 0, nGlow = 0, anyShape = false, anyEnv = false;
    const sparkle = !REDUCE && skyDark > 0.5 && GLOW;
    const shapeOn = shapeLive || hasA || hasB;
    const envOn = envLive || A.bg === "night" || B.bg === "night" || A.bg === "blue" || B.bg === "blue";
    for (let k = 0; k < COUNT; k++) {
      const isShape = k < E0;
      if (isShape ? !shapeOn : !envOn) { if (isShape) { k = E0 - 1; continue; } break; }
      let x, y, s, a, r, g, b, direct = 0;
      if (isShape) {
        const j = k, sd = seed[k], sd2 = fract(sd * 7.31);
        if (hasA) shapeInto(A, j, TA);
        if (hasB) shapeInto(B, j, TB);
        // strømmen hver partikkel driver i når figuren løsner (to langsomme bølger per akse)
        let fx = 0, fy = 0, amp = 0, glint = 1;
        if (flowing) {
          fx = Math.sin(T * 0.55 + sd * 47.1) + 0.5 * Math.sin(T * 0.31 + sd2 * 13.7);
          fy = Math.cos(T * 0.47 + sd2 * 39.3) + 0.5 * Math.cos(T * 0.27 + sd * 21.1);
          amp = 2 + 6 * sd2; glint = 0.5 + 0.5 * Math.sin(T * 2.6 + sd * 90);
        }
        if (!hasA && !hasB) { x = px[k]; y = py[k]; s = ps[k]; a = 0; r = pr[k]; g = pg[k]; b = pb[k]; }
        else if (settled) {
          if (hasA) {
            x = TA[0] + fx * amp * fzA; y = TA[1] + fy * amp * fzA; s = TA[2] * (1 - 0.3 * fzA); a = TA[3] * (1 - 0.25 * fzA * glint);
            r = TA[4]; g = TA[5]; b = TA[6]; direct = TA[7];
          } else { x = px[k]; y = py[k]; s = ps[k]; a = 0; r = pr[k]; g = pg[k]; b = pb[k]; }
        } else {
          if (!hasA) { TA.set(TB); if (dustIn) scatter(TA, k); else TA[3] = 0; }
          if (!hasB) { TB.set(TA); if (dustOut) scatter(TB, k); else TB[3] = 0; }
          if (flowing) {                                         // begge figurene er løse i endene av overgangen
            TA[0] += fx * amp * fzA; TA[1] += fy * amp * fzA; TA[2] *= 1 - 0.3 * fzA;
            TB[0] += fx * amp * fzB; TB[1] += fy * amp * fzB; TB[2] *= 1 - 0.3 * fzB;
          }
          // hver partikkel reiser for seg, litt forskjøvet i tid, og driver som støv på veien
          const d = sd * 0.25;
          const mk = REDUCE ? (m < 0.5 ? 0 : 1) : smooth(clamp01((m - d) / 0.75)), sw = Math.sin(Math.PI * mk);
          x = TA[0] + (TB[0] - TA[0]) * mk; y = TA[1] + (TB[1] - TA[1]) * mk;
          s = TA[2] + (TB[2] - TA[2]) * mk;
          // partikler som ikke er med videre tones ut med en gang, og nye kommer først til når de er fremme
          a = TB[3] === 0 ? TA[3] * (1 - smooth(clamp01(mk * 2.2))) : TA[3] === 0 ? TB[3] * smooth(clamp01((mk - 0.55) / 0.45)) : TA[3] + (TB[3] - TA[3]) * mk;
          r = TA[4] + (TB[4] - TA[4]) * mk; g = TA[5] + (TB[5] - TA[5]) * mk; b = TA[6] + (TB[6] - TA[6]) * mk;
          if (!REDUCE && sw > 0) {
            if (spin3) {                                         // skyen dreier én runde rundt sin loddrette akse mens formen skifter
              const rx = lerp(TA[0] - A.cx, TB[0] - B.cx, mk), ry = lerp(TA[1] - A.cy, TB[1] - B.cy, mk), rz = lerp(TA[8], TB[8], mk);
              const th = smooth(mk) * TAU, ct = Math.cos(th), st = Math.sin(th), x3 = rx * ct + rz * st, z3 = -rx * st + rz * ct;
              x = lerp(A.cx, B.cx, mk) + x3; y = lerp(A.cy, B.cy, mk) + ry;
              const depth = clamp01(0.5 + z3 / (vh * 0.6));      // det som er bak, blir mindre og svakere
              s *= (1 - 0.1 * sw) * (0.85 + 0.3 * depth * sw + 0.15 * (1 - sw)); a *= 1 - sw * 0.22 * (1 - depth);
            } else {
              const drift = swarm ? 16 : 10;
              x += sw * drift * fx; y += sw * drift * fy;
              s *= 1 - 0.15 * sw;
            }
            a *= 1 - 0.08 * sw * glint;
          }
          if (mk <= 0) direct = TA[7]; else if (mk >= 1) direct = TB[7];
        }
      } else {
        envInto(A, k, TA);
        if (settled) { x = TA[0]; y = TA[1]; s = TA[2]; a = TA[3]; r = TA[4]; g = TA[5]; b = TA[6]; }
        else {
          envInto(B, k, TB);
          x = lerp(TA[0], TB[0], m); y = lerp(TA[1], TB[1], m); s = lerp(TA[2], TB[2], m); a = lerp(TA[3], TB[3], m);
          r = lerp(TA[4], TB[4], m); g = lerp(TA[5], TB[5], m); b = lerp(TA[6], TB[6], m);
        }
      }
      if (repel) {
        const ex = x - mouseX, ey = y - mouseY, d2 = ex * ex + ey * ey;
        if (d2 < 8100 && d2 > 0.01) { const d = Math.sqrt(d2), f = 1 - d / 90, f2 = f * f; x += (ex * 26 - ey * 16) * f2 / d; y += (ey * 26 + ex * 16) * f2 / d; }   // skyves unna og virvler rundt
      }
      // usynlige prikker dukker opp på stedet, og stjerner som går rundt kanten hopper rett over
      if (pa[k] < 0.03 || px[k] !== px[k] || (!isShape && (Math.abs(x - px[k]) > jumpX || Math.abs(y - py[k]) > jumpY))) {
        px[k] = x; py[k] = y; pr[k] = r; pg[k] = g; pb[k] = b;
      }
      const kp = direct ? kDir : kPos;                       // figurer i ro følger formen, figurer i overgang henger litt etter
      px[k] += (x - px[k]) * kp; py[k] += (y - py[k]) * kp;
      ps[k] += (s - ps[k]) * kFade; pa[k] += (a - pa[k]) * kFade;
      pr[k] += (r - pr[k]) * kFade; pg[k] += (g - pg[k]) * kFade; pb[k] += (b - pb[k]) * kFade;
      if (ps[k] < 0.35 || pa[k] < 0.02) continue;
      if (isShape) anyShape = true; else anyEnv = true;
      if (py[k] < -12 || py[k] > vhC + 12 || px[k] < -12 || px[k] > vw + 12) continue;
      const lvl = Math.min(LEVELS - 1, Math.round(pa[k] * (LEVELS - 1)));
      if (lvl <= 0) continue;
      if (sparkle && seed[k] > 0.985 && pa[k] > 0.3) glowList[nGlow++] = k;
      const key = ((((pr[k] | 0) >> 4) << 8) | (((pg[k] | 0) >> 4) << 4) | ((pb[k] | 0) >> 4)) * LEVELS + lvl;
      keyOf[nDraw] = key; order[nDraw++] = k; counts[key]++;
    }
    if (shapeOn) shapeLive = anyShape;
    if (envOn) envLive = anyEnv;
    let acc = 0;
    for (let q = 0; q < KEYS; q++) { starts[q] = acc; acc += counts[q]; }
    for (let q = 0; q < nDraw; q++) sorted[starts[keyOf[q]]++] = order[q];
    for (let key = 0, q0 = 0; key < KEYS && q0 < nDraw; key++) {
      const n = counts[key];
      if (!n) continue;
      ctx.globalAlpha = (key % LEVELS) / (LEVELS - 1);
      ctx.fillStyle = colStr((key / LEVELS) | 0);
      ctx.beginPath();
      for (let q = q0; q < q0 + n; q++) {
        const k = sorted[q], rad = ps[k] / 2;
        if (rad < 1.15) ctx.rect(px[k] - rad * 0.9, py[k] - rad * 0.9, rad * 1.8, rad * 1.8);
        else { ctx.moveTo(px[k] + rad, py[k]); ctx.arc(px[k], py[k], rad, 0, TAU); }
      }
      ctx.fill();
      q0 += n;
    }
    if (nGlow) {                                             // gnistene lyser opp det som ligger under
      ctx.globalCompositeOperation = "lighter";
      for (let q = 0; q < nGlow; q++) {
        const k = glowList[q], r = 2 + ps[k] * 2.6;
        ctx.globalAlpha = Math.min(1, pa[k]) * (0.22 + 0.14 * Math.sin(T * 2.1 + seed[k] * 80));
        ctx.drawImage(GLOW.cv, px[k] - r, py[k] - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = 1;
    drawClouds(true);                                        // skylaget vi flyr gjennom ligger foran figurene
  }

  /* ---------- oppstart ---------- */
  function init() {
    layout();
    GLOW = layerCanvas(48, 48, 1);                             // myk glød til gnistene
    const gg = GLOW.g.createRadialGradient(24, 24, 0, 24, 24, 24);
    gg.addColorStop(0, "rgba(255,255,255,0.9)"); gg.addColorStop(0.25, "rgba(210,222,255,0.32)"); gg.addColorStop(1, "rgba(160,180,255,0)");
    GLOW.g.fillStyle = gg; GLOW.g.fillRect(0, 0, 48, 48);
    for (let k = 0; k < COUNT; k++) { px[k] = vw * seed[k]; py[k] = vh * 0.5; ps[k] = 0; pa[k] = 0; pr[k] = pg[k] = pb[k] = 255; }
    requestAnimationFrame(frame);
  }
  let rt = 0, lastW = window.innerWidth;
  function relayout() { clearTimeout(rt); rt = setTimeout(layout, 150); }
  window.addEventListener("resize", () => { if (SMALL && window.innerWidth === lastW) return; lastW = window.innerWidth; relayout(); });
  if ("ResizeObserver" in window) new ResizeObserver(relayout).observe(document.body);
  window.addEventListener("load", relayout);
  if (FINE) {
    window.addEventListener("pointermove", (e) => { mouseX = e.clientX; mouseY = e.clientY; }, { passive: true });
    document.addEventListener("pointerleave", () => { mouseX = mouseY = -1e4; });
  }
  const fontReady = document.fonts && document.fonts.load
    ? Promise.race([document.fonts.load('700 100px "Oswald"'), new Promise((r) => setTimeout(r, 1200))])
    : Promise.resolve();
  fontReady.then(init, init);
})();
