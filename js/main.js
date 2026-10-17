import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { buildCar, buildSpeaker } from './devices.js';
import { buildBoomBot, PLATE_TOP } from './boombot.js';
import { Shell, SHAPES } from './sculpt.js';
import { Panel, makeTag, C, FONT } from './ui.js';
import { initAudio, sfx } from './sound.js';
import { REQUIRED, OPTIONAL, FILAMENT, costs, money, sheetHTML } from './sourcing.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const IDENTIFY = 0, DIAGNOSE = 1, TEARDOWN = 2, MERGE = 3, SOURCE = 4, SCULPT = 5, FAB = 6;
const STEP_NAMES = ['Identify', 'Diagnose', 'Teardown', 'Merge', 'Source', 'Sculpt', 'Fabricate'];
const STEPS = STEP_NAMES.length;
const XR_SCALE = 1.4;
const COLORS = ['#ff6a3d', '#f2f1ee', '#1c1d21', '#5be7ff', '#ffc15e', '#7b61ff'];
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutBack = t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const clamp01 = t => Math.min(1, Math.max(0, t));

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.localClippingEnabled = true;
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const BG = new THREE.Color(0x0a0d13);
scene.background = BG;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(0.6, 1.4, 1.0); scene.add(key);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.01, 50);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.minDistance = 0.3; controls.maxDistance = 4;
controls.enablePan = false;

// Workbench: everything lives here so it can be placed and scaled in XR
const bench = new THREE.Group();
scene.add(bench);

// Holographic floor disc
{
  const g = new THREE.Group(), m = new THREE.LineBasicMaterial({ color: 0x5be7ff, transparent: true, opacity: 0.12 });
  for (const r of [0.2, 0.4, 0.62]) {
    const pts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m));
  }
  const rad = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; rad.push(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2, Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rad, 3));
  g.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x5be7ff, transparent: true, opacity: 0.05 })));
  g.position.y = -0.0005;
  bench.add(g);
}

const car = buildCar(), spk = buildSpeaker();
car.group.position.set(-0.34, 0, 0);
spk.group.position.set(0.34, 0, 0);
bench.add(car.group, spk.group);
const devices = [car, spk];
const parts = [...car.parts, ...spk.parts];
parts.forEach(p => { p.device = p.id.startsWith('car') ? car : spk; });
const partsById = Object.fromEntries(parts.map(p => [p.id, p]));
const KEEP = parts.filter(p => p.keep).length;

const bot = buildBoomBot(partsById);
bot.group.position.set(0, 0, 0.02);
const BOT_HOME = bot.group.position.clone();
bench.add(bot.group);
bot.group.visible = false;

const solidClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1000);
const holoClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1000);
const shell = new Shell(solidClip, holoClip);
shell.mesh.position.set(0, PLATE_TOP, 0);
shell.mesh.visible = false;
bot.group.add(shell.mesh);

const PANEL_W = 0.5, PANEL_H = 0.32;
const panel = new Panel(PANEL_W, PANEL_H, 1500);
panel.mesh.position.set(0, 0.44, -0.26);
const DESKTOP_PANEL_SCALE = 1.3; // bigger on flat screens so the text stays readable
panel.mesh.scale.setScalar(DESKTOP_PANEL_SCALE);
bench.add(panel.mesh);

// Scan FX: corner brackets + sweep per device
const scanFx = devices.map(dev => {
  const box = new THREE.Box3().setFromObject(dev.group);
  dev.group.worldToLocal(box.min); dev.group.worldToLocal(box.max);
  const size = box.getSize(new THREE.Vector3()).multiplyScalar(1.08), c = box.getCenter(new THREE.Vector3());
  const g = new THREE.Group(); g.position.copy(c);
  const hx = size.x / 2, hy = size.y / 2, hz = size.z / 2, L = Math.min(size.x, size.z) * 0.18, pts = [];
  for (const x of [-hx, hx]) for (const y of [-hy, hy]) for (const z of [-hz, hz]) {
    pts.push(x, y, z, x - Math.sign(x) * L, y, z, x, y, z, x, y - Math.sign(y) * L, z, x, y, z, x, y, z - Math.sign(z) * L);
  }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const brackets = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: 0x5be7ff, transparent: true }));
  g.add(brackets);
  const sweep = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.z), new THREE.MeshBasicMaterial({
    color: 0x5be7ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  sweep.rotation.x = -Math.PI / 2; g.add(sweep);
  const tag = makeTag(dev.name, 'Identified', C.green, 0.022); tag.position.set(0, hy + 0.03, 0); tag.visible = false; g.add(tag);
  dev.group.add(g);
  return { g, brackets, sweep, tag, hy };
});

// Problem markers
const PROBLEM_TAGS = { 'car-battery': [-0.07, 0.17, -0.05], 'car-top': [0.07, 0.12, 0.07], 'spk-housing': [0, 0.13, 0] };
const markers = [];
for (const dev of devices) for (const pr of dev.problems) {
  const p = partsById[pr.part], g = new THREE.Group();
  const anchor = p.home.pos.clone();
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.005, 16, 12), new THREE.MeshBasicMaterial({ color: C.red, depthTest: false }));
  dot.position.copy(anchor); dot.renderOrder = 25; g.add(dot);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.008, 0.0105, 32), new THREE.MeshBasicMaterial({ color: C.red, transparent: true, depthTest: false, side: THREE.DoubleSide }));
  halo.position.copy(anchor); halo.renderOrder = 25; g.add(halo);
  const tp = new THREE.Vector3(...PROBLEM_TAGS[pr.part]);
  const tag = makeTag(pr.title, pr.text, C.red, 0.02); tag.position.copy(tp); g.add(tag);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([anchor, tp]), new THREE.LineBasicMaterial({ color: C.red, transparent: true, opacity: 0.6, depthTest: false }));
  line.renderOrder = 24; g.add(line);
  g.visible = false; dev.group.add(g);
  markers.push({ g, halo });
}

// Angle the devices toward the middle: nicer 3/4 view, and the speaker's
// front-to-back explosion reads diagonally instead of stacking toward the camera
car.group.rotation.y = 0.4;
spk.group.rotation.y = -0.55;

// Exploded-view leader lines (home -> current position)
for (const dev of devices) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dev.parts.length * 6), 3));
  dev.leaders = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x5be7ff, transparent: true, opacity: 0.22, depthWrite: false }));
  dev.leaders.frustumCulled = false;
  dev.group.add(dev.leaders);
}

