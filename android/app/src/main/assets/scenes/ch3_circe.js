/* ============================================================
   ODYSSEY — Chapter 3: Circe's Island (Aiaia)
   Exploration: walk the enchanted glade, harvest Hermes' sacred
   Moly blossoms, drive off guardian beasts with contextual sword strikes,
   transmute the Celestial Moly Elixir at the Palace Cauldron,
   and shatter Circe's swine hexes to restore the crew!
   ============================================================ */

import { PAL, drawSky, drawGround, drawRidge, drawTorch, drawOdysseus, drawCirce, drawPig, drawCrewman, drawBeast, drawNameTag } from "../js/art.js";
import { ChapterScene, sleep } from "../js/scenefw.js";
import { Gear } from "../js/gear.js";
import { HUD, Mech } from "../js/ui.js";
import { Cinematic } from "../js/combat.js";
import { PixelVFX } from "../js/pixelvfx.js";
import { Stick } from "../js/stick.js";

const ING_NAMES = ["herb", "mushroom", "flower", "coral", "honey"];
const ING_COLORS = ["#7a7f46", "#b0653a", "#c9a13f", "#5f8a8b", "#d19a3f"];
const ING_GLYPHS = ["H", "M", "F", "C", "Y"];
const RECIPES = { "0-1": "Clarifying Draught — cures muddled minds", "1-2": "Warm Honey Tea — restores weak bodies", "0-3": "Salt-Bright Tonic — lifts heavy hearts" };
const PIG_NAMES = ["Polites", "Elpenor", "Perimedes"];
const BEAST_NAMES = ["wolf", "lion", "lynx"];

export class Ch3Scene extends ChapterScene {
  initState() {
    this.audio.startAmbience("wind");
    this.audio.playChapterMusic(3); // lydian enchantment

    this.playerX = 0.12;
    this.facing = 1;
    this.hp = 4;
    this.pigsCured = 0;
    this.potion = null;
    this.inventory = [0, 0, 0, 0, 0];
    this.molyEssence = 0;
    this.hasMolyDraught = false;
    this.elixirCharges = 0;
    this.cauldronActive = false;
    this._cauldronPulse = 0;
    this._finaleStarted = false;

    // The three bewitched crewmen across the island
    this.pigs = [
      { at: 0.28, cured: false },
      { at: 0.60, cured: false },
      { at: 0.84, cured: false },
    ];

    // Sacred luminous Moly blossoms across the glade
    this.molyPlants = [
      { at: 0.18, taken: false },
      { at: 0.36, taken: false },
      { at: 0.54, taken: false },
      { at: 0.72, taken: false },
      { at: 0.90, taken: false },
    ];
    this.ings = [
      { at: 0.20, ing: 0, taken: false }, { at: 0.40, ing: 2, taken: false },
      { at: 0.52, ing: 3, taken: false }, { at: 0.72, ing: 4, taken: false },
      { at: 0.82, ing: 2, taken: false }, { at: 0.30, ing: 0, taken: false },
      { at: 0.60, ing: 1, taken: false },
    ];

    // Circe's guardian beasts roaming the island
    this.beasts = [
      { at: 0.38, alive: true, state: "lurk", t: 1.5, hp: 30 },
      { at: 0.68, alive: true, state: "lurk", t: 1.8, hp: 35 },
      { at: 0.93, alive: true, state: "lurk", t: 2.2, hp: 40 },
    ];

    this.benchOpen = false;
    this.selected = [];
    HUD.health(4);
    Mech.clear();
    Stick.setCombatMode(false);
    Stick.setDodgeVisible(false);
  }

  cleanup() {
    Stick.setCombatMode(false);
    Stick.setDodgeVisible(false);
    if (this.selected?.length) for (const i of this.selected) this.inventory[i]++;
    this.selected = [];
    this.benchOpen = false;
    Mech.hide();
    const b = document.getElementById("cauldron-brew-btn");
    if (b) b.remove();
    const bench = document.getElementById("bench-open");
    if (bench) bench.remove();
  }

