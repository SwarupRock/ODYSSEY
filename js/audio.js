/* ============================================================
   ODYSSEY — audio
   Fully synthesized (WebAudio): lyre-based bard score with
   Mediterranean modes, SFX, ambience. No audio files needed,
   no network calls. Warm and acoustic, not synth-trailer.
   ============================================================ */

const MODES = {
  // semitone offsets — warm, ancient color
  aeolyian: [0, 2, 3, 5, 7, 8, 10],     // natural minor, doom
  dorian: [0, 2, 3, 5, 7, 9, 10],       // hero home
  phrygian: [0, 1, 3, 5, 7, 8, 10],     // eastern menace
  lydian: [0, 2, 4, 6, 7, 9, 11],       // divine/bright
  mixolydian: [0, 2, 4, 5, 7, 9, 10],   // triumphant
};

export const Audio = {
  ctx: null,
  master: null,
  musicGain: null,
  sfxGain: null,
  ambGain: null,
  muted: false,
  _mode: "dorian",
  _root: 220,
  _timers: [],
  _ambNodes: [],
  _started: false,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);

    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 4;
    comp.connect(this.master);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(comp);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.7;
    this.sfxGain.connect(comp);

    this.ambGain = this.ctx.createGain();
    this.ambGain.gain.value = 0.35;
    this.ambGain.connect(comp);

    // generated hall reverb — one shared impulse, sends SFX + music wet
    this._buildReverb(comp);
  },

  _buildReverb(comp) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * 1.4);
    const imp = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = imp.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
    }
    this._conv = c.createConvolver();
    this._conv.buffer = imp;
    this._wet = c.createGain();
    this._wet.gain.value = 0.16;
    this._conv.connect(this._wet);
    this._wet.connect(comp);
    // every bus feeds the cave/hall a little
    this.sfxGain.connect(this._conv);
    this.musicGain.connect(this._conv);
  },

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  },

  /** music ducks under voice lines, swells back after */
  duck(on) {
    if (!this.musicGain) return;
    const g = this.musicGain.gain;
    try {
      g.cancelScheduledValues(this.ctx.currentTime);
      g.setTargetAtTime(on ? 0.16 : 0.5, this.ctx.currentTime, 0.4);
    } catch {}
  },

  /* ---------------- instruments ---------------- */

  _pluck(freq, when, dur = 0.9, gain = 0.2, dest = null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;

    const o2 = this.ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = freq * 2.005; // slight detune shimmer

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const flt = this.ctx.createBiquadFilter();
    flt.type = "lowpass";
    flt.frequency.setValueAtTime(3200, t);
    flt.frequency.exponentialRampToValueAtTime(900, t + dur);

    o.connect(g); o2.connect(g);
    g.connect(flt); flt.connect(dest || this.musicGain);
    o.start(t); o2.start(t);
    o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  },

  _flute(freq, when, dur = 0.8, gain = 0.1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq * 0.985, t);
    o.frequency.linearRampToValueAtTime(freq, t + 0.06);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.09);
    g.gain.setValueAtTime(gain, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const vib = this.ctx.createOscillator();
    vib.frequency.value = 5;
    const vg = this.ctx.createGain();
    vg.gain.value = freq * 0.006;
    vib.connect(vg); vg.connect(o.frequency);
    vib.start(t); vib.stop(t + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur);
  },

  _drum(when, dur = 0.28, gain = 0.5, tone = 96) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(tone, t);
    o.frequency.exponentialRampToValueAtTime(46, t + dur);
    const g = ctxGain(this.ctx, gain);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.02);

    const nz = noiseBurst(this.ctx, 0.05, gain * 0.3, 700);
    nz.g.connect(this.musicGain);
    nz.src.start(t);
  },

  /* ---------------- score ---------------- */

  setMode(mode, root = 220) {
    this._mode = MODES[mode] ? mode : "dorian";
    this._root = root;
  },

  playDrumLoop(bpm = 92, beats = 8, pattern = "x...x..x") {
    this.stopMusic();
    if (!this.ctx || this.muted) return;
    const step = 60 / bpm / 2; // 8th notes
    let i = 0;
    const tick = () => {
      if (this.muted) return;
      if (pattern[i % pattern.length] === "x") this._drum(0, 0.3, 0.55, i % 4 === 0 ? 96 : 78);
      i++;
      this._timers.push(setTimeout(tick, step * 1000));
    };
    tick();
  },

  playLyreLoop(bpm = 84, mode = null, root = null) {
    this.stopMusic();
    if (mode) this.setMode(mode, root);
    if (!this.ctx) return;
    const scale = MODES[this._mode];
    const rootHz = this._root;
    const step = 60 / bpm / 2;
    const seq = [0, 2, 4, 2, 5, 4, 2, 0]; // arpeggio indices into mode
    let i = 0;
    const tick = () => {
      if (!this.muted) {
        const deg = seq[i % seq.length];
        const oct = i % 8 >= 4 ? 2 : 1;
        const freq = rootHz * Math.pow(2, scale[deg % 7] / 12) * oct;
        this._pluck(freq, 0, 1.1, 0.16);
        if (i % 4 === 0) this._pluck(rootHz / 2, 0, 1.6, 0.1); // drone
      }
      i++;
      this._timers.push(setTimeout(tick, step * 1000));
    };
    tick();
  },

  /** stately theme for title / homecoming — melody line over drone */
  playTheme(bpm = 72, mode = "dorian", root = 196) {
    this.stopMusic();
    if (!this.ctx || this.muted) return;
    this.setMode(mode, root);
    const scale = MODES[mode];
    const melody = [0, 2, 4, 7, 4, 2, 0, -3];
    let bar = 0;
    const tick = () => {
      if (!this.muted) {
        const n = melody[bar % melody.length];
        const f = root * Math.pow(2, n / 12);
        this._pluck(f, 0, 1.5, 0.18);
        this._flute(f * 2, 0.15, 1.1, 0.05);
        this._pluck(root / 2, 0, 1.9, 0.12);
      }
      bar++;
      this._timers.push(setTimeout(tick, (60 / bpm) * 1000));
    };
    tick();
  },

  stopMusic() {
    this._timers.forEach(clearTimeout);
    this._timers = [];
  },

  /* ---------------- ambience ---------------- */

  startAmbience(type) {
    this.stopAmbience();
    if (!this.ctx || this.muted) return;
    const c = this.ctx;

    if (type === "wind") {
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c, 3);
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = "bandpass"; f.frequency.value = 420; f.Q.value = 0.7;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.13;
      const lg = c.createGain(); lg.gain.value = 180;
      lfo.connect(lg); lg.connect(f.frequency);
      const g = c.createGain(); g.gain.value = 0.5;
      src.connect(f); f.connect(g); g.connect(this.ambGain);
      src.start(); lfo.start();
      this._ambNodes.push(src, lfo);
    }

    if (type === "waves") {
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c, 4);
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 380;
      const g = c.createGain();
      g.gain.value = 0.18;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.18;
      const lg = c.createGain(); lg.gain.value = 0.1;
      lfo.connect(lg); lg.connect(g.gain);
      src.connect(f); f.connect(g); g.connect(this.ambGain);
      src.start(); lfo.start();
      this._ambNodes.push(src, lfo);
    }

    if (type === "fire") {
      // crackle: random filtered bursts
      const iv = setInterval(() => {
        if (this.muted || !this.ctx) return;
        if (Math.random() < 0.5) {
          const nz = noiseBurst(this.ctx, 0.04 + Math.random() * 0.05, 0.05 + Math.random() * 0.08, 2400);
          nz.g.connect(this.ambGain);
          nz.src.start();
        }
      }, 180);
      this._ambNodes.push({ stop: () => clearInterval(iv) });
    }

    if (type === "cave") {
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c, 3);
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 120;
      const g = c.createGain(); g.gain.value = 0.4;
      src.connect(f); f.connect(g); g.connect(this.ambience_gain_proxy || this.ambGain);
      src.start();
      this._ambNodes.push(src);
      const iv = setInterval(() => {
        if (this.muted || !this.ctx) return;
        this.sfx("drip");
      }, 3400 + Math.random() * 2600);
      this._ambNodes.push({ stop: () => clearInterval(iv) });
    }

    if (type === "underworld") {
      // low drone + faint choir-ish stack
      const o = c.createOscillator(); o.type = "sine"; o.frequency.value = 55;
      const o2 = c.createOscillator(); o2.type = "sine"; o2.frequency.value = 82.5;
      const g = c.createGain(); g.gain.value = 0.16;
      o.connect(g); o2.connect(g); g.connect(this.ambGain);
      o.start(); o2.start();
      this._ambNodes.push(o, o2);
    }

    if (type === "hall") {
      // faint distant revelry — muted plucks at random
      const iv = setInterval(() => {
        if (this.muted || !this.ctx) return;
        if (Math.random() < 0.6) {
          const f = [196, 233, 262, 294][Math.floor(Math.random() * 4)];
          const saveDest = this.musicGain; this.musicGain = this.ambGain;
          this._pluck(f, 0, 0.5, 0.05, this.ambGain);
          this.musicGain = saveDest;
        }
      }, 900);
      this._ambNodes.push({ stop: () => clearInterval(iv) });
    }
  },

  stopAmbience() {
    this._ambNodes.forEach((n) => { try { n.stop(); } catch {} });
    this._ambNodes = [];
  },

  /* ---------------- SFX ---------------- */

  /* ---------------- chapter scores ----------------
     Each shore gets its own mode, root and melody so the voyage
     itself travels musically — doom at Troy, menace in the cave,
     a sailing song for the open water, a dirge below, and the
     homecoming theme for Ithaca. */

  _themeLoop({ bpm = 76, melody = [0, 2, 4, 2], mode = "dorian", root = 196, octave = 1, drum = null, flute = true, pluckGain = 0.17 }) {
    this.stopMusic();
    if (!this.ctx || this.muted) return;
    this.setMode(mode, root);
    const scale = MODES[mode];
    let bar = 0;
    const stepMs = (60 / bpm) * 1000;
    const tick = () => {
      if (!this.muted) {
        const n = melody[bar % melody.length];
        const f = root * Math.pow(2, n / 12) * octave;
        this._pluck(f, 0, 1.4, pluckGain);
        if (flute && bar % 2 === 0) this._flute(f * 2, 0.12, 1.2, 0.045);
        this._pluck(root / 2, 0, 1.8, 0.1); // drone under everything
        if (drum && drum[bar % drum.length] === "x") this._drum(0, 0.34, 0.32, 70);
      }
      bar++;
      this._timers.push(setTimeout(tick, stepMs));
    };
    tick();
  },

  /** score for chapter idx — called by the scene framework on begin() */
  playChapterMusic(idx) {
    switch (idx) {
      case 0: // Troy burns — doomed dirge with a war heartbeat
        this._themeLoop({ bpm: 62, mode: "aeolyian", root: 165, melody: [0, -3, 0, 2, 0, -3, -5, -3], flute: false, drum: "x......." });
        break;
      case 1: // the cyclops — phrygian menace, sparse and low
        this._themeLoop({ bpm: 66, mode: "phrygian", root: 155, melody: [0, 1, 0, 3, 0, 1, 0, -2], flute: false, drum: "..x....." });
        break;
      case 2: // bag of winds — a rolling sailing song
        this._themeLoop({ bpm: 96, mode: "mixolydian", root: 196, melody: [0, 2, 4, 7, 4, 2, 5, 4], drum: "x..x..x." });
        break;
      case 3: // Circe — lydian enchantment, bright harp figures
        this._themeLoop({ bpm: 84, mode: "lydian", root: 220, melody: [0, 4, 6, 4, 7, 4, 2, 0], octave: 1 });
        break;
      case 4: // the underworld — a mourning drone, almost still
        this._themeLoop({ bpm: 50, mode: "aeolyian", root: 147, melody: [0, 0, -3, 0, 0, -5], flute: true, drum: null });
        break;
      case 5: // the straits — dorian tension, persistent pulse
        this._themeLoop({ bpm: 104, mode: "dorian", root: 175, melody: [0, 2, 3, 2, 5, 3, 2, 0], drum: "x.x.x.x." });
        break;
      case 6: // Ithaca — the homecoming theme, stately and warm
        this._themeLoop({ bpm: 72, mode: "dorian", root: 196, melody: [0, 2, 4, 7, 9, 7, 4, 2], drum: null });
        break;
      default:
        this.playTheme();
    }
  },

  /* ---------------- SFX (layered) ---------------- */

  sfx(name) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t0 = c.currentTime;

    const tone = (f0, f1, dur, type = "triangle", gain = 0.2, when = 0) => {
      const t = t0 + when;
      const o = c.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.sfxGain);
      o.start(t); o.stop(t + dur + 0.02);
    };

    const noise = (dur, freq, gain = 0.25, when = 0, sweepTo = null) => {
      const t = t0 + when;
      const nz = noiseBurst(c, dur, gain, freq);
      if (sweepTo) {
        nz.f.frequency.setValueAtTime(freq, t);
        nz.f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
      }
      nz.g.connect(this.sfxGain);
      nz.src.start(t);
    };

    switch (name) {
      case "tap":
        tone(520, 300, 0.07, "sine", 0.10);
        tone(1040, 600, 0.05, "sine", 0.05, 0.01);
        break;
      case "sword": // three-layer swing: air whoosh → steel ring → shimmer
        noise(0.16, 900, 0.22, 0, 3600);
        tone(2400, 1400, 0.18, "triangle", 0.07, 0.02);
        tone(3600, 2900, 0.1, "sine", 0.04, 0.05);
        break;
      case "thud": // body knock: sub drop + knock + debris
        tone(120, 40, 0.26, "sine", 0.5);
        tone(210, 90, 0.09, "triangle", 0.22, 0.01);
        noise(0.14, 300, 0.2, 0.02, 140);
        break;
      case "roar": // deep cinematic war swell & harmonic bronze gong (replaces buzz)
        tone(110, 48, 0.85, "sine", 0.38);
        tone(220, 110, 0.6, "triangle", 0.16, 0.02);
        tone(330, 165, 0.45, "sine", 0.10, 0.04);
        noise(0.35, 450, 0.12, 0, 140);
        break;
      case "horn": // bronze war horn
        tone(146.83, 146.83, 0.9, "triangle", 0.24);
        tone(220, 220, 0.75, "sine", 0.16, 0.03);
        tone(293.66, 293.66, 0.6, "sine", 0.10, 0.06);
        break;
      case "dialogue": // crisp parchment / stone click on text prompt
        tone(540, 540, 0.05, "sine", 0.09);
        tone(810, 810, 0.06, "sine", 0.06, 0.015);
        break;
      case "footstep":
        noise(0.05, 430, 0.07, 0, 240);
        break;
      case "pickup": // little lyre figure
        tone(660, 660, 0.1, "sine", 0.15); tone(830, 830, 0.1, "sine", 0.13, 0.07); tone(990, 990, 0.16, "sine", 0.12, 0.14);
        break;
      case "potion":
        tone(300, 720, 0.35, "sine", 0.18); tone(450, 1080, 0.4, "sine", 0.1, 0.05); noise(0.3, 2600, 0.05, 0.1, 4800);
        break;
      case "error":
        tone(220, 160, 0.22, "square", 0.1); tone(233, 170, 0.24, "square", 0.08, 0.02);
        break;
      case "success": // harp arpeggio
        tone(523, 523, 0.14, "sine", 0.16); tone(659, 659, 0.14, "sine", 0.14, 0.08); tone(784, 784, 0.2, "sine", 0.13, 0.16); tone(1047, 1047, 0.26, "sine", 0.09, 0.24);
        break;
      case "perfect":
        tone(784, 784, 0.14, "sine", 0.16); tone(1175, 1175, 0.16, "sine", 0.13, 0.07); tone(1568, 1568, 0.24, "sine", 0.1, 0.14);
        break;
      case "miss":
        tone(300, 150, 0.18, "square", 0.1); noise(0.1, 700, 0.1, 0, 300);
        break;
      case "drip":
        tone(900, 400, 0.09, "sine", 0.06); tone(1800, 900, 0.05, "sine", 0.03, 0.005);
        break;
      case "wind":
        noise(1.3, 400, 0.26, 0, 900);
        break;
      case "gust":
        noise(0.5, 700, 0.34, 0, 1600);
        break;
      case "flare":
        tone(880, 1400, 0.5, "sawtooth", 0.08); noise(0.4, 1800, 0.13, 0, 3200); tone(440, 880, 0.4, "sine", 0.05, 0.05);
        break;
      case "crash": // big impact: crack + sub + ringing tail
        noise(0.35, 900, 0.4, 0, 200);
        noise(0.5, 2400, 0.14, 0.03, 700);
        tone(90, 40, 0.45, "sine", 0.5);
        tone(320, 180, 0.3, "triangle", 0.1, 0.02);
        break;
      case "gate":
        tone(160, 60, 0.6, "sawtooth", 0.22); noise(0.5, 180, 0.18, 0.05, 90);
        break;
      case "reveal":
        tone(392, 392, 0.4, "triangle", 0.16); tone(523, 523, 0.5, "triangle", 0.14, 0.12); tone(659, 659, 0.6, "triangle", 0.1, 0.24);
        break;
      case "heartbeat":
        tone(60, 45, 0.14, "sine", 0.5); tone(52, 40, 0.12, "sine", 0.34, 0.22);
        break;
      case "bow": // draw-creak → string twang → arrow whistle
        noise(0.07, 1200, 0.1, 0, 400);
        tone(1900, 550, 0.1, "triangle", 0.12, 0.05);
        noise(0.22, 2600, 0.1, 0.07, 5200);
        break;
      case "arrowhit": // thunk + shiver
        tone(340, 130, 0.11, "square", 0.16);
        noise(0.07, 800, 0.24, 0, 260);
        tone(1150, 900, 0.07, "sine", 0.05, 0.02);
        break;
      case "block": // bronze clang: inharmonic partials + scrape
        tone(1500, 1480, 0.14, "square", 0.07);
        tone(2230, 2200, 0.12, "sine", 0.05, 0.005);
        tone(3170, 3100, 0.09, "sine", 0.035, 0.01);
        noise(0.09, 4200, 0.2, 0, 2600);
        break;
      case "stagger": // boss stagger gong
        tone(196, 190, 0.9, "triangle", 0.2);
        tone(392, 380, 0.7, "sine", 0.12, 0.02);
        tone(587, 570, 0.5, "sine", 0.07, 0.04);
        noise(0.2, 600, 0.12, 0, 250);
        break;
      default:
        break;
    }
  },
};

/* ============================================================
   helpers
   ============================================================ */

function ctxGain(c, v) {
  const g = c.createGain();
  g.gain.value = v;
  return g;
}

let _noiseBuf = null;
function noiseBuffer(c, seconds = 2) {
  if (_noiseBuf && _noiseBuf.sampleRate === c.sampleRate) return _noiseBuf;
  const len = c.sampleRate * seconds;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  _noiseBuf = buf;
  return buf;
}

function noiseBurst(c, dur, gain, freq) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 2);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  src.connect(f); f.connect(g);
  return { src, g, f };
}
