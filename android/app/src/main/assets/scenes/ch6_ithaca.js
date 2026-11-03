/* ============================================================
   ODYSSEY — Chapter 6: Return to Ithaca (Finale)
   Act 1: dodge the Suitors' thrown volleys (hold + swipe).
   Act 2: wave combat — strike with timing as they lunge.
   Act 3: duel with Antinous (QTE-style punish windows).
   Ends with Penelope's bed-test and two endings by hubris.
   ============================================================ */

import { PAL, drawSky, drawGround, drawColumn, drawTorch, drawMeander,
         drawOdysseus, drawSuitor, drawPenelope, drawNameTag, drawBow, drawShield, getGlow } from "../js/art.js";
import { ChapterScene, sleep } from "../js/scenefw.js";
import { HUD, Mech } from "../js/ui.js";
import { Gear } from "../js/gear.js";
import { Fx } from "../js/fx.js";
import { Cinematic } from "../js/combat.js";

export class Ch6Scene extends ChapterScene {
  initState() {
    this.audio.startAmbience("hall");
    this.audio.playChapterMusic(6); // homecoming theme

    this.phase = "arrive";
    this.playerX = 0.2;
    this.facing = 1;
    this.hp = 4;
    this.enemies = [];
    this.volley = [];
    this.wave = 0;
    this.throwers = [true, true, true]; // volley throwers (shootable)

    HUD.health(4);
    this.showGearChip();
  }

  async intro() {
    await this.say(
      { who: "NARRATOR", text: "A stranger in his own hall. A beggar's rags over a fighter's shoulders, watched by a hundred hungry eyes." },
      { who: "NARRATOR", text: "The feast raged. The suitors ate his cattle, drank his wine, and courted his wife in his own house." },
      { who: "ODYSSEUS", text: "Patience, old friend. We have been patient for twenty years. A little longer." }
    );

    await this.say(
      { who: "NARRATOR", text: "Then Penelope brought out the great bow. Twelve axes in a row. And the beggar asked for the bow." },
      { who: "SUITOR", text: "The beggar wants to shoot? Fetch him a stool and let him try!" },
      { who: "NARRATOR", text: "The string sang once." }
    );
    this.audio.sfx("reveal");
    this.engine.shake(1.2);

    await this.say(
      { who: "ODYSSEUS", text: "The contest is over. You have eaten my house for three years. Now the door is barred." },
      { who: "NARRATOR", text: "The doors slammed. The revellers froze mid-cup. Antinous's face went the color of ash." }
    );

    // the Great Bow returns to its master
    if (Gear.award("bow", 2)) {
      this.showGearChip();
      this.audio.sfx("reveal");
      await this.say(
        { who: "NARRATOR", text: "The great bow is yours again — and the quiver that hung beside it in the old armory." },
        { who: "ODYSSEUS", text: "Twelve axes in a row once. Now the arrows find the men themselves." }
      );
    }

    this.phase = "volley";
    this.setupVolley();
    this.objective("Move with <span class=\"kbd\">A</span>/<span class=\"kbd\">D</span> (or hold sides) — <span class=\"kbd\">A</span>/<span class=\"kbd\">D</span> again to dodge the volleys");
  }

  /* ---------------- ACT 1: volley ---------------- */

  setupVolley() {
    this.volleyTimer = 1.2;
    this.volleySurvive = 16; // seconds until the volley falters
    this.setCounter(8);
  }

  setCounter(n) {
    let el = document.getElementById("v6-count");
    if (!el) {
      Mech.set(`<div class="vitals"><div class="vit-chip" id="v6-count"></div></div>`);
      el = document.getElementById("v6-count");
    }
    el.textContent = "Suitors: " + n;
  }

