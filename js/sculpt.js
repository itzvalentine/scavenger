// Sculptable shell: a superellipsoid on a sphere grid, with per-vertex displacement
// along each vertex's direction. Brushes: pull, push, smooth (with X mirror).
import * as THREE from 'three';

export const SHAPES = {
  pod:   { label: 'Pod',   a: 0.082, top: 0.074, bottom: 0.012, c: 0.074, n: 2.6, z: -0.012 },
  rover: { label: 'Rover', a: 0.084, top: 0.058, bottom: 0.012, c: 0.078, n: 4.6, z: -0.01 },
  orb:   { label: 'Orb',   a: 0.078, top: 0.082, bottom: 0.014, c: 0.072, n: 2.0, z: -0.012 },
};

export class Shell {
  constructor(solidClip, holoClip) {
    this.W = 96; this.H = 64;
    this.geo = new THREE.SphereGeometry(1, this.W, this.H);
    const n = this.geo.attributes.position.count;
    this.dirs = new Float32Array(this.geo.attributes.position.array); // unit sphere directions
    this.base = new Float32Array(n * 3);
    this.disp = new Float32Array(n);
    this.tmp = new Float32Array(n);
    this.material = new THREE.MeshStandardMaterial({ color: 0xff6a3d, roughness: 0.38, metalness: 0.05, clippingPlanes: [solidClip] });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.holo = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({
      color: 0x5be7ff, wireframe: true, transparent: true, opacity: 0.35, depthWrite: false, clippingPlanes: [holoClip] }));
    this.mesh.add(this.holo);
    this.mesh.userData.kind = 'shell';
    this.shapeName = 'pod';
    this.setShape('pod');
  }

  setShape(name) {
    const s = SHAPES[name]; this.shapeName = name;
    const d = this.dirs, b = this.base;
    for (let i = 0; i < this.disp.length; i++) {
      const x = d[i * 3], y = d[i * 3 + 1], z = d[i * 3 + 2];
      const by = y >= 0 ? s.top : s.bottom;
      const t = Math.pow(Math.pow(Math.abs(x / s.a), s.n) + Math.pow(Math.abs(y / by), s.n) + Math.pow(Math.abs(z / s.c), s.n), -1 / s.n);
      b[i * 3] = x * t; b[i * 3 + 1] = y * t; b[i * 3 + 2] = z * t + s.z;
    }
    this.disp.fill(0);
    this.update();
  }

  setColor(hex) { this.material.color.set(hex); }

  setXray(on) {
    this.material.transparent = on; this.material.opacity = on ? 0.3 : 1; this.material.depthWrite = !on;
    this.material.needsUpdate = true;
  }

  update() {
    const p = this.geo.attributes.position.array, d = this.dirs, b = this.base, k = this.disp;
    for (let i = 0; i < k.length; i++) {
      p[i * 3] = b[i * 3] + d[i * 3] * k[i];
      p[i * 3 + 1] = b[i * 3 + 1] + d[i * 3 + 1] * k[i];
      p[i * 3 + 2] = b[i * 3 + 2] + d[i * 3 + 2] * k[i];
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    this.geo.computeBoundingBox();
  }

  // Keep the UV seam and the poles welded so the surface never tears
  weld() {
    const W = this.W, H = this.H, k = this.disp, row = W + 1;
    for (let iy = 0; iy <= H; iy++) k[iy * row + W] = k[iy * row];
    for (const iy of [0, H]) {
      let s = 0; for (let ix = 0; ix <= W; ix++) s += k[iy * row + ix];
      s /= row; for (let ix = 0; ix <= W; ix++) k[iy * row + ix] = s;
    }
  }

  // point: shell-local hit point. tool: 'pull' | 'push' | 'smooth'
  brush(point, tool, dt, mirror = true, radius = 0.028, strength = 0.05) {
    this._apply(point, tool, dt, radius, strength);
    if (mirror && Math.abs(point.x) > radius * 0.35) this._apply(new THREE.Vector3(-point.x, point.y, point.z), tool, dt, radius, strength);
    this.weld();
    this.update();
  }

  _apply(pt, tool, dt, R, strength) {
    const p = this.geo.attributes.position.array, k = this.disp, W = this.W, H = this.H, row = W + 1;
    if (tool === 'smooth') this.tmp.set(k);
    for (let i = 0; i < k.length; i++) {
      const dx = p[i * 3] - pt.x, dy = p[i * 3 + 1] - pt.y, dz = p[i * 3 + 2] - pt.z;
      const dist2 = dx * dx + dy * dy + dz * dz;
      if (dist2 > R * R) continue;
      const f = Math.pow(1 - dist2 / (R * R), 2);
      if (tool === 'pull') k[i] += strength * f * dt;
      else if (tool === 'push') k[i] -= strength * f * dt;
      else {
        const ix = i % row, iy = (i - ix) / row;
        const l = iy * row + ((ix - 1 + W) % W), r = iy * row + ((ix + 1) % W);
        const u = Math.max(0, iy - 1) * row + ix, dn = Math.min(H, iy + 1) * row + ix;
        const avg = (this.tmp[l] + this.tmp[r] + this.tmp[u] + this.tmp[dn]) / 4;
        k[i] += (avg - k[i]) * Math.min(1, f * dt * 12);
      }
      k[i] = Math.min(0.05, Math.max(-0.025, k[i]));
    }
  }

  // Surface area in cm^2
  areaCm2() {
    const p = this.geo.attributes.position.array, idx = this.geo.index.array;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    let s = 0;
    for (let i = 0; i < idx.length; i += 3) {
      a.fromArray(p, idx[i] * 3); b.fromArray(p, idx[i + 1] * 3); c.fromArray(p, idx[i + 2] * 3);
      s += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    return s * 1e4;
  }

  // Filament for a hollow shell with ~2.5 mm walls (PLA, 1.24 g/cm^3)
  grams() { return this.areaCm2() * 0.25 * 1.24; }

  // Enclosed volume in cm^3 (divergence theorem over the closed mesh)
  volumeCm3() {
    const p = this.geo.attributes.position.array, idx = this.geo.index.array;
    let v = 0;
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1])
         - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c])
         + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
    }
    return Math.abs(v / 6) * 1e6;
  }
}
