/* ============================================================
   ODYSSEY — Chapter 2: The Bag of Winds
   Resource-management chapter. Balance the wind meter with
   tap/hold; resist (and manage) the crew's temptation to open
   the bag. No combat — you fail by losing the ship.
   ============================================================ */

import { PAL, drawSky, drawGround, drawWaves, drawMeander, drawShip, drawAeolus, drawOdysseus, drawSuitor, drawNameTag, drawGulls, drawReflections } from "../js/art.js";
import { ChapterScene, sleep } from "../js/scenefw.js";
import { HUD, Mech, Choices } from "../js/ui.js";

export class Ch2Scene extends ChapterScene {
  initState() {
    this.audio.startAmbience("waves");
    this.audio.playChapterMusic(2); // open-water sailing song

    this.wind = 0.5;        // 0..1 meter position
    this.windTarget = 0.5;
    this.drift = 0;         // external push per second
    this.integrity = 100;   // hull/bag stress
    this.progress = 0;      // voyage completion 0..1
    this.crewTempt = 0;     // 0..1
    this.holdDir = 0;
    this.events = [];
    this.nextEvent = 6;
    this.buildUI();
  }

  async intro() {
    await this.say(
      { who: "NARRATOR", text: "Aeolus, keeper of the winds, gave Odysseus a sack: all the world's gales, bound in leather." },
      { who: "AEOLUS", text: "One fair west wind is left outside the knot. It will carry you to Ithaca. Do not open the bag. Not for any reason." },
      { who: "NARRATOR", text: "Nine days Odysseus held the tiller and never slept. The bag creaked like a whip in the wind." }
    );
    this.objective("Keep the needle in the pale zone — and your crew's hands off the bag");
    HUD.health(-1);
  }

  buildUI() {
    Mech.set(`
      <div class="windmeter">
        <div class="wm-title">Favorable Wind</div>
        <div class="wm-track">
          <div class="wm-zone" style="left:38%;width:24%"></div>
          <div class="wm-needle" id="wm-needle"></div>
        </div>
        <div class="wm-bands"><span>storm</span><span>calm</span><span>gale</span></div>
        <div class="wm-bag">sail: <b>hold left / right side of screen</b> to trim</div>
        <div class="wm-crew" id="wm-crew"></div>
      </div>`);
  }

  scheduleEvent() {
    const roll = Math.random();
    if (roll < 0.45) {
      // crew drifts toward the bag
      this.events.push({
        type: "crew",
        t: 4.5,
        label: "A sailor creeps toward the bag — TAP the warning to stop him",
        resolved: false,
      });
    } else if (roll < 0.75) {
      // wind squall
      this.events.push({ type: "squall", t: 5, label: "A squall! Hold against it!", dir: Math.random() < 0.5 ? -1 : 1, power: 0.1 + Math.random() * 0.08 });
      this.audio.sfx("gust");
    } else {
      // becalmed
      this.events.push({ type: "calm", t: 5, label: "The wind dies. Sail hangs slack…" });
    }
  }

  tick(dt) {
    const W = this.engine.W;

    // --- squall / calm drift ---
    for (const ev of this.events) {
      ev.t -= dt;
      if (ev.type === "squall") this.drift += ev.dir * ev.power * dt * 3;
      if (ev.type === "calm") this.drift -= 0.06 * dt * 3;
      if (ev.type === "crew") {
        if (!ev.resolved && ev.t > 0) {
          this.crewTempt += dt * 0.22;
        }
      }
    }
    this.events = this.events.filter((ev) => ev.t > 0);

    // natural wandering of the wind
    this.windTarget += (0.5 - this.windTarget) * dt * 0.14; // squalls always relax back to fair wind
    this.windTarget += Math.sin(this.t * 0.5) * 0.02 * dt + (Math.random() - 0.5) * 0.001;
    this.windTarget = Math.max(0, Math.min(1, this.windTarget + this.drift * dt));
    this.drift *= Math.pow(0.4, dt); // decay

    // player trim: WASD/arrows or tap-hold halves
    this.wind += (this.holdDir + this.engine.axisX()) * dt * 0.34;
    // wind follows target slowly
    this.wind += (this.windTarget - this.wind) * dt * 0.5;
    this.wind = Math.max(0, Math.min(1, this.wind));

    // in pale zone (0.38–0.62) → progress; otherwise stress
    const inZone = this.wind > 0.38 && this.wind < 0.62;
    if (inZone) {
      this.progress = Math.min(1, this.progress + dt * 0.055);
      this.integrity = Math.min(100, this.integrity + dt * 3);
    } else {
      const edge = this.wind < 0.38 ? (0.38 - this.wind) : (this.wind - 0.62);
      this.integrity -= edge * 26 * dt;
    }

    // crew temptation events scheduling
    this.nextEvent -= dt;
    if (this.nextEvent <= 0) {
      this.nextEvent = 8 + Math.random() * 7;
      this.scheduleEvent();
    }
    // resolve crew events by tapping the crew label
    const crewEl = document.getElementById("wm-crew");
    if (crewEl) {
      const active = this.events.find((e) => e.type === "crew" && !e.resolved);
      if (active) {
        crewEl.textContent = "⚠ " + active.label;
        crewEl.classList.add("warn");
      } else {
        crewEl.textContent = this.crewTempt > 0.05 ? "the men eye the bag…" : "";
        crewEl.classList.remove("warn");
      }
    }

    // crew temptation consequences
    if (this.crewTempt >= 1) {
      this.disaster();
      return;
    }
    this.crewTempt = Math.max(0, this.crewTempt - dt * 0.05);

    // needle UI
    const needle = document.getElementById("wm-needle");
    if (needle) needle.style.left = `calc(${(this.wind * 100).toFixed(1)}% - 3px)`;

    // integrity fail
    if (this.integrity <= 0) {
      this.disaster(true);
      return;
    }

    // win
    if (this.progress >= 1 && !this._win) {
      this._win = true;
      this.victory();
    }
  }

