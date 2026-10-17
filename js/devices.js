// The two scanned devices, modeled from retailer specs + typical teardowns of this class.
// Units are meters. Each device's origin sits on the table, front facing +Z.
import * as THREE from 'three';
import {
  mat, metal, rbox, at, canvasTexture, pcb, tire, motor130, gearbox, battery18650, pouchBattery,
  driver45, passiveRadiator, lightRing, ledBar, usbcBoard,
} from './kit.js';

function makeDevice(info) {
  const group = new THREE.Group();
  const parts = [];
  function part(def, obj, home, explode) {
    obj.userData.partId = def.id;
    at(obj, ...home);
    group.add(obj);
    const p = {
      ...def, obj, deviceName: info.name,
      home: { pos: obj.position.clone(), quat: obj.quaternion.clone() },
      explode: new THREE.Vector3(...explode),
      state: 'docked', slot: null, glow: 0,
    };
    obj.userData.part = p;
    parts.push(p);
    return p;
  }
  return { ...info, group, parts, part, explodeT: 0, explodeTarget: 0 };
}

// ---------------------------------------------------------------------------
// CV-C500 gesture stunt car (double-sided, 4WD, 2.4 GHz, gesture watch)
// ---------------------------------------------------------------------------
export function buildCar() {
  const dev = makeDevice({
    id: 'car', name: 'CV-C500 Stunt Car', short: 'Stunt car',
    specs: '2.4 GHz · 4WD · gesture watch · 3.7 V Li-ion',
  });
  const { part } = dev;
  const RED = 0xd8312f, R = 0.042, W = 0.034;

  // Top shell
  {
    const g = new THREE.Group();
    g.add(rbox(0.17, 0.024, 0.22, 0.011, mat(RED, { roughness: 0.32 })));
    const glass = rbox(0.1, 0.008, 0.095, 0.004, mat(0x111418, { roughness: 0.12, metalness: 0.3 }));
    glass.position.set(0, 0.012, -0.012); g.add(glass);
    for (const x of [-0.05, 0.05]) {
      const hl = rbox(0.03, 0.007, 0.006, 0.002, mat(0xffffff, { emissive: 0xdde9ff, emissiveIntensity: 0.6 }));
      hl.position.set(x, 0.004, 0.108); g.add(hl);
    }
    for (const x of [-0.07, 0.07]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.0012, 0.18), mat(0x16171a));
      stripe.position.set(x, 0.0122, 0); g.add(stripe);
    }
    part({ id: 'car-top', name: 'Top shell', type: 'shell', keep: false,
      specs: ['ABS plastic body', 'Double-sided: drives either way up'],
      reason: 'Replaced by your new printed shell.' }, g, [0, 0.06, 0], [0, 0.31, 0]);
  }
  // Bottom shell (double-sided car, mirrored cockpit)
  {
    const g = new THREE.Group();
    g.add(rbox(0.17, 0.024, 0.22, 0.011, mat(0x1f2126, { roughness: 0.5 })));
    const glass = rbox(0.1, 0.008, 0.095, 0.004, mat(0x111418, { roughness: 0.12, metalness: 0.3 }));
    glass.position.set(0, -0.012, -0.012); g.add(glass);
    const sw = rbox(0.012, 0.004, 0.02, 0.0015, mat(0xf5c400)); sw.position.set(0.03, -0.0125, 0.06); g.add(sw);
    part({ id: 'car-bottom', name: 'Bottom shell', type: 'shell', keep: false,
      specs: ['ABS plastic, power switch + charge port'],
      reason: 'The new build gets its own base plate.' }, g, [0, 0.024, 0], [0, 0.012, 0]);
  }
  // Chassis frame
  {
    const g = new THREE.Group();
    g.add(rbox(0.12, 0.022, 0.17, 0.004, mat(0x2b2f36, { roughness: 0.7 })));
    for (const z of [-0.06, -0.02, 0.02, 0.06]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.003, 0.004), mat(0x3a3f47)); rib.position.set(0, 0.0115, z); g.add(rib);
    }
    part({ id: 'car-chassis', name: 'Chassis frame', type: 'frame', keep: false,
      specs: ['Plastic tub holding motors + gearboxes'],
      reason: 'BoomBot uses a printed base plate instead.' }, g, [0, 0.042, 0], [0, 0.065, 0]);
  }
  // Wheels
  [['fl', -1, 1], ['fr', 1, 1], ['rl', -1, -1], ['rr', 1, -1]].forEach(([k, sx, sz]) => {
    part({ id: `car-wheel-${k}`, name: 'Stunt wheel', type: 'wheel', keep: true,
      specs: ['Soft rubber tire, ~84 mm (est.)', 'Deep tread for climbing'],
      reason: 'Grippy wheels: BoomBot can roll over anything.' },
    tire(R, W), [sx * 0.1025, R, sz * 0.072], [sx * 0.21, R, sz * 0.105]);
  });
  // Motors (pinion faces outward toward each gearbox)
  [['l', -1], ['r', 1]].forEach(([k, s]) => {
    part({ id: `car-motor-${k}`, name: `Drive motor ${k.toUpperCase()}`, type: 'motor', keep: true,
      specs: ['Brushed DC, 130-size class (typical)', 'One per side: tank-style steering'],
      reason: 'Drives BoomBot. One per side lets it spin on the spot.' },
    motor130(), [s * 0.036, 0.042, 0, 0, s < 0 ? Math.PI : 0, 0], [s * 0.06, 0.13, 0.0]);
  });
  // Gearboxes (gears face outward)
  [['l', -1], ['r', 1]].forEach(([k, s]) => {
    part({ id: `car-gear-${k}`, name: `Gearbox ${k.toUpperCase()}`, type: 'gearbox', keep: true,
      specs: ['Nylon reduction gears', 'Trades speed for torque'],
      reason: 'Gives the motors enough torque to carry a speaker.' },
    gearbox(), [s * 0.071, 0.042, 0, 0, s < 0 ? Math.PI : 0, 0], [s * 0.125, 0.13, 0]);
  });
  // Battery: the car's weak spot
  part({ id: 'car-battery', name: 'Car battery', type: 'battery-small', keep: false,
    specs: ['Li-ion 3.7 V · 500 mAh (typical for this class)', 'About 20–45 min of driving'],
    reason: 'Too small. This is the car\'s main problem.' },
  pouchBattery(['3.7V', '500mAh']), [0, 0.04, -0.05], [0, 0.175, -0.045]);
  // Receiver + motor driver
  part({ id: 'car-rx', name: '2.4 GHz receiver', type: 'rx', keep: true,
    specs: ['2.4 GHz radio receiver', 'Dual H-bridge motor driver', 'Pairs with the gesture watch'],
    reason: 'Listens to the watch and drives both motors.' },
  pcb({ w: 0.05, d: 0.04, seed: 3, color: '#0f3d63',
    chips: [{ x: -0.008, z: 0.004, w: 0.012, d: 0.012, label: '2.4G' }, { x: 0.013, z: -0.007, w: 0.01, d: 0.008, label: 'DRV' }],
    caps: [{ x: 0.016, z: 0.012, r: 0.0025, h: 0.006 }, { x: -0.019, z: -0.013, r: 0.002, h: 0.005 }] }),
  [0, 0.056, 0.042], [0, 0.225, 0.03]);
  // Lights
  part({ id: 'car-led-f', name: 'Headlights', type: 'led', keep: true,
    specs: ['White LED bar'], reason: 'BoomBot\'s headlights.' },
  ledBar(0xffffff), [0, 0.046, 0.107], [0, 0.11, 0.2]);
  part({ id: 'car-led-r', name: 'Tail lights', type: 'led', keep: true,
    specs: ['Red LED bar'], reason: 'BoomBot\'s tail lights.' },
  ledBar(0xff2a2a), [0, 0.046, -0.107, 0, Math.PI, 0], [0, 0.11, -0.2]);
  // Gesture watch
  {
    const g = new THREE.Group();
    g.add(rbox(0.038, 0.011, 0.034, 0.005, mat(0x17181b, { roughness: 0.35 })));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.026), new THREE.MeshBasicMaterial({
      toneMapped: false,
      map: canvasTexture(300, 260, (x, w, h) => {
        x.fillStyle = '#05090f'; x.fillRect(0, 0, w, h);
        x.strokeStyle = '#4fd8ff'; x.lineWidth = 10; x.lineCap = 'round';
        x.beginPath(); x.arc(w / 2, h / 2, 70, -2.4, -0.7); x.stroke();
        x.beginPath(); x.arc(w / 2, h / 2, 70, 0.7, 2.4); x.stroke();
        x.fillStyle = '#4fd8ff'; x.beginPath(); x.arc(w / 2, h / 2, 16, 0, Math.PI * 2); x.fill();
      }),
    }));
    screen.rotation.x = -Math.PI / 2; screen.position.y = 0.0056; g.add(screen);
    for (const s of [-1, 1]) {
      const band = rbox(0.022, 0.004, 0.05, 0.0018, mat(0x2a2c31, { roughness: 0.8 }));
      band.position.set(0, -0.003, s * 0.04); g.add(band);
    }
    part({ id: 'car-watch', name: 'Gesture watch', type: 'watch', keep: true,
      specs: ['Gravity (tilt) sensor', '2.4 GHz transmitter', 'Tilt your wrist to steer'],
      reason: 'Steer BoomBot with a wave of your hand.' }, g, [0.01, 0.0075, 0.175], [0, 0.03, 0.255]);
  }

  dev.problems = [
    { part: 'car-battery', title: 'Dies fast', text: '500 mAh: ~20–45 min of play' },
    { part: 'car-top', title: 'Silent', text: 'No speaker. Can\'t play music.' },
  ];
  return dev;
}

