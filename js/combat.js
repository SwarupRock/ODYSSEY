/* ============================================================
   ODYSSEY — combat.js
   Two owners live here:
   1) Cinematic — sword/arrow ATTACK EFFECTS drawn over the scene
      (slash arcs, sparks, arrow trails, impact flashes, hit-stop).
   2) FilmIntro — the film-style opening: the Trojan Horse night,
      the reveal, the title cards. Skippable, non-interactive.
   ============================================================ */

import { PAL } from "./art.js";
import { Fx } from "./fx.js";
import { Voice } from "./voice.js";
import { PixelVFX } from "./pixelvfx.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const Cinematic = {
  slashes: [],   // { x,y,dir,t,life,big }
  sparks: [],    // { x,y,vx,vy,t,life,c }
  trails: [],    // arrow trails { x,y,x2,y2,t,life }
  rings: [],     // impact shockwaves { x,y,r,maxR,t,life,c }
  heroAnim: null, // { type, t, dur, dir, comboStep }
  _combo: 0,
  _comboReset: 0,
  _lastSlashAt: 0,

  /** direct trigger for any pixelfx module at screen coords (x,y) */
  fx(id, x, y, opts = {}) {
    return PixelVFX.spawn(id, x, y, opts);
  },

  /**
   * Perform a hero combat move with pixelfx + animated Odysseus pose:
   * move: "slash" | "uppercut" | "spin" | "spear" | "block" | "parry" | "dash"
   */
  performMove(move, x, y, dir = 1, opts = {}) {
    const swordTier = opts.swordTier !== undefined ? opts.swordTier : 1;
    const pal = opts.palette || (swordTier >= 3 ? "hector" : swordTier === 2 ? "moly" : "bronze");
    const engine = opts.engine || null;

    if (move === "slash") {
      const step = this._comboReset > 0 ? ((this._lastSlashAt + 1) % 3) : 0;
      this._lastSlashAt = step;
      this._comboReset = 1.15;
      const fxId = (swordTier >= 3 || step === 2)
        ? "melee/heavy-cleave"
        : step === 1 || swordTier === 2
          ? "melee/double-slash"
          : "melee/sword-slash";
      const big = step === 2 || swordTier >= 3;
      this.slashes.push({ x: x + dir * 24, y: y - 42, dir, t: 0, life: big ? 0.30 : 0.22, big });
      PixelVFX.spawn(fxId, x + dir * 26, y - 28, {
        flip: dir < 0,
        palette: big ? "hector" : pal,
        sparks: "fire",
        scale: big ? 1.2 : 1.05,
        light: 1.3,
        engine,
        autoHits: true,
      });
      this.heroAnim = { type: "slash", t: 0, dur: big ? 0.44 : 0.34, dir, comboStep: step };
      return { move, step, big };
    }

    if (move === "uppercut") {
      this._comboReset = 1.3;
      PixelVFX.spawn("melee/uppercut", x + dir * 20, y - 8, {
        flip: dir < 0,
        palette: "hector",
        sparks: "fire",
        scale: 1.24,
        light: 1.35,
        engine,
        autoHits: true,
      });
      PixelVFX.spawn("impacts/heavy-landing", x, y + 2, {
        flip: dir < 0,
        palette: "rock",
        scale: 0.72,
      });
      this.heroAnim = { type: "uppercut", t: 0, dur: 0.62, dir, comboStep: 0 };
      return { move, big: true };
    }

    if (move === "spin") {
      this._comboReset = 1.3;
      PixelVFX.spawn("melee/spin-slash", x, y - 16, {
        flip: dir < 0,
        palette: swordTier >= 2 ? "hector" : "bronze",
        sparks: "fire",
        radius: 22,
        scale: 1.28,
        light: 1.35,
        engine,
        autoHits: true,
      });
      PixelVFX.spawn("impacts/ground-slam", x, y + 2, {
        palette: "rock",
        scale: 0.85,
      });
      this.heroAnim = { type: "spin", t: 0, dur: 0.56, dir, comboStep: 0 };
      return { move, big: true };
    }

    if (move === "spear") {
      this._comboReset = 1.3;
      PixelVFX.spawn("melee/spear-sweep", x + dir * 18, y - 14, {
        flip: dir < 0,
        palette: "bronze",
        sparks: "fire",
        scale: 1.22,
        light: 1.25,
        engine,
        autoHits: true,
      });
      PixelVFX.spawn("melee/thrust", x + dir * 42, y - 22, {
        flip: dir < 0,
        palette: "hector",
        scale: 1.0,
        light: 1.2,
      });
      this.heroAnim = { type: "spear", t: 0, dur: 0.52, dir, comboStep: 0 };
      return { move, big: false };
    }

    if (move === "parry") {
      PixelVFX.spawn("impacts/parry", x + dir * 20, y - 34, {
        flip: dir < 0,
        palette: "apollo",
        scale: 1.15,
        light: 1.4,
      });
      PixelVFX.spawn("holy/divine-shield", x, y - 10, {
        palette: "apollo",
        scale: 0.95,
        light: 1.3,
      });
      PixelVFX.spawn("impacts/impact-frame", x, y - 40, { scale: 1.2 });
      this.heroAnim = { type: "block", t: 0, dur: 0.45, dir, parry: true };
      return { move };
    }

    if (move === "block") {
      PixelVFX.spawn("impacts/shield-block", x + dir * 16, y - 22, {
        flip: dir < 0,
        palette: "bronze",
        sparks: "fire",
        scale: 1.0,
        light: 1.2,
      });
      this.heroAnim = { type: "block", t: 0, dur: 0.55, dir, parry: false };
      return { move };
    }

    if (move === "dash") {
      PixelVFX.spawn("moves/dash-strike", x, y - 4, {
        flip: dir < 0,
        palette: "bronze",
        scale: 0.95,
      });
      this.heroAnim = { type: "dash", t: 0, dur: 0.28, dir };
      return { move };
    }
    return null;
  },

  /** current procedural pose offset for drawOdysseus() */
  getHeroPose() {
    const a = this.heroAnim;
    if (!a) return null;
    const u = clamp(a.t / a.dur, 0, 1);
    const dir = a.dir || 1;
    if (a.type === "uppercut") {
      // quick coil 0..0.18, high rising jump 0.18..0.85, land
      const dy = u < 0.16
        ? 6 * (u / 0.16)
        : -58 * Math.sin(((u - 0.16) / 0.84) * Math.PI);
      const bladeAngle = u < 0.16 ? 0.9 : -2.1 + u * 0.7;
      return { attackType: "uppercut", k: u, dy, dx: dir * Math.sin(u * Math.PI) * 16, lean: u < 0.16 ? 0.15 : -0.2, spin: 0, bladeAngle, shield: false };
    }
    if (a.type === "spin") {
      const dy = -14 * Math.sin(u * Math.PI);
      const spin = u * Math.PI * 4 * dir; // crisp fast double/single whirl
      return { attackType: "spin", k: u, dy, dx: dir * Math.sin(u * Math.PI) * 10, lean: 0.12, spin, bladeAngle: 0.15, shield: false };
    }
    if (a.type === "spear") {
      const lunge = Math.sin(Math.min(1, u * 1.4) * Math.PI);
      return { attackType: "spear", k: u, dy: 2 * lunge, dx: dir * lunge * 28, lean: 0.26 * lunge, spin: 0, bladeAngle: -0.08, shield: false };
    }
    if (a.type === "slash") {
      const swing = Math.sin(u * Math.PI);
      const bladeAngle = a.comboStep === 1 ? (1.3 - u * 2.5) : (-1.7 + u * 2.7);
      return { attackType: "slash", k: u, dy: 0, dx: dir * swing * 16, lean: 0.22 * swing, spin: 0, bladeAngle, shield: false };
    }
    if (a.type === "block") {
      return { attackType: "block", k: u, dy: 2, dx: -dir * 4 * (1 - u), lean: -0.08, spin: 0, bladeAngle: -0.9, shield: true, parry: !!a.parry };
    }
    if (a.type === "dash") {
      return { attackType: "dash", k: u, dy: -6 * Math.sin(u * Math.PI), dx: 0, lean: 0.34, spin: 0, bladeAngle: 0.4, shield: false };
    }
    return null;
  },

  /** floating pixelfx damage / crit number + combo counter */
  damageNumber(x, y, dmg, crit = false, comboCount = 0) {
    if (crit) {
      PixelVFX.spawn("ui/crit-number", x, y - 16, {
        text: String(dmg) + "!",
        label: "CRIT",
        palette: "hector",
        scale: 0.9,
      });
    } else {
      PixelVFX.spawn("ui/damage-number", x, y, {
        text: "-" + String(dmg),
        palette: "blood",
        scale: 0.92,
      });
    }
    if (comboCount >= 2) {
      PixelVFX.spawn("ui/combo-counter", x - 18, y - 48, {
        count: comboCount,
        label: "COMBO",
        palette: "hector",
        scale: 0.82,
      });
    }
  },

  /** a sword slash arc at (x,y); dir ±1; big=true for heavy blows; swordTier=0..3 */
  slash(x, y, dir, big = false, swordTier = 1) {
    this.slashes.push({ x, y, dir, t: 0, life: big ? 0.30 : 0.22, big });
    // pixelfx sword slash scaled by blade tier
    const fxId = swordTier >= 3 || big
      ? "melee/heavy-cleave"
      : swordTier === 2
        ? "melee/double-slash"
        : "melee/sword-slash";
    const pal = swordTier >= 3 || big ? "hector" : swordTier === 2 ? "moly" : "bronze";
    PixelVFX.spawn(fxId, x, y + 18, {
      flip: dir < 0,
      palette: pal,
      scale: big ? 1.18 : 0.95,
      light: 1.25,
    });

    const n = big ? 12 : 6;
    for (let i = 0; i < n; i++) {
      const a = (dir > 0 ? -0.9 : Math.PI + 0.9) + (Math.random() - 0.5) * 1.6;
      const sp = 120 + Math.random() * (big ? 300 : 190);
      this.sparks.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        t: 0, life: 0.28 + Math.random() * 0.3,
        c: Math.random() < 0.35 ? PAL.fireBright : PAL.bronzeBright,
      });
    }
  },

  /** fast arrow trail segment spawned by scenefw on each arrow frame */
  arrowTrail(x, y, x2, y2, arrowTier = 0) {
    this.trails.push({ x, y, x2, y2, t: 0, life: 0.16, tier: arrowTier });
  },

  /** bronze / elemental impact: pixelfx hit + shockwave ring + sparks + flash */
  impact(x, y, c = PAL.bronzeBright, big = false, kind = null) {
    this.rings.push({ x, y, r: 6, maxR: big ? 64 : 40, t: 0, life: big ? 0.38 : 0.26, c });

    if (kind === "fire") {
      PixelVFX.spawn("explosions/small-explosion", x, y + 16, { palette: "fire", scale: 0.8 });
    } else if (kind === "apollo") {
      PixelVFX.spawn("holy/smite", x, y + 24, { palette: "apollo", scale: 0.85, light: 1.3 });
    } else if (kind === "blunt") {
      PixelVFX.spawn("impacts/blunt-hit", x, y + 12, { palette: c === PAL.blood ? "blood" : "rock", scale: big ? 1.15 : 0.9 });
    } else if (kind === "zap") {
      PixelVFX.spawn("lightning/zap-hit", x, y + 12, { palette: "apollo", scale: 1.0 });
    } else {
      const isBlood = c === PAL.blood;
      PixelVFX.spawn(big ? "impacts/crit-hit" : "impacts/hit-spark", x, y + 12, {
        palette: isBlood ? "blood" : big ? "hector" : "bronze",
        scale: big ? 1.1 : 0.92,
        light: 1.2,
      });
    }

    for (let i = 0; i < (big ? 10 : 6); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * (big ? 260 : 170);
      this.sparks.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        t: 0, life: 0.25 + Math.random() * 0.35,
        c: Math.random() < 0.5 ? c : PAL.fireBright,
      });
    }
    Fx.hit(big ? 0.75 : 0.5);
  },

  /** armor block / shield deflection */
  block(x, y, dir = 1, armorTier = 1) {
    PixelVFX.spawn("impacts/shield-block", x, y + 26, {
      flip: dir < 0,
      palette: armorTier >= 2 ? "apollo" : "bronze",
      sparks: "fire",
      scale: 1.05,
      light: 1.25,
    });
    PixelVFX.spawn("impacts/parry", x + dir * 10, y + 4, {
      flip: dir < 0,
      palette: "bronze",
      scale: 0.85,
    });
  },

  /** dash / landing dust wave */
  dash(x, y, dir = 1) {
    PixelVFX.spawn("impacts/heavy-landing", x, y, {
      flip: dir < 0,
      palette: "rock",
      scale: 0.72,
    });
  },

  update(dt) {
    PixelVFX.update(dt);
    if (this._comboReset > 0) {
      this._comboReset -= dt;
      if (this._comboReset <= 0) this._combo = 0;
    }
    if (this.heroAnim) {
      this.heroAnim.t += dt;
      if (this.heroAnim.t >= this.heroAnim.dur) this.heroAnim = null;
    }
    for (const s of this.slashes) s.t += dt;
    this.slashes = this.slashes.filter((s) => s.t < s.life);
    for (const p of this.sparks) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 620 * dt;
    }
    this.sparks = this.sparks.filter((p) => p.t < p.life);
    for (const tr of this.trails) tr.t += dt;
    this.trails = this.trails.filter((tr) => tr.t < tr.life);
    for (const r of this.rings) { r.t += dt; r.r += (r.maxR - r.r) * Math.min(1, dt * 10); }
    this.rings = this.rings.filter((r) => r.t < r.life);
  },

  draw(ctx) {
    // arrow trails — quick fading shafts of motion
    ctx.save();
    ctx.lineCap = "round";
    for (const tr of this.trails) {
      const k = 1 - tr.t / tr.life;
      ctx.globalAlpha = k * (tr.tier >= 1 ? 0.75 : 0.55);
      ctx.strokeStyle = tr.tier >= 2 ? PAL.bronzeBright : tr.tier === 1 ? PAL.fire : PAL.boneDim;
      ctx.lineWidth = (tr.tier >= 1 ? 3.2 : 2.4) * k + 0.6;
      ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x2, tr.y2); ctx.stroke();
    }
    // subtle backing glow under pixelfx slashes
    for (const s of this.slashes) {
      const k = s.t / s.life;
      const a = Math.sin(k * Math.PI);
      const R = s.big ? 54 : 38;
      const sweep = (2.1 - k * 1.4);
      ctx.globalAlpha = a * 0.35;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(s.dir, 1);
      ctx.rotate(-0.7 + k * 0.9);
      ctx.strokeStyle = PAL.fireBright;
      ctx.lineWidth = s.big ? 4 : 2.5;
      ctx.beginPath(); ctx.arc(0, 0, R, -sweep / 2, sweep / 2); ctx.stroke();
      ctx.restore();
    }
    // impact rings
    for (const r of this.rings) {
      const k = 1 - r.t / r.life;
      ctx.globalAlpha = k * 0.65;
      ctx.strokeStyle = r.c;
      ctx.lineWidth = 3.5 * k + 0.8;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    }
    // sparks — warm dots with gravity
    for (const p of this.sparks) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.4 + 1.8 * k, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Crisp pixel-art VFX overlay
    PixelVFX.draw(ctx, "front");
  },

  clear() {
    this.slashes = []; this.sparks = []; this.trails = []; this.rings = [];
    this.heroAnim = null; this._combo = 0; this._comboReset = 0;
    PixelVFX.clear();
  },
};

