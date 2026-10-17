// Geometry + material helpers for building device parts procedurally.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...o });
export const metal = (color = 0xb8bec6, o = {}) => mat(color, { metalness: 0.9, roughness: 0.3, ...o });
export const rubber = (color = 0x1b1c1f) => mat(color, { roughness: 0.92 });

export function rbox(w, h, d, r, material) {
  const rad = Math.max(0.0002, Math.min(r, Math.min(w, h, d) / 2 - 0.0002));
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, rad), material);
}

export function at(obj, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  obj.position.set(x, y, z); obj.rotation.set(rx, ry, rz); return obj;
}

// Cylinder whose axis runs along X (wheels, motors, batteries)
export function cylX(r, len, material, seg = 28) {
  const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(Math.PI / 2);
  return new THREE.Mesh(g, material);
}
// Cylinder whose axis runs along Z (speaker parts facing forward)
export function cylZ(r, len, material, seg = 32) {
  const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2);
  return new THREE.Mesh(g, material);
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function pcbTexture(seed, base = '#0e3b2a') {
  return canvasTexture(512, 512, (x, w, h) => {
    const r = rng(seed);
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    x.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      let px = r() * w, py = r() * h;
      x.strokeStyle = `rgba(222,190,110,${0.35 + r() * 0.3})`; x.lineWidth = 2 + r() * 3;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 3; k++) { if (r() < 0.5) px += (r() - 0.5) * 220; else py += (r() - 0.5) * 220; x.lineTo(px, py); }
      x.stroke();
      x.fillStyle = 'rgba(235,205,120,0.9)'; x.beginPath(); x.arc(px, py, 5, 0, Math.PI * 2); x.fill();
    }
    x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 3; x.strokeRect(10, 10, w - 20, h - 20);
  });
}

function chipTexture(text) {
  return canvasTexture(256, 128, (x, w, h) => {
    x.fillStyle = '#16171a'; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,0.55)'; x.font = '600 34px system-ui, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2);
    x.beginPath(); x.arc(22, 22, 8, 0, Math.PI * 2); x.fillStyle = 'rgba(255,255,255,0.25)'; x.fill();
  });
}

export function pcb({ w, d, seed = 1, color = '#0e3b2a', chips = [], caps = [] }) {
  const g = new THREE.Group();
  const top = new THREE.MeshStandardMaterial({ map: pcbTexture(seed, color), roughness: 0.6 });
  const edge = mat(color);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.0016, d), [edge, edge, top, edge, edge, edge]));
  for (const c of chips) {
    const h = c.h || 0.0014, dark = mat(0x18191c, { roughness: 0.4 });
    const topM = new THREE.MeshStandardMaterial({ map: chipTexture(c.label || ''), roughness: 0.4 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(c.w, h, c.d), [dark, dark, topM, dark, dark, dark]);
    m.position.set(c.x, 0.0008 + h / 2, c.z); g.add(m);
  }
  for (const c of caps) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, c.h, 16), metal(0xc9ced6, { roughness: 0.35 }));
    can.position.set(c.x, 0.0008 + c.h / 2, c.z); g.add(can);
    const topDisc = new THREE.Mesh(new THREE.CylinderGeometry(c.r * 0.98, c.r * 0.98, 0.0004, 16), mat(0x2a2f6b));
    topDisc.position.set(c.x, 0.0008 + c.h, c.z); g.add(topDisc);
  }
  return g;
}

export function gearGeometry(teeth, rOuter, depth, rHole = 0) {
  const s = new THREE.Shape(), rRoot = rOuter * 0.84, step = Math.PI * 2 / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [[rRoot, a], [rOuter, a + step * 0.22], [rOuter, a + step * 0.48], [rRoot, a + step * 0.7]];
    pts.forEach(([r, ang], k) => {
      const px = Math.cos(ang) * r, py = Math.sin(ang) * r;
      if (i === 0 && k === 0) s.moveTo(px, py); else s.lineTo(px, py);
    });
  }
  s.closePath();
  if (rHole) { const h = new THREE.Path(); h.absarc(0, 0, rHole, 0, Math.PI * 2, true); s.holes.push(h); }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}

export function wire(points, color, r = 0.0007) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 20, r, 6), mat(color, { roughness: 0.5 }));
}

// ---- Reusable components --------------------------------------------------