  async intro() {
    await this.say(
      { who: "NARRATOR", text: "Aiaia. A soft emerald island wrapped in fragrant cypress and bewitched mist." },
      { who: "NARRATOR", text: "Circe's marble palace stands in the clearing, guarded by enchanted beasts. Inside her pen, three comrades grunt in swine hide." },
      { who: "EURYLOCHUS", text: "I would not enter the hall. Circe changed the others into swine — I ran to warn you." },
      { who: "ODYSSEUS", text: "You did right to return. We will bring Polites, Elpenor and Perimedes back." },
      { who: "NARRATOR", text: "Hermes left black-rooted moly to ward off witchcraft. The island's ingredients may also yield a counter-potion." },
      { who: "ODYSSEUS", text: "Then I gather what the island offers and out-brew the witch. For my men." }
    );
    this.updateObjective();
  }

  updateObjective() {
    const left = 3 - this.pigsCured;
    if (left <= 0) {
      this.objective("All crewmen stand upright — approach the Palace steps; Circe awaits!");
      return;
    }
    if (this.potion === "0-1") {
      this.objective("<b>Clarifying Draught ready</b> — rescue a crewman; this draught takes priority · <b>" + left + "</b> left");
    } else if (this.potion) {
      this.objective("A potion is prepared but cannot break Circe's hex. Brew a Clarifying Draught or gather Moly for the Cauldron · <b>" + left + "</b> left");
    } else if (this.hasMolyDraught && this.elixirCharges > 0) {
      this.objective(
        "<b>Moly Elixir Infused (" + this.elixirCharges + " charges)</b> — Rescue a bewitched crewman with <span class=\"kbd\">SPACE</span>/<span class=\"kbd\">ENTER</span> or ACT · <b>" + left + "</b> left"
      );
    } else if (this.molyEssence >= 2) {
      this.objective(
        "<b>Sacred Moly Gathered</b> — At the Palace Cauldron, use <b>TRANSMUTE MOLY ELIXIR</b>."
      );
    } else {
      this.objective(
        "Gather ingredients and milk-white <b>Moly Blossoms</b>; brew at the palace bench or Cauldron · <b>" + left + "</b> transformed crew remaining"
      );
    }
  }

  onPointerDown(x) {
    if (this.benchOpen) return;
    this._holdDir = x < this.engine.W / 2 ? -1 : 1;
  }

  onPointerUp() { this._holdDir = 0; }

  tick(dt) {
    if (this.benchOpen) return;
    const W = this.engine.W;
    this._cauldronPulse += dt;

    // Player locomotion
    const kbd = this.engine.axisX();
    if (this._holdDir) this.playerX += this._holdDir * dt * 0.16;
    this.playerX += kbd * dt * 0.12;
    this.playerX = Math.max(0.04, Math.min(0.96, this.playerX));
    const move = (this._holdDir || 0) + kbd;
    if (move < 0) this.facing = -1;
    if (move > 0) this.facing = 1;

    // Harvest luminous Moly blossoms
    for (const m of this.molyPlants) {
      if (!m.taken && Math.abs(m.at - this.playerX) < 0.035) {
        m.taken = true;
        this.molyEssence++;
        this.audio.sfx("pickup");
        this.note("Gathered Sacred Moly (" + this.molyEssence + " gathered) — Hermes' starlight charges!");
        const mx = m.at * W, my = this.groundY() - 25;
        this.burst(mx, my, "#f7f5c4", 36, 3.5);
        PixelVFX.spawn("pickups/collect-burst", mx, my, { palette: "moly", scale: 1.0 });
        PixelVFX.spawn("holy/blessing", mx, my, { palette: "apollo", scale: 0.8 });
        this.updateObjective();
      }
    }

    for (const ing of this.ings) {
      if (!ing.taken && Math.abs(ing.at - this.playerX) < 0.025) {
        ing.taken = true;
        this.inventory[ing.ing]++;
        this.audio.sfx("pickup");
        this.note("Gathered " + ING_NAMES[ing.ing] + " (" + ING_GLYPHS[ing.ing] + ")");
        this.burst(ing.at * W, this.groundY() - 30, ING_COLORS[ing.ing], 40, 3);
        PixelVFX.spawn("pickups/collect-burst", ing.at * W, this.groundY() - 30, { palette: ing.ing === 4 || ing.ing === 2 ? "apollo" : "moly", scale: 0.85 });
      }
    }

    // Guardian beast AI
    for (const b of this.beasts) {
      if (!b.alive) continue;
      if (b.state === "lurk") {
        b.t -= dt;
        if (Math.abs(b.at - this.playerX) < 0.12 && b.t <= 0) {
          b.state = "charge";
          b.t = 0;
          this.audio.sfx("roar");
        }
      } else if (b.state === "charge") {
        b.t += dt;
        if (b.t > 0.65) { b.state = "strike"; b.t = 0; }
      } else if (b.state === "strike") {
        b.t += dt;
        if (b.t > 0.45) {
          b.state = "lurk";
          b.t = 2.0;
          if (Math.abs(b.at - this.playerX) < 0.08) {
            PixelVFX.spawn("melee/claw-swipe", this.playerX * W, this.groundY() - 32, {
              flip: b.at > this.playerX,
              palette: "blood",
              scale: 0.95,
            });
            if (this.hitPlayer(b.at * W, this.groundY() - 40) === "hit") {
              this.hp--; HUD.health(this.hp);
              this.audio.sfx("crash");
              this.engine.shake(1.2);
              if (this.hp <= 0) this.knocked();
            }
          }
        }
      }
    }

    // Proximity to Cauldron (at 0.47)
    const nearCauldron = Math.abs(this.playerX - 0.47) < 0.06;
    const cauldron = document.getElementById("cauldron-brew-btn");
    if (cauldron) cauldron.style.display = nearCauldron ? "" : "none";
    const bench = document.getElementById("bench-open");
    if (bench) bench.style.display = nearCauldron ? "" : "none";
  }

