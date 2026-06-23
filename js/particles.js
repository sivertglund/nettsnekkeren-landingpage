// ============================================================================
// NOVA — WebGL particle morph system (Three.js, global UMD build r147)
// A point cloud that forms shapes and explodes/reassembles as you scroll.
// Classic script (no ES module) so it runs from file:// without a server.
// ============================================================================
(function () {
"use strict";
if (!window.THREE) { console.error("THREE not loaded"); return; }
const THREE = window.THREE;

// coarse pointer OR small screen = phone/tablet → lighter everything
const IS_MOBILE = window.matchMedia("(max-width: 768px)").matches || window.matchMedia("(pointer: coarse)").matches;
const COUNT = IS_MOBILE ? 9000 : 24000;
const RADIUS = 1.7;
const SPREAD = 0.8; // how far particles fly apart mid-transition (calm, less chaos)

// ---------- shape generators (return Float32Array length COUNT*3) ----------
function rand(a, b) { return a + Math.random() * (b - a); }

function box(out, i, x0, x1, y0, y1, z0, z1) {
  out[i*3] = rand(x0, x1); out[i*3+1] = rand(y0, y1); out[i*3+2] = rand(z0, z1);
}

// 1) ICOSAHEDRON — futuristic wireframe crystal (particles along the edges)
function fillIcosa() {
  const t = (1 + Math.sqrt(5)) / 2;
  let V = [[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],
           [0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]];
  const s = (RADIUS * 1.15) / Math.sqrt(1 + t * t);
  V = V.map((v) => [v[0]*s, v[1]*s, v[2]*s]);
  const edgeLen = 2 * s, edges = [];
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) {
    const dx=V[i][0]-V[j][0], dy=V[i][1]-V[j][1], dz=V[i][2]-V[j][2];
    if (Math.abs(Math.sqrt(dx*dx+dy*dy+dz*dz) - edgeLen) < edgeLen * 0.08) edges.push([i, j]);
  }
  const a = new Float32Array(COUNT * 3);
  for (let k = 0; k < COUNT; k++) {
    // 82% on edges (wireframe), 18% loosely inside for depth
    if (Math.random() < 0.82) {
      const e = edges[(Math.random() * edges.length) | 0];
      const A = V[e[0]], B = V[e[1]], tt = Math.random(), n = 0.035;
      a[k*3]   = A[0] + (B[0]-A[0])*tt + rand(-n,n);
      a[k*3+1] = A[1] + (B[1]-A[1])*tt + rand(-n,n);
      a[k*3+2] = A[2] + (B[2]-A[2])*tt + rand(-n,n);
    } else {
      const vv = V[(Math.random()*12)|0], f = rand(0, 0.85);
      a[k*3] = vv[0]*f; a[k*3+1] = vv[1]*f; a[k*3+2] = vv[2]*f;
    }
  }
  return a;
}

// torus — clean glowing ring facing the camera
function fillTorus() {
  const a = new Float32Array(COUNT * 3);
  const R = 1.25, r = 0.4;
  for (let i = 0; i < COUNT; i++) {
    const u = rand(0, Math.PI * 2), v = rand(0, Math.PI * 2);
    const rr = r * (0.82 + Math.random() * 0.18);
    a[i*3]   = (R + rr * Math.cos(v)) * Math.cos(u);
    a[i*3+1] = (R + rr * Math.cos(v)) * Math.sin(u);
    a[i*3+2] = rr * Math.sin(v);
  }
  return a;
}

// spiral galaxy — flat tilted disk with curved arms (futuristic)
function fillGalaxy() {
  const a = new Float32Array(COUNT * 3);
  const ARMS = 3, SPIN = 2.3, tilt = 0.55;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  for (let i = 0; i < COUNT; i++) {
    const t = Math.pow(Math.random(), 0.55);   // denser toward the core
    const radius = t * 1.95;
    const arm = ((Math.random() * ARMS) | 0) / ARMS * Math.PI * 2;
    const ang = arm + radius * SPIN + rand(-0.22, 0.22) * (1.1 - t * 0.6);
    const thick = (1 - t) * 0.16 + 0.015;
    let x = Math.cos(ang) * radius + rand(-thick, thick);
    let y = Math.sin(ang) * radius + rand(-thick, thick);
    let z = rand(-thick, thick) * 1.3;
    // tilt the disk around the X axis so it reads as a 3D galaxy
    const ny = y * ct - z * st, nz = y * st + z * ct;
    a[i*3] = x; a[i*3+1] = ny; a[i*3+2] = nz;
  }
  return a;
}

// sphere shell — clean orb
function fillSphere() {
  const a = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1);
    const r = RADIUS * Math.cbrt(rand(0.55, 1));
    a[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    a[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    a[i*3+2] = r * Math.cos(phi);
  }
  return a;
}

// INFINITY — a lemniscate ribbon (∞): two founders, one endless loop
function fillInfinity() {
  const a = new Float32Array(COUNT * 3);
  const A = 2.5;
  for (let i = 0; i < COUNT; i++) {
    const t = rand(0, Math.PI * 2);
    const s = Math.sin(t), c = Math.cos(t), d = 1 + s * s;
    const x = A * c / d;
    const y = A * s * c / d * 1.7;           // stretch the loops vertically a touch
    const tube = 0.11;
    a[i*3]   = x + rand(-tube, tube);
    a[i*3+1] = y + rand(-tube, tube);
    a[i*3+2] = Math.sin(t * 2) * 0.28 + rand(-tube, tube);  // gentle 3D ribbon twist
  }
  return a;
}

// WORMHOLE — a straight cylindrical tunnel the camera sits INSIDE and is dragged through
function fillWormhole() {
  const a = new Float32Array(COUNT * 3);
  const NEAR = 7.0, FAR = -15.0, R = 2.2;    // extends well past the camera (z=5.4) so we're inside it
  for (let i = 0; i < COUNT; i++) {
    const ang = Math.random() * Math.PI * 2;
    const z = rand(FAR, NEAR);
    // concentric rings down the tube (no swirl) — reads as travel, not spin
    const r = R + Math.sin(z * 0.9) * 0.16 + rand(-0.14, 0.14);
    a[i*3]   = Math.cos(ang) * r;
    a[i*3+1] = Math.sin(ang) * r;
    a[i*3+2] = z;
  }
  return a;
}

// COSMIC WEB — clustered galaxies linked by a spanning tree of filaments, with voids
// (clusters + minimum spanning tree + a few loops = realistic branching large-scale structure)
function fillCosmicWeb() {
  const a = new Float32Array(COUNT * 3);
  const NODES = 300;
  const RX = 5.0, RY = 3.6, RZ = 1.4;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const clampN = (v, r) => Math.max(-r, Math.min(r, v));

  // 1) clusters spread across the whole frame on a jittered grid (structure everywhere + voids between)
  const GX = 7, GY = 5, cseeds = [];
  for (let gx = 0; gx < GX; gx++) for (let gy = 0; gy < GY; gy++) {
    cseeds.push([
      (gx / (GX - 1) - 0.5) * 2 * RX + gauss() * 0.7,
      (gy / (GY - 1) - 0.5) * 2 * RY + gauss() * 0.6,
      rand(-RZ, RZ),
    ]);
  }
  const CLUSTERS = cseeds.length;
  const nodes = [];
  for (let i = 0; i < NODES; i++) {
    if (Math.random() < 0.82) {                     // clustered around a grid cluster
      const c = cseeds[Math.random() * CLUSTERS | 0];
      nodes.push([clampN(c[0]+gauss()*1.15, RX), clampN(c[1]+gauss()*0.95, RY), clampN(c[2]+gauss()*0.5, RZ)]);
    } else {                                        // field galaxies in the voids
      nodes.push([rand(-RX,RX), rand(-RY,RY), rand(-RZ,RZ)]);
    }
  }
  const dist2 = (i, j) => { const dx=nodes[i][0]-nodes[j][0], dy=nodes[i][1]-nodes[j][1], dz=nodes[i][2]-nodes[j][2]; return dx*dx+dy*dy+dz*dz; };

  // 2) minimum spanning tree (Prim) -> filaments branch naturally
  const seen = new Set(), E = [], deg = new Array(NODES).fill(0);
  const addEdge = (i, j) => { const k = Math.min(i,j)+"-"+Math.max(i,j); if (i!==j && !seen.has(k)) { seen.add(k); E.push([i, j]); deg[i]++; deg[j]++; } };
  const inT = new Array(NODES).fill(false), md = new Array(NODES).fill(Infinity), par = new Array(NODES).fill(-1);
  md[0] = 0;
  for (let it = 0; it < NODES; it++) {
    let u = -1, best = Infinity;
    for (let v = 0; v < NODES; v++) if (!inT[v] && md[v] < best) { best = md[v]; u = v; }
    if (u < 0) break;
    inT[u] = true;
    if (par[u] >= 0) addEdge(u, par[u]);
    for (let v = 0; v < NODES; v++) if (!inT[v]) { const dd = dist2(u, v); if (dd < md[v]) { md[v] = dd; par[v] = u; } }
  }
  // 3) a few extra short links -> loops (the web isn't a pure tree)
  for (let i = 0; i < NODES; i++) if (Math.random() < 0.45) {
    let bj = -1, bd = Infinity;
    for (let j = 0; j < NODES; j++) if (j !== i && j !== par[i] && par[j] !== i) { const dd = dist2(i, j); if (dd < bd) { bd = dd; bj = j; } }
    if (bj >= 0 && bd < 2.4) addEdge(i, bj);
  }

  // allocation weighted by filament length (even thread density) and node degree (bright hubs)
  const elen = E.map((e) => Math.sqrt(dist2(e[0], e[1])));
  let totalLen = 0; for (const l of elen) totalLen += l;
  const nodeW = deg.map((d) => 0.3 + d * d * 0.5);
  let totalW = 0; for (const w of nodeW) totalW += w;
  const mids = E.map(() => [rand(-0.14,0.14), rand(-0.14,0.14), rand(-0.08,0.08)]);

  for (let p = 0; p < COUNT; p++) {
    if (Math.random() < 0.13) {                     // bright cluster knot (weighted by degree)
      let w = Math.random() * totalW, ni = 0; while (ni < NODES-1 && (w -= nodeW[ni]) > 0) ni++;
      const n = nodes[ni], spread = 0.04 + Math.min(deg[ni], 6) * 0.03;
      const rr = Math.pow(Math.random(), 2.4) * spread;
      const th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1);
      a[p*3]   = n[0] + rr*Math.sin(ph)*Math.cos(th);
      a[p*3+1] = n[1] + rr*Math.sin(ph)*Math.sin(th);
      a[p*3+2] = n[2] + rr*Math.cos(ph);
    } else {                                        // thin glowing filament thread
      let w = Math.random() * totalLen, ei = 0; while (ei < E.length-1 && (w -= elen[ei]) > 0) ei++;
      const e = E[ei], A = nodes[e[0]], B = nodes[e[1]], M = mids[ei];
      const u = Math.random(), iu = 1 - u;
      const mx=(A[0]+B[0])/2+M[0], my=(A[1]+B[1])/2+M[1], mz=(A[2]+B[2])/2+M[2];
      const bx = iu*iu*A[0] + 2*iu*u*mx + u*u*B[0];
      const by = iu*iu*A[1] + 2*iu*u*my + u*u*B[1];
      const bz = iu*iu*A[2] + 2*iu*u*mz + u*u*B[2];
      const tube = 0.011 + 0.052 * (1 - Math.abs(u-0.5)*2);  // thin, fatter near the nodes
      a[p*3]   = bx + gauss() * tube;
      a[p*3+1] = by + gauss() * tube;
      a[p*3+2] = bz + gauss() * tube * 0.6;
    }
  }
  return a;
}

