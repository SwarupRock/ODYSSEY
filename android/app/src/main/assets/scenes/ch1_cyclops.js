/* ============================================================
   ODYSSEY — Chapter 1: Polyphemus's Cave
   Stealth intro (noise meter, sleeping giant) → boss fight:
   dodge club swings, strike when the eye exposes. 3 staggers.
   ============================================================ */

import { PAL, drawSky, drawGround, drawRidge, drawTorch, FireParticles, drawCaveMouth,
         drawOdysseus, drawCyclops, drawSheep, drawNameTag, drawBow, getGlow } from "../js/art.js";
import { ChapterScene, sleep } from "../js/scenefw.js";
import { HUD, Mech } from "../js/ui.js";
import { Gear } from "../js/gear.js";
import { Fx } from "../js/fx.js";
import { Cinematic } from "../js/combat.js";

export class Ch1Scene extends ChapterScene {
  initState() {
    this.audio.startAmbience("cave");
    this.audio.playChapterMusic(1); // phrygian cave menace
    this.playerX = 0;
    this.playerHP = 3;
    this.noise = 0;
    this.state = "sneak";
    this.eye = { alert: false, glow: 0 };
    this.showGearChip();
    Mech.set(`<div class="stealth-eye" id="stealth-eye"><div class="se-iris"></div></div>
      <div class="vitals"><div class="vit-chip" id="noise-chip">quiet</div></div>`);
    HUD.health(3);
    this.objective("Sneak to the olive stake — hold <span class=\"kbd\">D</span>, move slowly");
  }

  async intro() {
    await this.say(
      { who: "NARRATOR", text: "The cave mouth breathed cold. Inside: cheese, pens of sheep — and a giant's snore like surf on rocks." },
      { who: "ODYSSEUS", text: "We wait in the dark. If he wakes, we are mice in a drum." }
    );
  }

  /* ---------------- stealth phase ---------------- */

  onPointerDrag(x, y, dx) {
    if (this.state !== "sneak") return;
    this.playerX = Math.max(0, Math.min(this.sneakMax - 10, this.playerX + dx));
    this.noise = Math.min(1, this.noise + Math.abs(dx) * 0.0035);
  }

  tick(dt) {
    // firelight comes alive — embers rising from the hearth
    this._fl = (this._fl || 0) + dt;
    if (this._fl > 0.22) {
      this._fl = 0;
      Fx.spawnEmbers(this.engine.W * 0.22, this.groundY() - 30, 2, 10);
    }
    this.eyeAcc = (this.eyeAcc || 0) + dt;

    if (this.state === "sneak") {
      this.sneakMax = this.engine.W * 0.62;
      this.noise = Math.max(0, this.noise - dt * 0.16); // decays
      // keyboard sneak: move with A/D, slowly, and make noise while doing it
      const kbd = this.engine.axisX();
      if (kbd !== 0) {
        this.playerX = Math.max(0, Math.min(this.sneakMax - 10, this.playerX + kbd * dt * 190));
        this.noise = Math.min(1, this.noise + dt * 0.22);
      }
      const chip = document.getElementById("noise-chip");
      if (chip) {
        chip.textContent = this.noise > 0.7 ? "LOUD!" : this.noise > 0.35 ? "rustling…" : "quiet";
        chip.style.color = this.noise > 0.7 ? PAL.fireBright : "";
      }
      // giant stirs when noise is high
      this.eye.alert = this.noise > 0.72;
      this.eye.glow += ((this.eye.alert ? 0.7 : 0) - this.eye.glow) * dt * 5;
      const el = document.getElementById("stealth-eye");
      if (el) el.classList.toggle("alert", this.eye.alert);

      if (this.noise >= 1 && !this._caught) {
        this._caught = true;
        this.audio.sfx("roar");
        this.engine.shake(1.4);
        this.playerX = Math.max(0, this.playerX - this.engine.W * 0.22);
        this.noise = 0.2;
        this.note("He stirs! You slip back into the dark…");
        setTimeout(() => (this._caught = false), 1400);
      }

      if (this.playerX >= this.sneakMax - 12 && !this._storyStarted) {
        this._storyStarted = true;
        this.state = "story";
        Mech.hide();
        this.story();
      }
    }

    /* ---------------- fight phase ---------------- */
    if (this.state === "fight") this.tickFight(dt);
    if (this.state === "won") { /* victory handled in story */ }
  }

