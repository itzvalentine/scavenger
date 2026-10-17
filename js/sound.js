// Tiny synth for UI feedback. Created on the first user gesture.
let ctx = null, noise = null;

export function initAudio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function blip(freq = 880, dur = 0.08, type = 'sine', vol = 0.05, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  tap: () => blip(1250, 0.05, 'sine', 0.035),
  hover: () => blip(1900, 0.025, 'sine', 0.012),
  grab: () => blip(520, 0.07, 'triangle', 0.05),
  drop: () => blip(380, 0.08, 'triangle', 0.04),
  snap: () => { blip(880, 0.07, 'triangle', 0.05); blip(1320, 0.12, 'triangle', 0.045, 0.06); },
  reject: () => { blip(170, 0.16, 'square', 0.03); blip(140, 0.2, 'square', 0.03, 0.12); },
  whoosh: () => { if (!ctx) return; const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime;
    s.buffer = noise; f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.2);
    g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    s.connect(f).connect(g).connect(ctx.destination); s.start(t); },
  scanTick: () => blip(1500 + Math.random() * 500, 0.03, 'sine', 0.015),
  success: () => [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.45, 'triangle', 0.04, i * 0.07)),
  printTick: () => blip(190, 0.04, 'square', 0.012),
  kick: () => { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.32); },
  hat: () => { if (!ctx) return; const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime;
    s.buffer = noise; f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f).connect(g).connect(ctx.destination); s.start(t); s.stop(t + 0.06); },
};