// Parts to buy, shown in amber on the build during the Source step
const buyGroup = new THREE.Group();
{
  const amber = () => new THREE.MeshStandardMaterial({ color: 0xffc15e, emissive: 0xffa31a, emissiveIntensity: 0.5, roughness: 0.4 });
  const sw = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.006), amber()); sw.position.set(0.07, PLATE_TOP + 0.003, -0.06);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.016, 20), amber()); cap.position.set(-0.05, PLATE_TOP + 0.008, -0.05);
  const wires = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.03, PLATE_TOP + 0.01, -0.02), new THREE.Vector3(-0.045, PLATE_TOP + 0.02, 0.0), new THREE.Vector3(-0.04, 0.05, 0.01)]), 16, 0.0012, 6), amber());
  buyGroup.add(sw, cap, wires);
  [['Power switch', sw, [0.1, 0.13, -0.06]], ['Noise capacitor', cap, [-0.12, 0.14, -0.05]], ['Wiring + connectors', wires, [-0.13, 0.08, 0.04]]].forEach(([t, m, tp]) => {
    const tag = makeTag(t, 'To buy', C.amber, 0.016); tag.position.set(...tp); buyGroup.add(tag);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([m.position, new THREE.Vector3(...tp)]),
      new THREE.LineBasicMaterial({ color: C.amber, transparent: true, opacity: 0.6, depthTest: false }));
    line.renderOrder = 24; buyGroup.add(line);
  });
  buyGroup.visible = false;
  bot.group.add(buyGroup);
}
const optional = new Set();

// Print head + layer glow
const nozzle = new THREE.Group();
{
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.018, 16), new THREE.MeshStandardMaterial({ color: 0xc0c6cf, metalness: 0.8, roughness: 0.3 }));
  cone.rotation.x = Math.PI; cone.position.y = 0.011;
  nozzle.add(cone, new THREE.Mesh(new THREE.SphereGeometry(0.0035, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false })));
}
const layer = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
  color: 0xffb347, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
layer.rotation.x = -Math.PI / 2;
nozzle.visible = layer.visible = false;
scene.add(nozzle, layer);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let step = IDENTIFY, stepTime = 0, dirty = true, message = null, messageTime = 0;
let selected = null, hovered = null, partTag = null, partTagFor = null;
let tool = 'pull', mirror = true, xray = false, colorIdx = 0;
let volume = shell.volumeCm3();
let printT = -1, driving = false, driveT = 0, beat = 0, shellAppear = 1;
const tweens = [];
const isXR = () => renderer.xr.isPresenting;

// ---------------------------------------------------------------------------
// Parts: highlight, tweens, docking, slots
// ---------------------------------------------------------------------------
function setGlow(p, level) {
  if (!p || p.glow === level) return;
  p.glow = level;
  p.obj.traverse(o => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m.emissive) continue;
      if (!m.userData.e0) { m.userData.e0 = m.emissive.clone(); m.userData.ei0 = m.emissiveIntensity; }
      if (level > 0) { m.emissive.set(0x2fb6ff); m.emissiveIntensity = level; }
      else { m.emissive.copy(m.userData.e0); m.emissiveIntensity = m.userData.ei0; }
    }
  });
}
function refreshGlow() {
  for (const p of parts) setGlow(p, p === selected ? 0.32 : (p === hovered ? 0.16 : 0));
}

function tween(obj, toPos, toQuat, dur = 0.6, delay = 0, arc = 0, onDone = null) {
  for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].obj === obj) tweens.splice(i, 1);
  tweens.push({ obj, fp: null, fq: null, tp: toPos.clone(), tq: toQuat.clone(), t: -delay, dur, arc, onDone });
}

function dockTarget(p) {
  const e = ease(clamp01(p.device.explodeTarget));
  return p.home.pos.clone().lerp(p.explode, e);
}

function freeSlot(p) {
  if (!p.slot) return;
  p.slot.part = null; p.slot.ghost.visible = step === MERGE; p.slot = null;
}

function returnPart(p, delay = 0, instant = false) {
  freeSlot(p);
  p.device.group.attach(p.obj);
  if (instant) { p.obj.position.copy(dockTarget(p)); p.obj.quaternion.copy(p.home.quat); p.state = 'docked'; return; }
  p.state = 'tween';
  tween(p.obj, dockTarget(p), p.home.quat, 0.6, delay, 0.04, () => { p.state = 'docked'; });
}

function snapToSlot(p, slot, delay = 0, instant = false) {
  freeSlot(p);
  bot.group.attach(p.obj);
  slot.part = p; p.slot = slot; slot.ghost.visible = false;
  if (instant) { p.obj.position.copy(slot.pos); p.obj.quaternion.copy(slot.quat); p.state = 'slotted'; return; }
  p.state = 'tween';
  tween(p.obj, slot.pos, slot.quat, 0.55, delay, 0.07, () => { p.state = 'slotted'; sfx.snap(); dirty = true; });
}

const filledCount = () => bot.slots.filter(s => s.part).length;

function autoAssemble(instant = false) {
  let i = 0;
  for (const slot of bot.slots) {
    if (slot.part) continue;
    const pref = partsById[slot.ghostId];
    const pick = (!pref.slot && pref.state !== 'held' ? pref : null)
      || parts.find(p => p.type === slot.type && !p.slot && p.state !== 'held');
    if (pick && pick.state !== 'held') snapToSlot(pick, slot, i++ * 0.07, instant);
  }
  dirty = true;
}

