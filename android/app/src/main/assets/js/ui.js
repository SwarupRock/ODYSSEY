/* ============================================================
   ODYSSEY — UI layer
   Dialogue box, chapter cards, HUD, toasts, choices, mech UI.
   ============================================================ */

import { Voice } from "./voice.js";
import { Audio } from "./audio.js";

const $ = (id) => document.getElementById(id);

/* speaker nameplate colors — the cast is color-coded like a playbill */
const SPEAKER_COLORS = {
  ODYSSEUS: "#ffdf80",
  NARRATOR: "#f4ebd9",
  POLYPHEMUS: "#ff6e38",
  AGAMEMNON: "#f7be48",
  CIRCE: "#fcaee0",
  PENELOPE: "#a8e0f8",
  SIRENS: "#fcaee0",
  TIRESIAS: "#b8dcf0",
  ACHILLES: "#ffaa88",
  SUITOR: "#ff7b6b",
  EURYLOCHUS: "#e2ca88",
  AEOLUS: "#b8f4e6",
  ANTINOUS: "#ff7b6b",
  CREW: "#d8cfbd",
  SOLDIER: "#d8cfbd",
  GHOST: "#b8e4ec",
};

/* ---------------- dialogue ---------------- */

export const Dialogue = {
  lines: [],
  idx: 0,
  charIdx: 0,
  typing: false,
  onDone: null,
  _timer: null,

  get active() { return this.lines.length > 0 && this.idx < this.lines.length; },

  show(lines, onDone = null) {
    this.lines = lines.map((l) => (typeof l === "string" ? { who: "", text: l } : l));
    this.idx = 0;
    this.onDone = onDone;
    $("dialogue").classList.remove("hidden");
    document.body.classList.add("dlg-open"); // suppress touch controls
    // Reset joystick or button holds so moving when dialogue opens stops immediately
    try {
      import("./stick.js").then(({ Stick }) => {
        Stick.setInteractive(false);
        Stick.reset();
      }).catch(() => {});
    } catch {}
    this._startLine();
  },

  _startLine() {
    const line = this.lines[this.idx];
    const sp = $("dlg-speaker");
    sp.textContent = line.who || "";
    sp.style.display = line.who ? "inline-block" : "none";
    const col = SPEAKER_COLORS[(line.who || "").toUpperCase()] ||
      SPEAKER_COLORS[Object.keys(SPEAKER_COLORS).find((k) => (line.who || "").toUpperCase().includes(k))];
    sp.style.color = col || "var(--bronze-bright)";
    sp.style.borderColor = col || "var(--bronze-bright)";
    $("dlg-text").textContent = "";
    // voice over for the line (skips silent narration-less lines)
    if (line.text && line.text.length > 8) Voice.say(line.who, line.text);
    this.charIdx = 0;
    this.typing = true;
    clearTimeout(this._timer);
    const step = () => {
      if (!this.typing) return;
      this.charIdx += 2;
      $("dlg-text").textContent = line.text.slice(0, this.charIdx);
      if (this.charIdx < line.text.length) {
        this._timer = setTimeout(step, 18);
      } else {
        this.typing = false;
      }
    };
    step();
  },

  /** advance on tap; returns true if consumed */
  advance() {
    if (!this.active) return false;
    Voice.stop(); // skipped typing or moved on — hush the current line
    const line = this.lines[this.idx];
    if (this.typing) {
      this.typing = false;
      clearTimeout(this._timer);
      $("dlg-text").textContent = line.text;
      return true;
    }
    this.idx++;
    if (this.idx >= this.lines.length) {
      this.hide();
      const cb = this.onDone;
      this.onDone = null;
      if (cb) cb();
    } else {
      this._startLine();
    }
    return true;
  },

  hide() {
    this.lines = [];
    this.typing = false;
    clearTimeout(this._timer);
    Voice.stop();
    $("dialogue").classList.add("hidden");
    document.body.classList.remove("dlg-open");
    import("./stick.js").then(({ Stick }) => {
      if (Stick.inGame) Stick.setInteractive(true);
    }).catch(() => {});
  },
};

