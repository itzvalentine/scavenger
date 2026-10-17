// Floating glass panel (canvas texture) that works with mouse rays and XR hand rays.
import * as THREE from 'three';

export const C = {
  accent: '#5be7ff', green: '#4ade80', red: '#ff5a64', amber: '#ffc15e',
  text: '#f4f7fb', dim: 'rgba(244,247,251,0.6)', faint: 'rgba(244,247,251,0.35)',
  line: 'rgba(255,255,255,0.12)', glass: 'rgba(16,20,28,0.78)', card: 'rgba(255,255,255,0.05)',
};
export const FONT = 'system-ui, -apple-system, "SF Pro Display", "Segoe UI", Roboto, sans-serif';

export function rr(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

export class Panel {
  constructor(widthM, heightM, pxW = 1500) {
    this.W = pxW; this.H = Math.round(pxW * heightM / widthM);
    this.canvas = document.createElement('canvas'); this.canvas.width = this.W; this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthM, heightM),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false }));
    this.mesh.renderOrder = 20;
    this.mesh.userData.kind = 'panel';
    this.buttons = []; this.hover = null; this.pressed = null;
  }

  begin() {
    const x = this.ctx; this.buttons = [];
    x.clearRect(0, 0, this.W, this.H);
    x.fillStyle = C.glass; rr(x, 3, 3, this.W - 6, this.H - 6, 44); x.fill();
    x.strokeStyle = C.line; x.lineWidth = 2; x.stroke();
    return x;
  }
  end() { this.tex.needsUpdate = true; }

  hitButton(uv) {
    const px = uv.x * this.W, py = (1 - uv.y) * this.H;
    return this.buttons.find(b => !b.disabled && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) || null;
  }

  text(t, px, py, { size = 30, weight = 500, color = C.text, align = 'left', spacing = 0 } = {}) {
    const x = this.ctx;
    x.font = `${weight} ${size}px ${FONT}`; x.fillStyle = color; x.textAlign = align; x.textBaseline = 'alphabetic';
    if (spacing) { x.letterSpacing = `${spacing}px`; }
    x.fillText(t, px, py);
    if (spacing) x.letterSpacing = '0px';
  }

  wrap(t, px, py, maxW, lineH, opts = {}) {
    const x = this.ctx; x.font = `${opts.weight || 500} ${opts.size || 30}px ${FONT}`;
    const words = t.split(' '); let line = '', y = py;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (x.measureText(test).width > maxW && line) { this.text(line, px, y, opts); line = w; y += lineH; }
      else line = test;
    }
    if (line) this.text(line, px, y, opts);
    return y + lineH;
  }

  // variant: 'primary' | 'ghost' | 'chip'
  button(id, px, py, w, h, label, { variant = 'ghost', active = false, disabled = false, swatch = null } = {}) {
    const x = this.ctx, hov = this.hover === id && !disabled;
    this.buttons.push({ id, x: px, y: py, w, h, disabled });
    rr(x, px, py, w, h, h / 2);
    if (variant === 'primary') { x.fillStyle = disabled ? 'rgba(91,231,255,0.25)' : (hov ? '#8cf0ff' : C.accent); x.fill(); }
    else {
      x.fillStyle = active ? 'rgba(91,231,255,0.18)' : (hov ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)'); x.fill();
      x.strokeStyle = active ? C.accent : C.line; x.lineWidth = 2; x.stroke();
    }
    if (swatch) {
      x.fillStyle = swatch; x.beginPath(); x.arc(px + w / 2, py + h / 2, h / 2 - 10, 0, Math.PI * 2); x.fill();
      if (active) { x.strokeStyle = '#fff'; x.lineWidth = 4; x.beginPath(); x.arc(px + w / 2, py + h / 2, h / 2 - 4, 0, Math.PI * 2); x.stroke(); }
      return;
    }
    this.text(label, px + w / 2, py + h / 2 + h * 0.16, {
      size: Math.round(h * 0.4), weight: 600, align: 'center',
      color: variant === 'primary' ? '#06121a' : (disabled ? C.faint : (active ? C.accent : C.text)) });
  }

  bar(px, py, w, h, p, color = C.accent) {
    const x = this.ctx;
    rr(x, px, py, w, h, h / 2); x.fillStyle = 'rgba(255,255,255,0.08)'; x.fill();
    if (p > 0) { rr(x, px, py, Math.max(h, w * Math.min(1, p)), h, h / 2); x.fillStyle = color; x.fill(); }
  }

  card(px, py, w, h) {
    const x = this.ctx; rr(x, px, py, w, h, 30);
    x.fillStyle = C.card; x.fill(); x.strokeStyle = 'rgba(255,255,255,0.07)'; x.lineWidth = 2; x.stroke();
  }

  dot(px, py, r, color) { const x = this.ctx; x.fillStyle = color; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill(); }
}

// Small floating tag sprite (part names, device names, problems)
export function makeTag(title, sub = '', color = C.accent, heightM = 0.026) {
  const c = document.createElement('canvas'), x = c.getContext('2d');
  const tf = `650 46px ${FONT}`, sf = `500 34px ${FONT}`;
  x.font = tf; const tw = x.measureText(title).width;
  x.font = sf; const sw = sub ? x.measureText(sub).width : 0;
  c.width = Math.ceil(Math.max(tw, sw) + 92); c.height = sub ? 132 : 84;
  x.fillStyle = 'rgba(14,18,26,0.86)'; rr(x, 2, 2, c.width - 4, c.height - 4, 30); x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.14)'; x.lineWidth = 2; x.stroke();
  x.fillStyle = color; x.beginPath(); x.arc(34, 42, 9, 0, Math.PI * 2); x.fill();
  x.font = tf; x.fillStyle = '#f4f7fb'; x.fillText(title, 56, 58);
  if (sub) { x.font = sf; x.fillStyle = 'rgba(244,247,251,0.62)'; x.fillText(sub, 56, 108); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false }));
  const h = heightM * (c.height / 84);
  s.scale.set(h * c.width / c.height, h, 1);
  s.center.set(0.5, 0);
  s.renderOrder = 30;
  return s;
}