  handleTap() {
    if (this.benchOpen) return;
    const pigIdx = this.pigs.findIndex((p) => !p.cured && Math.abs(p.at - this.playerX) < 0.06);
    if (pigIdx >= 0) return this.curePig(pigIdx);
    if (Math.abs(this.playerX - 0.47) < 0.06) return this.openBench();
    const beast = this.beasts.find((b) => b.alive && Math.abs(b.at - this.playerX) < 0.11);
    if (beast) return this.executeSwordStrike("slash");
  }

  onActionKey(k) {
    if (this.benchOpen) {
      if (k === " " || k === "enter" || k === "escape") this.closeBench();
      return;
    }
    if (k === " " || k === "enter") this.handleTap();
  }

  openBench() {
    if (this.benchOpen) return;
    this.benchOpen = true;
    this.selected = [];
    this.renderBench();
  }

  renderBench() {
    Mech.set(`<div class="bench"><div class="bench-title">Palace Brew Bench</div>
      <div class="bench-hint">Pair two ingredients. H + M makes the <b>Clarifying Draught</b>. Space closes.</div>
      <div class="bench-slots"><div class="ing-slot" id="slot0">?</div><div class="ing-slot" id="slot1">?</div></div>
      <div class="bench-row"><div class="bench-ings">${this.inventory.map((n,i)=>`<button class="bench-ing ${n ? "" : "used"}" data-i="${i}">${ING_GLYPHS[i]}<small>x${n}</small></button>`).join("")}</div>
      <button class="btn-stone bench-brew" id="bench-brew">Brew</button></div><button class="btn-stone bench-close" id="bench-close">Close</button></div>`);
    Mech.show();
    document.querySelectorAll(".bench-ing").forEach((el) => el.addEventListener("click", () => {
      const i = +el.dataset.i;
      if (this.inventory[i] > 0 && this.selected.length < 2) { this.selected.push(i); this.inventory[i]--; this.audio.sfx("tap"); this.renderBench(); }
    }));
    document.getElementById("bench-brew").addEventListener("click", () => this.tryBrew());
    document.getElementById("bench-close").addEventListener("click", () => this.closeBench());
    for (let s=0; s<2; s++) if (this.selected[s] !== undefined) {
      const el=document.getElementById("slot"+s); el.textContent=ING_GLYPHS[this.selected[s]]; el.classList.add("filled");
    }
  }

  tryBrew() {
    if (this.potion) { this.note("Use the carried potion before brewing another."); return; }
    if (this.selected.length !== 2) { this.note("Pick two ingredients."); return; }
    const key=[...this.selected].sort().join("-");
    if (!RECIPES[key]) {
      this.audio.sfx("error"); this.note("The brew turns grey. Wrong pairing; ingredients restored.");
      PixelVFX.spawn("explosions/smoke-bomb", 0.47*this.engine.W, this.groundY()-10, {palette:"circe",scale:0.75});
      for (const i of this.selected) this.inventory[i]++;
      this.selected=[]; this.renderBench(); return;
    }
    this.potion=key;
    this.selected=[]; // successful brewing consumes the selected ingredients
    this.audio.sfx("potion");
    PixelVFX.spawn("arcane/magic-circle-cast", 0.47*this.engine.W, this.groundY(), {palette:"moly",scale:0.9});
    this.note("Brewed: " + RECIPES[key]);
    this.updateObjective();
    this.closeBench();
  }

