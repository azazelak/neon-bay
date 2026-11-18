// Neon Bay — synthesized sound. No audio files: WebAudio oscillators
// and filtered noise for engine, siren, shots, pickups and a bass loop.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.muted = false;
    this.bassNotes = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
    this.bassStep = 0;
  }

  // Must be called from a user gesture at least once.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.ctx = null;
      return;
    }
    // Engine hum: sawtooth through a low-pass, pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
    // Siren: triangle that wails between two notes.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.ctx.destination);
    this.sirenOsc.start();
    // Synthwave bass loop: one note every 0.42 s.
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const freq = this.bassNotes[this.bassStep % this.bassNotes.length];
      this.bassStep++;
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.045, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.38);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + 0.4);
    }, 420);
  }

  setEngine(speedNorm, driving) {
    if (!this.ctx || !this.engineOsc) return;
    this.engineOsc.frequency.value = 45 + speedNorm * 140;
    this.engineGain.gain.value = driving ? 0.03 + speedNorm * 0.05 : 0.012;
  }

  setSiren(wanted, time) {
    if (!this.ctx || !this.sirenOsc) return;
    if (wanted <= 0) {
      this.sirenGain.gain.value = 0;
      return;
    }
    this.sirenGain.gain.value = 0.018;
    this.sirenOsc.frequency.value = Math.sin(time * 2.2) > 0 ? 720 : 540;
  }

  blip(freq, dur, type = 'sine', vol = 0.08) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  }

  shot() {
    if (!this.ctx || this.muted) return;
    const len = this.ctx.sampleRate * 0.12;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.22;
    src.connect(g);
    g.connect(this.ctx.destination);
    src.start();
  }

  reload() { this.blip(300, 0.08, 'square', 0.05); }
  pickup() { this.blip(880, 0.12); this.blip(1320, 0.14); }
  cash() {
    this.blip(1046, 0.1);
    setTimeout(() => this.blip(1318, 0.16), 90);
  }
  mission() {
    this.blip(523, 0.12);
    setTimeout(() => this.blip(659, 0.12), 110);
    setTimeout(() => this.blip(784, 0.2), 220);
  }
  busted() {
    this.blip(220, 0.3, 'sawtooth', 0.08);
    setTimeout(() => this.blip(165, 0.4, 'sawtooth', 0.08), 200);
  }
}
