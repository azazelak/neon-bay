// Neon Bay v4 — sound: fully synthesized WebAudio. Engine hum follows car
// speed, a two-tone siren wails while wanted, and a slow synthwave bass
// loop runs under the game. Everything guards for headless runs (no
// AudioContext, no gesture) and stays silent instead of throwing.
import { clamp } from './config.js';

export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, sirenT = 0;
  let musicTimer = null, step = 0, muted = false;
  const BASS = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.35;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch (e) { ctx = null; return false; }
  }

  function blip(freq, dur, type, vol) {
    if (!ensure() || muted) return;
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch (e) { /* silent */ }
  }

  function noise(dur, vol) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = ctx.createGain(); g.gain.value = vol || 0.3;
      src.connect(g); g.connect(master);
      src.start();
    } catch (e) { /* silent */ }
  }

  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      try {
        const f = BASS[step % BASS.length]; step++;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.14, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
        o.connect(g); g.connect(master);
        o.start(); o.stop(ctx.currentTime + 0.45);
      } catch (e) { /* silent */ }
    }, 300);
  }

  function update(dt, speed, wanted) {
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const target = clamp(Math.abs(speed) / 40, 0, 1) * 0.12;
      engineGain.gain.value += (target - engineGain.gain.value) * 0.1;
      engineOsc.frequency.value = 50 + Math.abs(speed) * 4;
      sirenT += dt;
      if (wanted > 0) {
        sirenGain.gain.value = 0.05;
        sirenOsc.frequency.value = Math.sin(sirenT * 4) > 0 ? 750 : 950;
      } else sirenGain.gain.value = 0;
    } catch (e) { /* silent */ }
  }

  return {
    ensure, startMusic, update,
    shot: () => noise(0.12, 0.35),
    punch: () => noise(0.08, 0.25),
    pickup: () => blip(880, 0.12, 'sine', 0.25),
    cash: () => { blip(660, 0.1, 'square', 0.2); setTimeout(() => blip(990, 0.16, 'square', 0.2), 90); },
    crash: () => noise(0.3, 0.4),
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.35; },
  };
}