function nearestSlot(p, maxDist) {
  const wp = p.obj.getWorldPosition(new THREE.Vector3());
  bot.group.worldToLocal(wp);
  let best = null, bd = maxDist;
  for (const s of bot.slots) {
    if (s.part) continue;
    const d = s.pos.distanceTo(wp);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

// Where a held part would drop. With a mouse there's no depth, so match slots by
// where they appear on screen; with hands, use real 3D distance.
function dropSlot(p) {
  if (grab.source !== 'mouse') return nearestSlot(p, 0.075);
  const r = canvas.getBoundingClientRect(), v = new THREE.Vector3();
  let best = null, bd = 55; // pixels
  for (const s of bot.slots) {
    if (s.part) continue;
    s.ghost.getWorldPosition(v).project(camera);
    const d = Math.hypot((v.x - mouse.ndc.x) * r.width / 2, (v.y - mouse.ndc.y) * r.height / 2);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

function select(p) {
  selected = p; dirty = true; refreshGlow();
}

function say(text) { message = text; messageTime = 0; dirty = true; }

// ---------------------------------------------------------------------------
// Grabbing (mouse + XR)
// ---------------------------------------------------------------------------
const grab = { part: null, source: null, prevParent: null, prevState: null, t0: 0, p0: new THREE.Vector3(), moved: false,
  mode: 'move', plane: new THREE.Plane(), offset: new THREE.Vector3() };

const canGrab = () => step === TEARDOWN || step === MERGE;

function beginGrab(p, source) {
  if (p.state === 'tween' || p.state === 'held') return false;
  grab.part = p; grab.source = source; grab.prevParent = p.obj.parent; grab.prevState = p.state;
  grab.t0 = performance.now(); grab.moved = false;
  p.obj.getWorldPosition(grab.p0);
  (source === 'mouse' ? scene : source).attach(p.obj);
  p.state = 'held';
  hovered = null; select(p); sfx.grab();
  return true;
}

function endGrab() {
  const p = grab.part; if (!p) return;
  grab.part = null;
  const quick = !grab.moved && performance.now() - grab.t0 < 350;
  if (quick) { grab.prevParent.attach(p.obj); p.state = grab.prevState; select(p); return; }

  if (step === MERGE) {
    const slot = dropSlot(p);
    if (slot) {
      if (slot.type === p.type) { snapToSlot(p, slot); select(p); return; }
      if (p.id === 'car-battery' && slot.type === 'battery') say('500 mAh is too small: that\'s the car\'s whole problem. Use the speaker\'s 1800 mAh cell.');
      else say(`The ${p.name.toLowerCase()} doesn't go in the ${slot.label.toLowerCase()} slot.`);
      sfx.reject();
    }
  }
  freeSlot(p);
  p.device.group.attach(p.obj);
  p.state = 'free';
  sfx.drop(); dirty = true;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------
const view = { anim: null };
function cameraFor(s) {
  const a = camera.aspect, close = s >= SOURCE;
  const target = close ? new THREE.Vector3(0, 0.28, -0.04) : new THREE.Vector3(0, 0.22, 0);
  const fitW = close ? 0.42 : 0.66;
  const dist = Math.max(close ? 1.0 : 1.2, fitW / (Math.tan(THREE.MathUtils.degToRad(22.5)) * a));
  const dir = close ? new THREE.Vector3(0.2, 0.22, 1).normalize() : new THREE.Vector3(0, 0.3, 1).normalize();
  return { pos: target.clone().addScaledVector(dir, dist), target };
}
function moveCamera(s, instant = false) {
  const v = cameraFor(s);
  if (instant) { camera.position.copy(v.pos); controls.target.copy(v.target); controls.update(); return; }
  view.anim = { fp: camera.position.clone(), ft: controls.target.clone(), tp: v.pos, tt: v.target, t: 0 };
}
controls.addEventListener('start', () => { view.anim = null; });

function goStep(s) {
  const prev = step;
  step = Math.max(0, Math.min(FAB, s)); stepTime = 0; message = null;
  closeSheet();

  if (step <= DIAGNOSE) {
    for (const d of devices) d.explodeTarget = 0;
    for (const p of parts) if (p.state !== 'docked' || p.slot) returnPart(p, 0, prev <= DIAGNOSE);
  }
  if (step === TEARDOWN) {
    for (const d of devices) d.explodeTarget = 1;
    if (prev >= MERGE) parts.filter(p => p.slot).forEach((p, i) => returnPart(p, i * 0.04));
  }
  if (step === MERGE) for (const d of devices) d.explodeTarget = 1;
  if (step >= SOURCE && filledCount() < bot.slots.length) autoAssemble(true);

  bot.group.visible = step >= MERGE;
  bot.blueprint.visible = step === MERGE;
  bot.plate.visible = step >= SOURCE;
  buyGroup.visible = step === SOURCE;
  for (const sl of bot.slots) sl.ghost.visible = step === MERGE && !sl.part;
  for (const d of devices) d.group.visible = step < SOURCE;
  shell.mesh.visible = step >= SCULPT;
  if (step >= SCULPT && prev < SCULPT) shellAppear = 0;
  scanFx.forEach(f => { f.g.visible = step === IDENTIFY; f.tag.visible = false; });
  markers.forEach(m => { m.g.visible = step === DIAGNOSE; });

  if (step === FAB) startPrint();
  else { printT = -1; solidClip.constant = 1000; holoClip.constant = -1000; nozzle.visible = layer.visible = false; stopDrive(); }

  if (step < TEARDOWN) select(null);
  if (!isXR()) moveCamera(step);
  sfx.whoosh(); dirty = true;
}

function startPrint() { printT = 0; stopDrive(); dirty = true; }

let watchWorld = null;
function startDrive() {
  driving = true; driveT = 0; beat = 0;
  const w = bot.slots.find(s => s.type === 'watch').part;
  if (w) watchWorld = { p: w.obj.getWorldPosition(new THREE.Vector3()), q: w.obj.getWorldQuaternion(new THREE.Quaternion()) };
  dirty = true;
}
function stopDrive() {
  if (!driving) return;
  driving = false;
  const ws = bot.slots.find(s => s.type === 'watch');
  if (ws.part) { ws.part.obj.position.copy(ws.pos); ws.part.obj.quaternion.copy(ws.quat); }
  dirty = true;
}

function exportSTL() {
  const geo = shell.geo.clone(); geo.scale(1000, 1000, 1000); // STL in millimeters
  const mesh = new THREE.Mesh(geo); mesh.updateMatrixWorld();
  const data = new STLExporter().parse(mesh, { binary: true });
  const url = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
  const a = document.createElement('a'); a.href = url; a.download = `boombot-shell-${shell.shapeName}.stl`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  say('STL saved. In your slicer (Cura, PrusaSlicer, Bambu), use 0% infill + 3 walls for a hollow shell.');
  sfx.success();
}

// Shopping list: a regular HTML sheet so it's readable and the store links work.
// In the headset, it ends the AR session first and opens the sheet in the browser.
const sheet = document.getElementById('sheet');
let openSheetAfterXR = false;
function openSheet() {
  if (isXR()) { openSheetAfterXR = true; renderer.xr.getSession().end(); return; }
  sheet.innerHTML = sheetHTML(shell.grams(), optional, filledCount());
  sheet.classList.add('open');
  sheet.querySelector('#sheet-close').onclick = closeSheet;
}
function closeSheet() { sheet.classList.remove('open'); }

// ---------------------------------------------------------------------------
// Panel actions
// ---------------------------------------------------------------------------
function action(id) {
  initAudio(); sfx.tap();
  if (id === 'next') return goStep(step + 1);
  if (id === 'back') return goStep(step - 1);
  if (id === 'recenter') { needPlace = true; return; }
  if (id === 'explode') {
    const t = car.explodeTarget > 0.5 ? 0 : 1;
    for (const d of devices) d.explodeTarget = t;
    if (t === 0) parts.filter(p => p.state === 'free').forEach((p, i) => returnPart(p, i * 0.03));
    sfx.whoosh(); dirty = true; return;
  }
  if (id === 'reset') { parts.filter(p => p.state === 'free').forEach((p, i) => returnPart(p, i * 0.03)); dirty = true; return; }
  if (id === 'auto') return autoAssemble();
  if (id === 'clear') { parts.filter(p => p.slot).forEach((p, i) => returnPart(p, i * 0.03)); dirty = true; return; }
  if (id.startsWith('opt:')) { const k = id.slice(4); if (optional.has(k)) optional.delete(k); else optional.add(k); dirty = true; return; }
  if (id === 'shop') return openSheet();
  if (id.startsWith('tool:')) { tool = id.slice(5); dirty = true; return; }
  if (id.startsWith('shape:')) { shell.setShape(id.slice(6)); volume = shell.volumeCm3(); dirty = true; return; }
  if (id.startsWith('color:')) { colorIdx = +id.slice(6); shell.setColor(COLORS[colorIdx]); dirty = true; return; }
  if (id === 'mirror') { mirror = !mirror; dirty = true; return; }
  if (id === 'xray') { xray = !xray; shell.setXray(xray); dirty = true; return; }
  if (id === 'resetShape') { shell.setShape(shell.shapeName); volume = shell.volumeCm3(); dirty = true; return; }
  if (id === 'print') return startPrint();
  if (id === 'stl') return exportSTL();
  if (id === 'drive') { driving ? stopDrive() : startDrive(); return; }
}

// ---------------------------------------------------------------------------
// Panel drawing
// ---------------------------------------------------------------------------
const L = 64, LW = 820, RX = 930, RW = 506;

function drawInspector(y0 = 180, h = 620) {
  panel.card(RX, y0, RW, h);
  const p = selected;
  if (!p) {
    panel.text('Inspector', RX + 40, y0 + 64, { size: 24, weight: 700, color: C.faint, spacing: 3 });
    panel.wrap(isXR() ? 'Point at a part and pinch to grab it. Quick-pinch to inspect.' : 'Click a part to inspect it. Drag to move it, right-drag to turn it.',
      RX + 40, y0 + 130, RW - 80, 42, { size: 30, color: C.dim });
    return;
  }
  panel.text(p.deviceName.toUpperCase(), RX + 40, y0 + 62, { size: 22, weight: 700, color: C.faint, spacing: 2 });
  let y = panel.wrap(p.name, RX + 40, y0 + 122, RW - 80, 52, { size: 46, weight: 700 });
  const chipW = p.keep ? 200 : 140;
  const x = panel.ctx;
  x.beginPath(); x.roundRect(RX + 40, y - 30, chipW, 48, 24);
  x.fillStyle = p.keep ? 'rgba(74,222,128,0.16)' : 'rgba(255,255,255,0.08)'; x.fill();
  panel.text(p.keep ? 'SALVAGE' : 'SKIP', RX + 40 + chipW / 2, y + 3, { size: 24, weight: 700, color: p.keep ? C.green : C.dim, align: 'center', spacing: 2 });
  if (p.slot) panel.text('Installed', RX + 60 + chipW, y + 3, { size: 24, weight: 600, color: C.accent });
  y += 68;
  for (const s of p.specs) y = panel.wrap(s, RX + 40, y, RW - 80, 38, { size: 28, color: C.text });
  y += 14;
  panel.wrap(p.reason, RX + 40, y, RW - 80, 38, { size: 28, color: p.keep ? C.green : C.dim });
}

function drawPanel() {
  const x = panel.begin();
  // Header
  panel.text('SCAVENGER', L, 92, { size: 28, weight: 800, color: C.accent, spacing: 6 });
  const stepLabel = `0${step + 1} / 0${STEPS}   ${STEP_NAMES[step].toUpperCase()}`;
  if (isXR()) {
    panel.button('recenter', panel.W - L - 210, 50, 210, 58, 'Recenter');
    panel.text(stepLabel, panel.W - L - 240, 92, { size: 24, weight: 600, color: C.faint, align: 'right', spacing: 3 });
  } else panel.text(stepLabel, panel.W - L, 92, { size: 24, weight: 600, color: C.faint, align: 'right', spacing: 3 });
  const segW = (panel.W - L * 2 - (STEPS - 1) * 10) / STEPS;
  for (let i = 0; i < STEPS; i++) {
    x.beginPath(); x.roundRect(L + i * (segW + 10), 122, segW, 6, 3);
    x.fillStyle = i <= step ? C.accent : 'rgba(255,255,255,0.1)'; x.fill();
  }
  const title = (t, sub) => {
    panel.text(t, L, 222, { size: 62, weight: 750 });
    return panel.wrap(sub, L, 280, LW, 42, { size: 30, color: C.dim });
  };

  if (step === IDENTIFY) {
    const p = clamp01(stepTime / 3);
    title(p < 1 ? 'Scanning…' : 'Two devices found', p < 1 ? 'Mapping shape, model and internals.' : 'Matched by model number, then mapped from specs and teardowns.');
    devices.forEach((d, i) => {
      const y = 400 + i * 120, done = p > 0.45 + i * 0.3;
      panel.dot(L + 14, y - 12, 9, done ? C.green : C.faint);
      panel.text(d.name, L + 42, y, { size: 36, weight: 650, color: done ? C.text : C.dim });
      panel.text(d.specs, L + 42, y + 44, { size: 27, color: C.dim });
    });
    if (p < 1) panel.bar(L, 660, LW, 10, p);
    panel.card(RX, 180, RW, 620);
    panel.text('SCAN SUMMARY', RX + 40, 244, { size: 22, weight: 700, color: C.faint, spacing: 3 });
    const rows = [['Devices', '2'], ['Parts mapped', `${parts.length}`], ['Worth salvaging', `${KEEP}`], ['Shared voltage', '3.7 V']];
    rows.forEach(([k, v], i) => {
      const y = 330 + i * 86;
      panel.text(k, RX + 40, y, { size: 30, color: C.dim });
      panel.text(p < 1 ? '—' : v, RX + RW - 40, y, { size: 40, weight: 700, align: 'right' });
      x.fillStyle = C.line; x.fillRect(RX + 40, y + 28, RW - 80, 2);
    });
    panel.wrap('Specs from retailer listings. Internals typical for this class.', RX + 40, 700, RW - 80, 36, { size: 24, color: C.faint });
  }

  if (step === DIAGNOSE) {
    title('What\'s holding them back', 'Each device has a weakness the other one solves.');
    let y = 400;
    for (const d of devices) for (const pr of d.problems) {
      panel.dot(L + 14, y - 12, 9, C.red);
      panel.text(pr.title, L + 42, y, { size: 36, weight: 650 });
      x.font = `650 36px ${FONT}`;
      panel.text(d.short, L + 42 + x.measureText(pr.title).width + 22, y, { size: 26, weight: 600, color: C.faint });
      panel.text(pr.text, L + 42, y + 42, { size: 28, color: C.dim });
      y += 116;
    }
    panel.card(RX, 180, RW, 620);
    panel.text('THE INSIGHT', RX + 40, 244, { size: 22, weight: 700, color: C.accent, spacing: 3 });
    let yy = panel.wrap('Both run on one 3.7 V Li-ion cell.', RX + 40, 316, RW - 80, 54, { size: 44, weight: 700 });
    panel.wrap('So their parts can share power. The speaker\'s 1800 mAh battery holds 3.6× the car\'s 500 mAh, and the car\'s motors can finally take the music somewhere.',
      RX + 40, yy + 16, RW - 80, 42, { size: 29, color: C.dim });
  }

  if (step === TEARDOWN) {
    title('Pull them apart', isXR() ? 'Pinch any part to grab it. Move it, turn it, look inside.' : 'Drag any part to move it. Right-drag to turn it.');
    [[parts.length, 'parts', C.text], [KEEP, 'worth saving', C.green], [parts.length - KEEP, 'skip', C.faint]].forEach(([n, l, col], i) => {
      panel.text(`${n}`, L + i * 260, 470, { size: 84, weight: 750, color: col });
      panel.text(l, L + i * 260, 516, { size: 28, color: C.dim });
    });
    const exploded = car.explodeTarget > 0.5;
    panel.button('explode', L, 610, 270, 76, exploded ? 'Assemble' : 'Explode', { active: !exploded });
    panel.button('reset', L + 290, 610, 270, 76, 'Reset parts', { disabled: !parts.some(p => p.state === 'free') });
    drawInspector();
  }

  if (step === MERGE) {
    const n = filledCount();
    title('BoomBot', 'A roaming party speaker you steer by tilting your wrist. Drag parts into the glowing slots.');
    panel.text(`Parts installed`, L, 410, { size: 28, color: C.dim });
    panel.text(`${n} / ${bot.slots.length}`, L + LW, 410, { size: 30, weight: 700, align: 'right', color: n === bot.slots.length ? C.green : C.text });
    panel.bar(L, 430, LW, 10, n / bot.slots.length, n === bot.slots.length ? C.green : C.accent);
    bot.slots.forEach((s, i) => {
      const col = i % 3, row = Math.floor(i / 3), cx = L + col * 280, cy = 470 + row * 56;
      x.beginPath(); x.roundRect(cx, cy, 266, 44, 22);
      x.fillStyle = s.part ? 'rgba(74,222,128,0.13)' : 'rgba(255,255,255,0.05)'; x.fill();
      panel.dot(cx + 24, cy + 22, 6, s.part ? C.green : 'rgba(255,255,255,0.25)');
      panel.text(s.label, cx + 42, cy + 31, { size: 23, weight: 600, color: s.part ? C.text : C.dim });
    });
    drawInspector(180, message ? 470 : 620);
    if (message) {
      panel.card(RX, 666, RW, 134);
      panel.wrap(message, RX + 32, 708, RW - 64, 34, { size: 25, weight: 600, color: C.amber });
    }
  }

  if (step === SOURCE) {
    const g = shell.grams(), c = costs(g, optional);
    title('Source the rest', `${filledCount()} parts came from your two devices. You'd buy these few.`);
    const rows = [...REQUIRED.map(i => [i.name, i.qty, money(i.price)]), [FILAMENT.name, `~${Math.round(g)} g`, money(c.filament)]];
    rows.forEach(([n, q, p], i) => {
      const y = 372 + i * 50;
      panel.dot(L + 10, y - 9, 6, C.amber);
      panel.text(n, L + 30, y, { size: 28, weight: 600 });
      x.font = `600 28px ${FONT}`;
      panel.text(q, L + 46 + x.measureText(n).width, y, { size: 23, color: C.faint });
      panel.text(p, L + LW, y, { size: 28, weight: 650, align: 'right' });
    });
    panel.text('OPTIONAL UPGRADES', L, 690, { size: 22, weight: 700, color: C.faint, spacing: 3 });
    OPTIONAL.forEach((o, i) => panel.button(`opt:${o.id}`, L + i * 278, 708, 262, 64, `${optional.has(o.id) ? '✓ ' : '+ '}${o.short}`, { active: optional.has(o.id) }));
    panel.card(RX, 180, RW, 620);
    panel.text('COST BREAKDOWN', RX + 40, 244, { size: 22, weight: 700, color: C.faint, spacing: 3 });
    const lines = [[`Salvaged (${filledCount()} parts)`, 'Free', C.green], ['Parts to buy', money(c.parts), C.text], ['Filament', money(c.filament), C.text]];
    if (optional.size) lines.push(['Upgrades', money(c.upgrades), C.text]);
    lines.forEach(([k, v, col], i) => {
      const y = 312 + i * 58;
      panel.text(k, RX + 40, y, { size: 28, color: C.dim });
      panel.text(v, RX + RW - 40, y, { size: 30, weight: 700, align: 'right', color: col });
    });
    x.fillStyle = C.line; x.fillRect(RX + 40, 548, RW - 80, 2);
    panel.text('Estimated total', RX + 40, 600, { size: 28, color: C.dim });
    panel.text(money(c.total), RX + RW - 40, 604, { size: 50, weight: 750, align: 'right' });
    panel.text('USD estimates · live prices in the list', RX + 40, 650, { size: 22, color: C.faint });
    panel.button('shop', RX + 40, 700, RW - 80, 72, isXR() ? 'Open shopping list (exits AR)' : 'Open shopping list', { variant: 'primary' });
  }

  if (step === SCULPT) {
    title('Shape the shell', isXR() ? 'Point at the shell and pinch to sculpt it.' : 'Drag on the shell to sculpt. Hold Shift for the opposite tool.');
    const label = (t, y) => panel.text(t, L, y, { size: 22, weight: 700, color: C.faint, spacing: 3 });
    label('TOOL', 384);
    ['pull', 'push', 'smooth'].forEach((t, i) => panel.button(`tool:${t}`, L + i * 220, 404, 204, 70, t[0].toUpperCase() + t.slice(1), { active: tool === t }));
    label('SHAPE', 528);
    Object.entries(SHAPES).forEach(([k, s], i) => panel.button(`shape:${k}`, L + i * 220, 548, 204, 70, s.label, { active: shell.shapeName === k }));
    label('COLOR', 672);
    COLORS.forEach((c, i) => panel.button(`color:${i}`, L + i * 90, 692, 74, 74, '', { swatch: c, active: colorIdx === i }));
    panel.card(RX, 180, RW, 620);
    panel.text('SHELL', RX + 40, 244, { size: 22, weight: 700, color: C.faint, spacing: 3 });
    // Rough estimates for a hollow shell with ~2.5 mm walls at ~22 g/hour
    const g = shell.grams(), hrs = g / 22;
    [['Size', `${Math.round(volume)} cm³`], ['Filament', `~${Math.round(g)} g PLA`], ['Print time', `~${Math.floor(hrs)}h ${Math.round((hrs % 1) * 60)}m`]].forEach(([k, v], i) => {
      const y = 320 + i * 80;
      panel.text(k, RX + 40, y, { size: 29, color: C.dim });
      panel.text(v, RX + RW - 40, y, { size: 34, weight: 700, align: 'right' });
    });
    panel.button('mirror', RX + 40, 572, 200, 64, 'Mirror', { active: mirror });
    panel.button('xray', RX + 256, 572, 210, 64, 'X-ray', { active: xray });
    panel.button('resetShape', RX + 40, 656, RW - 80, 64, 'Reset shape');
  }

  if (step === FAB) {
    const p = printT < 0 ? 0 : clamp01(printT / PRINT_DUR);
    title(p < 1 ? 'Printing the shell' : 'BoomBot is ready', p < 1 ? 'Layer by layer, from your sculpt.' : 'Export the shell and print it for real.');
    panel.text(p < 1 ? `${Math.round(p * 100)}%` : 'Done', L, 410, { size: 30, weight: 700, color: p < 1 ? C.amber : C.green });
    panel.bar(L, 428, LW, 10, p, p < 1 ? C.amber : C.green);
    const tasks = ['Print shell + base plate', 'Mount motors, gearboxes, wheels', 'Wire 1800 mAh cell to both boards', 'Pair gesture watch + phone'];
    tasks.forEach((t, i) => {
      const done = p >= 1 && printT > PRINT_DUR + 0.4 * (i + 1);
      const y = 494 + i * 52;
      panel.dot(L + 12, y - 9, 8, done ? C.green : 'rgba(255,255,255,0.2)');
      panel.text(t, L + 36, y, { size: 28, color: done ? C.text : C.faint });
    });
    panel.button('stl', L, 712, 260, 74, 'Export STL', { disabled: p < 1 });
    panel.button('drive', L + 280, 712, 260, 74, driving ? 'Stop' : 'Test drive', { active: driving, disabled: p < 1 });
    panel.button('print', L + 560, 712, 260, 74, 'Reprint', { disabled: p < 1 });
    panel.card(RX, 180, RW, 620);
    panel.text('BUILD SUMMARY', RX + 40, 244, { size: 22, weight: 700, color: C.faint, spacing: 3 });
    const cost = costs(shell.grams(), optional).total;
    [['Salvaged parts', `${filledCount()}`], ['Parts to buy', money(cost)], ['Battery', '1800 mAh'], ['vs. car battery', '3.6×'], ['Control', 'Wrist + BT']].forEach(([k, v], i) => {
      const y = 320 + i * 70;
      panel.text(k, RX + 40, y, { size: 29, color: C.dim });
      panel.text(v, RX + RW - 40, y, { size: 34, weight: 700, align: 'right' });
    });
    if (message) panel.wrap(message, RX + 40, 700, RW - 80, 34, { size: 24, weight: 600, color: C.green });
  }

  // Footer
  if (step > 0) panel.button('back', L, 842, 200, 76, 'Back');
  if (step === MERGE) {
    panel.button('auto', L + 220, 842, 290, 76, 'Auto-assemble', { disabled: filledCount() === bot.slots.length });
    panel.button('clear', L + 530, 842, 200, 76, 'Clear', { disabled: filledCount() === 0 });
  }
  const NEXT = ['Diagnose', 'Tear down', 'Merge', 'Source parts', 'Sculpt', 'Fabricate'];
  if (step < FAB) panel.button('next', panel.W - L - 320, 842, 320, 76, `${NEXT[step]}  →`, { variant: 'primary', disabled: step === IDENTIFY && stepTime < 3 });
  panel.end();
}

// ---------------------------------------------------------------------------
// Raycasting
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
function classify(o) {
  while (o) {
    if (o === panel.mesh) return { kind: 'panel' };
    if (o === shell.mesh) return { kind: 'shell' };
    if (o.userData && o.userData.part) return { kind: 'part', part: o.userData.part };
    o = o.parent;
  }
  return null;
}
function cast(rc) {
  const targets = [panel.mesh];
  if (canGrab()) for (const p of parts) if (p.state !== 'tween' && p.state !== 'held' && p.obj.visible) targets.push(p.obj);
  if (step === SCULPT && shell.mesh.visible) targets.push(shell.mesh);
  for (const h of rc.intersectObjects(targets, true)) {
    if (h.object === shell.holo) continue;
    const k = classify(h.object);
    if (k) return { ...k, point: h.point, uv: h.uv, distance: h.distance };
  }
  return null;
}
function brushAt(hitPoint, t, dt) {
  const local = shell.mesh.worldToLocal(hitPoint.clone());
  shell.brush(local, t, dt, mirror);
}
const invert = t => t === 'pull' ? 'push' : t === 'push' ? 'pull' : t;

// ---------------------------------------------------------------------------
// Mouse / touch
// ---------------------------------------------------------------------------
const mouse = { ndc: new THREE.Vector2(), has: false, down: false, button: 0, sx: 0, sy: 0, lx: 0, ly: 0, candidate: null, sculpting: false, shift: false };
const canvas = renderer.domElement;
function mouseRay(e) {
  const r = canvas.getBoundingClientRect();
  mouse.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  mouse.has = true;
  raycaster.setFromCamera(mouse.ndc, camera);
}
// Capture phase on window so we can stop OrbitControls before it starts rotating
window.addEventListener('pointerdown', e => {
  if (e.target !== canvas || isXR()) return;
  initAudio();
  mouseRay(e);
  mouse.down = true; mouse.button = e.button; mouse.sx = mouse.lx = e.clientX; mouse.sy = mouse.ly = e.clientY; mouse.shift = e.shiftKey;
  const hit = cast(raycaster);
  if (!hit) return;
  if (hit.kind === 'panel') { const b = panel.hitButton(hit.uv); if (b) action(b.id); }
  else if (hit.kind === 'part') mouse.candidate = hit;
  else if (hit.kind === 'shell') mouse.sculpting = true;
  controls.enabled = false;
  e.stopPropagation();
}, { capture: true });

window.addEventListener('pointermove', e => {
  if (isXR()) return;
  mouseRay(e);
  mouse.shift = e.shiftKey;
  const dx = e.clientX - mouse.lx, dy = e.clientY - mouse.ly;
  mouse.lx = e.clientX; mouse.ly = e.clientY;
  if (mouse.candidate && !grab.part && Math.hypot(e.clientX - mouse.sx, e.clientY - mouse.sy) > 4) {
    if (beginGrab(mouse.candidate.part, 'mouse')) {
      grab.mode = mouse.button === 2 ? 'rotate' : 'move';
      grab.moved = true;
      const wp = grab.part.obj.position; // parent is scene now
      grab.plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), wp);
      const hp = new THREE.Vector3(); raycaster.ray.intersectPlane(grab.plane, hp);
      grab.offset.copy(wp).sub(hp);
    }
    mouse.candidate = null;
  }
  if (grab.part && grab.source === 'mouse') {
    const o = grab.part.obj;
    if (grab.mode === 'move') {
      const hp = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(grab.plane, hp)) { o.position.copy(hp.add(grab.offset)); o.position.y = Math.max(bench.position.y, o.position.y); }
    } else {
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      o.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), dx * 0.012);
      o.rotateOnWorldAxis(right, dy * 0.012);
    }
  }
});