export function tire(r, w, rimColor = 0xf5c400) {
  const g = new THREE.Group();
  const rub = rubber();
  g.add(cylX(r * 0.9, w, rub, 40));
  const treadGeo = new THREE.BoxGeometry(w * 1.02, r * 0.13, r * 0.17);
  const tread = new THREE.InstancedMesh(treadGeo, rub, 24);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    e.set(a, 0, 0); q.setFromEuler(e);
    m.compose(new THREE.Vector3(0, Math.cos(a) * r * 0.93, Math.sin(a) * r * 0.93), q, s);
    tread.setMatrixAt(i, m);
  }
  g.add(tread);
  const rim = mat(rimColor, { roughness: 0.35 });
  g.add(cylX(r * 0.55, w * 1.04, rim, 28));
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(w * 1.08, r * 0.08, r * 0.5), mat(0x222326));
    spoke.rotation.x = (i / 5) * Math.PI * 2; spoke.position.set(0, 0, 0);
    spoke.geometry.translate(0, 0, r * 0.25); g.add(spoke);
  }
  g.add(cylX(r * 0.16, w * 1.12, metal(), 16));
  return g;
}

export function motor130() {
  const g = new THREE.Group();
  const can = cylX(0.0102, 0.025, metal(0xc4c9d0)); can.scale.z = 0.76; g.add(can);
  const cap = cylX(0.0096, 0.006, mat(0xeeeeee, { roughness: 0.6 })); cap.scale.z = 0.76; cap.position.x = -0.0155; g.add(cap);
  const shaft = cylX(0.001, 0.012, metal()); shaft.position.x = 0.018; g.add(shaft);
  const pin = new THREE.Mesh(gearGeometry(10, 0.0036, 0.004, 0), metal(0xd4a94a));
  pin.rotation.y = Math.PI / 2; pin.position.x = 0.021; g.add(pin);
  for (const s of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.004, 0.0025), metal(0xd08a3a));
    t.position.set(-0.019, s * 0.004, 0); g.add(t);
  }
  g.add(wire([[-0.019, 0.004, 0], [-0.026, 0.008, 0.004], [-0.03, 0.012, 0.01]], 0xd23b3b));
  g.add(wire([[-0.019, -0.004, 0], [-0.026, -0.006, 0.005], [-0.03, -0.004, 0.012]], 0x1e1e1e));
  return g;
}

export function gearbox() {
  const g = new THREE.Group();
  g.add(rbox(0.014, 0.032, 0.122, 0.003, mat(0x3a3f47, { roughness: 0.5, transparent: true, opacity: 0.92 })));
  const nylon = () => mat(0xf1ead8, { roughness: 0.45 });
  const big = gearGeometry(26, 0.0145, 0.004, 0.0015), small = gearGeometry(14, 0.0085, 0.004, 0.0012);
  for (const z of [-0.045, 0.045]) {
    const m = new THREE.Mesh(big, nylon()); m.rotation.y = Math.PI / 2; m.position.set(0.009, 0, z); g.add(m);
  }
  for (const z of [-0.02, 0.02]) {
    const m = new THREE.Mesh(small, nylon()); m.rotation.y = Math.PI / 2; m.position.set(0.009, 0.004, z); g.add(m);
  }
  const mid = new THREE.Mesh(gearGeometry(20, 0.011, 0.004, 0.0012), nylon()); mid.rotation.y = Math.PI / 2; mid.position.set(0.0125, -0.002, 0); g.add(mid);
  for (const z of [-0.045, 0.045]) { const a = cylX(0.0018, 0.03, metal()); a.position.set(0.01, 0, z); g.add(a); }
  return g;
}

export function battery18650(text, wrapColor = '#1f7a4c') {
  const g = new THREE.Group();
  const tex = canvasTexture(256, 1024, (x, w, h) => {
    x.fillStyle = wrapColor; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(0, h * 0.12, w, 16); x.fillRect(0, h * 0.86, w, 16);
    x.save(); x.translate(w / 2, h / 2); x.rotate(-Math.PI / 2);
    x.fillStyle = '#fff'; x.font = '700 64px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 0, 0); x.restore();
  });
  g.add(cylX(0.009, 0.064, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 }), 32));
  const pos = cylX(0.0035, 0.002, metal()); pos.position.x = 0.033; g.add(pos);
  const neg = cylX(0.0086, 0.001, metal()); neg.position.x = -0.0325; g.add(neg);
  return g;
}