/* ---------------- choices ---------------- */

export const Choices = {
  options: [],
  sel: 0,

  show(options) {
    const el = $("choices");
    el.classList.remove("hidden");
    el.innerHTML = "";
    this.options = options;
    this.sel = 0;
    for (const opt of options) {
      const b = document.createElement("button");
      b.className = "btn-stone choice-btn";
      b.textContent = opt.label;
      b.addEventListener("click", () => {
        this.hide();
        opt.cb();
      });
      el.appendChild(b);
    }
    this.paint();
  },

  paint() {
    const el = $("choices");
    [...el.children].forEach((b, i) => b.classList.toggle("selected", i === this.sel));
  },

  move(d) {
    if (!this.visible()) return;
    this.sel = (this.sel + d + this.options.length) % this.options.length;
    this.paint();
  },

  confirm() {
    if (!this.visible()) return;
    const opt = this.options[this.sel];
    if (opt) { this.hide(); opt.cb(); }
  },

  visible() {
    return !$("choices").classList.contains("hidden");
  },

  hide() {
    this.options = [];
    $("choices").classList.add("hidden");
    $("choices").innerHTML = "";
  },
};

/* ---------------- chapter card ---------------- */

export function showChapterCard(kicker, title, sub, dur = 2600) {
  return new Promise((resolve) => {
    $("cc-kicker").textContent = kicker;
    $("cc-title").textContent = title;
    $("cc-sub").textContent = sub || "";
    const el = $("chapter-card");
    el.classList.remove("hidden");
    setTimeout(() => {
      el.classList.add("hidden");
      resolve();
    }, dur);
  });
}

/* ---------------- fade ---------------- */

export const Fade = {
  to(opacity, ms = 500, color = "#000") {
    return new Promise((resolve) => {
      const el = $("fade-overlay");
      el.style.background = color;
      el.style.transition = `opacity ${ms}ms ease`;
      requestAnimationFrame(() => { el.style.opacity = opacity; });
      setTimeout(resolve, ms + 30);
    });
  },
};

/* ---------------- HUD ---------------- */

export const HUD = {
  show() { $("hud").classList.remove("hidden"); },
  hide() {
    $("hud").classList.add("hidden");
    this.setChapter("");
    this.objective(null);
    this.health(-1);
  },

  setChapter(text) {
    $("hud-chapter").textContent = text;
  },

  objective(text) {
    const el = $("hud-objective");
    if (!text) { el.classList.add("hidden"); return; }
    el.innerHTML = text;
    el.classList.remove("hidden");
    el.style.opacity = 1;
  },

  /** n = health, -1 hides */
  health(n, max = 3) {
    const el = $("hud-health");
    if (n < 0) { el.classList.add("hidden"); el.innerHTML = ""; return; }
    el.classList.remove("hidden");
    let html = "";
    for (let i = 0; i < max; i++) {
      html += `<div class="hp-pip ${i < n ? "" : "empty"}"></div>`;
    }
    el.innerHTML = html;
  },

  toast(text, ms = 1800) {
    const el = $("hud-toast");
    el.textContent = text;
    el.classList.remove("hidden");
    el.style.animation = "none";
    void el.offsetWidth; // restart animation
    el.style.animation = "toast-in 0.45s ease";
    clearTimeout(this._tt);
    this._tt = setTimeout(() => el.classList.add("hidden"), ms);
  },
};

/* ---------------- mech UI container ---------------- */

export const Mech = {
  root: null,
  show() { $("mech-ui").classList.remove("hidden"); },
  hide() { $("mech-ui").classList.add("hidden"); $("mech-ui").innerHTML = ""; },
  set(html) {
    this.show();
    $("mech-ui").innerHTML = html;
  },
  clear() { $("mech-ui").innerHTML = ""; },
};
