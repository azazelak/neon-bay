// Neon Bay — synthesized sound. No audio files: every sound is a WebAudio
// oscillator or filtered noise burst, and the music is a scheduled loop of
// bass notes, kick and hats. The context is created on the first user
// gesture (browsers block audio before one), and every method is a no-op
// until then, so headless screenshots stay silent and safe.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.muted = false;
  }

  // Call from a user gesture (start button, first key). Safe to call often.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this._startEngineLoop();
    } catch (e) {
      this.ctx = null;
    }
  }

  _noiseBuffer(seconds = 0.5) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _startEngineLoop() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  // Engine hum follows speed: 0 (idle, quiet) to 1 (top speed).
  setEngine(ratio, inCar) {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    const target = inCar ? 0.05 + ratio * 0.11 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(46 + ratio * 150, t, 0.08);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (!on) {
      if (this.sirenOsc) {
        try { this.sirenOsc.stop(); } catch (e) {}
        this.sirenOsc = null;
      }
      return;
    }
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'square';
    this.sirenOsc.frequency.value = 720;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 1.6;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.045;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    lfo.start();
    this.sirenOsc._lfo = lfo;
  }

  _blip(freq, dur, type = 'sine', vol = 0.2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  gunshot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.18);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
    this._blip(160, 0.08, 'square', 0.15);
  }

  punch() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.08);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    src.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  pickup() {
    this._blip(880, 0.12, 'sine', 0.22);
    setTimeout(() => this._blip(1318, 0.16, 'sine', 0.2), 90);
  }

  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._blip(f, 0.22, 'triangle', 0.22), i * 110));
  }

  busted() {
    [392, 311, 233].forEach((f, i) => setTimeout(() => this._blip(f, 0.3, 'sawtooth', 0.14), i * 160));
  }

  horn() {
    this._blip(370, 0.18, 'square', 0.12);
    this._blip(466, 0.18, 'square', 0.1);
  }

  // Simple synthwave loop: Am – F – C – G bass, four-on-the-floor kick,
  // offbeat hats. Scheduled a bar ahead, cheap and cheerful.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const roots = [55, 43.65, 65.41, 49]; // A1 F1 C2 G1
    const stepDur = 0.24;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const bar = Math.floor(this.musicStep / 8) % 4;
      const step = this.musicStep % 8;
      const root = roots[bar];
      const t = this.ctx.currentTime + 0.05;
      // Kick on every beat.
      if (step % 2 === 0) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(0.32, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.connect(g); g.connect(this.master);
        osc.start(t); osc.stop(t + 0.16);
      }
      // Bass note on the beat.
      if (step % 2 === 0) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = root * 2;
        g.gain.setValueAtTime(0.07, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 1.8);
        osc.connect(g); g.connect(this.master);
        osc.start(t); osc.stop(t + stepDur * 1.9);
      }
      // Hat offbeat.
      if (step % 2 === 1) {
        const src = this.ctx.createBufferSource();
        src.buffer = this._noiseBuffer(0.03);
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 7000;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        src.connect(f); f.connect(g); g.connect(this.master);
        src.start(t);
      }
      this.musicStep++;
    }, stepDur * 1000);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