window.addEventListener('pointerup', () => {
  if (isXR()) return;
  if (mouse.candidate) { select(mouse.candidate.part); sfx.tap(); }
  if (grab.part && grab.source === 'mouse') endGrab();
  if (mouse.sculpting) { volume = shell.volumeCm3(); dirty = true; }
  mouse.candidate = null; mouse.sculpting = false; mouse.down = false;
  controls.enabled = true;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') { initAudio(); goStep(step + 1); }
  if (e.key === 'ArrowLeft') { initAudio(); goStep(step - 1); }
  mouse.shift = e.shiftKey;
});
window.addEventListener('keyup', e => { mouse.shift = e.shiftKey; });

// ---------------------------------------------------------------------------
// XR controllers / hands (pinch = select)
// ---------------------------------------------------------------------------
const tmpM = new THREE.Matrix4();
const ctrls = [0, 1].map(i => {
  const c = renderer.xr.getController(i);
  scene.add(c);
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x5be7ff, transparent: true, opacity: 0.5 }));
  line.visible = false; c.add(line);
  const cursor = new THREE.Mesh(new THREE.RingGeometry(0.005, 0.0075, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, side: THREE.DoubleSide }));
  cursor.renderOrder = 40; cursor.visible = false; scene.add(cursor);
  const st = { c, line, cursor, hit: null, connected: false, sculpting: false };
  c.addEventListener('connected', () => { st.connected = true; line.visible = true; });
  c.addEventListener('disconnected', () => { st.connected = false; line.visible = false; cursor.visible = false; });
  c.addEventListener('selectstart', () => {
    initAudio();
    const hit = st.hit; if (!hit) return;
    if (hit.kind === 'panel') { const b = panel.hitButton(hit.uv); if (b) action(b.id); }
    else if (hit.kind === 'part' && !grab.part) beginGrab(hit.part, c);
    else if (hit.kind === 'shell') st.sculpting = true;
  });
  c.addEventListener('selectend', () => {
    if (grab.part && grab.source === c) endGrab();
    if (st.sculpting) { st.sculpting = false; volume = shell.volumeCm3(); dirty = true; }
  });
  return st;
});