  closeBench() {
    for (const i of this.selected) this.inventory[i]++;
    this.selected=[]; this.benchOpen=false; Mech.hide();
  }

  /** Transmutes Hermes' Holy Moly Elixir at Circe's Cauldron with sensational PixelFX */
  transmuteCauldron() {
    const W = this.engine.W, gy = this.groundY();
    const cx = 0.47 * W, cy = gy - 36;

    if (this.benchOpen) return;
    if (this.pigs.some((p) => !p.cured && Math.abs(p.at - this.playerX) < 0.06)) {
      this.note("Rescue the nearby crewman first.");
      return;
    }
    if (Math.abs(this.playerX - 0.47) >= 0.06) return;

    if (this.molyEssence < 2) {
      this.note("The Cauldron needs two Moly essences. Gather blossoms or drive off beasts.");
      this.audio.sfx("error");
      return;
    }
    this.molyEssence -= 2;

    this.hasMolyDraught = true;
    this.elixirCharges = 3;
    this.hp = 4;
    HUD.health(4);

    this.audio.sfx("potion");
    this.audio.sfx("reveal");
    this.engine.shake(0.6);

    // Dazzling eruption of arcane & holy magic
    PixelVFX.spawn("arcane/magic-circle-cast", cx, gy - 8, { palette: "circe", scale: 1.25 });
    PixelVFX.spawn("holy/holy-pillar", cx, gy - 20, { palette: "moly", scale: 1.15 });
    PixelVFX.spawn("holy/sunburst", cx, gy - 42, { palette: "apollo", scale: 1.1 });
    PixelVFX.spawn("holy/blessing", this.playerX * W, gy - 55, { palette: "moly", scale: 1.0 });
    PixelVFX.spawn("pickups/potion", this.playerX * W + 20 * this.facing, gy - 85, { palette: "apollo", scale: 0.95 });

    this.burst(cx, cy, PAL.bronzeBright, 55, 4.5);
    this.note("Hermes' Holy Moly Draught transmuted! Your blade shines with purifying starlight (3 charges).");
    this.updateObjective();
  }

  /** Cleanses a pig and restores the human Greek crewman */
  curePig(pigIdx) {
    const pig = this.pigs[pigIdx];
    if (!pig || pig.cured || this._finaleStarted) return false;
    const W = this.engine.W, gy = this.groundY();
    const px = pig.at * W;
    const useClarifying = this.potion === "0-1";
    const useMoly = !useClarifying && this.hasMolyDraught && this.elixirCharges > 0;
    if (!useClarifying && !useMoly) {
      this.note("Circe's hex holds. Brew a Clarifying Draught or infuse Moly at the Cauldron.");
      PixelVFX.spawn("arcane/rune-circle", px, gy - 8, { palette: "circe", scale: 0.8 });
      this.audio.sfx("error");
      return false;
    }

    pig.cured = true;
    this.pigsCured++;
    if (useClarifying) this.potion = null;
    else this.elixirCharges--;

    this.audio.sfx("potion");
    this.audio.sfx("sword");
    this.audio.sfx("reveal");
    this.engine.shake(0.8);

    // Eruption of divine healing and transmutation reversal
    PixelVFX.spawn("holy/heal", px, gy, { palette: "moly", scale: 1.25 });
    PixelVFX.spawn("nature/healing-bloom", px, gy - 12, { palette: "moly", scale: 1.05 });
    PixelVFX.spawn("holy/smite", px, gy - 28, { palette: "apollo", scale: 1.1 });
    PixelVFX.spawn("spawn/poof", px, gy - 16, { palette: "rock", scale: 1.1 });
    PixelVFX.spawn("impacts/parry", px, gy - 32, { palette: "apollo", scale: 1.0 });
    this.burst(px, gy - 26, PAL.gold, 60, 4.8);

    this.note(PIG_NAMES[pigIdx] + " stands upright! 'The witch's hex is broken!' (" + this.pigsCured + "/3)");
    this.updateObjective();

    if (this.pigsCured >= 3 && !this._finaleStarted) {
      this._finaleStarted = true;
      setTimeout(() => this.circeScene(), 800);
    }
    return true;
  }