  tickVolley(dt) {
    const W = this.engine.W;
    const kbd = this.engine.axisX();
    this.playerX += ((this._holdDir || 0) + kbd) * dt * 0.3;
    this.playerX = Math.max(0.08, Math.min(0.72, this.playerX));

    this.volleySurvive -= dt;
    if (this.volleySurvive <= 0) {
      this.endVolley();
      return;
    }

    this.volleyTimer -= dt;
    if (this.volleyTimer <= 0) {
      this.volleyTimer = 0.9 + Math.random() * 0.7;
      const slot = Math.floor(Math.random() * 3);
      if (this.throwers[slot]) {
        this.volley.push({ x: 1.05, targetX: this.playerX + (Math.random() - 0.5) * 0.14, y: 0, vy: 0, hit: false });
        this.audio.sfx("wind");
      }
    }

    // counter-snipe the throwers — each one silenced hurries the falter
    const throwerColliders = this.throwers.map((alive, i) =>
      alive ? { x: W * (0.85 + i * 0.05), r: 42, ref: { slot: i } } : null
    ).filter(Boolean);
    this.tickArrows(dt, throwerColliders, (t) => {
      this.throwers[t.slot] = false;
      this.volleySurvive -= 2.5;
      this.burst(W * (0.85 + t.slot * 0.05), this.groundY() - 60, PAL.blood, 55, 4);
      this.note("A thrower drops — the volley falters sooner!");
      return true;
    });

    for (const v of this.volley) {
      v.x -= dt * 0.5;
      v.vy += dt * 0.6;
      v.y += v.vy * dt * 0.35;
      const sx = v.x * W;
      const px = this.playerX * W;
      // a jar shatters when it reaches its aim point — it only hurts if you are still standing there
      if (!v.hit && Math.abs(sx - v.targetX * W) < 26 && Math.abs(px - v.targetX * W) < 26) {
        v.hit = true;
        this.damage();
      }
    }
    this.volley = this.volley.filter((v) => v.x > -0.1 && !v.hit);
  }

  tick(dt) {
    // hearthlight embers drifting up the great hall
    this._fl = (this._fl || 0) + dt;
    if (this._fl > 0.25) {
      this._fl = 0;
      const W = this.engine.W;
      Fx.spawnEmbers(W * (0.17 + Math.random() * 0.66), this.groundY() - this.engine.H * 0.18, 2, 12);
    }
    if (this.phase === "volley") this.tickVolley(dt);
    else if (this.phase === "wave") this.tickWave(dt);
    else if (this.phase === "duel") this.tickDuel(dt);
  }

  endVolley() {
    this.phase = "wave";
    this.audio.sfx("success");
    this.note("The volley falters — they draw steel!");
    this.setupWave(0);
  }

  /* ---------------- ACT 2: waves ---------------- */

  setupWave(n) {
    this.phase = "wave";
    this.enemies = [];
    const count = 2 + n;
    for (let i = 0; i < count; i++) {
      this.enemies.push({
        x: 0.75 + i * 0.16,
        state: "approach",
        t: 0,
        hp: 1,
        speed: 0.05 + Math.random() * 0.02,
      });
    }
    this.setCounter(this.enemies.length);
    this.objective("Strike with <span class=\"kbd\">SPACE</span> when a suitor is close — dodge his lunge with <span class=\"kbd\">A</span>/<span class=\"kbd\">D</span>");
  }

