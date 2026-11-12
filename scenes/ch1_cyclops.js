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
import { PixelVFX } from "../js/pixelvfx.js";
import { Stick } from "../js/stick.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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
        PixelVFX.spawn("ui/exclamation", this.engine.W * 0.8, this.groundY() - 140, { palette: "blood", scale: 1.0 });
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
    this.facing = 1;
    this.playerHP = 5;
    HUD.health(5);
    Stick.setCombatMode(true);
    Stick.refreshBow();
    const W = this.engine.W;
    this.fight = {
      hp: 210,
      maxHp: 210,
      poise: 0,          // 0..100 builds up stagger / expose!
      staggers: 0,
      phase: "idle",     // idle → windup → swing → charge → expose → staggered → done
      pattern: "slam",   // slam | sweep | charge | rocks
      timer: 1.0,
      clubSide: 1,
      bossX: W * 0.78,
      baseBossX: W * 0.78,
      hitFlash: 0,
      boulders: [],
      guardT: 0,
      parryT: 0,
      atkCd: 0,
      spinCd: 0,
      upperCd: 0,
      spearCd: 0,
      combo: 0,
      comboT: 0,
      lastMove: null,
    };
    Mech.set(`
      <div class="bossbar">
        <div class="bb-name">Polyphemus · Son of Poseidon</div>
        <div class="bb-track"><div class="bb-fill" id="bb-fill"></div></div>
        <div class="bb-staggers">
          <div class="bb-stagger-pip" id="sp0"></div>
          <div class="bb-stagger-pip" id="sp1"></div>
          <div class="bb-stagger-pip" id="sp2"></div>
        </div>
      </div>`);
    this.bowPesters = 0;
    this.objective("⚔ SLASH · ⬆ UPPER (hits eye!) · 🌀 SPIN (breaks rocks) · 🔱 SPEAR · 🛡 PARRY");
    this.audio.playDrumLoop(112, 8, "x..x..x.");
  }

  /* ---------------- fight ---------------- */

  cleanup() {
    Stick.setCombatMode(false);
  }

  updateBossUI() {
    const f = this.fight;
    if (!f) return;
    const fill = document.getElementById("bb-fill");
    if (fill) fill.style.width = Math.max(0, Math.min(100, (f.hp / f.maxHp) * 100)) + "%";
    for (let i = 0; i < 3; i++) {
      const pip = document.getElementById("sp" + i);
      if (pip) pip.classList.toggle("on", i < f.staggers);
    }
  }

  startWindup() {
    const f = this.fight;
    const W = this.engine.W;
    const dist = Math.abs(f.bossX - this.playerX);
    // choose varied intense pattern based on phase & distance
    const r = Math.random();
    if (dist > W * 0.42 && r < 0.45) {
      f.pattern = "charge";
      f.phase = "windup";
      f.timer = f.staggers >= 2 ? 0.62 : 0.85;
      PixelVFX.spawn("status/rage", f.bossX, this.groundY() - 150, { palette: "fire", scale: 1.0 });
    } else if (f.staggers >= 1 && r > 0.72) {
      f.pattern = "rocks";
      f.phase = "windup";
      f.timer = 0.68;
    } else {
      f.pattern = "slam";
      f.phase = "windup";
      f.timer = f.staggers >= 2 ? 0.56 : 0.78;
    }
    f.clubSide = this.playerX < f.bossX - W * 0.16 ? -1 : 1;
    this.audio.sfx("roar");
    PixelVFX.spawn("ui/exclamation", f.bossX - 18, this.groundY() - 170, { palette: "blood", scale: 1.0 });
    const oldHint = document.getElementById("dodge-hint");
    if (oldHint) oldHint.remove();
    const hint = document.createElement("div");
    hint.className = "dodge-hint urgent";
    hint.id = "dodge-hint";
    hint.style.left = f.pattern === "charge" ? "50%" : (this.playerX < W * 0.4 ? "28%" : "62%");
    hint.textContent = f.pattern === "charge" ? "🔱 SPEAR / 🛡 PARRY / ⚡ DASH!" : "🛡 PARRY (F) or ⚡ DASH!";
    document.getElementById("mech-ui").appendChild(hint);
  }

  doSwing() {
    const f = this.fight;
    const W = this.engine.W, gy = this.groundY();
    const h = document.getElementById("dodge-hint");
    if (h) h.remove();
    this._hitThisSwing = false;

    if (f.pattern === "charge") {
      f.phase = "charge";
      f.timer = 0.52;
      this.audio.sfx("crash");
      PixelVFX.spawn("impacts/heavy-landing", f.bossX - 24, gy, { flip: true, palette: "rock", scale: 1.1 });
      this.engine.shake(1.1);
      return;
    }

    if (f.pattern === "rocks") {
      f.phase = "swing";
      f.timer = 0.25;
      this.audio.sfx("thud");
      PixelVFX.spawn("impacts/ground-slam", f.bossX - 36, gy, { palette: "rock", scale: 1.15 });
      PixelVFX.spawn("nature/quake", W * 0.45, gy, { palette: "rock", scale: 1.0 });
      this.engine.shake(1.6);
      // drop 3 rockfalls across arena
      for (let i = 0; i < 3; i++) {
        f.boulders.push({ x: clamp(this.playerX + (i - 1) * W * 0.16, W * 0.1, W * 0.64), y: -30 - i * 35, vy: 80, warn: 0.65 + i * 0.18 });
      }
      return;
    }

    // Heavy club slam right in front of Polyphemus (or sweeping reach)
    f.phase = "swing";
    f.timer = 0.24;
    this.audio.sfx("thud");
    const hitX = clamp(f.bossX - W * 0.22, W * 0.2, W * 0.68);
    f.slamX = hitX;
    PixelVFX.spawn("melee/hammer-smash", hitX, gy, { flip: true, palette: "rock", sparks: "fire", scale: 1.35, engine: this.engine, autoHits: true });
    PixelVFX.spawn("impacts/ground-slam", hitX, gy, { palette: "rock", scale: 1.25 });
    PixelVFX.spawn("explosions/dirt-explosion", hitX, gy, { palette: "rock", scale: 0.85 });
    this.engine.shake(1.6);
  }

  endSwing() {
    const f = this.fight;
    f.bossX = f.baseBossX;
    // After heavy swings, occasionally open brief Expose Eye window OR return quickly to duel
    f.phase = "expose";
    f.timer = (f.staggers >= 2 ? 1.25 : 1.65) + (f.exposeBonus || 0);
    f.exposeBonus = 0;
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
      <div class="qte-label">EYE EXPOSED — UPPERCUT / SLASH!</div>`;
    document.getElementById("mech-ui").appendChild(d);
  }

  hideQTE() {
    const d = document.getElementById("qte-box");
    if (d) d.remove();
  }

  tickFight(dt) {
    const f = this.fight, eng = this.engine;
    const W = eng.W, gy = this.groundY();

    // timers & cooldowns
    if (f.hitFlash > 0) f.hitFlash = Math.max(0, f.hitFlash - dt);
    if (f.guardT > 0) f.guardT = Math.max(0, f.guardT - dt);
    if (f.parryT > 0) f.parryT = Math.max(0, f.parryT - dt);
    if (f.atkCd > 0) f.atkCd = Math.max(0, f.atkCd - dt);
    if (f.spinCd > 0) f.spinCd = Math.max(0, f.spinCd - dt);
    if (f.upperCd > 0) f.upperCd = Math.max(0, f.upperCd - dt);
    if (f.spearCd > 0) f.spearCd = Math.max(0, f.spearCd - dt);
    if (f.comboT > 0) {
      f.comboT -= dt;
      if (f.comboT <= 0) f.combo = 0;
    }

    // player movement & facing
    const moveAxis = (this._holdDir || 0) + eng.axisX();
    if (Math.abs(moveAxis) > 0.05) {
      this.facing = moveAxis > 0 ? 1 : -1;
      this.aimDir = this.facing;
    } else if (this.playerX < f.bossX - 24) {
      this.facing = 1;
      this.aimDir = 1;
    }
    const moveSpeed = f.guardT > 0 ? 160 : 320;
    this.playerX += clamp(moveAxis, -1, 1) * dt * moveSpeed;
    this.playerX = clamp(this.playerX, W * 0.06, Math.min(W * 0.72, f.bossX - 42));
    if (this.dash > 0) this.dash -= dt;

    // passive giant footwork during idle — stalks near player range
    if (f.phase === "idle") {
      const targetX = clamp(Math.max(W * 0.56, this.playerX + W * 0.19), W * 0.54, W * 0.82);
      f.bossX += (targetX - f.bossX) * Math.min(1, dt * 2.5);
    }

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
        if (f.pattern !== "rocks" && !this._hitThisSwing && !(this.dash > 0)) {
          const hitCenter = f.slamX || (f.bossX - W * 0.22);
          if (Math.abs(this.playerX - hitCenter) < W * 0.16) {
            this._hitThisSwing = true;
            this.resolveBossHit();
          }
        }
        if (f.timer <= 0) { this._hitThisSwing = false; this.endSwing(); }
        break;
      }
      case "charge": {
        f.timer -= dt;
        f.bossX = Math.max(W * 0.22, f.bossX - W * 0.85 * dt);
        if (!this._hitThisSwing && !(this.dash > 0) && Math.abs(this.playerX - f.bossX) < 76) {
          this._hitThisSwing = true;
          this.resolveBossHit();
        }
        if (f.timer <= 0) {
          this._hitThisSwing = false;
          const h = document.getElementById("dodge-hint");
          if (h) h.remove();
          f.phase = "expose";
          f.timer = 1.45;
          f.eyeT = 0;
          this.showQTE();
        }
        break;
      }
      case "expose": {
        f.timer -= dt;
        f.eyeT = 1 - Math.max(0, f.timer) / 1.6;
        if (f.timer <= 0) {
          this.hideQTE();
          f.bossX += (f.baseBossX - f.bossX) * 0.5;
          f.phase = "idle";
          f.timer = f.staggers >= 2 ? 0.65 : 0.95;
        }
        break;
      }
      case "staggered":
        f.timer -= dt;
        f.bossX += (f.baseBossX - f.bossX) * Math.min(1, dt * 3);
        if (f.timer <= 0) {
          f.phase = "idle";
          f.timer = 0.8;
        }
        break;
    }

    // continuous falling boulders in late phases (or rockfall pattern)
    if (f.staggers >= 2 && f.phase !== "staggered" && f.phase !== "done") {
      f.boulderT = (f.boulderT || 2.4) - dt;
      if (f.boulderT <= 0) {
        f.boulderT = 2.8 + Math.random() * 1.3;
        f.boulders.push({ x: clamp(this.playerX + (Math.random() - 0.5) * W * 0.22, W * 0.08, W * 0.66), y: -40, vy: 0, warn: 0.78 });
      }
    }
    for (const b of f.boulders) {
      if (b.warn > 0) { b.warn -= dt; continue; }
      b.vy += dt * 920; b.y += b.vy * dt;
      if (Math.abs(b.x - this.playerX) < 34 && Math.abs(b.y - gy + 30) < 42 && this.dash <= 0) {
        b.y = 1e9;
        PixelVFX.spawn("explosions/dirt-explosion", b.x, gy, { palette: "rock", scale: 0.78 });
        this.resolveBossHit();
      } else if (b.y >= gy - 8 && b.y < 1e8) {
        PixelVFX.spawn("explosions/dirt-explosion", b.x, gy, { palette: "rock", scale: 0.65 });
        b.y = 1e9;
      }
    }
    f.boulders = f.boulders.filter((b) => b.y < gy + 60);

    // arrows: shatter falling boulders, chip & stagger Polyphemus
    const colliders = [{ x: f.bossX, r: 62, ref: f }];
    for (const b of f.boulders) if (b.warn <= 0) colliders.push({ x: b.x, r: 44, ref: b });
    this.tickArrows(dt, colliders, (ref, arrow) => {
      if (ref === f) {
        const arrowDmg = (arrow.dmg || 2) * 4;
        this.damageCyclops(arrowDmg, "arrow", arrow.x, gy - 115);
        ref.exposeBonus = Math.min(1.0, (ref.exposeBonus || 0) + 0.35);
        return false;
      }
      this.burst(ref.x, ref.y, PAL.sand, 55, 4);
      PixelVFX.spawn("explosions/dirt-explosion", ref.x, ref.y + 20, { palette: "rock", scale: 0.75 });
      ref.y = 1e9;
      this.note("Arrow splits the falling stone!");
      return true;
    });
  }

  resolveBossHit() {
    const f = this.fight, gy = this.groundY();
    if (f.parryT > 0) {
      // PERFECT PARRY!
      f.parryT = 0; f.guardT = 0;
      Cinematic.performMove("parry", this.playerX, gy, this.facing, { engine: this.engine });
      this.audio.sfx("block");
      this.audio.sfx("sword");
      this.engine.hitStop(0.14);
      this.engine.shake(1.8);
      this.note("⚡ PERFECT PARRY! His balance breaks!");
      if (Math.abs(f.bossX - this.playerX) < this.engine.W * 0.34) {
        this.damageCyclops(22, "parry", f.bossX - 24, gy - 88, true);
        if (f.phase !== "staggered" && f.phase !== "done") {
          f.phase = "expose";
          f.timer = 1.8;
          this.showQTE();
        }
      }
      return;
    }
    if (f.guardT > 0) {
      Cinematic.performMove("block", this.playerX, gy, this.facing, { engine: this.engine });
      this.audio.sfx("block");
      this.engine.shake(0.7);
      this.playerX = Math.max(this.engine.W * 0.06, this.playerX - 28);
      this.note("Shielded the blow!");
      return;
    }
    if (this.hitPlayer(this.playerX, gy - 40) === "hit") this.damagePlayer();
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
    this.playerHP = 5; HUD.health(5);
    this.playerX = this.engine.W * 0.14;
    f.boulders = [];
    f.bossX = f.baseBossX;
    f.phase = "idle"; f.timer = 1.4;
    this.state = "fight";
  }

  /* ---------------- input ---------------- */

  onPointerDown(x) {
    if (this.state !== "fight") return;
    const mid = this.engine.W / 2;
    this._holdDir = x < mid ? -1 : 1;

    // tapping during expose triggers an immediate sword/uppercut lunge
    const f = this.fight;
    if (f && f.phase === "expose") {
      this.heroMove("uppercut");
    }
  }

  onPointerUp() { this._holdDir = 0; }

  onSwipe(dir) {
    if (this.state !== "fight") return;
    if ((dir === "left" || dir === "right") && this.dash <= 0) {
      this.dodge(dir === "left" ? -1 : 1);
    } else if (dir === "up") {
      this.heroMove("uppercut");
    }
  }

  dodge(dir) {
    const f = this.fight;
    if (this.dash > 0 || !f || f.phase === "done") return;
    this.dash = 0.34;
    this.dashDir = dir;
    Stick.cooldown("btn-dash", 380);
    Cinematic.performMove("dash", this.playerX, this.groundY(), dir, { engine: this.engine });
    this.playerX = clamp(this.playerX + dir * this.engine.W * 0.19, this.engine.W * 0.06, f.bossX - 42);
    this.audio.sfx("footstep");
    this.burst(this.playerX, this.groundY() - 30, PAL.bone, 40, 3);
  }

  /** trigger any Odysseus combat skill cleanly from APK buttons or keyboard */
  heroMove(kind) {
    const f = this.fight;
    if (this.state !== "fight" || !f || f.phase === "done") return;
    const gy = this.groundY();
    const kit = Gear.kit();
    const swordTier = kit.sword.id;
    const dist = Math.abs(f.bossX - this.playerX);

    if (kind === "block") {
      if (f.guardT > 0.35) return;
      f.guardT = 0.72;
      f.parryT = 0.28;
      Stick.cooldown("btn-block", 500);
      Cinematic.performMove("block", this.playerX, gy, this.facing, { swordTier, engine: this.engine });
      this.audio.sfx("block");
      return;
    }

    if (kind === "uppercut") {
      if (f.upperCd > 0) return;
      f.upperCd = 0.75;
      Stick.cooldown("btn-upper", 750);
      // leap toward boss slightly
      this.playerX = clamp(this.playerX + this.facing * 26, this.engine.W * 0.06, f.bossX - 38);
      Cinematic.performMove("uppercut", this.playerX, gy, this.facing, { swordTier, engine: this.engine });
      this.audio.sfx("sword");
      if (dist <= 165) {
        const isEyeShot = f.phase === "expose" || f.phase === "windup" || f.phase === "staggered";
        if (f.phase === "expose") {
          this.strikeEye();
        } else {
          if (f.phase === "windup" && f.pattern === "slam") {
            // uppercut breaks his slam windup!
            f.phase = "expose"; f.timer = 1.4;
            const h = document.getElementById("dodge-hint"); if (h) h.remove();
            this.showQTE();
            this.note("⬆ UPPERCUT BREAKS HIS GUARD — EYE EXPOSED!");
          }
          this.damageCyclops(18 + swordTier * 4, "uppercut", f.bossX - 24, gy - 140, isEyeShot || true);
        }
      }
      return;
    }

    if (kind === "spin") {
      if (f.spinCd > 0) return;
      f.spinCd = 0.85;
      Stick.cooldown("btn-spin", 850);
      Cinematic.performMove("spin", this.playerX, gy, this.facing, { swordTier, engine: this.engine });
      this.audio.sfx("sword");
      // cleave any boulders in whirlwind range!
      for (const b of f.boulders) {
        if (b.warn <= 0 && Math.abs(b.x - this.playerX) < 125) {
          b.y = 1e9;
          PixelVFX.spawn("impacts/hit-flash", b.x, gy - 50, { palette: "hector", scale: 0.9 });
          PixelVFX.spawn("explosions/dirt-explosion", b.x, gy - 30, { palette: "rock", scale: 0.8 });
          this.note("🌀 SPIN SLASH shatters the boulder!");
          this.damageCyclops(12, "spin", f.bossX - 20, gy - 90, false);
        }
      }
      if (dist <= 175) {
        if (f.phase === "expose") this.strikeEye();
        else this.damageCyclops(20 + swordTier * 4, "spin", f.bossX - 20, gy - 85, f.phase === "staggered");
      }
      return;
    }

    if (kind === "spear") {
      if (f.spearCd > 0) return;
      f.spearCd = 0.65;
      Stick.cooldown("btn-spear", 650);
      this.playerX = clamp(this.playerX + this.facing * 24, this.engine.W * 0.06, f.bossX - 42);
      Cinematic.performMove("spear", this.playerX, gy, this.facing, { swordTier, engine: this.engine });
      this.audio.sfx("sword");
      if (dist <= 220) {
        if (f.phase === "charge") {
          f.phase = "expose"; f.timer = 1.6; f.bossX += 40;
          const h = document.getElementById("dodge-hint"); if (h) h.remove();
          this.showQTE();
          this.note("🔱 SPEAR SWEEP halts his charge!");
        }
        if (f.phase === "expose") this.strikeEye();
        else this.damageCyclops(16 + swordTier * 3, "spear", f.bossX - 26, gy - 80, f.phase === "charge");
      }
      return;
    }

    // default: SLASH combo
    if (f.atkCd > 0) return;
    f.atkCd = 0.24;
    const res = Cinematic.performMove("slash", this.playerX, gy, this.facing, { swordTier, engine: this.engine });
    this.audio.sfx("sword");
    this.playerX = clamp(this.playerX + this.facing * 14, this.engine.W * 0.06, f.bossX - 38);
    if (dist <= 155) {
      if (f.phase === "expose") {
        this.strikeEye();
      } else {
        const base = (res && res.big ? 16 : 11) + swordTier * 3;
        this.damageCyclops(base, "slash", f.bossX - 22, gy - 78, res && res.big);
      }
    }
  }

  /** apply damage, hit-flash, floating numbers, combo, and stagger threshold */
  damageCyclops(dmg, source, fxX, fxY, crit = false) {
    const f = this.fight;
    if (!f || f.phase === "done") return;
    const bonus = (f.phase === "staggered" || f.phase === "expose") ? 1.5 : 1;
    const total = Math.round(dmg * bonus);
    f.hp = Math.max(0, f.hp - total);
    f.hitFlash = 0.14;
    f.combo++;
    f.comboT = 1.6;
    Cinematic.impact(fxX, fxY, crit ? PAL.fireBright : PAL.blood, crit, crit ? "fire" : null);
    Cinematic.damageNumber(fxX, fxY - 12, total, crit, f.combo);
    if (crit) PixelVFX.spawn("impacts/hit-flash", fxX, fxY, { palette: "hector", scale: 0.95 });
    PixelVFX.spawn("status/bleeding", fxX, fxY + 12, { palette: "blood", scale: 0.9 });
    this.engine.hitStop(crit ? 0.09 : 0.045);
    this.engine.shake(crit ? 1.15 : 0.55);

    // HP thresholds or 3 staggers trigger dramatic Eye-Burn milestones & final defeat
    const nextThreshold = Math.max(0, f.maxHp * (1 - (f.staggers + 1) / 3));
    if (f.hp <= 0 || (source !== "eye" && f.staggers < 3 && f.hp <= nextThreshold)) {
      this.strikeEye(true);
    } else {
      this.updateBossUI();
    }
  }

  onActionKey(k) {
    if (this.state !== "fight") return;
    if (k === "a" || k === "d") this.dodge(k === "a" ? -1 : 1);
    else if (k === "shift") this.dodge(this.facing || 1);
    else if (k === "u") this.heroMove("uppercut");
    else if (k === "k") this.heroMove("spin");
    else if (k === "l") this.heroMove("spear");
    else if (k === "f") this.heroMove("block");
    else if (k === " " || k === "enter" || k === "j") this.heroMove("slash");
    else if (k === "bow") {
      this.shootBow({ x: this.playerX + this.aimDir * 22, y: this.groundY() - 104, speed: 860 });
    }
  }

  strikeEye(fromDamage = false) {
    const f = this.fight;
    this.hideQTE();
    const h = document.getElementById("dodge-hint");
    if (h) h.remove();
    f.staggers++;
    if (!fromDamage) {
      f.hp = Math.min(f.hp, Math.max(0, Math.round(f.maxHp * (1 - f.staggers / 3))));
    }
    if (f.staggers >= 3) f.hp = 0;
    f.hitFlash = 0.25;
    this.updateBossUI();
    Cinematic.performMove("uppercut", this.playerX, this.groundY(), 1, { swordTier: Gear.kit().sword.id, engine: this.engine });
    PixelVFX.spawn("melee/thrust", f.bossX - 42, this.groundY() - 96, { palette: "fire", scale: 1.25 });
    PixelVFX.spawn("impacts/impact-frame", f.bossX - 24, this.groundY() - 115, { scale: 1.25 });
    Cinematic.impact(f.bossX - 18, this.groundY() - 120, PAL.fireBright, true, "fire");
    Cinematic.damageNumber(f.bossX - 18, this.groundY() - 140, 45, true, f.combo + 1);
    PixelVFX.spawn("status/stunned", f.bossX, this.groundY() - 155, { palette: "apollo", scale: 1.1 });
    if (f.staggers >= 3) {
      PixelVFX.spawn("fire/fire-ring", f.bossX, this.groundY(), { palette: "fire", scale: 1.3 });
      PixelVFX.spawn("fire/flame-pillar", f.bossX, this.groundY(), { palette: "fire", scale: 1.15 });
    }
    this.engine.hitStop(0.16);
    this.audio.sfx("sword");
    this.audio.sfx("roar");
    this.engine.shake(2.2);
    this.burst(f.bossX - 18, this.groundY() - 120, PAL.fireBright, 95, 6);

    if (f.staggers >= 3 || f.hp <= 0) {
      this.victory();
    } else {
      f.phase = "staggered";
      f.timer = 1.9;
      this.note(["🔥 EYE PIERCED — HE KNEELS! UNLEASH COMBOS!", "🔥 THE EYE WEEPS FIRE — PRESS THE ATTACK!", "NOW — DRIVE THE STAKE HOME!"][f.staggers - 1]);
    }
  }

  async victory() {
    this.state = "won";
    this.fight.phase = "done";
    Stick.setCombatMode(false);
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
    PixelVFX.drawLoop(ctx, "fire/campfire", W * 0.22, gy + 4, this.t, { palette: "fire", scale: 0.9 });

    if (this.state === "sneak" || this.state === "story") {
      drawCyclops(ctx, W * 0.8, gy + 14, 1.35, -1, this.t, "idle", this.eye.glow * 0.4);
      drawNameTag(ctx, W * 0.8, gy - 130, "POLYPHEMUS");
    } else {
      const f = this.fight;
      const bx = f ? f.bossX : W * 0.78;
      const pose = f && (f.phase === "windup" ? "windup"
        : f.phase === "swing" ? "swing"
        : f.phase === "charge" ? "charge"
        : f.phase === "staggered" ? "stagger"
        : f.phase === "expose" ? "expose" : "idle");
      const eyeGlow = f && (f.phase === "expose" || f.phase === "windup") ? 0.7 + Math.sin(this.t * 10) * 0.3 : 0;
      drawCyclops(ctx, bx, gy + 14, 1.5, -1, this.t, pose, eyeGlow, {
        hitFlash: f ? f.hitFlash : 0,
        blinded: f && f.staggers >= 2,
      });
      if (f && f.staggers >= 1 && f.phase !== "done") {
        PixelVFX.drawLoop(ctx, "status/burning", bx - 16, gy - 148, this.t, { palette: "fire", scale: 0.72 });
      }
      drawNameTag(ctx, bx, gy - (pose === "stagger" ? 124 : 146), "POLYPHEMUS");
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

    // odysseus (animated with pixelfx-synced pose & dash flicker)
    if (!(this.dash > 0 && Math.floor(this.t * 20) % 2 === 0)) {
      const heroPose = Cinematic.getHeroPose() || (this.fight && this.fight.guardT > 0 ? { shield: true } : null);
      drawOdysseus(ctx, this.playerX, gy, 1.05, this.facing || 1, this.t, this.state === "fight", true, Gear.kit(), heroPose);
      drawNameTag(ctx, this.playerX, gy - 80 + (heroPose ? (heroPose.dy || 0) : 0), "ODYSSEUS");
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
          PixelVFX.drawLoop(ctx, "nature/boulder", b.x, b.y, this.t, { palette: "rock", scale: 0.72 });
        }
      }
    }

    // danger zone telegraph during club slam / charge
    if (this.fight && (this.fight.phase === "windup" || this.fight.phase === "swing") && this.fight.pattern !== "rocks") {
      ctx.save();
      const hitX = this.fight.slamX || clamp(this.fight.bossX - W * 0.22, W * 0.2, W * 0.68);
      ctx.globalAlpha = this.fight.phase === "swing" ? 0.52 : 0.24 + Math.sin(this.t * 16) * 0.12;
      ctx.fillStyle = PAL.blood;
      ctx.beginPath();
      ctx.ellipse(this.fight.pattern === "charge" ? (this.fight.bossX + this.playerX) * 0.5 : hitX, gy - 4, W * 0.16, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.drawBursts(ctx);
  }
}