  async story() {
    this.objective(null);
    await this.say(
      { who: "NARRATOR", text: "By the cold hearth lay an olive stake, long as a mast, sharpened to a point." },
      { who: "POLYPHEMUS", text: "WHO WALKS IN MY CAVE?" },
      { who: "ODYSSEUS", text: "Nobody, great one. Only Nobody, blown off his course." },
      { who: "POLYPHEMUS", text: "Then Nobody stays for supper. Two of your men will do." }
    );
    this.audio.sfx("thud");
    this.engine.shake(1.6);
    await this.say(
      { who: "NARRATOR", text: "The crew scattered, screaming. Only courage — and the stake — remained." }
    );

    // fight begins
    this.state = "fight";
    this.fight = {
      staggers: 0,
      phase: "idle",     // idle → windup → swing → expose → staggered
      timer: 1.2,
      clubSide: 1,
      boulders: [],
    };
    Mech.set(`
      <div class="bossbar">
        <div class="bb-name">Polyphemus</div>
        <div class="bb-track"><div class="bb-fill" id="bb-fill"></div></div>
        <div class="bb-staggers">
          <div class="bb-stagger-pip" id="sp0"></div>
          <div class="bb-stagger-pip" id="sp1"></div>
          <div class="bb-stagger-pip" id="sp2"></div>
        </div>
      </div>`);
    // polyphemus is a stagger boss — arrows only pester him: 2 hits buy
    // one stagger-free windup delay, keep it honest but useful
    this.bowPesters = 0;
    this.objective("Dodge the club (<span class=\"kbd\">A</span>/<span class=\"kbd\">D</span> or swipe) — strike when the eye burns");
    this.audio.playDrumLoop(104, 8, "x..x..x.");
  }

  /* ---------------- fight ---------------- */

  startWindup() {
    const f = this.fight;
    f.phase = "windup";
    f.timer = f.staggers >= 2 ? 0.55 : 0.8;
    f.clubSide = Math.random() < 0.5 ? -1 : 1;
    this.audio.sfx("roar");
    const hint = document.createElement("div");
    hint.className = "dodge-hint urgent";
    hint.id = "dodge-hint";
    hint.style.left = f.clubSide < 0 ? "26%" : "74%";
    hint.textContent = "◀ A / D" ;
    document.getElementById("mech-ui").appendChild(hint);
  }

  doSwing() {
    const f = this.fight;
    f.phase = "swing";
    f.timer = 0.2;
    this.audio.sfx("thud");
  }

  endSwing() {
    const f = this.fight;
    f.phase = "expose";
    f.timer = (f.staggers >= 2 ? 1.1 : 1.5) + (f.exposeBonus || 0);
    f.eyeT = 0;
    this.showQTE();
    const h = document.getElementById("dodge-hint");
    if (h) h.remove();
  }

  showQTE() {
    const old = document.getElementById("qte-box");
    if (old) old.remove();
    const d = document.createElement("div");
    d.className = "qte"; d.id = "qte-box";
    d.innerHTML = `<div class="qte-ring" id="qte-ring" style="--qte-dur:${this.fight.timer}s">✦</div>
      <div class="qte-label">TAP or SPACE — DRIVE THE STAKE</div>`;
    document.getElementById("mech-ui").appendChild(d);
  }

  hideQTE() {
    const d = document.getElementById("qte-box");
    if (d) d.remove();
  }