// ---------------------------------------------------------------------------
// oraimo SpaceBox OBS-382 speaker (8 W, 45 mm driver + passive radiator, 1800 mAh)
// 146 x 72 x 50 mm
// ---------------------------------------------------------------------------
export function buildSpeaker() {
  const dev = makeDevice({
    id: 'spk', name: 'oraimo SpaceBox OBS-382', short: 'Speaker',
    specs: '8 W · 45 mm driver · BT 5.4 · FM · 1800 mAh',
  });
  const { part } = dev;
  const CH = 0x26282d;

  // Rear housing
  {
    const g = new THREE.Group();
    g.add(rbox(0.146, 0.072, 0.034, 0.012, mat(CH, { roughness: 0.55 })));
    const port = rbox(0.004, 0.006, 0.01, 0.001, mat(0x0b0b0c)); port.position.set(0.0735, -0.016, 0.004); g.add(port);
    part({ id: 'spk-housing', name: 'Rear housing', type: 'shell', keep: false,
      specs: ['Unit size 146 × 72 × 50 mm', '280 g total'],
      reason: 'Replaced by your new printed shell.' }, g, [0, 0.036, -0.008], [0, 0.036, -0.14]);
  }
  // Front grille
  {
    const g = new THREE.Group();
    g.add(rbox(0.146, 0.072, 0.016, 0.01, mat(0x1d1f23, { roughness: 0.7 })));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.134, 0.06), new THREE.MeshStandardMaterial({
      roughness: 0.85,
      map: canvasTexture(1024, 460, (x, w, h) => {
        x.fillStyle = '#202227'; x.fillRect(0, 0, w, h);
        x.fillStyle = '#0c0d0f';
        for (let yy = 14; yy < h; yy += 22) for (let xx = 14 + ((yy / 22) % 2) * 11; xx < w; xx += 22) {
          x.beginPath(); x.arc(xx, yy, 6.5, 0, Math.PI * 2); x.fill();
        }
      }),
    }));
    face.position.z = 0.0081; g.add(face);
    part({ id: 'spk-grille', name: 'Front grille', type: 'shell', keep: false,
      specs: ['Perforated front panel'], reason: 'BoomBot gets a new face.' }, g, [0, 0.036, 0.017], [0, 0.036, 0.215]);
  }
  part({ id: 'spk-ring', name: 'RGB light ring', type: 'ring', keep: true,
    specs: ['Music-synced RGB LEDs', 'Custom colors via the Oraimo Sound app'],
    reason: 'Becomes BoomBot\'s glowing face.' }, lightRing(0.029), [0, 0.036, 0.0265], [0, 0.036, 0.16]);
  part({ id: 'spk-driver', name: '45 mm driver', type: 'driver', keep: true,
    specs: ['45 mm full-range driver', '8 W output · 80 Hz–20 kHz'],
    reason: 'The voice of the new build.' }, driver45(), [0, 0.036, 0.012], [0, 0.036, 0.1]);
  part({ id: 'spk-radiator', name: 'Passive radiator', type: 'radiator', keep: true,
    specs: ['Unpowered bass membrane', 'Moves with air pressure from the driver'],
    reason: 'Keeps the deep bass.' }, passiveRadiator(), [0, 0.036, -0.0262, 0, Math.PI, 0], [0, 0.036, -0.21]);
  part({ id: 'spk-battery', name: 'Speaker battery', type: 'battery', keep: true,
    specs: ['Li-ion 3.7 V · 1800 mAh', 'Up to ~16 h of music at mid volume'],
    reason: '3.6× the car\'s battery. Powers motors and music.' },
  battery18650('3.7V 1800mAh'), [0, 0.017, -0.012], [0, 0.135, -0.02]);
  part({ id: 'spk-board', name: 'Main board', type: 'audio', keep: true,
    specs: ['Bluetooth 5.4 · 10 m range', '8 W amplifier', 'FM radio + TF card'],
    reason: 'Streams music from your phone.' },
  pcb({ w: 0.11, d: 0.03, seed: 5, color: '#0e3b2a',
    chips: [{ x: -0.03, z: 0, w: 0.012, d: 0.012, label: 'BT5.4' }, { x: 0.002, z: 0.002, w: 0.011, d: 0.009, label: 'AMP' },
      { x: 0.03, z: -0.002, w: 0.009, d: 0.009, label: 'FM' }],
    caps: [{ x: 0.046, z: 0.008, r: 0.003, h: 0.007 }, { x: -0.048, z: -0.006, r: 0.0024, h: 0.006 }, { x: 0.016, z: -0.009, r: 0.002, h: 0.005 }] }),
  [0, 0.058, -0.009], [0, 0.195, 0]);
  {
    const g = pcb({ w: 0.06, d: 0.012, seed: 7, color: '#0e3b2a' });
    [-0.022, -0.008, 0.008, 0.022].forEach(x => {
      const b = rbox(0.009, 0.006, 0.007, 0.002, mat(0x3b3e45, { roughness: 0.8 })); b.position.set(x, 0.004, 0); g.add(b);
    });
    part({ id: 'spk-buttons', name: 'Button board', type: 'buttons', keep: false,
      specs: ['Power · volume · mode · light'], reason: 'The watch + your phone replace these.' },
    g, [0, 0.067, 0.0], [0, 0.25, 0]);
  }
  part({ id: 'spk-usbc', name: 'USB-C charge board', type: 'usbc', keep: true,
    specs: ['USB-C charging input'], reason: 'Charges the whole robot.' },
  usbcBoard(), [0.064, 0.02, -0.006], [0.15, 0.1, 0]);

  dev.problems = [
    { part: 'spk-housing', title: 'Stuck in one spot', text: 'Great sound, but it can\'t move' },
  ];
  return dev;
}
