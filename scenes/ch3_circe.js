/* ============================================================
   ODYSSEY — Chapter 3: Circe's Island (Aiaia)
   Exploration: walk the island, gather ingredients, drive off
   guardian beasts with timed strikes, brew counter-potions and
   cure the crew. Circe scene finale.
   ============================================================ */

import { PAL, drawSky, drawGround, drawRidge, drawTorch, drawOdysseus, drawCirce, drawPig, drawBeast, drawNameTag } from "../js/art.js";
import { ChapterScene, sleep } from "../js/scenefw.js";
import { Gear } from "../js/gear.js";
import { HUD, Mech } from "../js/ui.js";
import { Cinematic } from "../js/combat.js";
import { PixelVFX } from "../js/pixelvfx.js";
import { Stick } from "../js/stick.js";

const ING_NAMES = ["herb", "mushroom", "flower", "coral", "honey"];
const ING_COLORS = ["#7a7f46", "#b0653a", "#c9a13f", "#5f8a8b", "#d19a3f"];
const ING_GLYPHS = ["H", "M", "F", "C", "Y"];

// recipes: sorted pair of ingredient indices -> info
const RECIPES = {
  "0-1": "Clarifying Draught — cures muddled minds",
  "1-2": "Warm Honey Tea — restores weak bodies",
  "0-3": "Salt-Bright Tonic — lifts heavy hearts",
};

// the swined crewmen, in pig order
const PIG_NAMES = ["Polites", "Eurylochus", "Perimedes"];
// the guardian beasts
const BEAST_NAMES = ["wolf", "lion", "lynx"];

export class Ch3Scene extends ChapterScene {
  initState() {
    this.audio.startAmbience("wind");
    this.audio.playChapterMusic(3); // lydian enchantment

    this.playerX = 0.12;
    this.facing = 1;
    this.hp = 3;
    this.pigsCured = 0;
    this.potion = null; // recipe key of carried potion
    this.inventory = [0, 0, 0, 0, 0];

    this.pigs = [
      { at: 0.34, cured: false },
      { at: 0.58, cured: false },
      { at: 0.86, cured: false },
    ];

    this.ings = [
      { at: 0.2, ing: 0, taken: false },
      { at: 0.4, ing: 2, taken: false },
      { at: 0.52, ing: 3, taken: false },
      { at: 0.72, ing: 4, taken: false },
      { at: 0.82, ing: 2, taken: false },
      { at: 0.3, ing: 0, taken: false },
      { at: 0.6, ing: 1, taken: false },
    ];

    this.beasts = [
      { at: 0.38, alive: true, state: "lurk", t: 1.5 },
      { at: 0.66, alive: true, state: "lurk", t: 1.5 },
      { at: 0.9, alive: true, state: "lurk", t: 2.2 },
    ];

    this.benchOpen = false;
    this.selected = [];

    HUD.health(3);
    Mech.clear();
    Stick.setCombatMode(true);
  }

  cleanup() {
    Stick.setCombatMode(false);
  }

  async intro() {
    await this.say(
      { who: "NARRATOR", text: "Aiaia. A soft green island that should have been safe — and was not." },
      { who: "NARRATOR", text: "Wolves and lions patrolled its glades, tame to their mistress, hungry for strangers. In her hall, men who were once your crew…" },
      { who: "ODYSSEUS", text: "…grunted. They grunted, Eurylochus. Our men are pigs now. Tails and all." },
      { who: "NARRATOR", text: "Hermes, ever helpful, left a sprig of black-rooted moly at your feet: it wards off witchcraft." },
      { who: "ODYSSEUS", text: "Then I gather what the island offers and out-brew the witch. For my men." }
    );
    this.updateCureObjective();
  }

  /** live objective: cure progress + what to do next */
  updateCureObjective() {
    const left = 3 - this.pigsCured;
    if (left <= 0) {
      this.objective("All three crewmen stand upright — approach the hall; Circe waits");
      return;
    }
    this.objective(
      "Walk with <span class=\"kbd\">WASD</span> · SPACE near a pig cures, at the hall opens the brew bench · " +
      (this.potion ? "<b>potion in hand</b> — find a pig" : "no potion — brew at the hall") +
      " · <b>" + left + "</b> still swine"
    );
  }

