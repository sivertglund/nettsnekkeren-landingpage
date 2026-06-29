// ============================================================================
// NOVA — subpage ambient particle field (Three.js, global UMD build r147)
// Same grain/glow style as the front page, but a calm DRIFTING FLOW FIELD that
// lives behind the content: particles stream along a smooth procedural flow,
// twinkle, react to the cursor (desktop) and parallax gently with scroll.
// ============================================================================
(function () {
"use strict";
if (!window.THREE) { console.error("THREE not loaded"); return; }
const THREE = window.THREE;

const IS_MOBILE = window.matchMedia("(max-width: 768px)").matches || window.matchMedia("(pointer: coarse)").matches;
const COUNT = IS_MOBILE ? 3200 : 6500;

// field box (wider/taller than the view so wrap-around happens off-screen — no popping)
const HX = 9.0, HY = 6.5, HZ = 3.0;

const rand = (a, b) => a + Math.random() * (b - a);

const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_MOBILE, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.3 : 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 0, 7);

// ---------- particles ----------
const positions = new Float32Array(COUNT * 3);
const colors    = new Float32Array(COUNT * 3);
const scales    = new Float32Array(COUNT);
const seeds     = new Float32Array(COUNT);
// calm palette — matches the front page (more blue/gold, some white, a few dim greys)
const C_WHITE = [0.82, 0.85, 0.92], C_BLUE = [0.27, 0.52, 1.0], C_ORANGE = [1.0, 0.6, 0.2], C_DIM = [0.4, 0.42, 0.5];
for (let i = 0; i < COUNT; i++) {
  positions[i*3]   = rand(-HX, HX);
  positions[i*3+1] = rand(-HY, HY);
  positions[i*3+2] = rand(-HZ, HZ);
  const r = Math.random();
  const c = r < 0.34 ? C_WHITE : r < 0.64 ? C_BLUE : r < 0.86 ? C_ORANGE : C_DIM;
  colors[i*3] = c[0]; colors[i*3+1] = c[1]; colors[i*3+2] = c[2];
  scales[i] = 0.5 + Math.pow(Math.random(), 3.2) * 2.0;   // mostly small, a few bigger
  seeds[i] = Math.random();
}
const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

const uCursor = { value: new THREE.Vector2(99, 99) };
const uRadius = { value: 0.16 };
const uPush   = { value: IS_MOBILE ? 0.0 : 0.12 };   // no pointer repel on touch
const uAspect = { value: 1.0 };
const uTime   = { value: 0.0 };

const mat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uSize: { value: renderer.getPixelRatio() * (window.innerHeight / 1000) * 10 },
    uCursor, uRadius, uPush, uAspect, uTime,
    uOpacity: { value: 0.9 },
  },
  vertexShader: `
    attribute vec3 color;
    attribute float aScale;
    attribute float aSeed;
    varying vec3 vColor;
    varying float vTw;
    uniform float uSize;
    uniform float uTime;
    uniform vec2 uCursor;
    uniform float uRadius;
    uniform float uPush;
    uniform float uAspect;
    void main() {
      vColor = color;
      // gentle twinkle, each grain on its own phase
      float tw = 0.55 + 0.45 * sin(uTime * 1.4 + aSeed * 6.2831);
      vTw = tw;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec4 clip = projectionMatrix * mv;
      vec2 ndc = clip.xy / clip.w;
      vec2 diff = (ndc - uCursor) * vec2(uAspect, 1.0);
      float dist = length(diff);
      float infl = smoothstep(uRadius, 0.0, dist);
      ndc += (dist > 0.0001 ? normalize(diff) / vec2(uAspect, 1.0) : vec2(0.0)) * infl * uPush;
      clip.xy = ndc * clip.w;
      gl_Position = clip;
      gl_PointSize = min(uSize * aScale * tw * (1.0 / -mv.z), 64.0);
    }`,
  fragmentShader: `
    varying vec3 vColor;
    varying float vTw;
    uniform float uOpacity;
    void main() {
      vec2 d = gl_PointCoord - vec2(0.5);
      float dist = length(d);
      if (dist > 0.5) discard;
      float a = smoothstep(0.5, 0.0, dist);
      gl_FragColor = vec4(vColor, a * uOpacity * vTw);
    }`,
});
const points = new THREE.Points(geo, mat);
scene.add(points);

// ---------- sizing ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 1 ? Math.min(72, 50 / camera.aspect) : 50;
  camera.updateProjectionMatrix();
  mat.uniforms.uSize.value = renderer.getPixelRatio() * (h / 1000) * 10;
  uAspect.value = w / h;
}
window.addEventListener("resize", resize);
resize();

// ---------- input ----------
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
if (!IS_MOBILE) {
  window.addEventListener("pointermove", (e) => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5);
    mouse.ty = (e.clientY / window.innerHeight - 0.5);
  });
}
let scrollY = 0, targetScroll = 0;
function onScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  targetScroll = max > 0 ? window.scrollY / max : 0;
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// ---------- animate ----------
const clock = new THREE.Clock();
let prev = 0;
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const dt = Math.min(t - prev, 0.05);
  prev = t;
  uTime.value = t;

  mouse.x += (mouse.tx - mouse.x) * 0.05;
  mouse.y += (mouse.ty - mouse.y) * 0.05;
  scrollY += (targetScroll - scrollY) * 0.06;

  // drift each grain along a smooth flow field, wrap inside the box
  const pos = geo.attributes.position.array;
  for (let i = 0; i < COUNT; i++) {
    const ix = i*3, iy = ix+1, iz = ix+2;
    let x = pos[ix], y = pos[iy], z = pos[iz];
    const vx = Math.sin(y * 0.25 + t * 0.25) * 0.42 + 0.16;   // wave + slow rightward drift
    const vy = Math.cos(x * 0.22 - t * 0.20) * 0.36 + 0.05;
    const vz = Math.sin((x + y) * 0.15 + t * 0.18) * 0.12;
    x += vx * dt; y += vy * dt; z += vz * dt;
    if (x >  HX) x = -HX; else if (x < -HX) x = HX;
    if (y >  HY) y = -HY; else if (y < -HY) y = HY;
    if (z >  HZ) z = -HZ; else if (z < -HZ) z = HZ;
    pos[ix] = x; pos[iy] = y; pos[iz] = z;
  }
  geo.attributes.position.needsUpdate = true;

  // cursor void in screen space (desktop)
  uCursor.value.set(mouse.x * 2, -mouse.y * 2);

  // scroll parallax + a whisper of pointer parallax — the whole field drifts as you read
  points.position.y = scrollY * 2.4 - mouse.y * 0.5;
  points.position.x = -mouse.x * 0.5;
  points.rotation.z = (scrollY - 0.5) * 0.12;

  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}
animate();

})();
