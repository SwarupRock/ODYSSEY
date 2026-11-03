/* ============================================================
   ODYSSEY — chapter scene framework
   Base class with async script runner (say / wait / do),
   shared VFX, input delegation, objective handling.
   ============================================================ */

import { Dialogue, Choices, HUD, Mech, Fade } from "./ui.js";
import { Gear } from "./gear.js";
import { drawArrow, PAL } from "./art.js";
import { Fx } from "./fx.js";
import { Cinematic } from "./combat.js";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class ChapterScene {
  constructor(engine, audio, meta = {}) {
    this.engine = engine;
    this.audio = audio;
    this.meta = meta; // { idx, kicker, title, sub, chapterLabel }
    this.t = 0;
    this.done = false;
    this.ready = false;   // set true once intro() has finished
    this.bursts = []; // expanding rings
    this._scriptBusy = false;
    this._tapWanted = false;
    // bow plumbing (Arms of the Hero) — scenes call shootBow/tickArrows
    this.arrows = [];
    this.bowCd = 0;
    this.aimDir = 1;
    // cinematic atmosphere preset for this chapter (ch5 sets its own mid-scene)
    const STYLES = ["troyburn", "firelight", "storm", "circe", "underworld", null, "gold"];
    Fx.setStyle(STYLES[meta.idx] !== undefined ? STYLES[meta.idx] : null);
    Fx.clearHero();
  }

  /** called by main after scene assigned; run intro card etc. */
  async begin() {
    HUD.show();
    HUD.objective(null); // clear any stale objective from a previous chapter
    Mech.hide();          // …and any stale mechanic UI
    HUD.setChapter(this.meta.chapterLabel || this.meta.title || "");
    if (this.initState) this.initState();
    this.ready = true;
    if (this.meta.title) {
      await Fade.to(1, 400);
      await showCard(this.meta);
      Fade.to(0, 600);
    }
    if (this.intro) await this.intro();
  }

  async finish(extra = {}) {
    if (this.done) return;
    this.done = true;
    this.cleanup && this.cleanup();
    Mech.hide();
    HUD.hide();
    const chip = document.getElementById("gear-chip");
    if (chip) chip.remove();
    const { Save } = await import("./engine.js");
    if (this.meta.idx !== undefined) Save.completeChapter(this.meta.idx, extra);
    if (extra.hubris) Save.addHubris(extra.hubris);
  }

  /* ---------------- script helpers ---------------- */

  /** show narration/dialogue lines, resolve when player finishes them */
  say(...lines) {
    return new Promise((resolve) => {
      Dialogue.show(lines, resolve);
    });
  }

  /** one-shot toast style narration (non-blocking) */
  note(text, ms = 2000) {
    HUD.toast(text, ms);
  }

  objective(text) { HUD.objective(text); }

  /** wait for any tap on canvas */
  waitTap() {
    return new Promise((resolve) => { this._tapWanted = resolve; });
  }

  /** expanding ring VFX at world pos */
  burst(x, y, color = "#e6c069", maxR = 70, width = 4) {
    this.bursts.push({ x, y, r: 4, maxR, width, color, a: 1 });
  }

  /* ---------------- Arms of the Hero ---------------- */

  /** small persistent HUD chip showing the current kit */
  showGearChip() {
    let el = document.getElementById("gear-chip");
    if (!el) {
      el = document.createElement("div");
      el.id = "gear-chip";
      document.getElementById("hud").appendChild(el);
    }
    const kit = Gear.kit();
    el.textContent = "🛡 " + kit.armor.name + " · ⚔ " + kit.sword.name + (kit.bow.power ? " · 🏹 " + kit.bow.name : "");
  }

  /**
   * incoming hit vs current armor. Returns "blocked" (armor ate it —
   * already played the clang) or "hit" (caller applies damage).
   */
  hitPlayer(px, py) {
    if (Gear.absorb() === "blocked") {
      this.audio.sfx("block");
      this.burst(px, py, "#e6c069", 46, 3);
      this.note("Turned by the " + Gear.armorName() + "!");
      return "blocked";
    }
    return "hit";
  }

  /** fire an arrow from (x, y) — uses the equipped bow's power */
  shootBow(opts = {}) {
    const kit = Gear.kit();
    if (!kit.bow.power) {
      this.note("No bow yet — the great bow still sleeps.");
      this.audio.sfx("error");
      return false;
    }
    if (this.bowCd > 0) return false;
    const ax = (this._holdDir || 0) + this.engine.axisX();
    if (ax !== 0) this.aimDir = ax > 0 ? 1 : -1;
    this.bowCd = 0.45;
    this.arrows.push({
      x: opts.x, y: opts.y,
      vx: this.aimDir * (opts.speed || 700),
      dmg: opts.dmg || Gear.arrowDmg(),
      arrowTier: kit.arrow.id,
      py: opts.y,
      dead: false,
    });
    this.audio.sfx("bow");
    return true;
  }

  /**
   * advance arrows; colliders = [{ x, r?, ref }] in the scene's own x-units.
   * onArrowHit(ref, arrow) returns true if the target died.
   */
  tickArrows(dt, colliders = [], onArrowHit = null) {
    this.bowCd = Math.max(0, this.bowCd - dt);
    const W = this.engine.W;
    for (const a of this.arrows) {
      const px = a.x;
      a.x += a.vx * dt;
      Cinematic.arrowTrail(px, a.py, a.x, a.y); // motion trail (fire arrows burn brighter below)
      for (const c of colliders) {
        if (c.ref && !c.ref.dead && Math.abs(a.x - c.x) < (c.r || 30)) {
          a.dead = true;
          this.audio.sfx("arrowhit");
          Cinematic.impact(a.x, a.y, a.arrowTier >= 1 ? PAL.fireBright : PAL.bronzeBright, a.dmg >= 4);
          const died = onArrowHit ? onArrowHit(c.ref, a) : true;
          if (died) c.ref.dead = true;
          break;
        }
      }
    }
    this.arrows = this.arrows.filter((a) => !a.dead && a.x > -80 && a.x < W + 80);
  }

  /** draw arrows at their own y (scene passes the arrow objects' unit) */
  drawArrows(ctx) {
    for (const a of this.arrows) {
      drawArrow(ctx, a.x, a.y, a.vx > 0 ? 1 : -1, 0, a.arrowTier);
    }
  }

  /* ---------------- default input plumbing ---------------- */

  onTap(x, y) {
    if (this._tapWanted) {
      const cb = this._tapWanted;
      this._tapWanted = null;
      cb();
      return;
    }
    this.handleTap && this.handleTap(x, y);
  }

  update(dt) {
    this.t += dt;
    if (!this.ready) return;
    // bursts
    for (const b of this.bursts) {
      b.r += (b.maxR - b.r) * Math.min(1, dt * 7);
      b.a -= dt * 1.6;
    }
    this.bursts = this.bursts.filter((b) => b.a > 0);
    this.tick && this.tick(dt);
  }

  /** engine-facing draw wrapper — hero rim light tracks the player */
  render(ctx) {
    if (!this.draw) return;
    const hs = this.heroScreen && this.heroScreen();
    if (hs) Fx.hero(hs.x, hs.y, hs.s || 1);
    else Fx.clearHero();
    this.draw(ctx);   // engine draws Fx.end (rim light) right after this
  }

  drawBursts(ctx) {
    for (const b of this.bursts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, b.a);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width;
      const s = this.engine.worldToScreen(b.x, b.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, b.r * this.engine.camera.zoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

async function showCard(meta) {
  const { showChapterCard } = await import("./ui.js");
  await showChapterCard(meta.kicker, meta.title, meta.sub);
}
