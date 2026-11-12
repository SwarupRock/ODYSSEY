/* ============================================================
   ODYSSEY — Prologue: The Fall of Troy
   Cold-open cinematic. Agamemnon enters burning Troy with
   hubris aura; Odysseus, apart, is uneasy. Non-interactive
   until the short walk to the ships.
   ============================================================ */

import { PAL, drawSky, drawGround, drawRidge, drawTorch, FireParticles,
         drawOdysseus, drawAgamemnon, drawSoldier, drawNameTag } from "../js/art.js";
import { ChapterScene, sleep } from "../js/scenefw.js";
import { PixelVFX } from "../js/pixelvfx.js";

export class PrologueScene extends ChapterScene {
  initState() {
    this.fire = new FireParticles(90);
    this.state = "intro";
    this.walkT = 0;        // agamemnon march progress 0..1
    this.stepAcc = 0;
    this.playerX = -140;   // odysseus x until the walk
    this.audio.startAmbience("fire");
    this.audio.playChapterMusic(0); // doomed Troy dirge
  }

  async intro() {
    const eng = this.engine;
    await sleep(500);
    eng.shake(1.2);
    this.audio.sfx("reveal");

    await this.say(
      { who: "NARRATOR", text: "Ten years the Greeks besieged the walls of Troy." },
      { who: "NARRATOR", text: "Ten years of blood, of gods taking sides, of kings grown proud." },
      { who: "NARRATOR", text: "Tonight the city burns — and victory turns men into monsters." }
    );

    this.state = "march";
  }

  async intro_part2() {
    this.audio.sfx("horn");
    await this.say(
      { who: "AGAMEMNON", text: "The walls of Priam are dust! Let all Asia remember my name!" },
      { who: "NARRATOR", text: "The king's retinue roared. The gods, they say, do not forgive such music for long." },
      { who: "ODYSSEUS", text: "Ten years to break a city... and a sea of storms between me and home. I do not ask for glory. Only my bed. My son. My wife." }
    );

    this.objective("Walk right — hold <span class=\"kbd\">D</span> or swipe →");
    this.playerX = -this.engine.W * 0.3;
    this._followDone = new Promise((res) => (this._followDoneRes = res));
    this.state = "follow";
    await this._followDone;
    this.audio.sfx("success");
    this.objective(null);
    this.note("The voyage home begins.");
    await sleep(1000);

    await this.say(
      { who: "NARRATOR", text: "So the beacons of Troy sank behind them, and the fleet put out into the wine-dark sea." },
      { who: "NARRATOR", text: "Nine days of fair wind. On the tenth, the island of the Cyclops rose out of the haze." }
    );
    await this.finish({ hubris: 1 });
    const { startNext } = await import("../js/main.js");
    startNext();
  }

  tick(dt) {
    this.fire.update(dt, -0.02);
    const eng = this.engine;

    if (this.state === "march") {
      this.walkT = Math.min(1, this.walkT + dt * 0.12);
      this.stepAcc += dt;
      if (this.stepAcc > 0.44) {
        this.stepAcc = 0;
        this.audio.sfx("footstep");
        eng.shake(0.9); // cinematic royal footstep impact
        const ax = -eng.W * 0.25 + this.walkT * eng.W * 0.47;
        if (ax > 0 && ax < eng.W) {
          PixelVFX.spawn("impacts/heavy-landing", ax, eng.H * 0.78 + 8, { palette: "rock", scale: 0.65, alpha: 0.7 });
        }
      }
      if (this.walkT >= 1) {
        this.state = "talk";
        this.intro_part2();
      }
    }

    if (this.state === "follow") {
      // movement: WASD/arrows (D/→) or swipe
      const kbd = this.engine.axisX();
      if (kbd !== 0) {
        this.playerX += kbd * dt * this.engine.W * 0.32;
        this.stepAcc += dt;
        if (this.stepAcc > 0.3) { this.stepAcc = 0; this.audio.sfx("footstep"); }
      }
      if (this.playerX >= -this.engine.W * 0.05) {
        this.state = "board";
        this._followDoneRes && this._followDoneRes();
      }
    }
  }

  onSwipe(dir) {
    // active walk: swipe right to walk toward the ships
    if (this.state === "follow" && (dir === "left" || dir === "right")) {
      this.playerX = Math.min(-this.engine.W * 0.05, this.playerX + this.engine.W * 0.1);
      this.audio.sfx("footstep");
    }
  }