function updateControllers(dt) {
  for (const st of ctrls) {
    if (!st.connected) continue;
    tmpM.identity().extractRotation(st.c.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(st.c.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmpM);
    const holding = grab.part && grab.source === st.c;
    st.hit = holding ? null : cast(raycaster);
    const dist = st.hit ? st.hit.distance : 0.6;
    st.line.scale.z = dist;
    st.cursor.visible = !!st.hit;
    if (st.hit) { st.cursor.position.copy(st.hit.point); st.cursor.lookAt(raycaster.ray.origin); }
    if (st.sculpting && st.hit && st.hit.kind === 'shell') brushAt(st.hit.point, tool, dt);
    if (holding && !grab.moved) {
      const wp = grab.part.obj.getWorldPosition(new THREE.Vector3());
      if (wp.distanceTo(grab.p0) > 0.012) grab.moved = true;
    }
  }
}

// ---------------------------------------------------------------------------
// XR session
// ---------------------------------------------------------------------------
let needPlace = false;
const arButton = ARButton.createButton(renderer, { optionalFeatures: ['local-floor', 'hand-tracking'] });
document.body.appendChild(arButton); // styled in index.html (#ARButton)

renderer.xr.addEventListener('sessionstart', () => {
  scene.background = null;
  bench.scale.setScalar(XR_SCALE);
  panel.mesh.scale.setScalar(1);
  document.getElementById('ui').style.display = 'none';
  needPlace = true; dirty = true;
});
renderer.xr.addEventListener('sessionend', () => {
  scene.background = BG;
  bench.position.set(0, 0, 0); bench.rotation.set(0, 0, 0); bench.scale.setScalar(1);
  panel.mesh.scale.setScalar(DESKTOP_PANEL_SCALE);
  document.getElementById('ui').style.display = '';
  moveCamera(step, true); dirty = true;
  if (openSheetAfterXR) { openSheetAfterXR = false; openSheet(); }
});

function placeBench() {
  const cam = renderer.xr.getCamera();
  const head = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(cam.matrixWorld));
  fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
  bench.position.copy(head).addScaledVector(fwd, 0.62); bench.position.y = head.y - 0.55;
  bench.rotation.set(0, Math.atan2(-fwd.x, -fwd.z), 0);
  needPlace = false;
}