  tickFight(dt) {
    const f = this.fight, eng = this.engine;
    const W = eng.W;
    const px = this.playerX;

    // ambient player movement (fight): WASD/arrows or tap-hold halves
    if (this._holdDir) this.playerX += this._holdDir * dt * 300;
    this.playerX += this.engine.axisX() * dt * 300;
    this.playerX = Math.max(eng.W * 0.06, Math.min(eng.W * 0.6, this.playerX));
    if (this.dash > 0) this.dash -= dt;

    switch (f.phase) {
      case "idle":
        f.timer -= dt;
        if (f.timer <= 0) this.startWindup();
        break;
      case "windup":
        f.timer -= dt;
        if (f.timer <= 0) this.doSwing();
        break;
      case "swing": {
        f.timer -= dt;
        // hit check: player in the swept band & not dashing
        const far = f.clubSide < 0; // far (left) sweep vs near (right) sweep
        const inZone = far ? px < W * 0.34 : px > W * 0.44;
        if (inZone && !(this.dash > 0) && !this._hitThisSwing) {
          this._hitThisSwing = true;
          if (this.hitPlayer(this.playerX, this.groundY() - 40) === "hit") this.damagePlayer();
        }
        if (f.timer <= 0) { this._hitThisSwing = false; this.endSwing(); }
        break;
      }
      case "expose": {
        f.timer -= dt;
        f.eyeT = 1 - Math.max(0, f.timer) / (f.staggers >= 2 ? 1.1 : 1.5);
        if (f.timer <= 0) {
          this.hideQTE();
          f.phase = "idle";
          f.timer = 1.4;
          // missed the QTE — the club catches you
          if (this.playerHP > 0) this.damagePlayer();
        }
        break;
      }
      case "staggered":
        f.timer -= dt;
        if (f.timer <= 0) {
          f.phase = "idle";
          f.timer = 0.9;
        }
        break;
    }

    // boulders after 2nd stagger — shootable out of the air
    if (f.staggers >= 2 && f.phase !== "staggered") {
      f.boulderT = (f.boulderT || 2.2) - dt;
      if (f.boulderT <= 0) {
        f.boulderT = 2.6 + Math.random() * 1.4;
        f.boulders.push({ x: eng.W * (0.1 + Math.random() * 0.45), y: -40, vy: 0, warn: 0.8 });
      }
      for (const b of f.boulders) {
        if (b.warn > 0) { b.warn -= dt; continue; }
        b.vy += dt * 900; b.y += b.vy * dt;
        if (Math.abs(b.x - this.playerX) < 34 && Math.abs(b.y - this.groundY() + 30) < 40 && this.dash <= 0) {
          b.y = 1e9;
          if (this.hitPlayer(this.playerX, this.groundY() - 40) === "hit") this.damagePlayer();
        }
      }
      f.boulders = f.boulders.filter((b) => b.y < this.groundY() + 60);
    }

    // arrows: shatter falling boulders, pester the giant (one advance/frame)
    const colliders = [{ x: eng.W * 0.78, r: 60, ref: f }];
    for (const b of f.boulders) if (b.warn <= 0) colliders.push({ x: b.x, r: 40, ref: b });
    this.tickArrows(dt, colliders, (ref) => {
      if (ref === f) {
        ref.exposeBonus = Math.min(1.2, (ref.exposeBonus || 0) + 0.4);
        this.burst(eng.W * 0.78, this.groundY() - 130, PAL.fireBright, 40, 3);
        this.note("The shaft bites — his eye will linger longer!");
        return false; // the giant stays a collider
      }
      this.burst(ref.x, ref.y, PAL.sand, 55, 4);
      ref.y = 1e9;
      this.note("You split the boulder mid-air!");
      return true;
    });
  }

  groundY() { return this.engine.H * 0.8; }

  /** screen anchor of the hero for the rim-light pass */
  heroScreen() {
    if (this.state === "won" || this.state === "sail") return null;
    return { x: this.playerX, y: this.groundY() - 55, s: 1.05 };
  }

  damagePlayer() {
    Fx.hit();
    this.playerHP--;
    HUD.health(this.playerHP);
    this.audio.sfx("crash");
    this.engine.shake(1.8);
    this.burst(this.playerX, this.groundY() - 40, PAL.blood, 60, 5);
    if (this.playerHP <= 0) this.failLoop();
  }

  async failLoop() {
    const f = this.fight;
    f.phase = "staggered"; f.timer = 99;
    this.state = "down";
    await this.say(
      { who: "NARRATOR", text: "Darkness took you at the cave's edge — but not the end. The crew dragged you back into the shadows." },
      { who: "ODYSSEUS", text: "Again, then. The stake is still sharp." }
    );
    this.playerHP = 3; HUD.health(3);
    this.playerX = this.engine.W * 0.12;
    f.boulders = [];
    f.staggers = Math.max(0, f.staggers); // keep progress
    f.phase = "idle"; f.timer = 1.6;
    this.state = "fight";
  }

