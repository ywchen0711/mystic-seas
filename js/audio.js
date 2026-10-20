// MYSTIC SEAS — sound, synthesized with the Web Audio API: hits, skills, waves, and a breezy sea shanty.
export class Sound {
  constructor() { this.ctx = null; this.vol = 0.6; this.musicOn = true; this.last = {}; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.3; this.musicBus.connect(this.master);
    const n = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, n, n); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.music();
  }
  tone(t, f, dur, type = 'square', vol = 0.1, f2, dest) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(t, dur, freq, vol = 0.2, type = 'lowpass', dest) {
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain(); s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(dest || this.master); s.start(t); s.stop(t + dur + 0.05);
  }
  play(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    // the same sound many times in one instant only plays once
    if (this.last[name] && t - this.last[name] < 0.05) return; this.last[name] = t;
    switch (name) {
      case 'jump': this.tone(t, 300, 0.12, 'square', 0.05, 600); break;
      case 'airjump': this.tone(t, 450, 0.14, 'triangle', 0.08, 1100); this.noise(t, 0.12, 2500, 0.06, 'highpass'); break;
      case 'dash': this.noise(t, 0.18, 1800, 0.18, 'bandpass'); break;
      case 'splash': this.noise(t, 0.4, 900, 0.22); this.noise(t, 0.2, 3000, 0.06, 'highpass'); break;
      case 'land': this.noise(t, 0.06, 500, 0.14); break;
      case 'swing': this.noise(t, 0.09, 2600, 0.12, 'bandpass'); break;
      case 'hit': this.noise(t, 0.08, 1200, 0.22); this.tone(t, 180, 0.08, 'square', 0.06, 90); break;
      case 'kill': this.tone(t, 520, 0.08, 'square', 0.06); this.tone(t + 0.06, 780, 0.14, 'square', 0.06); break;
      case 'hurt': this.tone(t, 220, 0.18, 'sawtooth', 0.08, 110); this.noise(t, 0.1, 700, 0.15); break;
      case 'proj': this.tone(t, 700, 0.2, 'sawtooth', 0.05, 200); this.noise(t, 0.2, 1500, 0.1, 'bandpass'); break;
      case 'boom': this.noise(t, 0.5, 400, 0.35); this.tone(t, 120, 0.4, 'sine', 0.2, 40); break;
      case 'beam': this.tone(t, 900, 0.6, 'sawtooth', 0.05, 600); this.tone(t, 450, 0.6, 'square', 0.03, 300); break;
      case 'aoe': this.noise(t, 0.35, 600, 0.25); this.tone(t, 160, 0.3, 'triangle', 0.12, 60); break;
      case 'level': [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.09, f, 0.3, 'square', 0.07)); break;
      case 'quest': [784, 988, 1175].forEach((f, i) => this.tone(t + i * 0.1, f, 0.25, 'triangle', 0.09)); break;
      case 'coin': this.tone(t, 988, 0.08, 'square', 0.05); this.tone(t + 0.07, 1319, 0.18, 'square', 0.05); break;
      case 'fruit': [392, 494, 587, 784, 988].forEach((f, i) => this.tone(t + i * 0.08, f, 0.35, 'sine', 0.1)); break;
      case 'click': this.tone(t, 700, 0.05, 'square', 0.04); break;
      case 'deny': this.tone(t, 200, 0.15, 'square', 0.05, 150); break;
      case 'die': this.noise(t, 0.4, 1500, 0.25, 'bandpass'); this.tone(t, 400, 0.6, 'sawtooth', 0.08, 70); break;
      case 'boss': [196, 233, 196, 175].forEach((f, i) => this.tone(t + i * 0.18, f, 0.3, 'sawtooth', 0.06)); break;
      case 'horn': this.tone(t, 220, 0.8, 'sawtooth', 0.06, 210); this.tone(t, 330, 0.8, 'triangle', 0.05); break;
    }
  }
  // a looping shanty in 6/8: oom-pah bass, accordion chords and a fiddle tune
  music() {
    const ctx = this.ctx, bpm = 168, step = 60 / bpm;
    const prog = [[0, 4, 7], [0, 4, 7], [-5, -1, 2], [-5, -1, 2], [5, 9, 12], [0, 4, 7], [-5, -1, 2], [0, 4, 7]];
    const lead = [7, 7, 9, 7, 4, 0, 2, 2, 4, 2, -1, -5, 5, 4, 5, 9, 7, 4, 7, 5, 2, 0, 0, null];
    let i = 0, next = ctx.currentTime + 0.1;
    const root = 293.7, f = (n) => root * Math.pow(2, n / 12);
    this.timer = setInterval(() => {
      if (!this.musicOn) { next = ctx.currentTime + 0.1; return; }
      while (next < ctx.currentTime + 0.25) {
        const beat = i % 6, bar = Math.floor(i / 6) % 8, ch = prog[bar];
        if (beat === 0 || beat === 3) this.tone(next, f(ch[0] - 24), step * 1.6, 'triangle', 0.13, null, this.musicBus);
        if (beat !== 0 && beat !== 3) ch.forEach((n) => this.tone(next, f(n - 12), step * 0.6, 'square', 0.014, null, this.musicBus));
        const note = lead[(Math.floor(i / 2) + (bar % 2) * 3) % lead.length];
        if (i % 2 === 0 && note !== null && bar < 6) this.tone(next, f(note), step * 1.7, 'sawtooth', 0.022, null, this.musicBus);
        if (beat === 0) this.noise(next, 0.06, 160, 0.16, 'lowpass', this.musicBus);
        next += step; i++;
      }
    }, 60);
    // the sea, always
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    s.buffer = this.noiseBuf; s.loop = true; fl.type = 'lowpass'; fl.frequency.value = 500; g.gain.value = 0.05; lfo.frequency.value = 0.12; lg.gain.value = 0.04;
    lfo.connect(lg); lg.connect(g.gain); s.connect(fl); fl.connect(g); g.connect(this.master); s.start(); lfo.start();
  }
  setMusic(on) { this.musicOn = on; if (this.musicBus) this.musicBus.gain.value = on ? 0.3 : 0; }
}