/* ============================================================
   FilmIntro — the opening the user asked for: the Trojan Horse,
   told like the film. Cinematic letterbox, slow shots, title
   cards, then hands off to the prologue scene. Skippable.
   ============================================================ */

const SHOTS = [
  { id: "card",  dur: 3.2, line: "TROY — THE TENTH YEAR OF THE WAR" },
  { id: "siege", dur: 4.6, voice: "Ten years the war ground on, and the walls of Priam never fell." },
  { id: "card",  dur: 2.6, line: "The city could not be taken by force." },
  { id: "beach", dur: 4.4, voice: "So the Greeks burned their camps, and pretended to sail for home." },
  { id: "horse", dur: 5.6, voice: "All that they left behind... was a gift." },
  { id: "wheel", dur: 4.6, voice: "The Trojans dragged their doom through their own gates — singing." },
  { id: "night", dur: 3.4, voice: "That night, Troy slept without a watch." },
  { id: "sack",  dur: 7.2, voice: "And from the belly of the horse, the heroes woke." },
  { id: "card",  dur: 4.2, line: "ODYSSEY" },
];

export class FilmIntro {
  constructor(engine, audio, onDone) {
    this.eng = engine;
    this.audio = audio;
    this.onDone = onDone;
    this.t = 0;
    this.i = 0;
    this.done = false;
    this._bar = 0;              // letterbox animation 0..1
    this._fired = new Set();    // one-shot audio cues per shot
    audio.playChapterMusic(0);  // the doomed Troy dirge under everything
  }