// wave grid — undulating plane of points
function fillWaveGrid() {
  const a = new Float32Array(COUNT * 3);
  const side = Math.ceil(Math.sqrt(COUNT));
  for (let i = 0; i < COUNT; i++) {
    const gx = (i % side) / side - 0.5;
    const gz = Math.floor(i / side) / side - 0.5;
    const x = gx * 4.6, z = gz * 4.6;
    const y = Math.sin(x * 1.5) * Math.cos(z * 1.5) * 0.75;
    a[i*3] = x; a[i*3+1] = y; a[i*3+2] = z;
  }
  return a;
}

// RING / nebula — loose dispersed cloud for the contact panel
function fillRing() {
  const a = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const t = rand(0, Math.PI * 2);
    const rr = RADIUS * rand(0.7, 1.25);
    const x = Math.cos(t) * rr, y = Math.sin(t) * rr * 0.62;
    a[i*3]   = x + rand(-0.5, 0.5);
    a[i*3+1] = y + rand(-0.5, 0.5);
    a[i*3+2] = rand(-1.1, 1.1);
  }
  return a;
}

const SHAPES = [fillSphere(), fillTorus(), fillGalaxy(), fillInfinity(), fillWormhole(), fillCosmicWeb()];

// ---------- per-particle attributes ----------
const colors = new Float32Array(COUNT * 3);
const dirs   = new Float32Array(COUNT * 3); // explosion direction
const seeds  = new Float32Array(COUNT);
const scales = new Float32Array(COUNT);     // per-particle grain size (varied)
// less white overall; more blue/gold, a few dim greys (calmer palette)
const C_WHITE = [0.82, 0.85, 0.92], C_BLUE = [0.27, 0.52, 1.0], C_ORANGE = [1.0, 0.6, 0.2], C_DIM = [0.4, 0.42, 0.5];
for (let i = 0; i < COUNT; i++) {
  const r = Math.random();
  const c = r < 0.34 ? C_WHITE : r < 0.64 ? C_BLUE : r < 0.86 ? C_ORANGE : C_DIM;
  colors[i*3] = c[0]; colors[i*3+1] = c[1]; colors[i*3+2] = c[2];
  // random unit direction
  const t = Math.random() * Math.PI * 2, ph = Math.acos(2*Math.random()-1);
  dirs[i*3] = Math.sin(ph)*Math.cos(t); dirs[i*3+1] = Math.sin(ph)*Math.sin(t); dirs[i*3+2] = Math.cos(ph);
  seeds[i] = Math.random() * 100;
  // mostly small grains, only a few slightly bigger (smaller overall)
  scales[i] = 0.45 + Math.pow(Math.random(), 3.5) * 1.9;
}