  /** Executes dynamic sword combat moves with PixelFX */
  executeSwordStrike(move) {
    if (move !== "slash") return false;
    const W = this.engine.W, gy = this.groundY();
    const px = this.playerX * W;

    Cinematic.performMove(move, px, gy, this.facing, { swordTier: Gear.kit().sword.id, engine: this.engine });
    this.audio.sfx("sword");

    const beast = this.beasts.find((b) => b.alive && Math.abs(b.at - this.playerX) < 0.11);

    if (beast) {
      const dmg = 25;
      beast.hp -= dmg;
      const bx = beast.at * W;
      this.engine.shake(0.7);

      Cinematic.impact(bx, gy - 26, PAL.bronzeBright, true);
      Cinematic.damageNumber(bx, gy - 46, dmg, false);

      if (beast.hp <= 0) {
        beast.alive = false;
        PixelVFX.spawn("spawn/poof", bx, gy, { palette: "rock", scale: 1.0 });
        PixelVFX.spawn("impacts/crit-hit", bx, gy - 28, { palette: "hector", scale: 1.1 });
        this.burst(bx, gy - 26, PAL.bronze, 55, 4.2);
        this.molyEssence++;
        this.note("Guardian beast subdued! Absorbed Hermes' Moly Essence.");
        this.updateObjective();
      } else {
        PixelVFX.spawn("impacts/hit-spark", bx, gy - 24, { palette: "fire", scale: 0.95 });
        this.burst(bx, gy - 24, PAL.bronzeBright, 25, 2.5);
      }
    }
  }

