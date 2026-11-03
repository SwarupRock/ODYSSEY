/* ============================================================
   ODYSSEY — js/voice.js — voice overs for the cast (natural build)
   Still zero assets, but tuned so it doesn't read as "robot":
   - prefers the device's best engines (Google > Natural > default)
   - speaks in sentence chunks with tiny prosody jitter per chunk
     (flat single utterances are the #1 "AI" tell)
   - ducks the music while a line plays, restores after
   - per-character gender pools + pitch/rate profiles as before
   ============================================================ */

const PROFILES = {
  NARRATOR:   { pitch: 0.80, rate: 0.94, gender: "m", slot: 0 },
  ODYSSEUS:   { pitch: 1.00, rate: 1.02, gender: "m", slot: 1 },
  POLYPHEMUS: { pitch: 0.20, rate: 0.74, gender: "m", slot: 2 },
  AGAMEMNON:  { pitch: 0.50, rate: 0.88, gender: "m", slot: 3 },
  EURYLOCHUS: { pitch: 1.10, rate: 1.04, gender: "m", slot: 4 },
  ANTINOUS:   { pitch: 0.65, rate: 0.96, gender: "m", slot: 5 },
  CREW:       { pitch: 0.95, rate: 1.06, gender: "m", slot: 6 },
  SOLDIER:    { pitch: 0.88, rate: 1.00, gender: "m", slot: 7 },
  TIRESIAS:   { pitch: 0.55, rate: 0.82, gender: "m", slot: 8 },
  GHOST:      { pitch: 0.45, rate: 0.84, gender: "f", slot: 0 },
  CIRCE:      { pitch: 1.45, rate: 0.96, gender: "f", slot: 1 },
  PENELOPE:   { pitch: 1.30, rate: 0.96, gender: "f", slot: 2 },
  SIRENS:     { pitch: 1.70, rate: 0.90, gender: "f", slot: 3 },
  AEOLUS:     { pitch: 1.25, rate: 1.05, gender: "f", slot: 4 },
};

const FEM_HINTS = ["female", "woman", "zira", "hazel", "susan", "samantha", "victoria", "karen", "moira", "tessa", "fiona", "serena", "allison", "ava", "nicky", "google uk english female", "google us english", "aria", "jenny", "michelle", "salli", "joanna", "kendra", "kimberly", "ivy", "emma", "amy", "sonia", "libby", "natasha"];
const MASC_HINTS = ["male", "man", "david", "daniel", "mark", "guy", "alex", "fred", "aaron", "arthur", "oliver", "thomas", "george", "ryan", "eric", "brian", "james", "christopher", "rishi"];

function guessGender(v) {
  const n = (v.name || "").toLowerCase();
  if (FEM_HINTS.some((h) => n.includes(h))) return "f";
  if (MASC_HINTS.some((h) => n.includes(h))) return "m";
  return "?";
}

/* quality ranking — natural-network voices first */
function voiceQuality(v) {
  const n = (v.name || "").toLowerCase();
  if (n.includes("google")) return 5;                    // Android's best
  if (/\bnatural\b/.test(n)) return 4;
  if (n.includes("enhanced") || n.includes("premium")) return 3;
  if (v.lang && /^en/i.test(v.lang)) return 2;
  return 1;
}

const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
function numWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[(n / 10) | 0] + (n % 10 ? "-" + ONES[n % 10] : "");
  if (n < 1000) return ONES[(n / 100) | 0] + " hundred" + (n % 100 ? " " + numWords(n % 100) : "");
  return String(n);
}

/* split into speakable chunks: sentences, then long clauses */
function chunk(text) {
  const out = [];
  for (const s of text.replace(/—/g, ", ").split(/(?<=[.!?…])\s+/)) {
    if (s.length <= 110) { if (s.trim()) out.push(s.trim()); continue; }
    let rest = s;
    while (rest.length > 110) {
      let cut = rest.lastIndexOf(",", 110);
      if (cut < 40) cut = rest.lastIndexOf(" ", 110);
      if (cut < 40) cut = 110;
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1);
    }
    if (rest.trim()) out.push(rest.trim());
  }
  return out;
}