export function pouchBattery(text) {
  const g = new THREE.Group();
  g.add(rbox(0.042, 0.011, 0.026, 0.002, mat(0x2b62c8, { roughness: 0.4 })));
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.036, 0.02), new THREE.MeshStandardMaterial({
    map: canvasTexture(512, 280, (x, w, h) => {
      x.fillStyle = '#e8eef8'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#16233b'; x.font = '800 64px system-ui, sans-serif'; x.textAlign = 'center';
      x.fillText(text[0], w / 2, 120); x.font = '600 50px system-ui, sans-serif'; x.fillText(text[1], w / 2, 200);
    }), roughness: 0.6 }));
  label.rotation.x = -Math.PI / 2; label.position.y = 0.0056; g.add(label);
  g.add(wire([[0.021, 0.002, 0.006], [0.03, 0.004, 0.008], [0.036, 0.006, 0.004]], 0xd23b3b));
  g.add(wire([[0.021, 0.002, -0.006], [0.03, 0.004, -0.008], [0.036, 0.006, -0.002]], 0x1e1e1e));
  return g;
}

export function driver45() {
  const g = new THREE.Group();
  const cone = new THREE.LatheGeometry([
    new THREE.Vector2(0.0075, 0.0), new THREE.Vector2(0.012, 0.003), new THREE.Vector2(0.017, 0.0062), new THREE.Vector2(0.0195, 0.0072),
  ], 48);
  cone.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(cone, mat(0x202226, { roughness: 0.75, side: THREE.DoubleSide })));
  const sur = new THREE.Mesh(new THREE.TorusGeometry(0.0205, 0.0017, 10, 48), rubber(0x2a2b2f)); sur.position.z = 0.0072; g.add(sur);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), mat(0x2b2e34, { roughness: 0.3 }));
  dome.rotation.x = Math.PI / 2; dome.position.z = -0.004; g.add(dome);
  const frame = new THREE.Mesh(new THREE.RingGeometry(0.0215, 0.0235, 48), mat(0x45484f, { side: THREE.DoubleSide })); frame.position.z = 0.0073; g.add(frame);
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.011, 0.007, 32, 1, true), metal(0x5a5f68, { side: THREE.DoubleSide }));
  basket.rotation.x = -Math.PI / 2; basket.position.z = 0.0036; g.add(basket);
  const magnet = cylZ(0.0115, 0.009, metal(0x34373d, { roughness: 0.4 })); magnet.position.z = -0.0045; g.add(magnet);
  const plate = cylZ(0.012, 0.0015, metal()); plate.position.z = -0.0095; g.add(plate);
  return g;
}

export function passiveRadiator() {
  const g = new THREE.Group();
  g.add(cylZ(0.021, 0.002, mat(0x1d1f23, { roughness: 0.6 })));
  const sur = new THREE.Mesh(new THREE.TorusGeometry(0.0215, 0.0016, 10, 48), rubber(0x2a2b2f)); g.add(sur);
  const w = cylZ(0.009, 0.0025, metal(0x9aa1ab)); w.position.z = 0.0018; g.add(w);
  const frame = new THREE.Mesh(new THREE.RingGeometry(0.022, 0.0245, 48), mat(0x3a3d43, { side: THREE.DoubleSide })); g.add(frame);
  return g;
}

export function lightRing(r = 0.029) {
  const g = new THREE.Group();
  const geo = new THREE.TorusGeometry(r, 0.0024, 12, 120);
  const colors = [], pos = geo.attributes.position, c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getY(i), pos.getX(i));
    c.setHSL((a / (Math.PI * 2) + 1) % 1, 1, 0.58); colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  ring.name = 'ringGlow';
  g.add(ring);
  const back = new THREE.Mesh(new THREE.RingGeometry(r - 0.004, r + 0.004, 64), mat(0x111214, { side: THREE.DoubleSide }));
  back.position.z = -0.0022; g.add(back);
  return g;
}

export function ledBar(color) {
  const g = new THREE.Group();
  g.add(rbox(0.05, 0.006, 0.006, 0.0015, mat(0x1d1f23)));
  for (const x of [-0.016, 0, 0.016]) {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 12, 8), mat(color, { emissive: color, emissiveIntensity: 1.6 }));
    led.position.set(x, 0, 0.0028); g.add(led);
  }
  return g;
}

export function usbcBoard() {
  const g = pcb({ w: 0.014, d: 0.018, seed: 9, color: '#123a5a', caps: [{ x: -0.004, z: -0.005, r: 0.0012, h: 0.002 }] });
  const port = rbox(0.0075, 0.0032, 0.009, 0.0014, metal(0xd0d4da));
  port.position.set(0.0045, 0.0024, 0.0); g.add(port);
  return g;
}