  async circeScene() {
    this.objective(null);
    await this.say(
      { who: "NARRATOR", text: "As the third sailor broke free from his bristles, the great doors of Circe's palace swung open." },
      { who: "CIRCE", text: "No mortal has ever stepped past my wolves... much less unmade my transmutation draught." },
      { who: "ODYSSEUS", text: "Your potion failed, witch of Aiaia. My blade is drawn, and Hermes' Moly stands between you and my crew." },
      { who: "CIRCE", text: "Hold your blade, King of Ithaca! I see the god's favor upon your shoulders. No more blood; I yield." },
      { who: "ODYSSEUS", text: "Swear on the sacred River Styx that you will work no more evil against us." },
      { who: "CIRCE", text: "I swear it by the waters of Death. Come, feast as heroes. You have a longer road ahead than any living man." },
      { who: "NARRATOR", text: "Circe kept her oath. Before dawn, she guided Odysseus toward the true threshold of his fate: the Underworld." }
    );

    // Award Circe's legendary gifts
    const gotSword = Gear.award("sword", 2);
    const gotArmor = Gear.award("armor", 2);
    if (gotSword || gotArmor) {
      this.showGearChip();
      this.audio.sfx("reveal");
      await this.say(
        { who: "CIRCE", text: "Take a guest-gift: the Moly-tempered blade, and an Aegis half-cape woven to turn aside sorcery and steel." },
        { who: "NARRATOR", text: "Equipped with Circe's gifts, Odysseus prepares to cross the Styx into the House of Hades." }
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
      { who: "NARRATOR", text: "The beasts drove you back — but Hermes' Moly kept the death-curse from taking hold." },
      { who: "ODYSSEUS", text: "Up again. My men need their king." }
    );
    this.hp = 4;
    HUD.health(4);
    this.state = "";
  }

  groundY() { return this.engine.H * 0.8; }

  heroScreen() {
    return { x: this.playerX * this.engine.W, y: this.groundY() - 55, s: 1.05 };
  }

  draw(ctx) {
    const eng = this.engine, W = eng.W, H = eng.H;
    const gy = this.groundY();

    drawSky(ctx, "#6d8e58", "#d2c78f", [W * 0.5, H * 0.16, Math.min(W, H) * 0.32]);
    drawRidge(ctx, gy - H * 0.32, H * 0.11, "rgba(58,74,32,0.52)", 5, 110);
    drawGround(ctx, gy, H - gy, "#546430", "#283014");

    // Circe's magnificent Ancient Greek Marble Palace at 0.47
    const hx = 0.47 * W;
    this.drawCircePalace(ctx, hx, gy, W, H);

    // Ambient floating butterflies & magic glade fireflies
    PixelVFX.drawLoop(ctx, "critters/butterfly", W * 0.18, gy - 56, this.t, { palette: "apollo", scale: 0.65 });
    PixelVFX.drawLoop(ctx, "critters/butterfly", W * 0.78, gy - 62, this.t + 1.4, { palette: "moly", scale: 0.60, flip: true });
    PixelVFX.drawLoop(ctx, "weather/fireflies", W * 0.50, gy - 80, this.t, { palette: "moly", scale: 0.95 });

    // Sacred Moly Blossoms across the glade
    this.molyPlants.forEach((m, i) => {
      if (m.taken) return;
      const x = m.at * W;
      const bob = Math.sin(this.t * 3.5 + i) * 3;
      this.drawMolyBlossom(ctx, x, gy - 16 + bob, this.t + i);
    });

    this.ings.forEach((ing, i) => {
      if (ing.taken) return;
      const x = ing.at * W, y = gy - 12 + Math.sin(this.t * 3 + i) * 2;
      ctx.fillStyle = ING_COLORS[ing.ing]; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff4c2"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center"; ctx.fillText(ING_GLYPHS[ing.ing], x, y + 3);
    });

    // Swine crewmen (and restored upright Greek sailors once cured!)
    this.pigs.forEach((p, i) => {
      const px = p.at * W;
      if (!p.cured) {
        // Swirling Circe dark hex ring around uncured pig
        PixelVFX.drawLoop(ctx, "arcane/rune-circle", px, gy - 8, this.t * 1.5 + i, { palette: "circe", scale: 0.68 });
        drawPig(ctx, px, gy - 4, 1.15, this.t, i);
        drawNameTag(ctx, px, gy - 32, PIG_NAMES[i] + " (Swine)");
      } else {
        // Upright Greek sailor celebrating!
        PixelVFX.drawLoop(ctx, "holy/heal", px, gy - 4, this.t * 0.8 + i, { palette: "moly", scale: 0.55 });
        drawCrewman(ctx, px, gy - 4, 1.1, (px > this.playerX * W ? -1 : 1), this.t, i);
        drawNameTag(ctx, px, gy - 84, PIG_NAMES[i]);
      }
    });

    // Circe's guardian beasts
    this.beasts.forEach((b, i) => {
      if (!b.alive) return;
      const dir = b.at > this.playerX ? -1 : 1;
      const rush = b.state === "charge" || b.state === "strike" ? (b.at > this.playerX ? -1 : 1) * (b.t * 44) : 0;
      drawBeast(ctx, b.at * W + rush, gy - 2, 1.15, dir, this.t);
      drawNameTag(ctx, b.at * W + rush, gy - 36, BEAST_NAMES[i].toUpperCase());
    });

    // Circe on the palace portico after all are cured
    if (this.pigsCured >= 3) {
      PixelVFX.drawLoop(ctx, "arcane/rune-circle", hx + 36, gy - 4, this.t, { palette: "circe", scale: 0.88 });
      drawCirce(ctx, hx + 36, gy - 6, 1.1, -1, this.t);
      drawNameTag(ctx, hx + 36, gy - 58, "CIRCE");
    }

    // Player (Odysseus) with visible sword always in hand
    const heroPose = Cinematic.getHeroPose();
    drawOdysseus(ctx, this.playerX * W, gy, 1.08, this.facing, this.t, false, Math.abs(this.engine.axisX() || this._holdDir || 0) > 0.05, Gear.kit(), heroPose);
    drawNameTag(ctx, this.playerX * W, gy - 108 + (heroPose ? (heroPose.dy || 0) : 0), "ODYSSEUS");

    // Shimmering Hermes Moly Elixir aura & floating flask above Odysseus
    if (this.hasMolyDraught && this.elixirCharges > 0) {
      PixelVFX.drawLoop(ctx, "pickups/potion", this.playerX * W + 22 * this.facing, gy - 96, this.t, { palette: "moly", scale: 0.72 });
      PixelVFX.drawLoop(ctx, "holy/heal", this.playerX * W, gy - 12, this.t * 1.8, { palette: "apollo", scale: 0.50 });
    }

    if (this.potion) PixelVFX.drawLoop(ctx, "pickups/potion", this.playerX * W + 22 * this.facing, gy - 92, this.t, { palette: "apollo", scale: 0.62 });
    this.ensureBenchButton();
    this.ensureCauldronButton();
    this.drawBursts(ctx);
  }

  /** Renders the magnificent Greek Marble Palace of Circe */
  drawCircePalace(ctx, hx, gy, W, H) {
    ctx.save();

    // Classical multi-tiered marble plinth foundation
    ctx.fillStyle = "#b5aba0";
    ctx.fillRect(hx - 92, gy - 14, 184, 14);
    ctx.fillStyle = "#d5ccbe";
    ctx.fillRect(hx - 86, gy - 22, 172, 8);
    ctx.fillStyle = "#ebe4d6";
    ctx.fillRect(hx - 80, gy - 30, 160, 8);

    // Greek gold meander line along top step
    ctx.strokeStyle = PAL.bronzeBright;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(hx - 78, gy - 29); ctx.lineTo(hx + 78, gy - 29);
    ctx.stroke();

    // Palace back wall & shadowed portico interior
    ctx.fillStyle = "#2c1724";
    ctx.fillRect(hx - 68, gy - 124, 136, 94);

    // Arched grand palace entrance
    ctx.fillStyle = "#120515";
    ctx.beginPath();
    ctx.arc(hx, gy - 80, 26, Math.PI, 0);
    ctx.lineTo(hx + 26, gy - 30);
    ctx.lineTo(hx - 26, gy - 30);
    ctx.closePath();
    ctx.fill();

    // Billowing Royal Tyrian purple velvet curtains
    const billow = Math.sin(this.t * 2.2) * 4;
    ctx.fillStyle = "#5c1b68";
    ctx.beginPath();
    ctx.moveTo(hx - 26, gy - 80);
    ctx.quadraticCurveTo(hx - 14 + billow, gy - 55, hx - 22, gy - 30);
    ctx.lineTo(hx - 32, gy - 30);
    ctx.quadraticCurveTo(hx - 28, gy - 60, hx - 26, gy - 80);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(hx + 26, gy - 80);
    ctx.quadraticCurveTo(hx + 14 - billow, gy - 55, hx + 22, gy - 30);
    ctx.lineTo(hx + 32, gy - 30);
    ctx.quadraticCurveTo(hx + 28, gy - 60, hx + 26, gy - 80);
    ctx.closePath();
    ctx.fill();

    // 4 Grand Fluted Marble Columns
    const cols = [-64, -28, 28, 64];
    for (const cx of cols) {
      const colX = hx + cx;
      // Column Base
      ctx.fillStyle = PAL.bronze;
      ctx.fillRect(colX - 7, gy - 33, 14, 4);
      // Fluted Marble Shaft
      ctx.fillStyle = "#e8e0d2";
      ctx.fillRect(colX - 5.5, gy - 114, 11, 81);
      // Shaded column fluting lines
      ctx.strokeStyle = "#beb4a5";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(colX - 2.5, gy - 114); ctx.lineTo(colX - 2.5, gy - 33);
      ctx.moveTo(colX + 2.5, gy - 114); ctx.lineTo(colX + 2.5, gy - 33);
      ctx.stroke();
      // Corinthian Golden Capital
      ctx.fillStyle = PAL.bronzeBright;
      ctx.beginPath();
      ctx.moveTo(colX - 8, gy - 118);
      ctx.lineTo(colX + 8, gy - 118);
      ctx.lineTo(colX + 6, gy - 114);
      ctx.lineTo(colX - 6, gy - 114);
      ctx.closePath();
      ctx.fill();
    }

    // Classical Marble Entablature & Pediment (Roof)
    ctx.fillStyle = "#d8cfc0";
    ctx.fillRect(hx - 78, gy - 128, 156, 11);
    ctx.fillStyle = PAL.bronze;
    ctx.fillRect(hx - 76, gy - 122, 152, 2.5);

    // Pediment Triangle
    ctx.fillStyle = "#ebe3d6";
    ctx.beginPath();
    ctx.moveTo(hx - 82, gy - 128);
    ctx.lineTo(hx, gy - 162);
    ctx.lineTo(hx + 82, gy - 128);
    ctx.closePath();
    ctx.fill();

    // Golden relief in pediment center (Circe's Golden Cup & Boar crest)
    ctx.fillStyle = PAL.bronzeBright;
    ctx.beginPath();
    ctx.arc(hx, gy - 142, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8a6624";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Acroteria at roof peak
    ctx.fillStyle = PAL.gold;
    ctx.beginPath();
    ctx.moveTo(hx - 4, gy - 162); ctx.lineTo(hx, gy - 171); ctx.lineTo(hx + 4, gy - 162);
    ctx.closePath();
    ctx.fill();

    // Twin Bronze Braziers with crackling magical flame
    drawTorch(ctx, hx - 68, gy - 30, this.t * 1.2, 54);
    drawTorch(ctx, hx + 68, gy - 30, this.t * 1.3 + 0.8, 54);

    // The Great Cauldron of Aiaia on the terrace steps
    const cauldX = hx, cauldY = gy - 30;
    // Tripod bronze legs
    ctx.strokeStyle = "#4d3416";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cauldX - 16, cauldY); ctx.lineTo(cauldX - 11, cauldY - 14);
    ctx.moveTo(cauldX + 16, cauldY); ctx.lineTo(cauldX + 11, cauldY - 14);
    ctx.moveTo(cauldX, cauldY); ctx.lineTo(cauldX, cauldY - 12);
    ctx.stroke();

    // Cauldron bronze bowl
    ctx.fillStyle = "#63431b";
    ctx.beginPath();
    ctx.arc(cauldX, cauldY - 15, 16, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = PAL.bronzeBright;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cauldX, cauldY - 15, 16, 0, Math.PI);
    ctx.stroke();

    // Glowing bubbling liquid inside cauldron
    const bubble = Math.sin(this.t * 6) * 1.5;
    const brewCol = this.hasMolyDraught ? "#3be88b" : "#b842df";
    ctx.fillStyle = brewCol;
    ctx.beginPath();
    ctx.ellipse(cauldX, cauldY - 15, 15, 4 + bubble * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Swirling cauldron rune loop
    PixelVFX.drawLoop(ctx, "arcane/rune-circle", cauldX, cauldY - 12, this.t * 1.2, {
      palette: this.hasMolyDraught ? "moly" : "circe",
      scale: 0.65,
    });

    ctx.restore();
  }

  /** Renders a radiant, milk-white Moly blossom (Hermes' divine herb) */
  drawMolyBlossom(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);

    // Dark black root in soil
    ctx.strokeStyle = "#1b140e";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-2, 12); ctx.lineTo(3, 18);
    ctx.stroke();

    // Emerald stem
    ctx.strokeStyle = "#466e2c";
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -10);
    ctx.stroke();