  onPointerDown(x) {
    if (this.benchOpen) return;
    this._holdDir = x < this.engine.W / 2 ? -1 : 1;
  }

  onPointerUp() { this._holdDir = 0; }

  tick(dt) {
    if (this.benchOpen) return;
    const W = this.engine.W;

    // movement
    const kbd = this.engine.axisX();
    if (this._holdDir) this.playerX += this._holdDir * dt * 0.14;
    this.playerX += kbd * dt * 0.1;
    this.playerX = Math.max(0.03, Math.min(0.97, this.playerX));
    const move = (this._holdDir || 0) + kbd;
    if (move < 0) this.facing = -1;
    if (move > 0) this.facing = 1;

    // pickups
    for (const ing of this.ings) {
      if (!ing.taken && Math.abs(ing.at - this.playerX) < 0.025) {
        ing.taken = true;
        this.inventory[ing.ing]++;
        this.audio.sfx("pickup");
        this.note("Gathered " + ING_NAMES[ing.ing] + " (" + ING_GLYPHS[ing.ing] + ")");
        this.burst(ing.at * W, this.groundY() - 30, ING_COLORS[ing.ing], 40, 3);
        PixelVFX.spawn("pickups/collect-burst", ing.at * W, this.groundY() - 30, {
          palette: ing.ing === 4 || ing.ing === 2 ? "apollo" : "moly",
          scale: 0.85,
        });
      }
    }

    // beasts
    for (const b of this.beasts) {
      if (!b.alive) continue;
      if (b.state === "lurk") {
        b.t -= dt;
        if (Math.abs(b.at - this.playerX) < 0.1 && b.t <= 0) {
          b.state = "charge";
          b.t = 0;
          this.audio.sfx("roar");
        }
      } else if (b.state === "charge") {
        b.t += dt;
        if (b.t > 0.7) { b.state = "strike"; b.t = 0; }
      } else if (b.state === "strike") {
        b.t += dt;
        if (b.t > 0.5) {
          b.state = "lurk";
          b.t = 2.2;
          if (Math.abs(b.at - this.playerX) < 0.07) {
            PixelVFX.spawn("melee/claw-swipe", this.playerX * W, this.groundY() - 32, {
              flip: b.at > this.playerX,
              palette: "blood",
              scale: 0.9,
            });
            if (this.hitPlayer(b.at * this.engine.W, this.groundY() - 40) === "hit") {
              this.hp--; HUD.health(this.hp);
            }
            this.audio.sfx("crash");
            this.engine.shake(1.2);
            if (this.hp <= 0) this.knocked();
          }
        }
      }
    }

    // bench proximity hint
    const nearBench = Math.abs(this.playerX - 0.47) < 0.05;
    const btn = document.getElementById("bench-open");
    if (btn) btn.style.display = nearBench ? "" : "none";
  }

  handleTap() {
    if (this.benchOpen) return;
    const W = this.engine.W;

    // cure a pig FIRST — beasts hover near their pen, the pig is why you are here
    const pigIdx = this.pigs.findIndex((p) => !p.cured && Math.abs(p.at - this.playerX) < 0.05);
    if (pigIdx >= 0) {
      const pig = this.pigs[pigIdx];
      if (this.potion) {
        pig.cured = true;
        this.pigsCured++;
        this.potion = null;
        this.audio.sfx("potion");
        this.burst(pig.at * W, this.groundY() - 20, PAL.bronzeBright, 50, 4);
        PixelVFX.spawn("holy/heal", pig.at * W, this.groundY(), { palette: "moly", scale: 1.05 });
        PixelVFX.spawn("nature/healing-bloom", pig.at * W, this.groundY(), { palette: "moly", scale: 0.9 });
        this.note(PIG_NAMES[pigIdx] + " stands upright and weeps! (" + this.pigsCured + "/3)");
        this.updateCureObjective();
        if (this.pigsCured >= 3) this.circeScene();
      } else {
        this.note(PIG_NAMES[pigIdx] + " needs a counter-potion — brew one at the hall bench (SPACE there).");
      }
      return;
    }

    // strike beast mid-lunge
    const beast = this.beasts.find((b) => b.alive && b.state === "strike" && Math.abs(b.at - this.playerX) < 0.08);
    if (beast) {
      beast.alive = false;
      this.audio.sfx("sword");
      this.engine.shake(0.7);
      const bx = beast.at * W, gy = this.groundY();
      Cinematic.slash(this.playerX * W + this.facing * 24, gy - 44, this.facing, false, Gear.kit().sword.id);
      Cinematic.impact(bx, gy - 26, PAL.bronzeBright, true);
      PixelVFX.spawn("spawn/poof", bx, gy, { palette: "rock", scale: 0.9 });
      this.burst(bx, gy - 26, PAL.bronze, 50, 4);
      this.note("Beast driven off!");
    }
  }

