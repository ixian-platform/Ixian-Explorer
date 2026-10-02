/**
 * The globe scene, plain three.js, loaded lazily.
 *
 * Draw calls: sphere, haze, land dots (one Points), city density and hover
 * rings (one Points), nodes (one Points), traffic arcs (one LineSegments) and
 * their heads. Colours come from the CSS theme tokens (setColors).
 * Everything that moves is done in shaders from a few uniforms, so a frame
 * costs almost nothing on the CPU.
 */
import * as THREE from 'three';
import { landPoints } from '@/data/geo/landMask';

export interface SceneNode {
  lat: number;
  lon: number;
  kind: 0 | 1; // 0 DLT, 1 S2
  city: number; // index into cities
}
export interface SceneCity {
  lat: number;
  lon: number;
  count: number;
  dlt: number;
  s2: number;
}

/** Globe colours, read from the --ix-globe-* and node tokens (see theme.css). */
export interface GlobeColors {
  sphere: string;
  rim: string;
  haze: string;
  hazeAlpha: number;
  land: string;
  landAlpha: number;
  ink: string;
  dlt: string;
  s2: string;
  flash: string;
  route: string;
  density: number;
  light: boolean;
}
const DARK: GlobeColors = {
  sphere: '#101612',
  rim: '#1d2621',
  haze: '#6f9be0',
  hazeAlpha: 0.0225,
  land: '#5f6461',
  landAlpha: 0.8,
  ink: '#f3f7f4',
  dlt: '#5cc96d',
  s2: '#3d7bff',
  flash: '#e2ffe6',
  route: '#9db9ff',
  density: 0.14,
  light: false,
};

const DEG = Math.PI / 180;
export function toVec(lat: number, lon: number, r = 1): THREE.Vector3 {
  const la = lat * DEG;
  const lo = lon * DEG;
  return new THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
}

const ARC_SLOTS = 40;
const ARC_SEG = 40;

const sphereVert = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const sphereFrag = /* glsl */ `
  uniform vec3 uSphere; uniform vec3 uRim;
  varying vec3 vN; varying vec3 vV;
  void main() {
    // one calm tone that lifts softly toward the limb (no hard edge)
    float f = 1.0 - max(dot(vN, vV), 0.0);
    gl_FragColor = vec4(mix(uSphere, uRim, pow(f, 2.6)), 1.0);
  }`;
const hazeFrag = /* glsl */ `
  uniform vec3 uHaze; uniform float uHazeA;
  varying vec3 vN; varying vec3 vV;
  void main() {
    // back faces of a slightly larger sphere: a faint haze just outside the rim, fading out
    float d = clamp(-dot(vN, vV) / 0.5, 0.0, 1.0);
    gl_FragColor = vec4(uHaze, pow(d, 2.6) * uHazeA);
  }`;
/* Land: small square-ish dots that fade toward the limb */
const landVert = /* glsl */ `
  uniform float uDpr; uniform float uScale;
  varying float vFacing;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * position);
    vFacing = dot(n, normalize(-mv.xyz));
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.6, 2.2 * uDpr * uScale);
  }`;
const landFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uLandA; varying float vFacing;
  void main() {
    if (vFacing < 0.0) discard;
    vec2 c = gl_PointCoord - 0.5;
    if (max(abs(c.x), abs(c.y)) > 0.5) discard;
    gl_FragColor = vec4(uColor, smoothstep(0.0, 0.4, vFacing) * uLandA);
  }`;

/* City density: a soft disc per city, sized by node count */
const cityVert = /* glsl */ `
  attribute float aSize; attribute float aHover; attribute float aVis;
  uniform float uDpr; uniform float uScale;
  varying float vFacing; varying float vHover; varying float vVis;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * position);
    vFacing = dot(n, normalize(-mv.xyz));
    vHover = aHover; vVis = aVis;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uDpr * uScale;
  }`;
const cityFrag = /* glsl */ `
  uniform vec3 uInk; uniform float uDensity; varying float vFacing; varying float vHover; varying float vVis;
  void main() {
    if (vFacing < 0.02 || vVis < 0.5) discard;
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float glow = (1.0 - d) * (1.0 - d) * uDensity;
    float ring = vHover * smoothstep(0.08, 0.0, abs(d - 0.86)) * 0.9;
    gl_FragColor = vec4(uInk, (glow + ring) * smoothstep(0.02, 0.3, vFacing));
  }`;

/* Nodes: DLT filled dots, S2 rings, each at its own
   jittered position. A new block runs a wave across the DLT nodes. */
const nodeVert = /* glsl */ `
  attribute float aKind; attribute float aPhase;
  uniform float uDpr; uniform float uScale; uniform float uFilter; uniform float uTime; uniform float uPulse;
  varying float vFacing; varying float vKind; varying float vOn; varying float vGreen;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * position);
    vFacing = dot(n, normalize(-mv.xyz));
    vKind = aKind;
    vOn = (uFilter < 0.5 || (uFilter < 1.5 && aKind < 0.5) || (uFilter > 1.5 && aKind > 0.5)) ? 1.0 : 0.0;
    float since = uTime - uPulse - aPhase * 0.9;
    vGreen = aKind < 0.5 ? clamp(1.0 - abs(since - 0.25) / 0.6, 0.0, 1.0) : 0.0;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (aKind < 0.5 ? 5.0 : 6.5) * uDpr * uScale * (1.0 + 0.35 * vGreen);
  }`;
const nodeFrag = /* glsl */ `
  uniform vec3 uDlt; uniform vec3 uS2; uniform vec3 uFlash;
  varying float vFacing; varying float vKind; varying float vOn; varying float vGreen;
  void main() {
    if (vFacing < 0.0) discard;
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a;
    vec3 col;
    if (vKind < 0.5) {
      a = smoothstep(1.0, 0.72, d);
      col = mix(uDlt, uFlash, vGreen * 0.8);
    } else {
      a = smoothstep(0.22, 0.0, abs(d - 0.7));
      col = uS2;
    }
    a *= smoothstep(0.0, 0.25, vFacing) * mix(0.1, 1.0, vOn);
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a);
  }`;

/* Arcs: each vertex knows its slot's start time and its position along the arc */
const arcVert = /* glsl */ `
  attribute float aT; attribute float aStart; attribute float aDur;
  uniform float uTime;
  varying float vA; varying float vFacing;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * position);
    vFacing = dot(n, normalize(-mv.xyz));
    float head = (uTime - aStart) / aDur;
    float tail = 0.42;
    float a = 0.0;
    if (aT <= head && aT >= head - tail) a = pow(1.0 - (head - aT) / tail, 1.6);
    // fade the whole arc out once the head has landed
    a *= 1.0 - smoothstep(1.0, 1.0 + tail, head);
    vA = a;
    gl_Position = projectionMatrix * mv;
  }`;
/* Packet heads: the same vertices, drawn as points only at the moving head */
const headVert = /* glsl */ `
  attribute float aT; attribute float aStart; attribute float aDur;
  uniform float uTime; uniform float uDpr;
  varying float vA; varying float vFacing;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * position);
    vFacing = dot(n, normalize(-mv.xyz));
    float head = (uTime - aStart) / aDur;
    float d = (head - aT) * ${ARC_SEG}.0;
    vA = (head >= 0.0 && head <= 1.02) ? exp(-d * d * 0.8) : 0.0;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = 4.5 * uDpr;
  }`;
const headFrag = /* glsl */ `
  uniform vec3 uRoute; varying float vA; varying float vFacing;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = vA * smoothstep(1.0, 0.2, d) * (0.4 + 0.6 * smoothstep(-0.25, 0.25, vFacing));
    if (a < 0.02) discard;
    gl_FragColor = vec4(uRoute, a);
  }`;

const arcFrag = /* glsl */ `
  uniform vec3 uRoute; varying float vA; varying float vFacing;
  void main() {
    float a = vA * (0.35 + 0.65 * smoothstep(-0.25, 0.25, vFacing));
    if (a < 0.01) discard;
    gl_FragColor = vec4(uRoute, min(1.0, a * 1.3));
  }`;

export interface GlobeOptions {
  canvas: HTMLCanvasElement;
  reducedMotion: boolean;
  facing: { lat: number; lon: number };
  onHover?: (city: number | null, x: number, y: number) => void;
  onSelect?: (city: number | null, x: number, y: number) => void;
  onInteract?: () => void;
  colors?: GlobeColors;
}

export class GlobeScene {
  private r: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  private world = new THREE.Group();
  private last = 0;
  private land!: THREE.Points;
  private cityPts: THREE.Points | null = null;
  private nodePts: THREE.Points | null = null;
  private arcs!: THREE.LineSegments;
  private arcNext = 0;
  private uniforms = {
    uDpr: { value: 1 },
    uScale: { value: 1 },
    uTime: { value: 0 },
    uPulse: { value: -100 },
    uFilter: { value: 0 },
    uInk: { value: new THREE.Vector3() },
    uDlt: { value: new THREE.Vector3() },
    uS2: { value: new THREE.Vector3() },
    uFlash: { value: new THREE.Vector3() },
    uRoute: { value: new THREE.Vector3() },
    uColor: { value: new THREE.Vector3() },
    uLandA: { value: 0.8 },
    uSphere: { value: new THREE.Vector3() },
    uRim: { value: new THREE.Vector3() },
    uHaze: { value: new THREE.Vector3() },
    uHazeA: { value: 0.075 },
    uDensity: { value: 0.14 },
  };
  private additive: THREE.ShaderMaterial[] = [];
  private lon: number;
  private lat: number;
  private vLon = 0;
  private vLat = 0;
  private auto: boolean;
  private target: { lat: number; lon: number } | null = null;
  private running = false;
  private raf = 0;
  private cities: SceneCity[] = [];
  private nodes: SceneNode[] = [];
  private hovered: number | null = null;
  private size = { w: 1, h: 1 };
  private drag: { x: number; y: number; moved: boolean; id: number } | null = null;
  private opts: GlobeOptions;
  private disposed = false;

  constructor(opts: GlobeOptions) {
    this.opts = opts;
    this.lat = Math.max(-35, Math.min(55, opts.facing.lat)) * 0.8;
    this.lon = opts.facing.lon + 12; // start a little east so the auto-rotation brings the region in
    if (opts.reducedMotion) this.lon = opts.facing.lon;
    this.auto = !opts.reducedMotion;
    this.r = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.r.setClearColor(0x000000, 0);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.r.setPixelRatio(dpr);
    this.uniforms.uDpr.value = dpr;
    this.camera.position.set(0, 0, 4.6);
    this.scene.add(this.world);
    this.world.rotation.order = 'XYZ';
    this.build();
    this.setColors(opts.colors ?? DARK);
    this.bind();
  }

  private build() {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 72, 48),
      new THREE.ShaderMaterial({ vertexShader: sphereVert, fragmentShader: sphereFrag, uniforms: this.uniforms })
    );
    this.world.add(sphere);
    // a very faint haze around the globe (normal blending, so it works on light and dark pages)
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.14, 64, 32),
      new THREE.ShaderMaterial({
        vertexShader: sphereVert,
        fragmentShader: hazeFrag,
        uniforms: this.uniforms,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      })
    );
    this.scene.add(halo);

    const pts = landPoints(42000);
    const pos = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => {
      const v = toVec(p.lat, p.lon, 1.001);
      pos.set([v.x, v.y, v.z], i * 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.land = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        vertexShader: landVert,
        fragmentShader: landFrag,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
      })
    );
    this.world.add(this.land);

    // arcs: fixed pool, one draw call
    const n = ARC_SLOTS * ARC_SEG * 2;
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    ag.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(n), 1));
    ag.setAttribute('aStart', new THREE.BufferAttribute(new Float32Array(n).fill(-1000), 1));
    ag.setAttribute('aDur', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
    this.arcs = new THREE.LineSegments(
      ag,
      this.addMat({
        vertexShader: arcVert,
        fragmentShader: arcFrag,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.arcs.frustumCulled = false;
    this.world.add(this.arcs);
    const heads = new THREE.Points(
      ag,
      this.addMat({
        vertexShader: headVert,
        fragmentShader: headFrag,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    heads.frustumCulled = false;
    this.world.add(heads);
  }

  private addMat(p: THREE.ShaderMaterialParameters) {
    const m = new THREE.ShaderMaterial(p);
    this.additive.push(m);
    return m;
  }

  /** Apply theme colours (hex from the CSS tokens). Hex goes to the shaders as raw sRGB. */
  setColors(c: GlobeColors) {
    const u = this.uniforms;
    const set = (v: THREE.Vector3, hex: string) => {
      const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
      if (Number.isFinite(n)) v.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    };
    set(u.uSphere.value, c.sphere);
    set(u.uRim.value, c.rim);
    set(u.uHaze.value, c.haze);
    set(u.uColor.value, c.land);
    set(u.uInk.value, c.ink);
    set(u.uDlt.value, c.dlt);
    set(u.uS2.value, c.s2);
    set(u.uFlash.value, c.flash);
    set(u.uRoute.value, c.route);
    u.uHazeA.value = c.hazeAlpha;
    u.uLandA.value = c.landAlpha;
    u.uDensity.value = c.density;
    // light traffic on a dark globe adds up; on a light globe it has to be drawn over
    for (const m of this.additive) {
      m.blending = c.light ? THREE.NormalBlending : THREE.AdditiveBlending;
      m.needsUpdate = true;
    }
    this.renderOnce();
  }

  setData(nodes: SceneNode[], cities: SceneCity[]) {
    this.nodes = nodes;
    this.cities = cities;
    if (this.nodePts) {
      this.world.remove(this.nodePts);
      this.nodePts.geometry.dispose();
    }
    if (this.cityPts) {
      this.world.remove(this.cityPts);
      this.cityPts.geometry.dispose();
    }
    const np = new Float32Array(nodes.length * 3);
    const kind = new Float32Array(nodes.length);
    const phase = new Float32Array(nodes.length);
    nodes.forEach((n, i) => {
      const v = toVec(n.lat, n.lon, 1.004);
      np.set([v.x, v.y, v.z], i * 3);
      kind[i] = n.kind;
      phase[i] = ((n.lon + 180) / 360) % 1; // the block wave sweeps west to east
    });
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(np, 3));
    ng.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    ng.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.nodePts = new THREE.Points(
      ng,
      new THREE.ShaderMaterial({
        vertexShader: nodeVert,
        fragmentShader: nodeFrag,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
      })
    );
    this.world.add(this.nodePts);

    const cp = new Float32Array(cities.length * 3);
    const size = new Float32Array(cities.length);
    cities.forEach((c, i) => {
      const v = toVec(c.lat, c.lon, 1.003);
      cp.set([v.x, v.y, v.z], i * 3);
      size[i] = 16 + Math.sqrt(c.count) * 13;
    });
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(cp, 3));
    cg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    cg.setAttribute('aHover', new THREE.BufferAttribute(new Float32Array(cities.length), 1));
    cg.setAttribute('aVis', new THREE.BufferAttribute(new Float32Array(cities.length).fill(1), 1));
    this.cityPts = new THREE.Points(
      cg,
      new THREE.ShaderMaterial({
        vertexShader: cityVert,
        fragmentShader: cityFrag,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
      })
    );
    this.world.add(this.cityPts);
    this.renderOnce();
  }

  /** 0 all, 1 DLT, 2 S2 */
  setFilter(f: 0 | 1 | 2) {
    this.uniforms.uFilter.value = f;
    if (this.cityPts) {
      const vis = this.cityPts.geometry.getAttribute('aVis') as THREE.BufferAttribute;
      this.cities.forEach((c, i) => vis.setX(i, f === 0 ? 1 : f === 1 ? (c.dlt > 0 ? 1 : 0) : c.s2 > 0 ? 1 : 0));
      vis.needsUpdate = true;
    }
    this.renderOnce();
  }

  setHighlight(city: number | null) {
    if (!this.cityPts) return;
    const a = this.cityPts.geometry.getAttribute('aHover') as THREE.BufferAttribute;
    for (let i = 0; i < a.count; i++) a.setX(i, i === city ? 1 : 0);
    a.needsUpdate = true;
    this.renderOnce();
  }

  /** Turn to face a city (from the list, keyboard or a link). */
  focusCity(i: number) {
    const c = this.cities[i];
    if (!c) return;
    this.auto = false;
    this.vLon = this.vLat = 0;
    if (this.opts.reducedMotion) {
      this.lon = c.lon;
      this.lat = Math.max(-60, Math.min(60, c.lat));
      this.renderOnce();
    } else {
      this.target = { lat: Math.max(-60, Math.min(60, c.lat)), lon: c.lon };
    }
  }

  /** Screen position of a city (CSS px in the canvas), or null when behind the globe. */
  cityScreen(i: number): { x: number; y: number } | null {
    const c = this.cities[i];
    if (!c) return null;
    const v = toVec(c.lat, c.lon, 1).applyMatrix4(this.world.matrixWorld);
    const toCam = this.camera.position.clone().sub(v).normalize();
    if (v.clone().normalize().dot(toCam) < 0.12) return null;
    v.project(this.camera);
    return { x: ((v.x + 1) / 2) * this.size.w, y: ((1 - v.y) / 2) * this.size.h };
  }

  /** A new block: green wave across DLT nodes, and propagation arcs from one of them. */
  block(seed: number) {
    if (this.opts.reducedMotion) return;
    this.uniforms.uPulse.value = this.uniforms.uTime.value;
    const dlt = this.nodes.filter((n) => n.kind === 0);
    if (dlt.length < 2) return;
    const from = dlt[seed % dlt.length];
    for (let k = 0; k < 5; k++) {
      const to = dlt[(seed * 7 + k * 13 + 3) % dlt.length];
      if (to !== from) this.arc(from, to, 1.5 + k * 0.12, k * 0.12);
    }
  }

  /** A transaction: enters through an S2 relay, lands on a DLT node. */
  tx(seed: number) {
    if (this.opts.reducedMotion) return;
    const s2 = this.nodes.filter((n) => n.kind === 1);
    const dlt = this.nodes.filter((n) => n.kind === 0);
    if (!s2.length || !dlt.length) return;
    this.arc(s2[seed % s2.length], dlt[(seed >>> 3) % dlt.length], 1.25, 0);
  }

  private arc(a: SceneNode, b: SceneNode, dur: number, delay: number) {
    const A = toVec(a.lat, a.lon, 1);
    const B = toVec(b.lat, b.lon, 1);
    const ang = A.angleTo(B);
    if (ang < 0.02) return;
    const lift = 0.06 + 0.32 * (ang / Math.PI);
    const slot = this.arcNext;
    this.arcNext = (this.arcNext + 1) % ARC_SLOTS;
    const g = this.arcs.geometry;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const at = g.getAttribute('aT') as THREE.BufferAttribute;
    const st = g.getAttribute('aStart') as THREE.BufferAttribute;
    const du = g.getAttribute('aDur') as THREE.BufferAttribute;
    const start = this.uniforms.uTime.value + delay;
    const point = (t: number) => {
      const p = A.clone().lerp(B, t).normalize(); // cheap slerp substitute, fine for the lift below
      const s = Math.sin(Math.PI * t);
      return p.multiplyScalar(1.004 + lift * s);
    };
    for (let i = 0; i < ARC_SEG; i++) {
      const t0 = i / ARC_SEG;
      const t1 = (i + 1) / ARC_SEG;
      const p0 = point(t0);
      const p1 = point(t1);
      const j = (slot * ARC_SEG + i) * 2;
      pos.setXYZ(j, p0.x, p0.y, p0.z);
      pos.setXYZ(j + 1, p1.x, p1.y, p1.z);
      at.setX(j, t0);
      at.setX(j + 1, t1);
      st.setX(j, start);
      st.setX(j + 1, start);
      du.setX(j, dur);
      du.setX(j + 1, dur);
    }
    pos.needsUpdate = at.needsUpdate = st.needsUpdate = du.needsUpdate = true;
  }

  /* ---------------------------------------------------------- interaction */

  private bind() {
    const c = this.opts.canvas;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
    c.addEventListener('pointerleave', this.onLeave);
  }

  private onDown = (e: PointerEvent) => {
    this.drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
    this.vLon = this.vLat = 0;
    this.target = null;
  };

  private onMove = (e: PointerEvent) => {
    if (this.drag && this.drag.id === e.pointerId) {
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      if (!this.drag.moved && Math.hypot(dx, dy) > 4) {
        this.drag.moved = true;
        this.opts.canvas.setPointerCapture(e.pointerId);
        this.stopAuto();
      }
      if (this.drag.moved) {
        const k = 180 / (this.size.h * 1.05);
        this.lon -= dx * k;
        this.lat = Math.max(-60, Math.min(60, this.lat + dy * k));
        this.vLon = -dx * k;
        this.vLat = dy * k;
        this.drag.x = e.clientX;
        this.drag.y = e.clientY;
        if (!this.running) this.renderOnce();
      }
      return;
    }
    if (e.pointerType === 'mouse') this.pick(e, false);
  };

  private onUp = (e: PointerEvent) => {
    const d = this.drag;
    this.drag = null;
    if (d && !d.moved) this.pick(e, true);
    if (this.opts.reducedMotion) this.vLon = this.vLat = 0;
  };

  private onLeave = () => {
    if (this.hovered != null && !this.drag) {
      this.hovered = null;
      this.opts.onHover?.(null, 0, 0);
    }
  };

  private stopAuto() {
    if (this.auto) {
      this.auto = false;
      this.opts.onInteract?.();
    }
  }

  /** Nearest front-facing city within reach of the pointer. */
  private pick(e: PointerEvent, select: boolean) {
    const rect = this.opts.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let best = -1;
    let bd = e.pointerType === 'mouse' ? 20 : 30;
    for (let i = 0; i < this.cities.length; i++) {
      const f = this.uniforms.uFilter.value;
      const c = this.cities[i];
      if ((f === 1 && !c.dlt) || (f === 2 && !c.s2)) continue;
      const p = this.cityScreen(i);
      if (!p) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    const id = best >= 0 ? best : null;
    if (select) {
      if (id != null) this.stopAuto();
      this.opts.onSelect?.(id, x, y);
    } else if (id !== this.hovered) {
      this.hovered = id;
      this.opts.canvas.style.cursor = id != null ? 'pointer' : 'grab';
      this.opts.onHover?.(id, x, y);
    }
  }

  /* ------------------------------------------------------------- lifecycle */

  resize(w: number, h: number) {
    this.size = { w, h };
    this.r.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the globe a comfortable size for any aspect
    const fit = w / h < 1 ? 5.1 / Math.max(0.62, w / h) : 4.8;
    this.camera.position.z = fit;
    this.camera.updateProjectionMatrix();
    this.uniforms.uScale.value = Math.max(0.7, Math.min(1.25, h / 720));
    this.renderOnce();
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.last = performance.now();
    const loop = () => {
      if (!this.running) return;
      const t = performance.now();
      this.frame(Math.min(0.05, (t - this.last) / 1000));
      this.last = t;
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame(dt: number) {
    this.uniforms.uTime.value += dt;
    if (this.target) {
      let dl = ((this.target.lon - this.lon + 540) % 360) - 180;
      const dla = this.target.lat - this.lat;
      const k = 1 - Math.pow(0.0015, dt);
      this.lon += dl * k;
      this.lat += dla * k;
      if (Math.abs(dl) < 0.05 && Math.abs(dla) < 0.05) this.target = null;
    } else if (!this.drag) {
      if (this.auto) this.lon -= dt * 1.6; // degrees per second: a slow eastward drift
      // inertia after a drag
      this.lon += this.vLon;
      this.lat = Math.max(-60, Math.min(60, this.lat + this.vLat));
      const decay = Math.pow(0.02, dt);
      this.vLon *= decay;
      this.vLat *= decay;
      if (Math.abs(this.vLon) < 1e-4) this.vLon = 0;
      if (Math.abs(this.vLat) < 1e-4) this.vLat = 0;
    }
    this.draw();
  }

  private draw() {
    this.world.rotation.set(this.lat * DEG, -this.lon * DEG, 0);
    this.world.updateMatrixWorld();
    this.r.render(this.scene, this.camera);
  }

  renderOnce() {
    if (!this.running) this.draw();
  }

  dispose() {
    this.disposed = true;
    this.stop();
    const c = this.opts.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onUp);
    c.removeEventListener('pointerleave', this.onLeave);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | undefined;
      mat?.dispose?.();
    });
    this.r.dispose();
  }

  /** Keyboard rotation (arrow keys on the focused globe). */
  nudge(dLon: number, dLat: number) {
    this.stopAuto();
    this.target = null;
    this.lon += dLon;
    this.lat = Math.max(-60, Math.min(60, this.lat + dLat));
    this.renderOnce();
  }
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