// ---------- three.js setup ----------
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_MOBILE, alpha: true, powerPreference: "high-performance" });
// cap resolution hard on mobile — additive blending over many big points is fill-rate bound
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 0, 5.4);

// main morphing cloud
const positions = new Float32Array(SHAPES[0]); // start on shape 0
const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));

// shared cursor uniforms — the shader pushes points away from the pointer in
// SCREEN space, so both the figure and the stars reshape around the cursor.
const uCursor = { value: new THREE.Vector2(99, 99) };
const uRadius = { value: 0.13 };   // influence radius in NDC (cursor void)
const uPush   = { value: 0.10 };   // how far points are pushed
const uAspect = { value: 1.0 };

const mat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uSize: { value: renderer.getPixelRatio() * (window.innerHeight / 1000) * 11 },
    uCursor, uRadius, uPush, uAspect,
    uOpacity: { value: 1.0 },
  },
  vertexShader: `
    attribute vec3 color;
    attribute float aScale;
    varying vec3 vColor;
    uniform float uSize;
    uniform vec2 uCursor;
    uniform float uRadius;
    uniform float uPush;
    uniform float uAspect;
    void main() {
      vColor = color;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec4 clip = projectionMatrix * mv;
      // screen-space repel from the pointer
      vec2 ndc = clip.xy / clip.w;
      vec2 diff = (ndc - uCursor) * vec2(uAspect, 1.0);
      float dist = length(diff);
      float infl = smoothstep(uRadius, 0.0, dist);
      ndc += (dist > 0.0001 ? normalize(diff) / vec2(uAspect, 1.0) : vec2(0.0)) * infl * uPush;
      clip.xy = ndc * clip.w;
      gl_Position = clip;
      gl_PointSize = min(uSize * aScale * (1.0 / -mv.z), 64.0);
    }`,
  fragmentShader: `
    varying vec3 vColor;
    uniform float uOpacity;
    void main() {
      vec2 d = gl_PointCoord - vec2(0.5);
      float dist = length(d);
      if (dist > 0.5) discard;
      float a = smoothstep(0.5, 0.0, dist);
      gl_FragColor = vec4(vColor, a * 0.9 * uOpacity);
    }`,
});
const points = new THREE.Points(geo, mat);
scene.add(points);

