// Synthesized sound: no audio files, everything is WebAudio oscillators
// and filtered noise. The context is created lazily on the first user
// gesture (browsers block audio before one) and every call is guarded, so
// a headless run without audio simply stays silent.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.musicTimer = null;
    this.musicStep = 0;
    const resume = () => this.resume();
    window.addEventListener('keydown', resume, { once: true });
    window.addEventListener('mousedown', resume, { once: true });
  }

  resume() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.buildEngine();
        this.buildSiren();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      // No audio available: stay silent.
    }
  }

  buildEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter).connect(this.engineGain).connect(ctx.destination);
    this.engineOsc.start();
  }

  buildSiren() {
    const ctx = this.ctx;
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 780;
    this.sirenLfo = ctx.createOscillator();
    this.sirenLfo.type = 'square';
    this.sirenLfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 190;
    this.sirenLfo.connect(lfoGain).connect(this.sirenOsc.frequency);
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(ctx.destination);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  // Called every frame: engine hum follows speed, siren follows wanted level.
  update(speed01, stars) {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      this.engineGain.gain.setTargetAtTime(speed01 > 0.02 ? 0.035 + speed01 * 0.03 : 0, t, 0.1);
      this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 165, t, 0.08);
      this.sirenGain.gain.setTargetAtTime(stars > 0 ? 0.022 : 0, t, 0.2);
    } catch {
      // ignore
    }
  }

  blip(freq = 880, dur = 0.09, type = 'sine', vol = 0.08) {
    if (!this.ctx) return;
    try {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch {
      // ignore
    }
  }

  noiseBurst(dur = 0.14, vol = 0.22, cutoff = 1800) {
    if (!this.ctx) return;
    try {
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(filter).connect(g).connect(ctx.destination);
      src.start();
    } catch {
      // ignore
    }
  }

  shot() {
    this.noiseBurst(0.13, 0.25, 2400);
  }

  punch() {
    this.noiseBurst(0.08, 0.16, 500);
  }

  pickup() {
    this.blip(880, 0.08);
    setTimeout(() => this.blip(1318, 0.12), 70);
  }

  cash() {
    this.blip(1046, 0.1);
    setTimeout(() => this.blip(1568, 0.16), 90);
  }

  // A slow synthwave bassline, scheduled a bar at a time.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
    this.musicTimer = setInterval(() => {
      if (!this.ctx) return;
      try {
        const f = bass[this.musicStep % bass.length];
        this.musicStep++;
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.05, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.45);
      } catch {
        // ignore
      }
    }, 240);
  }
}