  onActionKey(k) {
    if (this.benchOpen) {
      if (k === " " || k === "enter" || k === "escape") this.closeBench();
      return;
    }
    const W = this.engine.W, gy = this.groundY();
    if (k === "u" || k === "k" || k === "l" || k === "f" || k === "shift") {
      const map = { u: "uppercut", k: "spin", l: "spear", f: "block", shift: "dash" };
      const move = map[k];
      if (k === "shift") this.playerX = Math.max(0.05, Math.min(0.95, this.playerX + this.facing * 0.08));
      Cinematic.performMove(move, this.playerX * W, gy, this.facing, { swordTier: Gear.kit().sword.id, engine: this.engine });
      this.audio.sfx(k === "f" ? "block" : "sword");
      if (move !== "block" && move !== "dash") {
        const range = move === "spear" ? 0.14 : move === "spin" ? 0.13 : 0.10;
        const beast = this.beasts.find((b) => b.alive && Math.abs(b.at - this.playerX) < range);
        if (beast) {
          beast.alive = false;
          this.engine.shake(0.7);
          const bx = beast.at * W;
          Cinematic.impact(bx, gy - 26, PAL.bronzeBright, true);
          Cinematic.damageNumber(bx, gy - 46, move === "uppercut" ? 32 : 24, move === "uppercut");
          PixelVFX.spawn("spawn/poof", bx, gy, { palette: "rock", scale: 0.9 });
          this.burst(bx, gy - 26, PAL.bronze, 50, 4);
          this.note("Beast driven off!");
        }
      }
      return;
    }
    if (k !== " " && k !== "enter" && k !== "j") return;
    // pig cure / beast strike take priority; otherwise SPACE at the hall opens the bench
    const nearPig = this.pigs.some((p) => !p.cured && Math.abs(p.at - this.playerX) < 0.05);
    const nearBeast = this.beasts.some((b) => b.alive && b.state === "strike" && Math.abs(b.at - this.playerX) < 0.08);
    if (nearPig || nearBeast) return this.handleTap();
    if (Math.abs(this.playerX - 0.47) < 0.06) this.openBench();
    else Cinematic.performMove("slash", this.playerX * W, gy, this.facing, { swordTier: Gear.kit().sword.id, engine: this.engine });
  }

  /* ---------------- bench ---------------- */

  openBench() {
    if (this.benchOpen) return;
    this.benchOpen = true;
    this.selected = [];
    this.renderBench();
  }

  renderBench() {
    Mech.set(
      `<div class="bench">
        <div class="bench-title">Brewing Bench</div>
        <div class="bench-hint">Pair two ingredients — H+M brews the <b>Clarifying Draught</b> that un-swines your crew. SPACE closes.</div>
        <div class="bench-slots">
          <div class="ing-slot" id="slot0">?</div>
          <div class="ing-slot" id="slot1">?</div>
        </div>
        <div class="bench-row">
          <div class="bench-ings">` +
      this.inventory
        .map(
          (n, i) =>
            `<button class="bench-ing ${n > 0 ? "" : "used"}" data-i="${i}">` +
            ING_GLYPHS[i] + "<small>x" + n + "</small></button>"
        )
        .join("") +
      `</div>
          <button class="btn-stone bench-brew" id="bench-brew">Brew</button>
        </div>
        <button class="btn-stone bench-close" id="bench-close">Close</button>
      </div>`
    );
    Mech.show();

    document.querySelectorAll(".bench-ing").forEach((el) => {
      el.addEventListener("click", () => {
        const i = +el.dataset.i;
        if (this.inventory[i] > 0 && this.selected.length < 2) {
          this.selected.push(i);
          this.inventory[i]--;
          this.audio.sfx("tap");
          this.renderBench();
        }
      });
    });
    document.getElementById("bench-brew").addEventListener("click", () => this.tryBrew());
    document.getElementById("bench-close").addEventListener("click", () => this.closeBench());

    for (let s = 0; s < 2; s++) {
      const el = document.getElementById("slot" + s);
      if (this.selected[s] !== undefined) {
        el.textContent = ING_GLYPHS[this.selected[s]];
        el.classList.add("filled");
      }
    }
  }