  /* ---------------- input ---------------- */

  onPointerDown(x) {
    if (this.state !== "fight") return;
    const mid = this.engine.W / 2;
    this._holdDir = x < mid ? -1 : 1;

    // QTE check
    const f = this.fight;
    if (f && f.phase === "expose") {
      this.strikeEye();
    }
  }

  onPointerUp() { this._holdDir = 0; }

  onSwipe(dir) {
    if (this.state !== "fight") return;
    if ((dir === "left" || dir === "right") && this.dash <= 0 && this.fight.phase !== "staggered") {
      this.dodge(dir === "left" ? -1 : 1);
    }
  }

  dodge(dir) {
    if (this.dash > 0 || this.fight.phase === "staggered") return;
    this.dash = 0.3;
    this.dashDir = dir;
    this.playerX += dir * this.engine.W * 0.2;
    this.audio.sfx("footstep");
    this.burst(this.playerX, this.groundY() - 30, PAL.bone, 40, 3);
  }

  onActionKey(k) {
    if (this.state !== "fight") return;
    if ((k === "a" || k === "d") && this.fight.phase !== "staggered") this.dodge(k === "a" ? -1 : 1);
    if ((k === " " || k === "enter") && this.fight.phase === "expose") this.strikeEye();
    if (k === "bow") {
      // arrows fly from the hand toward the giant (or a falling boulder)
      this.shootBow({ x: this.playerX + this.aimDir * 22, y: this.groundY() - 110, speed: 820 });
    }
  }

  strikeEye() {
    const f = this.fight;
    this.hideQTE();
    f.staggers++;
    for (let i = 0; i < 3; i++) {
      const pip = document.getElementById("sp" + i);
      if (pip) pip.classList.toggle("on", i < f.staggers);
    }
    const fill = document.getElementById("bb-fill");
    if (fill) fill.style.width = 100 - (f.staggers / 3) * 100 + "%";
    Cinematic.slash(this.playerX + 40, this.groundY() - 90, 1, true);
    Cinematic.impact(this.engine.W * 0.78, this.groundY() - 120, PAL.fireBright, true);
    this.engine.hitStop(0.14);
    this.audio.sfx("sword");
    this.audio.sfx("roar");
    this.engine.shake(2);
    this.burst(this.engine.W * 0.72, this.groundY() - 120, PAL.fireBright, 90, 6);

    if (f.staggers >= 3) {
      this.victory();
    } else {
      f.phase = "staggered";
      f.timer = 1.6;
      this.note(["It recoils — blinded in fury!", "The eye weeps blood — once more!", "NOW — drive it home!"][f.staggers - 1]);
    }
  }

  async victory() {
    this.state = "won";
    this.fight.phase = "done";
    Mech.hide();
    this.audio.sfx("flare");
    setTimeout(() => this.audio.sfx("roar"), 400);
    this.engine.shake(2.4);
    await this.say(
      { who: "POLYPHEMUS", text: "NOBODY is killing me! NOBODY, by the gods!" },
      { who: "NARRATOR", text: "The blinded giant groped for ghosts. Under the bellies of his rams, the crew crept to freedom." },
      { who: "ODYSSEUS", text: "If any ask who shamed you — say Odysseus, sacker of cities, did it." },
      { who: "NARRATOR", text: "Proud words. The sea god heard them, and did not forget." }
    );

    // spoils of the cave: bronze cuirass + a real sword
    const gotArmor = Gear.award("armor", 1);
    const gotSword = Gear.award("sword", 1);
    if (gotArmor || gotSword) {
      this.showGearChip();
      this.audio.sfx("reveal");
      await this.say(
        { who: "NARRATOR", text: "From the cave's store you took a bronze cuirass and a blade of good Lesbian bronze." },
        { who: "ODYSSEUS", text: "The giant ate my men. I will eat his pantry. Fair trade."
        }
      );
    }
    this.audio.sfx("success");
    await this.finish({ hubris: 1, staggers: 3 });
    const { startNext } = await import("../js/main.js");
    startNext();
  }

  /* ---------------- draw ---------------- */