    // Milk-white star flower petals with golden starlight glow
    const glow = Math.sin(t * 4) * 2;
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    for (let p = 0; p < 5; p++) {
      const ang = p * (Math.PI * 2 / 5);
      const px = Math.cos(ang) * (6 + glow * 0.3);
      const py = -10 + Math.sin(ang) * (6 + glow * 0.3);
      ctx.beginPath();
      ctx.arc(px, py, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Golden blossom center
    ctx.fillStyle = PAL.gold;
    ctx.beginPath();
    ctx.arc(0, -10, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Starlight aura ring
    ctx.strokeStyle = "rgba(255, 248, 190, 0.45)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -10, 11 + glow, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  ensureCauldronButton() {
    if (document.getElementById("cauldron-brew-btn")) return;
    const b = document.createElement("button");
    b.id = "cauldron-brew-btn";
    b.className = "btn-stone";
    b.style.cssText = "position:absolute;left:66%;bottom:14%;transform:translateX(-50%);display:none;font-size:12px;padding:9px 12px;z-index:32;font-weight:bold;letter-spacing:1px;background:#24160a;border:2px solid #e6c069;color:#fff4c2;";
    b.textContent = "TRANSMUTE MOLY ELIXIR";
    b.addEventListener("click", () => this.transmuteCauldron());
    document.getElementById("mech-ui").appendChild(b);
  }

  ensureBenchButton() {
    if (document.getElementById("bench-open")) return;
    const b=document.createElement("button"); b.id="bench-open"; b.className="btn-stone";
    b.style.cssText="position:absolute;left:34%;bottom:14%;transform:translateX(-50%);display:none;font-size:12px;padding:9px 12px;z-index:32;font-weight:bold;letter-spacing:1px;background:#24160a;border:2px solid #e6c069;color:#fff4c2;";
    b.textContent="BREW POTION"; b.addEventListener("click",()=>this.openBench());
    document.getElementById("mech-ui").appendChild(b);
  }
}