  tryBrew() {
    if (this.selected.length !== 2) {
      this.note("Pick two ingredients.");
      return;
    }
    const key = [...this.selected].sort().join("-");
    if (!RECIPES[key]) {
      this.audio.sfx("error");
      this.note("The brew turns grey. Wrong pairing.");
      PixelVFX.spawn("explosions/smoke-bomb", 0.47 * this.engine.W, this.groundY() - 10, { palette: "circe", scale: 0.75 });
      for (const i of this.selected) this.inventory[i]++;
      this.selected = [];
      this.renderBench();
      return;
    }
    this.potion = key;
    this.audio.sfx("potion");
    PixelVFX.spawn("arcane/magic-circle-cast", 0.47 * this.engine.W, this.groundY(), { palette: "moly", scale: 0.9 });
    this.note("Brewed: " + RECIPES[key]);
    this.updateCureObjective();
    this.closeBench();
  }

  closeBench() {
    for (const i of this.selected) this.inventory[i]++;
    this.selected = [];
    this.benchOpen = false;
    Mech.hide();
  }

  /* ---------------- circe finale ---------------- */

  async circeScene() {
    this.objective(null);
    await this.say(
      { who: "NARRATOR", text: "When the last man stood upright and wept, the doors of the hall opened on their own." },
      { who: "CIRCE", text: "You keep dangerous company, sailor. Dangerous, and useful." },
      { who: "ODYSSEUS", text: "Witch, I came for my men." },
      { who: "CIRCE", text: "And you shall have them. Moly in your fist — you are no ordinary guest. Stay the night; I set no trap." },
      { who: "ODYSSEUS", text: "We sail at dawn. And I will hold you to that." }
    );
    this.audio.sfx("reveal");
    await this.say(
      { who: "CIRCE", text: "Then hear the cost of your course. You must visit the house of Death. There, blind Tiresias keeps the truth of your road home." },
      { who: "NARRATOR", text: "The crew, human again, lowered their eyes. None argued with the sea's newest terror: the Straits ahead." }
    );

    // Circe's gifts: the moly-tempered blade and the aegis half-cape
    const { Gear } = await import("../js/gear.js");
    const gotSword = Gear.award("sword", 2);
    const gotArmor = Gear.award("armor", 2);
    if (gotSword || gotArmor) {
      this.showGearChip();
      this.audio.sfx("reveal");
      await this.say(
        { who: "CIRCE", text: "Take a guest-gift worth having: a blade dipped in moly, and a half-cape woven against harm. AchILLES himself wore less." },
        { who: "NARRATOR", text: "The moly blade bites deep, and the aegis turns many a blow aside." }
      );
    }
    await this.finish({ hubris: 0 });
    const { startNext } = await import("../js/main.js");
    startNext();
  }

  async knocked() {
    if (this.state === "down") return;
    this.state = "down";
    await this.say(
      { who: "NARRATOR", text: "The beasts worried you to the treeline — and there, moly in your fist, you recovered." },
      { who: "ODYSSEUS", text: "Again. This island owes me three men." }
    );
    this.hp = 3;
    HUD.health(3);
    this.state = "";
  }

  groundY() { return this.engine.H * 0.8; }

  /* ---------------- draw ---------------- */

  /** screen anchor of the hero for the rim-light pass */
  heroScreen() {
    return { x: this.playerX * this.engine.W, y: this.groundY() - 55, s: 1.05 };
  }