// background starfield (drifts slowly, reshapes around the cursor via shared shader)
const STAR = 2300;
const starPos = new Float32Array(STAR * 3);
const starCol = new Float32Array(STAR * 3);
const starScl = new Float32Array(STAR);
for (let i = 0; i < STAR; i++) {
  starPos[i*3]   = rand(-14, 14);
  starPos[i*3+1] = rand(-9, 9);
  starPos[i*3+2] = rand(-10, 2);
  const r = Math.random();
  const c = r < 0.45 ? C_WHITE : r < 0.72 ? C_BLUE : r < 0.9 ? C_ORANGE : C_DIM;
  starCol[i*3]=c[0]; starCol[i*3+1]=c[1]; starCol[i*3+2]=c[2];
  starScl[i] = 0.55 + Math.pow(Math.random(), 3) * 2.0;  // smaller, only a few bigger
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute("color", new THREE.BufferAttribute(starCol, 3));
starGeo.setAttribute("aScale", new THREE.BufferAttribute(starScl, 1));
const starMat = mat.clone();
// share the cursor uniforms so stars repel from the pointer too; bigger push for stars
starMat.uniforms.uSize   = { value: renderer.getPixelRatio() * 7.5 };
starMat.uniforms.uCursor = uCursor;
starMat.uniforms.uRadius = uRadius;
starMat.uniforms.uPush   = { value: 0.16 };
starMat.uniforms.uAspect = uAspect;
const stars = new THREE.Points(starGeo, starMat);
stars.position.z = -3;
scene.add(stars);
const starBaseZ = -3;

const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- SATELLITES — single white dots with a little comet tail, orbiting the sphere ----------
const SAT_SPHERE_R = 1.5;          // sphere silhouette radius for occlusion (hide when behind)
const TAIL = 18;                   // points per satellite (head + trailing tail)
const SAT_ORBITS = [
  { R: 2.4,  tilt: 0.35, speed: 0.42, dir: 1,  phase: 0.0 },
  { R: 2.8,  tilt: -0.7, speed: 0.30, dir: -1, phase: 2.2 },
  { R: 2.1,  tilt: 1.15, speed: 0.55, dir: 1,  phase: 4.1 },
];
const sats = SAT_ORBITS.map((o) => {
  const pos = new Float32Array(TAIL * 3);
  const col = new Float32Array(TAIL * 3);
  const scl = new Float32Array(TAIL);
  for (let k = 0; k < TAIL; k++) {
    const f = k / (TAIL - 1);                 // 0 head -> 1 tail
    const b = Math.pow(1 - f, 1.4);           // white head fading to dark tail
    col[k*3] = b; col[k*3+1] = b; col[k*3+2] = b;
    scl[k] = 1.9 * (1 - f) + 0.25;            // head a bit bigger than normal grains, tail small
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aScale", new THREE.BufferAttribute(scl, 1));
  const m = mat.clone();
  m.uniforms.uSize = { value: renderer.getPixelRatio() * (window.innerHeight / 1000) * 11 };
  m.uniforms.uCursor = uCursor; m.uniforms.uRadius = uRadius; m.uniforms.uAspect = uAspect;
  m.uniforms.uPush = { value: 0.04 }; m.uniforms.uOpacity = { value: 0 };
  const pts = new THREE.Points(g, m);
  scene.add(pts);
  return { o, g, m, pos, hist: [] };
});

// ---------- sizing ----------
let lastW = 0, lastH = 0;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  // On phones the URL bar collapsing/expanding changes ONLY the height and would
  // otherwise re-size the renderer on every scroll frame → the stutter you saw.
  // Ignore pure-height jitter; only react to real changes (orientation / width).
  if (IS_MOBILE && lastW === w && Math.abs(h - lastH) < 140) return;
  lastW = w; lastH = h;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  mat.uniforms.uSize.value = renderer.getPixelRatio() * (h / 1000) * 11;
  for (const s of sats) s.m.uniforms.uSize.value = renderer.getPixelRatio() * (h / 1000) * 11;
  uAspect.value = w / h;
}
window.addEventListener("resize", resize);
resize();

// ---------- state driven by scroll ----------
let progress = 0;       // 0..1 over whole page
let targetProgress = 0;
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener("pointermove", (e) => {
  mouse.tx = (e.clientX / window.innerWidth - 0.5);
  mouse.ty = (e.clientY / window.innerHeight - 0.5);
});

const easeInOut = (t) => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
const segCount = SHAPES.length - 1;

// HOLD = how long each figure stays fully formed before/after morphing.
// Bigger = figures linger longer; the actual transition happens in the middle.
const HOLD = 0.08;
function holdRamp(t) {
  if (t <= HOLD) return 0;             // brief rest on shape A
  if (t >= 1 - HOLD) return 1;         // brief rest on shape B
  return (t - HOLD) / (1 - 2 * HOLD);  // transition window (most of the segment)
}
const BASE_Z = 5.4;
let camZ = BASE_Z;

// per-figure idle motion — SUBTLE: tiny float + slow spin, each shape its own way.
// (the big movement comes from scroll, handled separately below.)
const mo = { px: 0, py: 0, rz: 0, rx: 0 };
let spin = 0;
function motionTarget(idx, t) {
  switch (idx) {
    case 0: return { px: Math.sin(t*0.3)*0.08, py: Math.sin(t*0.5)*0.05, rz: Math.sin(t*0.3)*0.03, rx: 0, spin: 0.04 }; // sphere — slow turn
    case 1: return { px: Math.cos(t*0.3)*0.07, py: Math.sin(t*0.4)*0.06, rz: 0, rx: Math.sin(t*0.25)*0.06, spin: 0.10 }; // torus
    case 2: return { px: Math.sin(t*0.28)*0.09, py: Math.cos(t*0.36)*0.06, rz: 0, rx: 0.4, spin: 0.16 }; // galaxy — tilted spin
    case 3: return { px: Math.sin(t*0.3)*0.07, py: Math.cos(t*0.34)*0.05, rz: 0, rx: Math.sin(t*0.26)*0.1, spin: 0.07 }; // infinity — slow tumble
    case 4: return { px: 0, py: 0, rz: 0, rx: 0, spin: 0 }; // wormhole — perfectly still; we travel through it via the camera
    default:return { px: Math.sin(t*0.14)*0.05, py: Math.cos(t*0.17)*0.04, rz: 0, rx: 0, spin: 0 }; // cosmic web — face-on, no spin
  }
}
const _v = new THREE.Vector3(); // reused for star projection

const clock = new THREE.Clock();
let prevTime = 0;
function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();
  const dt = Math.min(time - prevTime, 0.05);
  prevTime = time;

  // smooth toward target scroll progress (lower = slower, heavier, smoother morph)
  progress += (targetProgress - progress) * 0.02;
  mouse.x += (mouse.tx - mouse.x) * 0.04;
  mouse.y += (mouse.ty - mouse.y) * 0.04;

  // which segment + local t
  const seg = Math.min(Math.floor(progress * segCount), segCount - 1);
  const localT = progress * segCount - seg;
  const A = SHAPES[seg], B = SHAPES[seg + 1];
  const morphT = holdRamp(localT);           // figures linger, then transition
  const disp = Math.sin(Math.PI * morphT);   // 0 while resting, 1 mid-transition
  const disp2 = disp * disp;
  const e = easeInOut(morphT);

  const pos = geo.attributes.position.array;
  for (let i = 0; i < COUNT; i++) {
    const ix = i*3, iy = ix+1, iz = ix+2;
    // base interpolation between shapes
    let x = A[ix] + (B[ix] - A[ix]) * e;
    let y = A[iy] + (B[iy] - A[iy]) * e;
    let z = A[iz] + (B[iz] - A[iz]) * e;
    // gentle outward drift at mid-transition (smooth, not violent)
    const s = seeds[i];
    const swirl = disp * SPREAD * (0.8 + 0.2 * Math.sin(s + time * 0.6));
    x += dirs[ix] * swirl;
    y += dirs[iy] * swirl;
    z += dirs[iz] * swirl;
    // subtle idle breathing when settled
    const breathe = (1 - disp) * 0.04;
    x += Math.sin(time * 0.8 + s) * breathe;
    y += Math.cos(time * 0.7 + s) * breathe;
    pos[ix] = x; pos[iy] = y; pos[iz] = z;
  }
  geo.attributes.position.needsUpdate = true;

  // ---- subtle idle motion + BIG scroll-driven slide across the screen ----
  const domIdx = Math.max(0, Math.min(SHAPES.length - 1, Math.round(progress * segCount)));
  const settle = 1 - disp;                 // 1 at rest, 0 mid-transition
  const m = motionTarget(domIdx, time);
  mo.px += (m.px * settle - mo.px) * 0.025;
  mo.py += (m.py * settle - mo.py) * 0.025;
  mo.rz += (m.rz * settle - mo.rz) * 0.025;
  mo.rx += (m.rx * settle - mo.rx) * 0.025;
  spin += m.spin * settle * dt;            // slow spin, only while settled

  // figure drifts gently sideways as it dissolves on scroll — but the whole wormhole
  // approach (forming the tube AND flying through it) stays dead-centred, no slide.
  const dir = (seg % 2 === 0) ? 1 : -1;
  const noSlide = (seg === 3 || seg === 4);
  const slideX = noSlide ? 0 : disp * 0.9 * dir;
  const slideY = noSlide ? 0 : disp * 0.28 * ((seg % 2 === 0) ? -1 : 1);

  // How strongly the tube must sit straight on its axis (0 = free idle motion, 1 = locked).
  // Ramp it in WHILE the tunnel forms in seg 3 (not after), and hold it through the
  // fly-through in seg 4 — so the cylinder is never seen tilted / from the side.
  const align = seg === 4 ? 1 : seg === 3 ? Math.min(1, e * 1.6) : 0;
  const free = 1 - align;
  points.position.x = (mo.px + slideX) * free;
  points.position.y = (mo.py + slideY) * free;
  points.rotation.y = (spin + mouse.x * 0.5) * free;
  points.rotation.x = (mo.rx + mouse.y * 0.25) * free;
  points.rotation.z = mo.rz * free;

  // ---- pointer reshapes everything via the shader (screen-space repel) ----
  uCursor.value.set(mouse.x * 2, -mouse.y * 2);  // cursor in NDC

  // ---- SATELLITES: white dot + comet tail, hidden when behind the sphere ----
  const satHero = 1 - smoothstep(0.04, 0.16, progress);   // only on the hero
  for (let si = 0; si < sats.length; si++) {
    const s = sats[si], o = s.o, ang = time * o.speed * o.dir + o.phase;
    const ox = Math.cos(ang) * o.R, oz = Math.sin(ang) * o.R;
    const hx = points.position.x + ox;
    const hy = points.position.y + oz * Math.sin(o.tilt);
    const hz = oz * Math.cos(o.tilt);
    // occlusion: hide while the head is behind the sphere silhouette
    const behind = hz < 0 && Math.hypot(hx - points.position.x, hy - points.position.y) < SAT_SPHERE_R;
    const target = behind ? 0 : satHero;
    s.m.uniforms.uOpacity.value += (target - s.m.uniforms.uOpacity.value) * 0.18;
    // push new head into the trail history (newest first)
    s.hist.unshift([hx, hy, hz]);
    if (s.hist.length > TAIL) s.hist.pop();
    for (let k = 0; k < TAIL; k++) {
      const h = s.hist[k] || s.hist[s.hist.length - 1];
      s.pos[k*3] = h[0]; s.pos[k*3+1] = h[1]; s.pos[k*3+2] = h[2];
    }
    s.g.attributes.position.needsUpdate = true;
  }

  // ---- camera: same gentle ease on every transition. NO deep dive on the wormhole —
  // diving past z=0 made lookAt flip and you saw the tube from outside (the stutter).
  // Staying at +z keeps us INSIDE the loophole, always looking forward into it.
  const targetZ = BASE_Z - disp * 1.5;
  camZ += (targetZ - camZ) * 0.05;
  camera.position.z = camZ;
  // center the camera on the tube's axis as it forms (free elsewhere) — same `align`
  camera.position.x += (mouse.x * 0.55 * free - camera.position.x) * 0.04;
  camera.position.y += (-mouse.y * 0.35 * free - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);

  // ---- starfield: gentle pointer parallax + slow drift ----
  stars.rotation.y = time * 0.005;
  stars.position.x += ((-mouse.x * 2.4) - stars.position.x) * 0.04;
  stars.position.y += ((mouse.y * 1.6) - stars.position.y) * 0.04;
  stars.position.z = starBaseZ;

  renderer.render(scene, camera);
}
animate();

// ---------- public API for main.js ----------
window.NOVA = {
  setProgress: function (p) { targetProgress = Math.max(0, Math.min(1, p)); },
  getProgress: function () { return progress; },
  ready: true,
};
window.dispatchEvent(new Event("nova:ready"));

})();