export const Voice = {
  supported: typeof window !== "undefined" && "speechSynthesis" in window,
  enabled: true,
  _voices: [],
  _voice: null,
  _lastKey: "",
  _queue: [],
  _active: 0,

  init() {
    if (!this.supported) return;
    try { this.enabled = localStorage.getItem("odyssey-voice") !== "off"; } catch {}
    this._pickAll();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => this._pickAll();
    }
  },

  _pickAll() {
    if (!this.supported) return;
    const vs = window.speechSynthesis.getVoices();
    if (!vs.length) return;
    this._voices = vs.slice().sort((a, b) => voiceQuality(b) - voiceQuality(a));
    this._voice = this._voices.find((v) => /^en/i.test(v.lang)) || this._voices[0];
  },

  _voiceFor(prof) {
    if (!this._voices.length) return this._voice;
    const wanted = prof.gender === "f" ? "f" : "m";
    const pool = this._voices.filter((v) => guessGender(v) === wanted);
    const use = pool.length ? pool : this._voices;
    return use[prof.slot % use.length] || this._voice;
  },

  castInfo() {
    const out = {};
    for (const [name, prof] of Object.entries(PROFILES)) {
      const v = this._voiceFor(prof);
      out[name] = v ? `${v.name} @p${prof.pitch}` : "(none)";
    }
    return out;
  },

  setEnabled(on) {
    this.enabled = on;
    try { localStorage.setItem("odyssey-voice", on ? "on" : "off"); } catch {}
    if (!on) this.stop();
  },

  /** speak one dialogue line with natural chunked delivery */
  say(who, text) {
    if (!this.supported || !this.enabled) return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    this.stop();
    if (!this._voices.length) this._pickAll();

    const key = (who || "") + "|" + text;
    if (key === this._lastKey && synth.speaking) return;
    this._lastKey = key;

    const W = (who || "NARRATOR").toUpperCase();
    const prof =
      PROFILES[W] ||
      PROFILES[Object.keys(PROFILES).find((k) => W.includes(k))] ||
      { pitch: 1, rate: 0.95, gender: "m", slot: 0 };

    const v = this._voiceFor(prof);
    // tidy spoken text: digits to words, em-dash pauses
    const clean = text
      .replace(/\b(\d{1,3})\b/g, (m) => numWords(+m))
      .replace(/—/g, " — ");

    const parts = chunk(clean);
    if (!parts.length) return;

    this._active++;
    try { this._duck(true); } catch {}

    // queue chunks; each gets slight rate/pitch jitter so consecutive
    // phrases don't machine-gun at identical prosody
    for (let i = 0; i < parts.length; i++) {
      const u = new SpeechSynthesisUtterance(parts[i]);
      if (v) { u.voice = v; u.lang = v.lang; }
      const last = i === parts.length - 1;
      const jR = 1 + (Math.random() * 0.06 - 0.03);
      const jP = 1 + (Math.random() * 0.08 - 0.04);
      u.pitch = Math.max(0.1, Math.min(2, prof.pitch * jP));
      u.rate = Math.max(0.5, Math.min(1.6, prof.rate * jR * (last ? 0.96 : 1)));
      u.volume = 0.95;
      this._queue.push(u);
    }
    this._pump();
  },

  _pump() {
    const synth = window.speechSynthesis;
    const next = this._queue[0];
    if (!next) {
      this._active = Math.max(0, this._active - 1);
      if (this._active === 0) { try { this._duck(false); } catch {} }
      return;
    }
    this._queue.shift();
    next.onend = () => { if (this._queue.length) this._pump(); else { this._active = Math.max(0, this._active - 1); if (this._active === 0) { try { this._duck(false); } catch {} } } };
    next.onerror = next.onend;
    try { synth.speak(next); } catch { next.onend(); }
  },

  stop() {
    if (!this.supported) return;
    this._lastKey = "";
    this._queue = [];
    try { window.speechSynthesis.cancel(); } catch {}
    if (this._active) { this._active = 0; try { this._duck(false); } catch {} }
  },

  _duck(on) {
    // optional integration — audio module may not be loaded in probes
    import("./audio.js").then(({ Audio }) => { if (Audio.duck) Audio.duck(on); }).catch(() => {});
  },
};
