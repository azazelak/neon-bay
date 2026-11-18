// Neon Bay v5c — synthesized WebAudio: engine hum, siren, blips, shots, cash.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.started = false;
  }

  ensure() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain).connect(this.ctx.destination);
      this.engineOsc.start();
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
      this.sirenOsc.start();
      this.started = true;
    } catch (e) { /* headless / no audio: stay silent */ }
  }

  update(speed, wanted) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(Math.min(0.06, Math.abs(speed) * 0.0016), t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 3.2, t, 0.1);
    if (wanted > 0) {
      this.sirenGain.gain.setTargetAtTime(0.02, t, 0.3);
      this.sirenOsc.frequency.setTargetAtTime(700 + Math.sin(t * 5) * 260, t, 0.05);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, t, 0.3);
    }
  }

  blip(freq = 660, dur = 0.08) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.05, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  shot() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(900, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.12, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    o.connect(g).connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + 0.13);
  }

  cash() { this.blip(990, 0.07); setTimeout(() => this.blip(1320, 0.1), 70); }
}