// ---------------------------------------------------------------------------
// Frame loop
// ---------------------------------------------------------------------------
const PRINT_DUR = 7;
const clock = new THREE.Clock();
const tmpV = new THREE.Vector3(), tmpBox = new THREE.Box3(), tmpC = new THREE.Vector3(), tmpS = new THREE.Vector3();
let lastHover = null, panelHover = null, redrawTick = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  stepTime += dt; messageTime += dt;
  if (message && messageTime > 6 && step !== FAB) { message = null; dirty = true; }

  if (isXR() && needPlace && renderer.xr.getCamera().matrixWorld.elements[15]) placeBench();

  // Hover from mouse or hands
  let hoverPart = null, hoverButton = null;
  if (isXR()) {
    updateControllers(dt);
    for (const st of ctrls) {
      if (!st.hit) continue;
      if (st.hit.kind === 'part') hoverPart = st.hit.part;
      if (st.hit.kind === 'panel') { const b = panel.hitButton(st.hit.uv); if (b) hoverButton = b.id; }
    }
  } else if (mouse.has) {
    raycaster.setFromCamera(mouse.ndc, camera);
    const hit = grab.part ? null : cast(raycaster);
    if (hit && hit.kind === 'part') hoverPart = hit.part;
    if (hit && hit.kind === 'panel') { const b = panel.hitButton(hit.uv); if (b) hoverButton = b.id; }
    canvas.style.cursor = grab.part ? 'grabbing' : hoverPart ? 'grab' : hoverButton ? 'pointer' : (hit && hit.kind === 'shell') ? 'crosshair' : '';
    if (mouse.sculpting && hit && hit.kind === 'shell') brushAt(hit.point, mouse.shift ? invert(tool) : tool, dt);
  }
  if (hoverPart !== lastHover) { hovered = hoverPart; lastHover = hoverPart; refreshGlow(); if (hoverPart) sfx.hover(); }
  if (hoverButton !== panelHover) { panelHover = hoverButton; panel.hover = hoverButton; dirty = true; }

  // Explode + docked parts + leader lines
  for (const d of devices) {
    d.explodeT += (d.explodeTarget - d.explodeT) * Math.min(1, dt * 2.6);
    const pos = d.leaders.geometry.attributes.position;
    d.parts.forEach((p, i) => {
      if (p.state === 'docked') {
        const delay = (i % 7) * 0.05;
        const e = ease(clamp01((d.explodeT * 1.3) - delay));
        p.obj.position.lerpVectors(p.home.pos, p.explode, e);
        p.obj.quaternion.copy(p.home.quat);
      }
      const show = p.state === 'docked' && d.explodeT > 0.05;
      const a = p.home.pos, b = show ? p.obj.position : p.home.pos;
      pos.setXYZ(i * 2, a.x, a.y, a.z); pos.setXYZ(i * 2 + 1, b.x, b.y, b.z);
    });
    pos.needsUpdate = true;
  }

  // Tweens
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    if (tw.t < 0) continue;
    if (!tw.fp) { tw.fp = tw.obj.position.clone(); tw.fq = tw.obj.quaternion.clone(); }
    const k = ease(clamp01(tw.t / tw.dur));
    tw.obj.position.lerpVectors(tw.fp, tw.tp, k);
    tw.obj.position.y += Math.sin(Math.PI * k) * tw.arc;
    tw.obj.quaternion.slerpQuaternions(tw.fq, tw.tq, k);
    if (k >= 1) { tweens.splice(i, 1); if (tw.onDone) tw.onDone(); }
  }

  // Step-specific animation
  if (step === IDENTIFY) {
    scanFx.forEach((f, i) => {
      const t = stepTime - i * 0.35, active = t > 0 && t < 3;
      f.sweep.visible = active;
      f.sweep.position.y = -f.hy + (f.hy * 2) * (0.5 - 0.5 * Math.cos(t * 3));
      f.brackets.material.opacity = active ? 0.55 + 0.45 * Math.sin(t * 12) : 0.6;
      if (!f.tag.visible && t > 2.2) { f.tag.visible = true; sfx.snap(); }
    });
    if (stepTime < 3 && Math.floor(stepTime * 7) !== Math.floor((stepTime - dt) * 7)) sfx.scanTick();
    if (stepTime < 3.2) dirty = true;
  }
  if (step === DIAGNOSE) markers.forEach((m, i) => { const s = 1 + 0.5 * ((stepTime * 1.2 + i * 0.3) % 1); m.halo.scale.setScalar(s); m.halo.material.opacity = 1 - ((stepTime * 1.2 + i * 0.3) % 1); m.halo.lookAt(camera.position); });

  if (step === MERGE) {
    const pulse = 0.12 + 0.06 * Math.sin(stepTime * 4);
    const target = grab.part ? dropSlot(grab.part) : null;
    for (const s of bot.slots) {
      if (s.part) continue;
      const hot = grab.part && grab.part.type === s.type;
      const o = s === target && hot ? 0.55 : hot ? 0.3 + 0.1 * Math.sin(stepTime * 8) : pulse;
      s.ghost.traverse(m => { if (m.isMesh) m.material.opacity = o; });
    }
  }

  if (shell.mesh.visible && shellAppear < 1) {
    shellAppear = Math.min(1, shellAppear + dt / 0.8);
    shell.mesh.scale.setScalar(Math.max(0.001, easeOutBack(shellAppear)));
  }

  // Printing
  if (step === FAB && printT >= 0) {
    const was = printT; printT += dt;
    shell.mesh.updateMatrixWorld();
    tmpBox.copy(shell.geo.boundingBox).applyMatrix4(shell.mesh.matrixWorld);
    tmpBox.getCenter(tmpC); tmpBox.getSize(tmpS);
    const p = clamp01(printT / PRINT_DUR);
    if (p < 1) {
      const h = tmpBox.min.y + tmpS.y * p;
      solidClip.constant = h; holoClip.constant = -h;
      const a = printT * 10;
      nozzle.position.set(tmpC.x + Math.cos(a) * tmpS.x * 0.4, h + 0.002, tmpC.z + Math.sin(a * 1.3) * tmpS.z * 0.4);
      nozzle.scale.setScalar(bench.scale.x);
      layer.position.set(tmpC.x, h, tmpC.z); layer.scale.set(tmpS.x * 1.1, tmpS.z * 1.1, 1);
      nozzle.visible = layer.visible = true;
      if (Math.floor(printT * 5) !== Math.floor(was * 5)) sfx.printTick();
    } else {
      solidClip.constant = 1000; holoClip.constant = -1000; nozzle.visible = layer.visible = false;
      if (was < PRINT_DUR) sfx.success();
    }
    if (printT < PRINT_DUR + 2.2) dirty = true;
  }

  // Test drive
  const ringParts = parts.filter(p => p.type === 'ring');
  for (const r of ringParts) { const g = r.obj.getObjectByName('ringGlow'); if (g) g.rotation.z += dt * (driving ? 4 : 0.8); }
  if (driving) {
    driveT += dt;
    const R = 0.11, w = 0.9, a = driveT * w;
    bot.group.position.set(BOT_HOME.x + Math.sin(a) * R, BOT_HOME.y, BOT_HOME.z + (Math.cos(a) - 1) * R * 0.7);
    // Face along the direction of travel (velocity of the path above)
    bot.group.rotation.y = Math.atan2(Math.cos(a), -0.7 * Math.sin(a));
    for (const s of bot.slots) if (s.type === 'wheel' && s.part) s.part.obj.rotateX(dt * 9);
    const ws = bot.slots.find(s => s.type === 'watch');
    if (ws.part && watchWorld) {
      bot.group.updateMatrixWorld();
      ws.part.obj.position.copy(bot.group.worldToLocal(watchWorld.p.clone()));
      const pq = bot.group.getWorldQuaternion(new THREE.Quaternion()).invert();
      ws.part.obj.quaternion.copy(pq.multiply(watchWorld.q));
    }
    const b = Math.floor(driveT / 0.24);
    if (b !== beat) { beat = b; if (b % 2 === 0) sfx.kick(); else sfx.hat(); }
    const env = 1 - ((driveT / 0.48) % 1);
    for (const r of ringParts) { const g = r.obj.getObjectByName('ringGlow'); if (g) g.scale.setScalar(1 + env * env * 0.12); }
  } else {
    bot.group.position.lerp(BOT_HOME, Math.min(1, dt * 6));
    bot.group.rotation.y += (0 - bot.group.rotation.y) * Math.min(1, dt * 6);
  }

  // Part name tag (hovered, else selected)
  const tagPart = hovered || (canGrab() ? selected : null);
  if (tagPart !== partTagFor) {
    if (partTag) { partTag.parent && partTag.parent.remove(partTag); partTag.material.map.dispose(); partTag.material.dispose(); partTag = null; }
    partTagFor = tagPart;
    if (tagPart) {
      partTag = makeTag(tagPart.name, tagPart.keep ? 'Salvage' : 'Skip', tagPart.keep ? C.green : C.faint, 0.02);
      partTag.userData.base = partTag.scale.clone();
      scene.add(partTag);
    }
  }
  if (partTag && partTagFor) {
    tmpBox.setFromObject(partTagFor.obj);
    partTag.position.set((tmpBox.min.x + tmpBox.max.x) / 2, tmpBox.max.y + 0.012 * bench.scale.x, (tmpBox.min.z + tmpBox.max.z) / 2);
    partTag.scale.copy(partTag.userData.base).multiplyScalar(bench.scale.x);
  }

  // Panel
  if (dirty) { drawPanel(); dirty = false; }

  if (!isXR()) {
    if (view.anim) {
      view.anim.t = Math.min(1, view.anim.t + dt / 1.1);
      const k = ease(view.anim.t);
      camera.position.lerpVectors(view.anim.fp, view.anim.tp, k);
      controls.target.lerpVectors(view.anim.ft, view.anim.tt, k);
      if (view.anim.t >= 1) view.anim = null;
    }
    controls.update();
  }
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (!isXR()) moveCamera(step, true);
});

moveCamera(IDENTIFY, true);
goStep(IDENTIFY);

// Hooks for automated tests
window.__scavenger = { goStep, action, get step() { return step; }, get message() { return message; }, parts, bot, shell, filledCount, camera, panel };