  draw(ctx) {
    const eng = this.engine, W = eng.W, H = eng.H;
    const gy = this.groundY();

    // cave interior
    ctx.fillStyle = "#0d0805";
    ctx.fillRect(0, 0, W, H);
    // warm firelight pool — cached glow sprite (one blit)
    const glowR = W * 0.5;
    ctx.drawImage(getGlow("232,140,58", 512, 0.22), W * 0.3 - glowR / 2, gy - 40 - glowR / 2, glowR, glowR);
    drawGround(ctx, gy, H - gy, "#2c1a0e", "#0d0805");

    // sheep pens + sheep
    for (let i = 0; i < 4; i++) drawSheep(ctx, W * (0.08 + i * 0.06), gy - 8, 0.9, this.t, i);
    // stalactites
    ctx.fillStyle = "#1a1008";
    for (let i = 0; i < 8; i++) {
      const sx = W * (0.05 + i * 0.13), sh = H * (0.06 + ((i * 29) % 4) * 0.02);
      ctx.beginPath();
      ctx.moveTo(sx - 12, 0); ctx.lineTo(sx + 12, 0); ctx.lineTo(sx, sh);
      ctx.closePath(); ctx.fill();
    }
    drawTorch(ctx, W * 0.22, gy, this.t, 60);

    if (this.state === "sneak" || this.state === "story") {
      drawCyclops(ctx, W * 0.8, gy + 14, 1.35, -1, this.t, "idle", this.eye.glow * 0.4);
      drawNameTag(ctx, W * 0.8, gy - 130, "POLYPHEMUS");
    } else {
      const f = this.fight;
      const pose = f && (f.phase === "windup" ? "windup" : f.phase === "swing" ? "swing" : "idle");
      const eyeGlow = f && f.phase === "expose" ? 0.6 + Math.sin(this.t * 8) * 0.3 : 0;
      drawCyclops(ctx, W * 0.8, gy + 14, 1.5, -1, this.t, pose, eyeGlow);
      drawNameTag(ctx, W * 0.8, gy - 146, "POLYPHEMUS");
    }

    // olive stake by fire (pre-fight)
    if (this.state === "sneak" || this.state === "story") {
      ctx.save();
      ctx.translate(W * 0.62, gy - 4);
      ctx.rotate(-0.9);
      ctx.fillStyle = "#6b4a24";
      ctx.fillRect(-5, -90, 10, 90);
      ctx.fillStyle = PAL.bone;
      ctx.beginPath(); ctx.moveTo(-5, -90); ctx.lineTo(0, -104); ctx.lineTo(5, -90); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // odysseus (dash flicker)
    if (!(this.dash > 0 && Math.floor(this.t * 20) % 2 === 0)) {
      drawOdysseus(ctx, this.playerX, gy, 1.05, this.state === "fight" ? 1 : 1, this.t, false, true, Gear.kit());
      drawNameTag(ctx, this.playerX, gy - 80, "ODYSSEUS");
      // bow in hand once earned (briefly drawn when loosed)
      if (this.state === "fight" && this.bowCd > 0.18) {
        drawBow(ctx, this.playerX + this.aimDir * 16, gy - 38, this.aimDir, Math.min(1, this.bowCd * 2), this.t);
      }
    }

    this.drawArrows(ctx);

    // boulders
    if (this.fight) {
      for (const b of this.fight.boulders) {
        if (b.warn > 0) {
          ctx.save();
          ctx.globalAlpha = 0.5 + Math.sin(this.t * 20) * 0.3;
          ctx.fillStyle = PAL.blood;
          ctx.beginPath(); ctx.ellipse(b.x, gy - 6, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = "#3d2a16";
          ctx.beginPath(); ctx.arc(b.x, b.y, 22, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(b.x, b.y, 22, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }

    // danger arc during swing
    if (this.fight && this.fight.phase === "swing") {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = PAL.blood;
      ctx.lineWidth = 8;
      if (this.fight.clubSide < 0) {
        ctx.beginPath(); ctx.arc(W * 0.2, gy - 90, W * 0.3, Math.PI * 0.7, Math.PI * 1.3); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(W * 0.56, gy - 90, W * 0.26, -Math.PI * 0.3, Math.PI * 0.35); ctx.stroke();
      }
      ctx.restore();
    }

    this.drawBursts(ctx);
  }
}
