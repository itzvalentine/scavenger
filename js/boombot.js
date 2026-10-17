// BoomBot: the merged build. A printed base plate with slots for salvaged parts.
import * as THREE from 'three';
import { rbox, mat } from './kit.js';
import { makeTag } from './ui.js';

export const PLATE_Y = 0.062, PLATE_TOP = 0.066;

export const SLOT_DEFS = [
  { id: 'w1', type: 'wheel', label: 'Wheel', pos: [-0.105, 0.042, 0.066], ghost: 'car-wheel-fl' },
  { id: 'w2', type: 'wheel', label: 'Wheel', pos: [0.105, 0.042, 0.066], ghost: 'car-wheel-fr' },
  { id: 'w3', type: 'wheel', label: 'Wheel', pos: [-0.105, 0.042, -0.066], ghost: 'car-wheel-rl' },
  { id: 'w4', type: 'wheel', label: 'Wheel', pos: [0.105, 0.042, -0.066], ghost: 'car-wheel-rr' },
  { id: 'm1', type: 'motor', label: 'Motor L', pos: [-0.04, 0.042, 0], rot: [0, Math.PI, 0], ghost: 'car-motor-l' },
  { id: 'm2', type: 'motor', label: 'Motor R', pos: [0.04, 0.042, 0], ghost: 'car-motor-r' },
  { id: 'g1', type: 'gearbox', label: 'Gearbox L', pos: [-0.075, 0.042, 0], rot: [0, Math.PI, 0], ghost: 'car-gear-l' },
  { id: 'g2', type: 'gearbox', label: 'Gearbox R', pos: [0.075, 0.042, 0], ghost: 'car-gear-r' },
  { id: 'bat', type: 'battery', label: 'Battery', pos: [0, PLATE_TOP + 0.0095, -0.022], ghost: 'spk-battery' },
  { id: 'amp', type: 'audio', label: 'Audio board', pos: [0, PLATE_TOP + 0.022, -0.022], ghost: 'spk-board' },
  { id: 'rx', type: 'rx', label: 'Receiver', pos: [0, PLATE_TOP + 0.033, -0.024], ghost: 'car-rx' },
  { id: 'usb', type: 'usbc', label: 'USB-C', pos: [0.02, PLATE_TOP + 0.002, -0.068], rot: [0, Math.PI / 2, 0], ghost: 'spk-usbc' },
  { id: 'drv', type: 'driver', label: 'Speaker', pos: [0, PLATE_TOP + 0.03, 0.07], ghost: 'spk-driver' },
  { id: 'ring', type: 'ring', label: 'Light ring', pos: [0, PLATE_TOP + 0.03, 0.079], ghost: 'spk-ring' },
  { id: 'rad', type: 'radiator', label: 'Bass radiator', pos: [0, PLATE_TOP + 0.03, -0.089], rot: [0, Math.PI, 0], ghost: 'spk-radiator' },
  { id: 'led1', type: 'led', label: 'Headlights', pos: [0, PLATE_Y, 0.08], ghost: 'car-led-f' },
  { id: 'led2', type: 'led', label: 'Tail lights', pos: [0, PLATE_Y, -0.08], rot: [0, Math.PI, 0], ghost: 'car-led-r' },
  { id: 'watch', type: 'watch', label: 'Gesture watch', pos: [0.175, 0.0075, 0.12], rot: [0, -0.5, 0], ghost: 'car-watch' },
];

export function buildBoomBot(partsById) {
  const group = new THREE.Group();

  // Blueprint plate (shown while merging) and printed plate (shown after)
  const blueprint = new THREE.Group();
  const bpFill = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.008, 0.15), new THREE.MeshBasicMaterial({
    color: 0x5be7ff, transparent: true, opacity: 0.08, depthWrite: false }));
  bpFill.position.y = PLATE_Y; blueprint.add(bpFill);
  const bpEdges = new THREE.LineSegments(new THREE.EdgesGeometry(bpFill.geometry), new THREE.LineBasicMaterial({
    color: 0x5be7ff, transparent: true, opacity: 0.7 }));
  bpEdges.position.y = PLATE_Y; blueprint.add(bpEdges);
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.152, 96), new THREE.MeshBasicMaterial({
    color: 0x5be7ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  floorRing.rotation.x = -Math.PI / 2; floorRing.position.y = 0.001; blueprint.add(floorRing);
  const tag = makeTag('BoomBot', 'Blueprint', '#5be7ff', 0.024);
  tag.position.set(0, 0.2, 0); blueprint.add(tag);
  group.add(blueprint);

  const plate = new THREE.Group();
  const pm = rbox(0.17, 0.008, 0.15, 0.006, mat(0x30343b, { roughness: 0.6 }));
  pm.position.y = PLATE_Y; plate.add(pm);
  plate.visible = false;
  group.add(plate);

  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x5be7ff, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false });
  const slots = SLOT_DEFS.map(def => {
    const src = partsById[def.ghost].obj;
    // userData links back to the part (circular), which clone() can't copy
    const ud = src.userData; src.userData = {};
    const ghost = src.clone(true);
    src.userData = ud;
    ghost.traverse(o => { if (o.isMesh) { o.material = ghostMat.clone(); o.raycast = () => {}; } });
    ghost.position.set(...def.pos);
    ghost.rotation.set(...(def.rot || [0, 0, 0]));
    group.add(ghost);
    return {
      ...def, ghostId: def.ghost, ghost, part: null,
      pos: ghost.position.clone(), quat: ghost.quaternion.clone(),
    };
  });

  return { group, blueprint, plate, slots };
}