  handleTap(x, y) {
    // tapping the crew warning drives the sailor off
    const active = this.events.find((e) => e.type === "crew" && !e.resolved);
    if (active) {
      active.resolved = true;
      active.t = 0;
      this.crewTempt = Math.max(0, this.crewTempt - 0.34);
      this.audio.sfx("success");
      this.note("You barked the order — the sailor slunk back to the oars.");
      return;
    }
  }

  onPointerDown(x) {
    const mid = this.engine.W / 2;
    this.holdDir = x < mid ? -1 : 1;
  }
  onPointerUp() { this.holdDir = 0; }
  onActionKey(k) {
    // SPACE barks the order at a meddling sailor (same action as tapping the crew label)
    if (k === " " || k === "enter") this.handleTap();
  }

  async disaster(storm = false) {
    if (this.state === "down" || this.state === "won" || this._win) return;
    this.state = "down";
    this.audio.sfx("crash");
    this.engine.shake(2.2);
    await this.say(
      storm
        ? { who: "NARRATOR", text: "The wind screamed out of the sack like a freed falcon. Masts snapped. The sea took the ships like a man taking back a loan." }
        : { who: "NARRATOR", text: "While you slept, they opened the bag. The winds roared out — and drove the fleet back across all the sea you had crossed." },
      { who: "NARRATOR", text: "But the gods are not done with you. The story carries you forward, shipwrecked and wiser." }
    );
    this.crewTempt = 0;
    this.integrity = 100;
    this.progress = Math.max(0, this.progress - 0.25);
    this.state = "";
    this.events = [];
  }

  async victory() {
    this.state = "won";
    Mech.hide();
    this.audio.sfx("success");
    await this.say(
      { who: "NARRATOR", text: "On the tenth evening, the smoke of Ithaca rose on the horizon. You could see the shore. You could see the fires." },
      { who: "ODYSSEUS", text: "Hold the course. Home, lads — home by dawn." },
      { who: "NARRATOR", text: "Then sleep took you at last. And behind you, the sailors whispered: What does the bag hold? Gold? Wine?" },
      { who: "NARRATOR", text: "The wind that filled the sail turned, as if listening. The isle of Circe would be your shore instead." }
    );
    await this.finish({ hubris: 1 });
    const { startNext } = await import("../js/main.js");
    startNext();
  }

  draw(ctx) {
    const eng = this.engine, W = eng.W, H = eng.H;
    const seaY = H * 0.62;

    drawSky(ctx, "#6d5b7a", "#c98a5a", [W * 0.78, H * 0.24, Math.min(W, H) * 0.34]); // dusk
    drawGulls(ctx, W, H, this.t, 3);
    // distant coast
    ctx.fillStyle = "rgba(74,48,22,0.7)";
    ctx.beginPath();
    ctx.moveTo(0, seaY);
    ctx.quadraticCurveTo(W * 0.2, seaY - H * 0.09, W * 0.4, seaY);
    ctx.lineTo(0, seaY);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, seaY);
    ctx.quadraticCurveTo(W * 0.8, seaY - H * 0.12, W * 0.62, seaY);
    ctx.lineTo(W, seaY);
    ctx.fill();

    // sea
    ctx.fillStyle = "#1d3d52";
    ctx.fillRect(0, seaY, W, H - seaY);
    drawWaves(ctx, seaY + 8, this.t, PAL.aegean, 0.5);
    drawWaves(ctx, seaY + 34, this.t * 1.3, "rgba(51,96,125,0.8)", 0.4);
    drawReflections(ctx, seaY, W, H, this.t);

    // wind streaks showing meter state
    const windVis = this.wind;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = PAL.bone;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      const yy = H * 0.1 + i * H * 0.05;
      const len = 20 + windVis * 90 + Math.sin(this.t * 3 + i) * 10;
      const xx = (this.t * (60 + windVis * 260) + i * 173) % (W + 200) - 100;
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + len, yy); ctx.stroke();
    }
    ctx.restore();

    // ship (player) — heel based on wind offset
    const heel = (this.wind - 0.5) * 0.5;
    ctx.save();
    ctx.translate(W * 0.5, seaY + 26);
    ctx.rotate(heel);
    drawShip(ctx, 0, 0, 1.1, this.t, true);
    ctx.restore();

    // crew figures on deck (temptation visual)
    const active = this.events.find((e) => e.type === "crew");
    if (active) {
      drawSuitor(ctx, W * 0.5 + 60, seaY + 24, 0.5, -1, this.t, false, false);
      drawNameTag(ctx, W * 0.5 + 60, seaY + 6, "EURYLOCHUS");
    }

    this.drawBursts(ctx);
  }
}