  draw(ctx) {
    const eng = this.engine;
    const W = eng.W, H = eng.H;
    const gy = H * 0.78;

    // burning sky
    drawSky(ctx, "#3a1c10", "#140b06", [W * 0.72, H * 0.2, Math.min(W, H) * 0.3]);

    // distant walls of Troy silhouettes
    ctx.fillStyle = "rgba(26,16,8,0.85)";
    const bw = W * 0.09;
    for (let i = 0; i < 9; i++) {
      const bx = W * 0.05 + i * bw * 1.05;
      const bh = H * (0.16 + ((i * 37) % 5) * 0.02);
      ctx.fillRect(bx, gy - bh, bw * 0.85, bh);
      // broken crenellation
      if (i % 2 === 0) ctx.fillRect(bx + bw * 0.3, gy - bh - H * 0.02, bw * 0.25, H * 0.02);
    }

    drawGround(ctx, gy, H - gy, "#4a2410", "#1a0d06");
    drawRidge(ctx, gy - H * 0.28, H * 0.05, "rgba(46,24,12,0.6)", 3, 120);

    // fires across the city — roaring animated pixelfx braziers & campfires
    this.fire.draw(ctx, 0, gy - H * 0.2, W, H * 0.22, 0.45);
    for (let i = 0; i < 4; i++) {
      const fx = W * (0.12 + i * 0.22);
      PixelVFX.drawLoop(ctx, i % 2 === 0 ? "fire/brazier" : "fire/campfire", fx, gy + 4, this.t + i * 0.73, {
        palette: "fire",
        scale: i % 2 === 0 ? 0.85 : 0.78,
      });
    }

    const ax = -W * 0.25 + this.walkT * W * 0.47;

    // Sovereign God-Ray streaming from the heavens directly onto Agamemnon
    if (this.state === "march" || this.state === "talk") {
      ctx.save();
      const beamG = ctx.createLinearGradient(ax - 50, 0, ax + 50, gy);
      beamG.addColorStop(0, "rgba(255,220,110,0.38)");
      beamG.addColorStop(0.5, "rgba(255,180,60,0.22)");
      beamG.addColorStop(1, "rgba(230,130,40,0)");
      ctx.fillStyle = beamG;
      ctx.beginPath();
      ctx.moveTo(ax - 35, 0);
      ctx.lineTo(ax + 35, 0);
      ctx.lineTo(ax + 95, gy + 12);
      ctx.lineTo(ax - 95, gy + 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      PixelVFX.drawLoop(ctx, "holy/blessing", ax, gy + 8, this.t, { palette: "apollo", scale: 1.05, alpha: 0.7 });
    }

    // soldiers & Mycenaean standard bearers marching behind agamemnon
    for (let i = 0; i < 4; i++) {
      const sx = ax - 90 - i * 65;
      if (sx > -80) {
        drawSoldier(ctx, sx, gy + 6, 1.05, 1, this.t, this.state === "march");
        // Royal Lion Standard for the first retinue hoplite
        if (i === 1) {
          ctx.save();
          ctx.strokeStyle = PAL.bronzeBright;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(sx + 10, gy + 4);
          ctx.lineTo(sx + 10, gy - 85);
          ctx.stroke();
          // Standard banner
          ctx.fillStyle = PAL.blood;
          ctx.fillRect(sx + 10, gy - 85, 28, 20);
          ctx.fillStyle = PAL.bronzeBright;
          ctx.beginPath();
          ctx.arc(sx + 24, gy - 75, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // agamemnon + majestic hubris aura
    drawAgamemnon(ctx, ax, gy + 8, 1.22, 1, this.t, this.state === "march" || this.state === "talk" ? 1.0 : 0.5);
    drawNameTag(ctx, ax, gy - 102, "AGAMEMNON");

    // odysseus
    const ox = this.state === "follow" || this.state === "board" ? this.playerX : W * 0.82;
    drawOdysseus(ctx, ox, gy + 26, 1.0, -1, this.t, false, this.state === "follow");
    drawNameTag(ctx, ox, gy - 74, "ODYSSEUS");

    // ships at right edge
    ctx.save();
    ctx.translate(W * 0.94, gy - 6);
    ctx.fillStyle = "#2c1a0e";
    ctx.beginPath();
    ctx.moveTo(-40, 0); ctx.quadraticCurveTo(0, 26, 46, 2); ctx.lineTo(38, 10);
    ctx.quadraticCurveTo(0, 34, -34, 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#4a3016"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(4, 2); ctx.lineTo(4, -52); ctx.stroke();
    ctx.restore();

    this.drawBursts(ctx);
  }
}