  skip() { this._finish(); }

  /** tap anywhere (engine routes quick taps here) */
  onTap() { this.skip(); }

  /** progress total time; index of the current shot */
  update(dt) {
    this.t += dt;
    this._bar = Math.min(1, this._bar + dt * 2);
    let shot = SHOTS[this.i];
    while (shot && this.t > shot.dur) {
      this.t -= shot.dur;
      this.i++;
      this._fired.clear();
      shot = SHOTS[this.i];
    }
    if (!shot) { this._finish(); return; }
    if (!this._fired.has("cue")) {
      this._fired.add("cue");
      if (shot.voice) { try { Voice.say("NARRATOR", shot.voice); } catch {} }
      if (shot.id === "horse") this.audio.sfx("reveal");
      if (shot.id === "wheel") this.audio.sfx("thud");
      if (shot.id === "sack") { this.audio.sfx("reveal"); this.eng.shake(1.5); }
      if (shot.id === "card" && shot.line === "ODYSSEY") this.audio.sfx("reveal");
    }
    // timed cinematic audio + pixelfx cues during the Trojan Horse breakout
    if (shot.id === "sack") {
      const W = this.eng.W, H = this.eng.H, gy = H * 0.84;
      const s = Math.min(W, H) / 420;
      const hx = W * 0.46, hcx = hx + 16 * s;
      if (this.t > 0.7 && !this._fired.has("rope")) {
        this._fired.add("rope");
        this.audio.sfx("thud");
        this.eng.shake(0.8);
        PixelVFX.spawn("impacts/heavy-landing", hcx - 4 * s, gy, { palette: "rock", scale: 0.75 });
      }
      if (this.t > 2.4 && !this._fired.has("hero1")) {
        this._fired.add("hero1");
        this.audio.sfx("slash");
        this.eng.shake(1.2);
        PixelVFX.spawn("impacts/heavy-landing", hcx, gy, { palette: "rock", scale: 0.9 });
        PixelVFX.spawn("melee/sword-slash", hx + 120 * s, gy - 20 * s, { palette: "bronze", scale: 0.9 });
      }
      if (this.t > 3.8 && !this._fired.has("hero2")) {
        this._fired.add("hero2");
        this.audio.sfx("thud");
        this.eng.shake(0.8);
        PixelVFX.spawn("impacts/ground-slam", hcx, gy, { palette: "rock", scale: 0.72 });
      }
      if (this.t > 5.1 && !this._fired.has("hero3")) {
        this._fired.add("hero3");
        this.audio.sfx("slash");
        PixelVFX.spawn("melee/double-slash", hx - 75 * s, gy - 22 * s, { flip: true, palette: "bronze", scale: 0.9 });
      }
      if (this.t > 6.2 && !this._fired.has("hero4")) {
        this._fired.add("hero4");
        this.audio.sfx("roar");
        this.eng.shake(1.8);
        PixelVFX.spawn("fire/fire-ring", hx + 10 * s, gy, { palette: "fire", scale: 0.95 });
      }
    }
  }

  _finish() {
    if (this.done) return;
    this.done = true;
    this.onDone && this.onDone();
  }

  /* ---------------- drawing ---------------- */

  draw(ctx) {
    const W = this.eng.W, H = this.eng.H;
    const shot = SHOTS[this.i] || { id: "card", line: "" };
    const k = this.t / shot.dur; // 0..1 through the current shot

    // base night — warm rich atmosphere
    ctx.fillStyle = "#140c08";
    ctx.fillRect(0, 0, W, H);
    if (shot.id === "card") {
      this._drawCard(ctx, W, H, shot.line, k);
    } else {
      // slow cinematic push-in on every live shot
      const cam = 1 + 0.10 * k;
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.scale(cam, cam); ctx.translate(-W / 2, -H / 2);
      if (shot.id === "siege") this._drawSiege(ctx, W, H, k);
      else if (shot.id === "beach") this._drawBeach(ctx, W, H, k);
      else if (shot.id === "horse") this._drawHorse(ctx, W, H, k);
      else if (shot.id === "wheel") this._drawWheel(ctx, W, H, k);
      else if (shot.id === "night") this._drawNight(ctx, W, H, k);
      else if (shot.id === "sack") this._drawSack(ctx, W, H, k);
      ctx.restore();
    }

    // letterbox bars + fade
    const bar = H * 0.11 * this._bar;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
    // soft fade-in of each shot
    const fadeAlpha = Math.max(0, 0.45 - k * 5);
    if (fadeAlpha > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }
    // skip hint
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(this.t * 3) * 0.15;
    ctx.fillStyle = PAL.boneDim;
    ctx.font = "13px Georgia, serif";
    ctx.textAlign = "right";
    ctx.fillText("tap to skip ▸", W - 18, H - bar - 14);
    ctx.restore();
  }