  tickWave(dt) {
    for (const e of this.enemies) {
      if (e.state === "approach") {
        e.x -= e.speed * dt;
        if (Math.abs(e.x - this.playerX) < 0.13) {
          e.state = "windup";
          e.t = 0;
          this.audio.sfx("roar");
        }
      } else if (e.state === "windup") {
        e.t += dt;
        if (e.t > 0.6) { e.state = "strike"; e.t = 0; }
      } else if (e.state === "strike") {
        e.t += dt;
        if (e.t > 0.35) {
          e.state = "approach";
          if (Math.abs(e.x - this.playerX) < 0.12) this.damage();
          e.x += 0.05;
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.setCounter(this.enemies.length);

    // arrows kill suitors at range
    this.tickArrows(dt, this.enemies.map((e) => ({ x: e.x * this.engine.W, r: 36, ref: e })), (e) => {
      e.hp = 0;
      this.burst(e.x * this.engine.W, this.groundY() - 40, PAL.blood, 50, 4);
      return true;
    });

    if (this.enemies.length === 0 && this.phase === "wave") this.nextWave();
  }

  nextWave() {
    this.wave++;
    if (this.wave >= 3) {
      this.startDuel();
      return;
    }
    this.audio.sfx("success");
    this.note("The hall clears — more pour in from the corridors!");
    this.setupWave(this.wave);
  }

  handleTap() {
    if (this.phase === "wave") {
      // the sword matters: better steel = longer reach; Hector's blade cleaves
      const kit = Gear.kit();
      const reach = 0.13 + kit.sword.power * 0.02;
      const inReach = this.enemies.filter((en) => Math.abs(en.x - this.playerX) < reach);
      if (inReach.length) {
        const cleave = kit.sword.power >= 4;
        const sx = this.playerX * this.engine.W, sy = this.groundY() - 52;
        Cinematic.slash(sx + this.facing * 26, sy, this.facing, cleave);
        this.engine.hitStop(cleave ? 0.13 : 0.08);
        for (const e of (cleave ? inReach : [inReach[0]])) {
          e.hp = 0;
          Cinematic.impact(e.x * this.engine.W, this.groundY() - 42, PAL.blood, false);
          this.burst(e.x * this.engine.W, this.groundY() - 40, PAL.blood, 50, 4);
        }
        this.audio.sfx("sword");
        this.engine.shake(0.6);
        if (cleave && inReach.length > 1) this.note("The Sword of Hector cleaves through them!");
      } else {
        this.audio.sfx("tap");
        this.note("Too far — let them come to you.");
      }
    } else if (this.phase === "duel") {
      this.duelStrike();
    }
  }

  /** screen anchor of the hero for the rim-light pass */
  heroScreen() {
    if (this.phase === "end-pan") return null;
    return { x: this.playerX * this.engine.W, y: this.groundY() - 55, s: 1.08 };
  }

  damage() {
    // armor gets its say first (Aegis can turn a cup or a sword entirely)
    if (this.hitPlayer(this.playerX * this.engine.W, this.groundY() - 40) === "blocked") return;
    Fx.hit();
    this.hp--;
    HUD.health(this.hp);
    this.audio.sfx("crash");
    this.engine.shake(1.6);
    this.burst(this.playerX * this.engine.W, this.groundY() - 40, PAL.blood, 60, 5);
    if (this.hp <= 0) this.knockedDown();
  }

  async knockedDown() {
    if (this.state === "down") return;
    this.state = "down";
    Mech.hide();
    await this.say(
      { who: "NARRATOR", text: "A wine cup caught your temple. You went down on one knee in the hall you built — and got up anyway." },
      { who: "ODYSSEUS", text: "I did not crawl from a giant's cave to die under a table." }
    );
    this.hp = 2;
    HUD.health(2);
    if (this.phase === "volley") this.volley = [];
    this.state = "";
  }

  /* ---------------- ACT 3: duel ---------------- */

  startDuel() {
    this.phase = "duel";
    this.duel = { phase: "idle", timer: 1.1, staggers: 0, lungeFrom: 0 };
    Mech.set(`
      <div class="bossbar">
        <div class="bb-name">Antinous — Lead of the Suitors</div>
        <div class="bb-track"><div class="bb-fill" id="bb-fill"></div></div>
        <div class="bb-staggers">
          <div class="bb-stagger-pip" id="sp0"></div>
          <div class="bb-stagger-pip" id="sp1"></div>
          <div class="bb-stagger-pip" id="sp2"></div>
          <div class="bb-stagger-pip" id="sp3"></div>
          <div class="bb-stagger-pip" id="sp4"></div>
        </div>
      </div>`);
    this.objective("Duel — dodge with <span class=\"kbd\">A</span>/<span class=\"kbd\">D</span>, strike with <span class=\"kbd\">SPACE</span> while he recovers");
    this.audio.playDrumLoop(112, 8, "x..x.x..");
  }

  tickDuel(dt) {
    const d = this.duel;
    const kbd = this.engine.axisX();
    this.playerX += ((this._holdDir || 0) + kbd) * dt * 0.28;
    this.playerX = Math.max(0.1, Math.min(0.6, this.playerX));

    const antX = 0.74;
    const dist = antX - this.playerX;

    switch (d.phase) {
      case "idle":
        d.timer -= dt;
        if (d.timer <= 0) {
          d.phase = "lungeWind";
          d.timer = 0.65;
          this.audio.sfx("roar");
        }
        break;
      case "lungeWind":
        d.timer -= dt;
        if (d.timer <= 0) {
          d.phase = "lunge";
          d.timer = 0.22;
          d.lungeFrom = antX;
        }
        break;
      case "lunge":
        d.timer -= dt;
        if (d.timer <= 0) {
          if (dist < 0.3 && !(this.dash > 0)) this.damage();
          d.phase = "recover";
          d.timer = 0.9;
          this.audio.sfx("thud");
        }
        break;
      case "recover":
        d.timer -= dt;
        if (d.timer <= 0) {
          d.phase = "idle";
          d.timer = 1.0;
        }
        break;
      case "staggered":
        d.timer -= dt;
        if (d.timer <= 0) {
          d.phase = "idle";
          d.timer = 0.9;
        }
        break;
    }

    if (this.dash > 0) this.dash -= dt;

    // arrows vs Antinous: a timed shaft during his windup spoils the lunge
    const W = this.engine.W, gy = this.groundY();
    this.tickArrows(dt, [{ x: 0.74 * W, r: 60, ref: d }], () => {
      if (d.phase === "lungeWind") {
        d.phase = "idle";
        d.timer = 0.8;
        this.burst(0.74 * W, gy - 120, PAL.fireBright, 50, 4);
        this.note("Your shaft spoiled his lunge!");
      } else {
        this.burst(0.74 * W, gy - 110, PAL.bronzeBright, 40, 3);
        this.note("His bronze turns it — strike during the recover.");
      }
      return false; // Antinous is no corpse — the arrow is spent either way
    });
  }

  duelStrike() {
    const d = this.duel;
    if (this.phase !== "duel") return;
    if (d.phase === "recover" && Math.abs(0.74 - this.playerX) < 0.22) {
      d.staggers++;
      const pip = document.getElementById("sp" + (d.staggers - 1));
      if (pip) pip.classList.add("on");
      const fill = document.getElementById("bb-fill");
      if (fill) fill.style.width = 100 - (d.staggers / 5) * 100 + "%";
      Cinematic.slash(0.74 * this.engine.W - 30, this.groundY() - 60, 1, true);
      Cinematic.impact(0.74 * this.engine.W, this.groundY() - 52, PAL.bronzeBright, true);
      this.engine.hitStop(0.14);
      this.audio.sfx("sword");
      this.engine.shake(0.8);
      this.burst(0.74 * this.engine.W, this.groundY() - 50, PAL.bronzeBright, 60, 5);
      d.phase = "staggered";
      d.timer = 1.4;
      if (d.staggers >= 5) this.victory();
      else this.note(["He staggers!", "Blood on the marble!", "He swings wide — punish!", "Another blow!", "The last of it!"][d.staggers - 1]);
    } else if (d.phase === "recover") {
      this.note("Closer — step in and strike!");
    }
  }

  onSwipe(dir) {
    if (this.phase === "volley" || this.phase === "wave" || this.phase === "duel") {
      if (dir === "left" || dir === "right") this.dodge(dir === "left" ? -1 : 1);
    }
  }

  dodge(dir) {
    if (this.phase === "volley" || this.phase === "wave" || this.phase === "duel") {
      this.dash = 0.35;
      this.playerX += dir * 0.13;
      this.audio.sfx("footstep");
    }
  }

  onActionKey(k) {
    if (k === "a" || k === "d") this.dodge(k === "a" ? -1 : 1);
    if (k === " " || k === "enter") this.handleTap();
    if (k === "bow") {
      this.shootBow({ x: this.playerX * this.engine.W + this.aimDir * 22, y: this.groundY() - 110, speed: 900 });
    }
  }

  /* ---------------- ending ---------------- */

  async victory() {
    this.phase = "won";
    Mech.hide();
    this.objective(null);
    this.audio.sfx("flare");
    this.audio.playTheme(70, "dorian", 174);
    await this.say(
      { who: "NARRATOR", text: "Antinous fell first, the cup still in his hand. One by one, the hall emptied of the proud." },
      { who: "NARRATOR", text: "Dawn found the king in the fighting gear he had left behind twenty years before." },
      { who: "ODYSSEUS", text: "Twenty years. Ten at war. Ten coming home." }
    );

    // Penelope's test — the bed secret
    await this.say(
      { who: "PENELOPE", text: "If he is my husband, he will know the secret of our bed." },
      { who: "NARRATOR", text: "She ordered the bed moved out of the bedchamber." },
      { who: "ODYSSEUS", text: "Move the bed? Who has cut down my olive tree? I built that bed around a living olive — no man can move it!" },
      { who: "PENELOPE", text: "It was the test. And you passed it. Twenty years, Odysseus. Twenty years." }
    );
    this.audio.sfx("reveal");
    await this.say({ who: "NARRATOR", text: "And then — home." });

    await this.finish({ hubris: 0 });
    const { Save } = await import("../js/engine.js");
    const isProud = Save.data.hubris >= 4;

    if (isProud) {
      await this.say(
        { who: "NARRATOR", text: "But the sea keeps its ledger. Poseidon was not finished with you." },
        { who: "NARRATOR", text: "Take an oar inland, the god said, until a stranger calls it a winnowing fan. Only then may you die soft, in the sea's sight, full of years." },
        { who: "ODYSSEUS", text: "So be it. I have been colder than fear — and I am home." }
      );
      this.showEnd(true);
    } else {
      await this.say(
        { who: "NARRATOR", text: "The sea kept its peace. Perhaps you had finally learned when to stop talking." },
        { who: "ODYSSEUS", text: "The best story is the one you tell sitting down — with your family around you." }
      );
      this.showEnd(false);
    }
  }

  async showEnd(proud) {
    const { Save } = await import("../js/engine.js");
    const save = Save.data;
    HUD.hide();

    document.getElementById("end-art").textContent = proud ? "⚓" : "🏺";
    document.getElementById("end-title").textContent = proud ? "The Winnowing Fan" : "The Quiet Homecoming";
    document.getElementById("end-body").textContent = proud
      ? "Your pride carried you across the wine-dark sea — and home at last, but the god's price hangs over your old age. A legend, paid in full."
      : "You learned to hold your tongue before the gods learned it for you. You ruled long in Ithaca, and the story that crossed the water was a happy one.";

    document.getElementById("end-stats").innerHTML =
      "<span>Chapters cleared: <b>" + save.completed.length + "/7</b></span>" +
      "<span>Hubris: <b>" + save.hubris + "</b></span>" +
      "<span>Sirens — perfect notes: <b>" + ((save.best[5] && save.best[5].perfect) || 0) + "</b></span>";

    const { showScreen } = await import("../js/main.js");
    showScreen("end");
  }

  /* ---------------- draw ---------------- */

  groundY() { return this.engine.H * 0.82; }

  draw(ctx) {
    const eng = this.engine, W = eng.W, H = eng.H;
    const gy = this.groundY();

    // palace hall — firelit interior (cached glow sprite)
    drawSky(ctx, "#2e1c0c", "#170d06");
    const glowR = W * 0.7;
    ctx.drawImage(getGlow("232,140,58", 512, 0.28), W * 0.5 - glowR / 2, gy - H * 0.2 - glowR / 2, glowR, glowR);

    // colonnade
    for (let i = 0; i < 5; i++) {
      drawColumn(ctx, W * (0.06 + i * 0.22), gy, H * 0.5, 1.2);
    }

    // meander frieze along the top
    drawMeander(ctx, 0, H * 0.05, W, 12, PAL.bronze, 0.4);

    drawGround(ctx, gy, H - gy, "#3a2412", "#1a1008");

    // torches
    drawTorch(ctx, W * 0.17, gy - H * 0.18, this.t, 60);
    drawTorch(ctx, W * 0.61, gy - H * 0.18, this.t * 1.07, 60);
    drawTorch(ctx, W * 0.83, gy - H * 0.18, this.t * 0.93, 60);

    if (this.phase === "volley" || this.phase === "wave") {
      // volley throwers at the right edge (shootable — dead ones stop throwing)
      if (this.phase === "volley") {
        for (let i = 0; i < 3; i++) {
          if (!this.throwers[i]) continue;
          drawSuitor(ctx, W * (0.85 + i * 0.05), gy - (i % 2) * 10, 1.0, -1, this.t + i, false, false);
        }
        drawNameTag(ctx, W * 0.9, gy - 86, "SUITORS");
      }
      // enemies
      for (const e of this.enemies) {
        const pose = e.state === "windup" ? 0 : e.state === "strike" ? 1 : 0;
        drawSuitor(ctx, e.x * W, gy, 1.02, -1, this.t + e.x * 7, false, e.state === "approach");
        drawNameTag(ctx, e.x * W, gy - 78, "SUITOR");
      }
      // volley items (cups, thrown)
      for (const v of this.volley) {
        const sx = v.x * W;
        const sy = gy - 80 + v.y * 60;
        ctx.fillStyle = PAL.bronze;
        ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.stroke();
      }
    }

    if (this.phase === "duel" || this.phase === "won") {
      const d = this.duel || { phase: "idle", lungeFrom: 0.74, timer: 0 };
      // Antinous position: lunges toward player visually
      let ax = 0.74;
      if (d.phase === "lunge") ax = 0.74 - (1 - d.timer / 0.22) * 0.18;
      if (d.phase === "recover") ax = 0.62;
      const staggered = d.phase === "staggered";
      ctx.save();
      if (staggered) ctx.rotate(Math.sin(this.t * 20) * 0.04);
      drawSuitor(ctx, ax * W, gy, 1.18, -1, this.t, true, false);
      ctx.restore();
      drawNameTag(ctx, ax * W, gy - 94, "ANTINOUS");
    }

    // player
    if (this.phase !== "end-pan") {
      drawOdysseus(ctx, this.playerX * W, gy, 1.08, 1, this.t, true, true, Gear.kit());
      drawNameTag(ctx, this.playerX * W, gy - 86, "ODYSSEUS");
      // bow arm while loosing, shield of the equipped armor at his side
      if ((this.phase === "volley" || this.phase === "wave" || this.phase === "duel") && this.bowCd > 0.18) {
        drawBow(ctx, this.playerX * W + this.aimDir * 16, gy - 44, this.aimDir, Math.min(1, this.bowCd * 2), this.t);
      }
      if (this.phase !== "won") {
        drawShield(ctx, this.playerX * W - this.aimDir * 15, gy - 42, this.aimDir, Gear.kit().armor.id, this.t);
      }
    }

    this.drawArrows(ctx);

    // Penelope appears at the end
    if (this.phase === "won") {
      drawPenelope(ctx, W * 0.14, gy, 1.0, this.t);
      drawNameTag(ctx, W * 0.14, gy - 104, "PENELOPE");
    }

    this.drawBursts(ctx);
  }
}