  draw(ctx) {
    const eng = this.engine, W = eng.W, H = eng.H;
    const gy = this.groundY();

    drawSky(ctx, "#87a06b", "#d8c98f", [W * 0.5, H * 0.16, Math.min(W, H) * 0.3]);
    drawRidge(ctx, gy - H * 0.3, H * 0.1, "rgba(74,90,40,0.5)", 5, 110);
    drawGround(ctx, gy, H - gy, "#5d6b34", "#2c3315");

    // Circe's hall at 0.47
    const hx = 0.47 * W;
    ctx.fillStyle = "#4a2410";
    ctx.fillRect(hx - 46, gy - 96, 92, 60);
    ctx.fillStyle = "#5e2c13";
    ctx.beginPath();
    ctx.moveTo(hx - 56, gy - 96); ctx.lineTo(hx, gy - 128); ctx.lineTo(hx + 56, gy - 96);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#120a05";
    ctx.fillRect(hx - 14, gy - 52, 28, 52);
    drawTorch(ctx, hx - 40, gy, this.t, 46);
    drawTorch(ctx, hx + 40, gy, this.t * 1.1, 46);
    PixelVFX.drawLoop(ctx, "critters/butterfly", W * 0.25, gy - 48, this.t, { palette: "apollo", scale: 0.6 });
    PixelVFX.drawLoop(ctx, "critters/butterfly", W * 0.76, gy - 54, this.t + 1.3, { palette: "moly", scale: 0.55, flip: true });

    // ingredient pickups
    this.ings.forEach((o, i) => {
      if (o.taken) return;
      const x = o.at * W;
      const bob = Math.sin(this.t * 3 + i) * 4;
      ctx.fillStyle = ING_COLORS[o.ing];
      ctx.beginPath(); ctx.arc(x, gy - 22 + bob, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PAL.bone;
      ctx.font = "bold 12px serif";
      ctx.textAlign = "center";
      ctx.fillText(ING_GLYPHS[o.ing], x, gy - 18 + bob);
      ctx.textAlign = "start";
      ctx.strokeStyle = "rgba(236,223,195,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, gy - 22 + bob, 16 + Math.sin(this.t * 5 + i) * 3, 0, Math.PI * 2);
      ctx.stroke();
    });

    // pigs — the crew, swined; each keeps his name
    this.pigs.forEach((p, i) => {
      if (p.cured) return;
      const px = p.at * W + i * 8;
      drawPig(ctx, px, gy - 4, 1, this.t, i);
      drawNameTag(ctx, px, gy - 26, PIG_NAMES[i]);
    });

    // beasts
    this.beasts.forEach((b, i) => {
      if (!b.alive) return;
      const dir = b.at > this.playerX ? -1 : 1;
      const rush = b.state === "charge" || b.state === "strike" ? (b.at > this.playerX ? -1 : 1) * (b.t * 40) : 0;
      drawBeast(ctx, b.at * W + rush, gy - 2, 1.1, dir, this.t);
      drawNameTag(ctx, b.at * W + rush, gy - 34, BEAST_NAMES[i]);
    });

    // circe on the porch after curing all
    if (this.pigsCured >= 3) {
      PixelVFX.drawLoop(ctx, "arcane/rune-circle", hx + 20, gy - 4, this.t, { palette: "circe", scale: 0.78 });
      drawCirce(ctx, hx + 20, gy - 6, 1.05, -1, this.t);
      drawNameTag(ctx, hx + 20, gy - 52, "CIRCE");
    }

    // player
    const heroPose = Cinematic.getHeroPose();
    drawOdysseus(ctx, this.playerX * W, gy, 1.05, this.facing, this.t, false, true, Gear.kit(), heroPose);
    drawNameTag(ctx, this.playerX * W, gy - 104 + (heroPose ? (heroPose.dy || 0) : 0), "ODYSSEUS");

    // glowing pixelfx potion above head when carrying
    if (this.potion) {
      PixelVFX.drawLoop(ctx, "pickups/potion", this.playerX * W + 24 * this.facing, gy - 92, this.t, { palette: "moly", scale: 0.65 });
    }

    // bench button (DOM)
    this.ensureBenchButton();

    this.drawBursts(ctx);
  }

  ensureBenchButton() {
    if (this.benchOpen || document.getElementById("bench-open")) return;
    const b = document.createElement("button");
    b.id = "bench-open";
    b.className = "btn-stone";
    b.style.cssText = "position:absolute;left:50%;bottom:14%;transform:translateX(-50%);display:none;font-size:13px;padding:9px 18px;z-index:32;";
    b.textContent = "BREW";
    b.addEventListener("click", () => this.openBench());
    document.getElementById("mech-ui").appendChild(b);
  }
}