  _title(ctx, cx, cy, text, size, alpha, color = PAL.bone, maxW) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let fs = size;
    ctx.font = `600 ${fs}px Georgia, serif`;
    if (maxW && ctx.measureText(text).width > maxW) {
      do { fs -= 1; ctx.font = `600 ${fs}px Georgia, serif`; } while (ctx.measureText(text).width > maxW && fs > 10);
    }
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }

  _drawCard(ctx, W, H, line, k) {
    const a = Math.min(1, k * 3) * Math.min(1, (1 - k) * 3.2);
    const big = line === "ODYSSEY";
    if (big) {
      const titleSize = Math.min(64, Math.max(32, W * 0.095));
      const subSize = Math.max(13, Math.min(18, W * 0.032));
      
      const titleY = H * 0.44;
      const subY = H * 0.55;
      const topRuleY = titleY - titleSize * 0.72;
      const btmRuleY = subY + subSize * 1.5;
      
      this._title(ctx, W / 2, titleY, "O D Y S S E Y", titleSize, a, PAL.bone, W * 0.85);
      
      // Subtitle
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = PAL.boneDim;
      ctx.font = `italic 400 ${subSize}px Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("the long way home", W / 2, subY);
      ctx.restore();
      
      // Elegant framing lines with gold center diamond / meander accents
      ctx.save();
      ctx.globalAlpha = a * 0.75;
      ctx.strokeStyle = PAL.bronze;
      ctx.lineWidth = 1.8;
      const w2 = Math.min(260, W * 0.36);
      
      // Top Rule
      ctx.beginPath();
      ctx.moveTo(W / 2 - w2, topRuleY);
      ctx.lineTo(W / 2 + w2, topRuleY);
      ctx.stroke();
      
      // Bottom Rule
      ctx.beginPath();
      ctx.moveTo(W / 2 - w2, btmRuleY);
      ctx.lineTo(W / 2 + w2, btmRuleY);
      ctx.stroke();

      // Center gold diamond ornaments on top and bottom rules
      ctx.fillStyle = PAL.bronzeBright;
      for (const yy of [topRuleY, btmRuleY]) {
        ctx.beginPath();
        ctx.moveTo(W / 2, yy - 3.5);
        ctx.lineTo(W / 2 + 3.5, yy);
        ctx.lineTo(W / 2, yy + 3.5);
        ctx.lineTo(W / 2 - 3.5, yy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else {
      this._title(ctx, W / 2, H * 0.5, line, Math.min(24, Math.max(14, W * 0.045)), a, PAL.boneDim, W * 0.88);
    }
  }

  /** THE HORSE — the Walk from the beach, torches right, embers */
  _drawHorse(ctx, W, H, k) {
    const gy = H * 0.86;
    // Bright glowing sunset sky behind the walls
    const skyG = ctx.createLinearGradient(0, 0, 0, gy);
    skyG.addColorStop(0, "#221008");
    skyG.addColorStop(0.5, "#481c0c");
    skyG.addColorStop(1, "#742c12");
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, W, H);

    const g = ctx.createRadialGradient(W * 0.7, gy - H * 0.3, 10, W * 0.7, gy - H * 0.3, H * 0.6);
    g.addColorStop(0, "rgba(255,140,50,0.65)");
    g.addColorStop(0.5, "rgba(220,90,30,0.3)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // city wall across the background with the gate
    ctx.fillStyle = "rgba(28,15,9,0.95)";
    const wy = gy - H * 0.06;
    ctx.fillRect(W * 0.45, wy - H * 0.18, W * 0.62, H * 0.18);
    for (let i = 0; i < 5; i++) ctx.fillRect(W * (0.5 + i * 0.11), wy - H * 0.23, W * 0.035, H * 0.05);
    ctx.fillRect(0, wy, W, H - wy);
    // ground
    ctx.fillStyle = "#1e110a";
    ctx.fillRect(0, gy, W, H - gy);
    // the horse walks in from the left
    const s = Math.min(W, H) / 440;
    const cx = W * (0.02 + k * 0.22);
    this._horse(ctx, cx, gy - 4, s, this.t);
    // Trojan braziers / torches at the gate (right)
    for (let i = 0; i < 4; i++) {
      const tx = W * (0.62 + i * 0.085), ty = gy - 2;
      PixelVFX.drawLoop(ctx, "fire/brazier", tx, ty, this.t + i * 0.67, { palette: "fire", scale: 0.65 });
    }
    this._embers(ctx, W, H, 24);
  }

  _embers(ctx, W, H, n) {
    for (let i = 0; i < n; i++) {
      const ex = (i * 97.3) % W;
      const ey = (H - ((this.t * (16 + (i % 9)) + i * 53) % H));
      ctx.globalAlpha = 0.45 + Math.sin(i + this.t) * 0.35;
      ctx.fillStyle = PAL.fireBright;
      ctx.fillRect(ex, ey, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
  }

  /** THE HORSE ITSELF */
  _horse(ctx, cx, gy, s, t) {
    ctx.save();
    ctx.translate(cx, gy);
    ctx.scale(s, s);
    const ink = "#18100b";
    const bob = Math.sin(t * 1.7) * 1.6; // breathing
    ctx.translate(0, bob);
    // tail — hangs DOWN from the rump
    ctx.strokeStyle = ink; ctx.lineWidth = 10; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-80, -136); ctx.quadraticCurveTo(-95, -100, -88, -58); ctx.stroke();
    // far-side legs (lighter ink — depth)
    ctx.fillStyle = "#22170f";
    ctx.fillRect(-40, -62, 12, 62); ctx.fillRect(62, -60, 11, 60);
    // barrel: deep chest at the FRONT, rounded rump at the back
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(-62, -58);
    ctx.quadraticCurveTo(-86, -66, -88, -100);   // under the haunch
    ctx.quadraticCurveTo(-91, -140, -62, -154);  // rump
    ctx.quadraticCurveTo(-36, -166, -2, -164);   // croup
    ctx.quadraticCurveTo(24, -168, 44, -158);    // withers
    ctx.quadraticCurveTo(60, -150, 70, -132);    // into the neck base
    ctx.quadraticCurveTo(88, -118, 90, -96);     // broad chest front
    ctx.quadraticCurveTo(91, -72, 68, -60);      // chest bottom
    ctx.quadraticCurveTo(28, -54, -8, -57);      // belly
    ctx.closePath(); ctx.fill();
    // near-side legs — fore pair at the chest, hind pair at the haunch
    ctx.fillStyle = ink;
    ctx.fillRect(-60, -64, 15, 64); ctx.fillRect(-30, -60, 13, 60);
    ctx.fillRect(42, -64, 15, 64); ctx.fillRect(72, -58, 12, 58);
    // hooves
    ctx.fillRect(-60, -8, 15, 8); ctx.fillRect(-30, -8, 13, 8);
    ctx.fillRect(42, -8, 15, 8); ctx.fillRect(72, -8, 12, 8);
    // NECK — arches up-forward from the withers/chest
    ctx.beginPath();
    ctx.moveTo(28, -158);
    ctx.quadraticCurveTo(62, -180, 86, -208);    // top of the arch
    ctx.lineTo(108, -196);                       // poll
    ctx.quadraticCurveTo(100, -174, 82, -156);   // down the throat
    ctx.quadraticCurveTo(66, -138, 48, -132);    // into the chest
    ctx.closePath(); ctx.fill();
    // HEAD — angled down-forward
    ctx.save();
    ctx.translate(96, -202);
    ctx.rotate(0.55);
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.quadraticCurveTo(18, -12, 40, 0);        // face top to the muzzle
    ctx.quadraticCurveTo(46, 5, 38, 11);         // nose
    ctx.quadraticCurveTo(16, 14, -6, 9);         // jaw
    ctx.closePath(); ctx.fill();
    // ears
    ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(3, -24); ctx.lineTo(9, -7); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-9, -7); ctx.lineTo(-6, -21); ctx.lineTo(-1, -8); ctx.closePath(); ctx.fill();
    ctx.restore();
    // mane
    ctx.strokeStyle = "#281b12"; ctx.lineWidth = 5; ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const mx = 34 + i * 10, my = -162 - i * 7.5;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + 6, my - 9); ctx.stroke();
    }
    ctx.lineCap = "butt";
    // plank seams
    ctx.strokeStyle = "rgba(42,30,22,0.95)"; ctx.lineWidth = 2.4;
    for (const px of [-42, -8, 26, 54]) {
      ctx.beginPath(); ctx.moveTo(px, -160); ctx.quadraticCurveTo(px + 3, -108, px - 2, -58); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(42,30,22,0.85)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-70, -66); ctx.lineTo(72, -62); ctx.stroke();
    // the hatch
    ctx.strokeStyle = "rgba(50,35,25,0.95)"; ctx.lineWidth = 3;
    ctx.strokeRect(-2, -102, 36, 28);
    ctx.strokeStyle = "rgba(255,180,80,0.6)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(26, -88, 5, 0, Math.PI * 2); ctx.stroke();
    // firelight rim
    ctx.strokeStyle = "rgba(255,170,80,0.7)"; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-88, -100); ctx.quadraticCurveTo(-91, -140, -62, -154); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-62, -154); ctx.quadraticCurveTo(-36, -166, -2, -164); ctx.stroke();
    ctx.restore();
  }

  /** the siege — Troy's walls at night, war-fires at the base */
  _drawSiege(ctx, W, H, k) {
    const gy = H * 0.82;
    // Glowing sky over burning city
    const skyG = ctx.createLinearGradient(0, 0, 0, gy);
    skyG.addColorStop(0, "#1a0b06");
    skyG.addColorStop(0.5, "#42180b");
    skyG.addColorStop(1, "#72280e");
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, W, H);

    // Fires along the wall base
    const g = ctx.createRadialGradient(W * 0.5, gy, 10, W * 0.5, gy, H * 0.55);
    g.addColorStop(0, "rgba(255,140,45,0.6)");
    g.addColorStop(0.5, "rgba(220,80,25,0.25)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // The great wall with towers
    ctx.fillStyle = "rgba(28,16,10,0.95)";
    const wy = gy - H * 0.20;
    ctx.fillRect(0, wy, W, H * 0.20);
    for (let i = 0; i < 4; i++) {
      const tx = W * (0.12 + i * 0.24);
      ctx.fillRect(tx, wy - H * 0.09, W * 0.055, H * 0.09);
      for (let m = 0; m < 3; m++) ctx.fillRect(tx + m * W * 0.02, wy - H * 0.105, W * 0.012, H * 0.015);
    }
    // Wall seams
    ctx.strokeStyle = "rgba(65,38,20,0.6)"; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const sx = W * (0.04 + i * 0.115);
      ctx.beginPath(); ctx.moveTo(sx, wy + 6); ctx.lineTo(sx, gy); ctx.stroke();
    }
    // Greek camp fires on the plain
    for (let i = 0; i < 5; i++) {
      const fx = W * (0.1 + i * 0.2), fy = gy + H * 0.05;
      PixelVFX.drawLoop(ctx, "fire/campfire", fx, fy, this.t + i * 0.71, { palette: "fire", scale: 0.72 });
    }
    ctx.fillStyle = "#160c07"; ctx.fillRect(0, gy + H * 0.06, W, H);
    this._embers(ctx, W, H, 20);
  }

  /** the beach — the fleet "sails away", the horse waits on the shore */
  _drawBeach(ctx, W, H, k) {
    const horizon = H * 0.46;
    // Luminous starry Aegean night sky
    const skyG = ctx.createLinearGradient(0, 0, 0, horizon);
    skyG.addColorStop(0, "#0c1828");
    skyG.addColorStop(0.7, "#162a40");
    skyG.addColorStop(1, "#264058");
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, W, horizon);

    // Bright moon + halo
    ctx.fillStyle = "rgba(255,240,200,0.25)";
    ctx.beginPath(); ctx.arc(W * 0.78, H * 0.16, H * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,245,220,0.95)";
    ctx.beginPath(); ctx.arc(W * 0.78, H * 0.16, H * 0.038, 0, Math.PI * 2); ctx.fill();

    // Sea water with moonlight reflections
    const seaG = ctx.createLinearGradient(0, horizon, 0, H);
    seaG.addColorStop(0, "#182c3e");
    seaG.addColorStop(0.4, "#101e2c");
    seaG.addColorStop(1, "#0a131c");
    ctx.fillStyle = seaG;
    ctx.fillRect(0, horizon, W, H - horizon);

    // Sea moon glint
    ctx.fillStyle = "rgba(255,235,180,0.45)";
    ctx.fillRect(W * 0.74, horizon, W * 0.08, H * 0.015);

    // Ships leaving on the horizon
    ctx.fillStyle = "#141d26";
    for (let i = 0; i < 3; i++) {
      const sx = W * (0.14 + i * 0.09) - k * W * 0.03 * (i + 1);
      const sy = horizon + 2 + i * 3;
      ctx.beginPath();
      ctx.moveTo(sx - 16, sy); ctx.quadraticCurveTo(sx, sy + 5, sx + 16, sy); ctx.lineTo(sx + 12, sy + 4);
      ctx.quadraticCurveTo(sx, sy + 8, sx - 12, sy + 4); ctx.closePath(); ctx.fill();
      ctx.fillRect(sx - 1, sy - 12, 2, 12);
    }

    // Beach sand ground
    const gy = H * 0.86;
    ctx.fillStyle = "#1e140d"; ctx.fillRect(0, gy - 8, W, H - gy + 8);
    // the horse on the shore, distant, waiting
    this._horse(ctx, W * 0.55, gy, Math.min(W, H) / 900, this.t);
    // beach campfires (the empty camp)
    for (let i = 0; i < 4; i++) {
      const fx = W * (0.09 + i * 0.09), fy = gy + 2;
      PixelVFX.drawLoop(ctx, "fire/campfire", fx, fy, this.t + i * 0.83, { palette: "fire", scale: 0.58 });
    }
    this._embers(ctx, W, H, 16);
  }

  /** the night watch — moonlit horse in the gate plaza, city asleep */
  _drawNight(ctx, W, H, k) {
    const gy = H * 0.85;
    // Luminous starry night sky
    const skyG = ctx.createLinearGradient(0, 0, 0, gy);
    skyG.addColorStop(0, "#081220");
    skyG.addColorStop(0.6, "#141a28");
    skyG.addColorStop(1, "#261c16");
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (let i = 0; i < 48; i++) {
      const sx = (i * 149.7) % W, sy = ((i * 83.1) % (H * 0.55));
      ctx.globalAlpha = 0.4 + Math.sin(i * 3 + this.t * 1.5) * 0.35;
      ctx.fillStyle = "#fff";
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // Crescent moon + glow
    ctx.fillStyle = "rgba(255,245,210,0.2)";
    ctx.beginPath(); ctx.arc(W * 0.2, H * 0.14, H * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,240,200,0.95)";
    ctx.beginPath(); ctx.arc(W * 0.2, H * 0.14, H * 0.032, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#081220";
    ctx.beginPath(); ctx.arc(W * 0.218, H * 0.132, H * 0.029, 0, Math.PI * 2); ctx.fill();

    // Sleeping houses (warm glowing windows)
    ctx.fillStyle = "rgba(22,14,10,0.95)";
    for (let i = 0; i < 6; i++) {
      const bw = W * 0.11, bh = H * (0.08 + ((i * 31) % 4) * 0.02);
      ctx.fillRect(i * bw * 1.02 + W * 0.3, gy - bh, bw * 0.9, bh);
    }
    // Warm window light
    ctx.fillStyle = `rgba(255,200,100,${0.75 + Math.sin(this.t * 2) * 0.2})`;
    ctx.fillRect(W * 0.52, gy - H * 0.065, 7, 9);
    ctx.fillRect(W * 0.36, gy - H * 0.055, 6, 8);

    ctx.fillStyle = "#1a100a"; ctx.fillRect(0, gy, W, H - gy);
    // the horse — moonlit rim
    const s = Math.min(W, H) / 480;
    this._horse(ctx, W * 0.5, gy - 4, s, this.t);
    // watcher's torch
    const fl = 4 + Math.sin(this.t * 10) * 1.6;
    ctx.fillStyle = "rgba(255,170,70,0.95)";
    ctx.beginPath(); ctx.arc(W * 0.9, gy - fl * 2, fl, 0, Math.PI * 2); ctx.fill();
  }

  /** the wheel — Trojan Horse on its rolling timber sled hauled toward the Scaean Gate */
  _drawWheel(ctx, W, H, k) {
    const gy = H * 0.87;
    const roll = k * W * 0.14;
    const sledX = W * 0.25 + roll;
    const R = H * 0.145;
    const frontWheelX = sledX + R * 1.45;
    const rearWheelX = sledX - R * 0.85;
    const wheelY = gy - R;

    // 1. Warm torchlit night sky over Troy
    const skyG = ctx.createLinearGradient(0, 0, 0, gy);
    skyG.addColorStop(0, "#0c0604");
    skyG.addColorStop(0.5, "#260f08");
    skyG.addColorStop(1, "#5c210c");
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, W, H);

    // Horizon city-wall silhouettes + distant watchfires
    ctx.fillStyle = "#160b06";
    ctx.fillRect(0, gy - H * 0.26, W * 0.56, H * 0.26);
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(W * (0.04 + i * 0.088), gy - H * 0.30, W * 0.04, H * 0.04);
    }

    // 2. Massive Scaean Gate masonry arch on the right
    const gx0 = W * 0.54;
    ctx.fillStyle = "#1d100a";
    ctx.fillRect(gx0, gy - H * 0.62, W - gx0, H * 0.62);
    // Gatehouse battlements
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(gx0 + i * W * 0.08, gy - H * 0.69, W * 0.045, H * 0.07);
    }
    // Stone block seams
    ctx.strokeStyle = "rgba(90,52,30,0.38)";
    ctx.lineWidth = 1.6;
    for (let row = 1; row <= 5; row++) {
      const sy = gy - row * H * 0.11;
      ctx.beginPath(); ctx.moveTo(gx0, sy); ctx.lineTo(W, sy); ctx.stroke();
    }
    // Open vaulted gate interior (deep warm glow spilling out from Troy's square)
    const archX = W * 0.67, archW = W * 0.26, archH = H * 0.44;
    const gateGlow = ctx.createRadialGradient(archX, gy - H * 0.14, 12, archX, gy - H * 0.14, archH);
    gateGlow.addColorStop(0, "rgba(255,155,60,0.55)");
    gateGlow.addColorStop(0.6, "rgba(180,65,20,0.28)");
    gateGlow.addColorStop(1, "#0b0503");
    ctx.fillStyle = gateGlow;
    ctx.beginPath();
    ctx.moveTo(archX - archW * 0.5, gy);
    ctx.lineTo(archX - archW * 0.5, gy - archH * 0.62);
    ctx.arc(archX, gy - archH * 0.62, archW * 0.5, Math.PI, 0);
    ctx.lineTo(archX + archW * 0.5, gy);
    ctx.closePath();
    ctx.fill();

    // Hanging scarlet banners + blazing gatehouse braziers
    ctx.fillStyle = "#6e1b14";
    ctx.fillRect(gx0 + W * 0.02, gy - H * 0.50, W * 0.025, H * 0.16);
    ctx.fillRect(W * 0.90, gy - H * 0.50, W * 0.025, H * 0.16);
    PixelVFX.drawLoop(ctx, "fire/brazier", gx0 + W * 0.032, gy - H * 0.26, this.t, { palette: "fire", scale: 0.72 });
    PixelVFX.drawLoop(ctx, "fire/brazier", W * 0.91, gy - H * 0.26, this.t + 0.5, { palette: "fire", scale: 0.72 });

    // 3. Cobblestone road / trodden siege path
    ctx.fillStyle = "#180d07";
    ctx.fillRect(0, gy, W, H - gy);
    ctx.strokeStyle = "rgba(120,76,42,0.28)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, gy + 2); ctx.lineTo(W, gy + 2); ctx.stroke();

    // 4. Giant Trojan Horse standing clearly atop the rolling timber sled
    const sledY = gy - R * 1.12;
    const horseScale = Math.min(W, H) / 485;
    this._horse(ctx, sledX + R * 0.25, sledY + 4, horseScale, this.t);

    // Heavy oak sled beams + vertical axle struts down to wheels
    ctx.fillStyle = "#2d1a0e";
    ctx.fillRect(sledX - R * 1.35, sledY - H * 0.032, R * 3.35, H * 0.055);
    ctx.strokeStyle = "#9b6b32";
    ctx.lineWidth = 2;
    ctx.strokeRect(sledX - R * 1.35, sledY - H * 0.032, R * 3.35, H * 0.055);
    ctx.fillStyle = "#24140a";
    ctx.fillRect(rearWheelX - R * 0.14, sledY + H * 0.02, R * 0.28, wheelY - sledY);
    ctx.fillRect(frontWheelX - R * 0.14, sledY + H * 0.02, R * 0.28, wheelY - sledY);

    // 5. Two heavy iron-rimmed spoked siege wheels
    const spinA = k * 2.4 + this.t * 0.45;
    for (const wx of [rearWheelX, frontWheelX]) {
      // Wheel shadow on cobblestones
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath(); ctx.ellipse(wx, gy + 3, R * 0.85, 5, 0, 0, Math.PI * 2); ctx.fill();
      // Spokes (beveled timber)
      ctx.strokeStyle = "#4d2f18";
      ctx.lineWidth = Math.max(4, R * 0.11);
      for (let i = 0; i < 8; i++) {
        const a = spinA + (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(wx, wheelY);
        ctx.lineTo(wx + Math.cos(a) * R * 0.88, wheelY + Math.sin(a) * R * 0.88);
        ctx.stroke();
      }
      // Wooden felloe + outer iron rim with firelight catch
      ctx.strokeStyle = "#362012";
      ctx.lineWidth = Math.max(7, R * 0.19);
      ctx.beginPath(); ctx.arc(wx, wheelY, R * 0.88, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#1c120c";
      ctx.lineWidth = Math.max(3, R * 0.07);
      ctx.beginPath(); ctx.arc(wx, wheelY, R * 0.96, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(230,150,70,0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(wx, wheelY, R * 0.96, -1.2, 0.5); ctx.stroke();
      // Central bronze hub + rivets
      ctx.fillStyle = "#9b6b32";
      ctx.beginPath(); ctx.arc(wx, wheelY, R * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#180d07";
      ctx.beginPath(); ctx.arc(wx, wheelY, R * 0.09, 0, Math.PI * 2); ctx.fill();
    }

    // 6. Taut braided siege ropes from sled hitch to hauling Trojans
    const hitchX = sledX + R * 1.98;
    const hitchY = sledY - H * 0.005;
    const pullers = [0, 1, 2, 3];
    const heave = Math.sin(this.t * 4.2) * 2.5;
    ctx.strokeStyle = "#c49452";
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(hitchX, hitchY - 3); ctx.lineTo(W * 0.84 + roll * 0.25, gy - H * 0.10 + heave); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hitchX, hitchY + 4); ctx.lineTo(W * 0.80 + roll * 0.25, gy - H * 0.08 + heave); ctx.stroke();

    // 7. Full-bodied Trojan soldier silhouettes with articulated legs braced on ground
    for (const i of pullers) {
      const px = W * (0.58 + i * 0.075) + roll * 0.25;
      const stride = Math.sin(this.t * 4.2 + i * 0.65);
      const lean = 0.28 + stride * 0.04;
      const h = H * 0.165;
      const hipY = -h * 0.42;
      ctx.save();
      ctx.translate(px, gy);
      // Ground shadow under feet
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath(); ctx.ellipse(0, 2, h * 0.28, 3.5, 0, 0, Math.PI * 2); ctx.fill();

      // Rear bracing leg (planted back behind hips, pushing hard)
      ctx.strokeStyle = "#1a0d08"; ctx.lineWidth = Math.max(4, h * 0.11); ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(h * 0.04, hipY);
      ctx.lineTo(-h * 0.10, -h * 0.21);
      ctx.lineTo(-h * 0.22, -2);
      ctx.stroke();

      // Front striding leg (bent knee stepping toward gate)
      ctx.strokeStyle = "#120906"; ctx.lineWidth = Math.max(4, h * 0.115);
      ctx.beginPath();
      ctx.moveTo(h * 0.04, hipY);
      ctx.lineTo(h * 0.20 + stride * h * 0.03, -h * 0.22);
      ctx.lineTo(h * 0.16 + stride * h * 0.04, -2);
      ctx.stroke();

      // Bronze greaves highlight on shins
      ctx.strokeStyle = "rgba(180,120,55,0.45)"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(h * 0.20 + stride * h * 0.03, -h * 0.22);
      ctx.lineTo(h * 0.16 + stride * h * 0.04, -4);
      ctx.stroke();

      // Upper torso + war tunic skirt + helmet pivoted around hips
      ctx.translate(h * 0.04, hipY);
      ctx.rotate(lean);
      // Tunic / chiton skirt draping over upper thighs
      ctx.fillStyle = "#120906";
      ctx.beginPath();
      ctx.moveTo(-h * 0.14, 0);
      ctx.lineTo(h * 0.16, 0);
      ctx.lineTo(h * 0.20, h * 0.12);
      ctx.lineTo(-h * 0.18, h * 0.12);
      ctx.closePath(); ctx.fill();
      // Torso & cuirass
      ctx.fillRect(-h * 0.14, -h * 0.44, h * 0.28, h * 0.45);
      // Helmet + scarlet crest
      ctx.beginPath(); ctx.arc(h * 0.02, -h * 0.56, h * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#8a2216";
      ctx.beginPath(); ctx.arc(-h * 0.03, -h * 0.68, h * 0.10, Math.PI, 0); ctx.fill();
      // Both arms reaching back to grip the taut rope
      ctx.strokeStyle = "#120906"; ctx.lineWidth = Math.max(3, h * 0.085);
      ctx.beginPath(); ctx.moveTo(-h * 0.04, -h * 0.34); ctx.lineTo(-h * 0.34, -h * 0.18); ctx.stroke();
      ctx.restore();
    }
    // Lead torchbearer lighting the Scaean Gate road
    PixelVFX.drawLoop(ctx, "fire/torch", W * 0.86 + roll * 0.25, gy - H * 0.14, this.t, { palette: "fire", scale: 0.9 });
    this._embers(ctx, W, H, 26);
  }

  /** the sack — Christopher Nolan-style cinematic: heroes emerging one by one, tactical landings, drawn blades */
  _drawSack(ctx, W, H, k) {
    const gy = H * 0.84;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    // Dramatic burning sky with billowing smoke
    const skyG = ctx.createLinearGradient(0, 0, 0, gy);
    skyG.addColorStop(0, "#080402");
    skyG.addColorStop(0.45, "#180a05");
    skyG.addColorStop(0.8, "#381408");
    skyG.addColorStop(1, "#541b0a");
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, W, H);

    // Distant burning Troy silhouette (pillars, ramparts, broken temples)
    ctx.fillStyle = "rgba(18, 9, 5, 0.95)";
    const bw = W * 0.08;
    for (let i = 0; i < 13; i++) {
      const bx = i * bw * 0.98 - W * 0.05;
      const bh = H * (0.12 + ((i * 47) % 7) * 0.025);
      ctx.fillRect(bx, gy - bh, bw * 0.9, bh);
      // Colonnade roofs & temple pediments
      if (i % 3 === 0) {
        ctx.beginPath();
        ctx.moveTo(bx, gy - bh);
        ctx.lineTo(bx + bw * 0.45, gy - bh - H * 0.035);
        ctx.lineTo(bx + bw * 0.9, gy - bh);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Great raging fire glow behind the walls
    const fireG = ctx.createRadialGradient(W * 0.8, gy - H * 0.25, 10, W * 0.8, gy - H * 0.25, H * 0.65);
    fireG.addColorStop(0, "rgba(255,140,40,0.55)");
    fireG.addColorStop(0.5, "rgba(180,60,20,0.25)");
    fireG.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fireG;
    ctx.fillRect(0, 0, W, H);

    // Ground stone plaza
    ctx.fillStyle = "#120a06";
    ctx.fillRect(0, gy, W, H - gy);
    ctx.strokeStyle = "rgba(45,26,14,0.45)";
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 10; i++) {
      const lx = W * (0.05 + i * 0.1);
      ctx.beginPath(); ctx.moveTo(lx, gy); ctx.lineTo(lx - W * 0.06, H); ctx.stroke();
    }

    // Atmospheric creeping ground fog
    ctx.fillStyle = "rgba(220,110,40,0.06)";
    for (let i = 0; i < 5; i++) {
      const fogX = ((i * 180 + this.t * 24) % (W * 1.3)) - W * 0.15;
      ctx.beginPath();
      ctx.ellipse(fogX, gy - 6, W * 0.22, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // The colossal Trojan Horse
    const s = Math.min(W, H) / 420;
    const hx = W * 0.46, hy = gy - H * 0.09;
    this._horse(ctx, hx, hy, s, this.t);

    // Hatch positions
    const openK = clamp(k * 7, 0, 1);
    const hcx = hx + 16 * s;
    const hcy = hy - 88 * s;

    // Open trapdoor on the belly
    ctx.save();
    ctx.fillStyle = "#1c1410";
    ctx.translate(hx + 34 * s, hy - 74 * s);
    ctx.rotate(openK * 1.55); // swings downward
    ctx.fillRect(-34 * s, 0, 34 * s, 6 * s);
    ctx.restore();

    // Volumetric golden God-Rays bursting from inside the dark horse
    if (openK > 0) {
      ctx.save();
      const beamG = ctx.createLinearGradient(hcx, hcy, hcx - 20 * s, gy);
      beamG.addColorStop(0, `rgba(255,200,90,${0.85 * openK})`);
      beamG.addColorStop(0.4, `rgba(240,140,50,${0.35 * openK})`);
      beamG.addColorStop(1, "rgba(240,120,40,0)");
      ctx.fillStyle = beamG;
      ctx.beginPath();
      ctx.moveTo(hcx - 14 * s, hcy);
      ctx.lineTo(hcx + 16 * s, hcy);
      ctx.lineTo(hcx + 45 * s, gy + 4);
      ctx.lineTo(hcx - 55 * s, gy + 4);
      ctx.closePath();
      ctx.fill();

      // Hatch interior firelight halo
      const hatchG = ctx.createRadialGradient(hcx, hcy, 2, hcx, hcy, 55 * s);
      hatchG.addColorStop(0, `rgba(255,210,110,${0.9 * openK})`);
      hatchG.addColorStop(0.5, `rgba(230,110,35,${0.4 * openK})`);
      hatchG.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = hatchG;
      ctx.fillRect(hcx - 55 * s, hcy - 55 * s, 110 * s, 110 * s);
      ctx.restore();
    }

    // Heavy knotted rope dropped to the stone floor
    const ropeLenK = clamp((k - 0.06) * 6, 0, 1);
    const ropeBottomY = hcy + (gy - hcy) * ropeLenK;
    ctx.save();
    ctx.strokeStyle = "rgba(145,105,65,0.95)";
    ctx.lineWidth = 3.2 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hcx, hcy);
    // slight natural sway
    const sway = Math.sin(this.t * 3.5) * 3 * s * (1 - k * 0.5);
    ctx.quadraticCurveTo(hcx + sway, hcy + (gy - hcy) * 0.5, hcx - 4 * s, ropeBottomY);
    ctx.stroke();

    // Rope knots for climbing grip
    ctx.fillStyle = "#5c3d1e";
    const numKnots = 7;
    for (let i = 1; i <= numKnots; i++) {
      const ky = hcy + (gy - hcy) * (i / (numKnots + 1));
      if (ky <= ropeBottomY) {
        ctx.beginPath();
        ctx.arc(hcx - 2 * s + sway * (i / numKnots), ky, 2.5 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // ----------------------------------------------------
    // HEROES DESCENDING ONE BY ONE (Tactical Nolan Infiltration)
    // ----------------------------------------------------

    // 1. ODYSSEUS (Commander — Blue Cloak, Bronze Blade)
    // Window: k from 0.10 to 1.0 (emerges, rappels, lands, draws blade, takes point)
    if (k >= 0.10) {
      this._drawHeroSequence(ctx, {
        name: "ODYSSEUS",
        type: "odysseus",
        cloakColor: PAL.aegean,
        helmColor: PAL.bronze,
        crestColor: PAL.blood,
        kStart: 0.10,
        kRappelEnd: 0.32,
        kLandEnd: 0.38,
        kAdvanceEnd: 0.48,
        startX: hcx,
        startY: hcy,
        groundY: gy,
        targetX: hx + 125 * s,
        k,
        s,
        t: this.t,
      });
    }

    // 2. DIOMEDES (Heavy Hoplite — Argive Round Shield & Spear)
    // Window: k from 0.28 to 1.0
    if (k >= 0.28) {
      this._drawHeroSequence(ctx, {
        name: "DIOMEDES",
        type: "diomedes",
        cloakColor: "#2a1e14",
        helmColor: PAL.bronzeBright,
        crestColor: "#1a120b",
        kStart: 0.28,
        kRappelEnd: 0.48,
        kLandEnd: 0.54,
        kAdvanceEnd: 0.64,
        startX: hcx,
        startY: hcy,
        groundY: gy,
        targetX: hx + 65 * s,
        k,
        s,
        t: this.t,
      });
    }

    // 3. NEOPTOLEMUS (Striker — Dual Curved Blades, Agile Flanker)
    // Window: k from 0.44 to 1.0
    if (k >= 0.44) {
      this._drawHeroSequence(ctx, {
        name: "NEOPTOLEMUS",
        type: "neoptolemus",
        cloakColor: "#181410",
        helmColor: "#322b22",
        crestColor: PAL.bronze,
        kStart: 0.44,
        kRappelEnd: 0.62,
        kLandEnd: 0.68,
        kAdvanceEnd: 0.78,
        startX: hcx,
        startY: hcy,
        groundY: gy,
        targetX: hx - 85 * s,
        k,
        s,
        t: this.t,
      });
    }

    // 4. MENELAUS (Spartan King — Crimson Cloak, Signal Torch)
    // Window: k from 0.60 to 1.0
    if (k >= 0.60) {
      this._drawHeroSequence(ctx, {
        name: "MENELAUS",
        type: "menelaus",
        cloakColor: PAL.blood,
        helmColor: PAL.bronzeBright,
        crestColor: PAL.blood,
        kStart: 0.60,
        kRappelEnd: 0.78,
        kLandEnd: 0.84,
        kAdvanceEnd: 0.92,
        startX: hcx,
        startY: hcy,
        groundY: gy,
        targetX: hx + 10 * s,
        k,
        s,
        t: this.t,
      });
    }

    // Cinematic Anamorphic Horizontal Flare on Odysseus's Drawn Blade
    if (k >= 0.42) {
      const flashAlpha = clamp(1 - (k - 0.42) * 2.5, 0, 1) * 0.9;
      if (flashAlpha > 0) {
        ctx.save();
        const bladeGlintX = hx + 125 * s + 12 * s;
        const bladeGlintY = gy - 42 * s;
        const streakG = ctx.createLinearGradient(bladeGlintX - 160 * s, bladeGlintY, bladeGlintX + 160 * s, bladeGlintY);
        streakG.addColorStop(0, "rgba(255,230,150,0)");
        streakG.addColorStop(0.48, `rgba(255,240,190,${0.4 * flashAlpha})`);
        streakG.addColorStop(0.5, `rgba(255,255,255,${0.95 * flashAlpha})`);
        streakG.addColorStop(0.52, `rgba(255,240,190,${0.4 * flashAlpha})`);
        streakG.addColorStop(1, "rgba(255,230,150,0)");
        ctx.fillStyle = streakG;
        ctx.fillRect(bladeGlintX - 160 * s, bladeGlintY - 2 * s, 320 * s, 4 * s);
        ctx.restore();
      }
    }

    this._embers(ctx, W, H, 24);
  }

  /** Renders an individual Greek warrior in their exact state of descent */
  _drawHeroSequence(ctx, hero) {
    const { type, cloakColor, helmColor, crestColor, kStart, kRappelEnd, kLandEnd, kAdvanceEnd, startX, startY, groundY, targetX, k, s, t } = hero;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    ctx.save();

    if (k < kRappelEnd) {
      // 1. RAPPEL / SLIDING DOWN THE ROPE
      const prog = (k - kStart) / (kRappelEnd - kStart);
      const currY = startY + (groundY - startY) * prog;
      const currX = startX - 4 * s + Math.sin(prog * Math.PI * 2) * 3 * s;

      ctx.translate(currX, currY);

      // Trailing cloak
      ctx.fillStyle = cloakColor;
      ctx.beginPath();
      ctx.moveTo(-4 * s, -28 * s);
      ctx.quadraticCurveTo(-18 * s - prog * 8 * s, -20 * s, -14 * s, -2 * s);
      ctx.lineTo(-2 * s, -12 * s);
      ctx.closePath();
      ctx.fill();

      // Slanted combat body
      ctx.fillStyle = "#120c08";
      ctx.fillRect(-5 * s, -26 * s, 10 * s, 22 * s);

      // Legs bent against the rope / horse
      ctx.strokeStyle = "#120c08";
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.moveTo(-3 * s, -6 * s); ctx.lineTo(-12 * s, 4 * s); ctx.lineTo(-6 * s, 12 * s);
      ctx.moveTo(3 * s, -6 * s); ctx.lineTo(6 * s, 6 * s); ctx.lineTo(10 * s, 14 * s);
      ctx.stroke();

      // Arms gripping the rope overhead
      ctx.strokeStyle = PAL.sand;
      ctx.lineWidth = 3.5 * s;
      ctx.beginPath();
      ctx.moveTo(-4 * s, -22 * s); ctx.lineTo(2 * s, -38 * s);
      ctx.moveTo(4 * s, -22 * s); ctx.lineTo(4 * s, -36 * s);
      ctx.stroke();

      // Helmet & Crest
      ctx.fillStyle = helmColor;
      ctx.beginPath(); ctx.arc(0, -32 * s, 6.5 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = crestColor; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(-6 * s, -36 * s); ctx.quadraticCurveTo(0, -44 * s, 6 * s, -34 * s); ctx.stroke();

    } else if (k < kLandEnd) {
      // 2. THREE-POINT COMBAT LANDING (Dust shockwave, knee compressed)
      const landProg = (k - kRappelEnd) / (kLandEnd - kRappelEnd);
      const currX = startX;

      // Ground landing dust puff
      ctx.save();
      const dustAlpha = (1 - landProg) * 0.75;
      ctx.fillStyle = `rgba(220,150,70,${dustAlpha})`;
      ctx.beginPath();
      ctx.ellipse(currX, groundY, (14 + landProg * 22) * s, (4 + landProg * 6) * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.translate(currX, groundY);

      // Low compressed crouch body
      ctx.fillStyle = cloakColor;
      ctx.beginPath();
      ctx.moveTo(-10 * s, -18 * s); ctx.lineTo(-24 * s, -2 * s); ctx.lineTo(-4 * s, -2 * s);
      ctx.closePath(); ctx.fill();

      ctx.fillStyle = "#120c08";
      ctx.fillRect(-6 * s, -16 * s, 12 * s, 14 * s);

      // Hand bracing on stone floor
      ctx.strokeStyle = PAL.sand; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(4 * s, -12 * s); ctx.lineTo(12 * s, -1 * s); ctx.stroke();

      // Helmet
      ctx.fillStyle = helmColor;
      ctx.beginPath(); ctx.arc(0, -22 * s, 6.5 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = crestColor; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(-6 * s, -26 * s); ctx.quadraticCurveTo(0, -33 * s, 6 * s, -24 * s); ctx.stroke();

    } else {
      // 3. ADVANCING & STANDING GUARD
      const advProg = clamp((k - kLandEnd) / (kAdvanceEnd - kLandEnd), 0, 1);
      const currX = startX + (targetX - startX) * advProg;
      const isWalking = advProg < 1;
      const bob = isWalking ? Math.sin(t * 12) * 2 * s : 0;

      ctx.translate(currX, groundY + bob);

      // Flowing cloak behind
      ctx.fillStyle = cloakColor;
      ctx.beginPath();
      ctx.moveTo(-6 * s, -38 * s);
      ctx.quadraticCurveTo(-22 * s - (isWalking ? 6 * s : 0), -26 * s, -16 * s, -4 * s);
      ctx.lineTo(-4 * s, -8 * s);
      ctx.closePath();
      ctx.fill();

      // Cuirass & Tunic
      ctx.fillStyle = "#160e09";
      ctx.fillRect(-6 * s, -36 * s, 12 * s, 26 * s);
      ctx.fillStyle = helmColor;
      ctx.fillRect(-5 * s, -34 * s, 10 * s, 14 * s); // bronze chest plate

      // Legs / greaves
      ctx.fillStyle = PAL.bronze;
      ctx.fillRect(-6 * s, -10 * s, 4.5 * s, 10 * s);
      ctx.fillRect(1.5 * s, -10 * s, 4.5 * s, 10 * s);

      // Arms & Weaponry based on hero type
      if (type === "odysseus") {
        // Drawn gleaming Bronze Xiphos Sword forward
        ctx.strokeStyle = PAL.bronzeBright;
        ctx.lineWidth = 2.8 * s;
        ctx.beginPath();
        ctx.moveTo(4 * s, -24 * s);
        ctx.lineTo(18 * s, -36 * s);
        ctx.stroke();

        // Sword crossguard & star glint
        ctx.fillStyle = PAL.bronzeBright;
        ctx.fillRect(7 * s, -28 * s, 3 * s, 6 * s);

        // Leading arm
        ctx.strokeStyle = PAL.sand; ctx.lineWidth = 3 * s;
        ctx.beginPath(); ctx.moveTo(0, -30 * s); ctx.lineTo(8 * s, -25 * s); ctx.stroke();

      } else if (type === "diomedes") {
        // Heavy round hoplite shield in left hand, spear in right
        ctx.fillStyle = PAL.bronze;
        ctx.beginPath(); ctx.arc(-2 * s, -24 * s, 12 * s, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = PAL.bronzeBright; ctx.lineWidth = 1.8 * s; ctx.stroke();

        // Heavy spear braced forward
        ctx.strokeStyle = "#4a2e16"; ctx.lineWidth = 2.4 * s;
        ctx.beginPath(); ctx.moveTo(4 * s, -6 * s); ctx.lineTo(24 * s, -44 * s); ctx.stroke();
        ctx.fillStyle = PAL.bronzeBright;
        ctx.beginPath(); ctx.moveTo(24 * s, -44 * s); ctx.lineTo(28 * s, -50 * s); ctx.lineTo(22 * s, -46 * s); ctx.closePath(); ctx.fill();

      } else if (type === "neoptolemus") {
        // Dual curved Greek machaira blades
        ctx.strokeStyle = PAL.bronzeBright; ctx.lineWidth = 2.2 * s;
        ctx.beginPath(); ctx.moveTo(4 * s, -20 * s); ctx.lineTo(16 * s, -28 * s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6 * s, -20 * s); ctx.lineTo(-14 * s, -30 * s); ctx.stroke();

      } else if (type === "menelaus") {
        // Signal torch flaming in left hand, drawn blade in right
        const torchX = -12 * s, torchY = -34 * s;
        ctx.strokeStyle = "#422812"; ctx.lineWidth = 2.6 * s;
        ctx.beginPath(); ctx.moveTo(-4 * s, -20 * s); ctx.lineTo(torchX, torchY); ctx.stroke();

        // Flame with warm dynamic flicker
        const fl = 4.5 + Math.sin(t * 14) * 1.8;
        ctx.fillStyle = "rgba(255,160,50,0.9)";
        ctx.beginPath(); ctx.arc(torchX, torchY - fl, fl, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,230,120,0.95)";
        ctx.beginPath(); ctx.arc(torchX, torchY - fl * 0.8, fl * 0.55, 0, Math.PI * 2); ctx.fill();

        // Sword in right hand
        ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 2.4 * s;
        ctx.beginPath(); ctx.moveTo(4 * s, -20 * s); ctx.lineTo(14 * s, -14 * s); ctx.stroke();
      }

      // Helmet & War Crest
      ctx.fillStyle = helmColor;
      ctx.beginPath(); ctx.arc(2 * s, -44 * s, 7.5 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#120a06"; ctx.fillRect(4.5 * s, -43 * s, 2 * s, 6 * s); // eye slit

      // Crest plume
      ctx.strokeStyle = crestColor; ctx.lineWidth = 3.6 * s; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-4 * s, -49 * s);
      ctx.quadraticCurveTo(2 * s, -60 * s, 12 * s, -47 * s);
      ctx.stroke();
      ctx.lineCap = "butt";
    }

    ctx.restore();
  }
}
