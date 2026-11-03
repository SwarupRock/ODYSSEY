/* ============================================================
   ODYSSEY — Chapter 5: Sirens, Scylla & Charybdis
   Act 1: rhythm track — tap/hold notes in time to resist the
   Sirens' song (fail loops you back a short distance, never to
   chapter start). Act 2: steer through the strait — hold up or
   down to pick a lane between Scylla (rocks, above) and
   Charybdis (whirlpool, below). Six crew are lost to Scylla,
   as fated — the game makes you watch.
   ============================================================ */

import { PAL, drawSky, drawGround, drawWaves, drawShip, drawSiren, drawOdysseus, drawNameTag, drawGulls, drawReflections } from "../js/art.js";
import { ChapterScene, sleep } from "../js/scenefw.js";
import { Fx } from "../js/fx.js";
import { HUD, Mech } from "../js/ui.js";

export class Ch5Scene extends ChapterScene {
  initState() {
    this.audio.startAmbience("waves");
    this.audio.playChapterMusic(5); // strait tension pulse
    this.phase = "brief";
    this.sirensBeaten = 0;
  }

  async intro() {
    await this.say(
      { who: "CIRCE", text: "Two straits ahead. In one, the Sirens — no man has heard their song and kept his ship." },
      { who: "CIRCE", text: "Plug your crew's ears with wax. Have them lash you to the mast, and only the mast. If you beg to be untied, they must tie you tighter." },
      { who: "ODYSSEUS", text: "And the other strait?" },
      { who: "CIRCE", text: "Scylla above. Charybdis below. Sail the middle, and pray the middle is wide enough." }
    );

    await this.say(
      { who: "NARRATOR", text: "The wax went in. The ropes went round. And across the water, a voice like warm honey began to sing your own story back to you." }
    );

    this.phase = "sirens";
    this.setupSirens();
    this.objective("TAP or press <span class=\"kbd\">W</span> on the notes — hold the long ones — stay the course");
  }

  /* ============================================================
     ACT 1 — SIRENS (rhythm)
     ============================================================ */

  setupSirens() {
    this.r = {
      notes: [],
      next: 0.8,
      count: 0,
      total: 18,          // notes per verse
      verse: 0,
      versesNeeded: 2,
      resistance: 100,    // 0 = you leap into the sea
      perfect: 0, good: 0, miss: 0,
      pull: 0.05,         // base drain per second
    };
    Mech.set(`
      <div class="rhythm">
        <div class="rh-track" id="rh-track">
          <div class="rh-hitline"></div>
        </div>
        <div class="rh-healthbar"><div class="rh-healthfill" id="rh-fill"></div></div>
      </div>`);
  }

  spawnNote() {
    const r = this.r;
    const hold = r.count % 7 === 3; // every 7th note is a hold
    const dur = hold ? 0.85 : 0;
    const el = document.createElement("div");
    el.className = "rh-note" + (hold ? " hold" : "");
    el.id = "note-" + r.count;
    document.getElementById("rh-track").appendChild(el);
    r.notes.push({ id: r.count, x: 1.15, hit: false, hold, holdT: 0, done: false, el });
  }

  tickSirens(dt) {
    const r = this.r;

    // spawn
    r.next -= dt;
    if (r.next <= 0 && r.count < r.total) {
      r.next = 0.95 + Math.random() * 0.35;
      this.spawnNote();
      r.count++;
    }

    // move notes; hitline at 22% of track width
    const track = document.getElementById("rh-track");
    const tw = track ? track.clientWidth : 300;
    for (const n of r.notes) {
      if (n.done) continue;
      if (n.hold && n.holding) {
        n.holdT += dt;
        if (n.holdT >= 0.85) { n.done = true; this.judge("perfect", n); n.el.remove(); continue; }
      }
      n.x -= dt * 0.24; // crosses track in ~3.5s
      n.el.style.left = (n.x * tw) + "px";
      // missed?
      if (n.x < 0.16 && !n.hit && !(n.hold && n.holding)) {
        n.done = true;
        this.judge("miss", n);
        n.el.remove();
      }
    }
    r.notes = r.notes.filter((n) => !n.done || n.holding);

    // resistance drain
    r.resistance -= r.pull * dt * (this.sirensBeaten > 0 ? 1.3 : 1);
    const fill = document.getElementById("rh-fill");
    if (fill) {
      fill.style.width = Math.max(0, r.resistance) + "%";
      fill.classList.toggle("low", r.resistance < 35);
    }
    if (r.resistance <= 0) this.sirenFail();
  }

  judge(kind, n) {
    const r = this.r;
    if (kind === "perfect") {
      r.resistance = Math.min(100, r.resistance + 9);
      r.perfect++;
      this.audio.sfx("perfect");
      this.showJudge("PERFECT", "perfect");
    } else if (kind === "good") {
      r.resistance = Math.min(100, r.resistance + 5);
      r.good++;
      this.audio.sfx("success");
      this.showJudge("GOOD", "good");
    } else {
      r.resistance -= 16;
      r.miss++;
      this.audio.sfx("miss");
      this.engine.shake(0.5);
      this.showJudge("THE SONG PULLS", "miss");
    }
  }

  showJudge(text, cls) {
    const track = document.getElementById("rh-track");
    if (!track) return;
    let j = document.getElementById("rh-judgment");
    if (!j) {
      j = document.createElement("div");
      j.id = "rh-judgment";
      j.className = "rh-judgment";
      track.appendChild(j);
    }
    j.textContent = text;
    j.className = "rh-judgment " + cls;
  }  handleTap(x, y) {
    if (this.phase !== "sirens") return;
    this.sirenStrike();
  }

  sirenStrike() {
    if (this.phase !== "sirens" || !this.r) return;
    const r = this.r;
    // find nearest unhit note near hitline
    let best = null, bestD = 1e9;
    for (const n of r.notes) {
      if (n.hit || n.done) continue;
      const d = Math.abs(n.x - 0.22);
      if (d < bestD) { bestD = d; best = n; }
    }
    if (best && bestD < 0.09) {
      best.hit = true;
      if (best.hold) {
        best.holding = true;
        best.el.style.background = PAL.bronzeBright;
      } else {
        best.done = true;
        best.el.remove();
        this.judge(bestD < 0.035 ? "perfect" : "good", best);
      }
    } else {
      // whiffed tap — small penalty
      r.resistance -= 4;
      this.audio.sfx("tap");
    }
  }

  releaseHolds() {
    // releasing a hold-note early: judge by progress
    if (this.phase !== "sirens" || !this.r) return;
    for (const n of this.r.notes) {
      if (n.holding && !n.done) {
        n.holding = false;
        n.done = true;
        n.el.remove();
        this.judge(n.holdT >= 0.5 ? "good" : "miss", n);
      }
    }
  }

  async sirenFail() {
    if (this.phase === "sirenfail") return;
    this.phase = "sirenfail";
    Mech.hide();
    this.audio.sfx("roar");
    await this.say(
      { who: "NARRATOR", text: "Your body strained against the ropes, screaming for the shore, for the song, for the rocks —" },
      { who: "NARRATOR", text: "— and the rowers, deaf to all of it, pulled you back to open water. The verse begins again." }
    );
    // loop back: restart verse, keep chapter progress (no full restart)
    this.phase = "sirens";
    this.setupSirens();
  }

  async sirenVictory() {
    this.phase = "between";
    Mech.hide();
    this.audio.playTheme(76, "dorian", 196);
    await this.say(
      { who: "NARRATOR", text: "The Sirens, furious, sang truer than ever — and you, lashed and bleeding lip, heard every word and stayed." },
      { who: "SIRENS", text: "Odysseus! Stay! We know the end of your tale —" },
      { who: "NARRATOR", text: "But the ship passed, and the song thinned, and the sea turned black under the cliffs ahead." }
    );
    // record best
    const r = this.r;
    await this.finishExtra({ perfect: r.perfect, verse: this.sirensBeaten + 1 });
    this.phase = "strait";
    this.setupStrait();
    this.objective("Steer with <span class=\"kbd\">W</span>/<span class=\"kbd\">S</span> (or tap-hold) — find the gap between rock and whirlpool");
  }

  async finishExtra(extra) {
    const { Save } = await import("../js/engine.js");
    Save.data.best[5] = { ...(Save.data.best[5] || {}), ...extra };
    Save.save();
  }

  /* ============================================================
     ACT 2 — SCYLLA & CHARYBDIS (steering)
     ============================================================ */

  setupStrait() {
    this.s = { laneY: 0.5, scroll: 0, lost: false, obstacles: [], next: 1.2, hits: 0 };
  }

  tickStrait(dt) {
    const s = this.s;
    const kbd = this.engine.axisY();
    if (this._holdSide) s.laneY += this._holdSide * dt * 0.5;
    s.laneY += kbd * dt * 0.45;
    s.laneY = Math.max(0.16, Math.min(0.84, s.laneY));
    s.scroll += dt;

    // obstacles: whirlpools (low, avoid) and rock spurs (high, avoid)
    s.next -= dt;
    if (s.next <= 0) {
      s.next = 1.5 + Math.random() * 1.1;
      const top = Math.random() < 0.5;
      s.obstacles.push({ x: 1.15, top, w: 0.12 + Math.random() * 0.06, hit: false });
    }
    for (const o of s.obstacles) {
      o.x -= dt * 0.24;
      if (!o.hit && Math.abs(o.x - 0.3) < o.w * 0.7) {
        // ship's lane zone: top obstacle hits if laneY < 0.38, bottom if > 0.62
        const inLane = o.top ? s.laneY < 0.42 : s.laneY > 0.58;
        if (inLane) {
          o.hit = true;
          s.hits++;
          this.audio.sfx("crash");
          this.engine.shake(1.5);
          this.note(o.top ? "Scylla's reach! Men scream from the deck!" : "Charybdis sucks at the keel!");
        }
      }
    }
    s.obstacles = s.obstacles.filter((o) => o.x > -0.2);

    // survive 30s of strait
    if (s.scroll > 30) this.straitVictory();
  }

  async straitVictory() {
    this.phase = "done";
    Mech.hide();
    const lost = 6; // fated
    await this.say(
      { who: "NARRATOR", text: "You threaded the middle current. Six times Scylla's necks darted from the cliff — six men lifted, calling your name once each." },
      { who: "NARRATOR", text: "You did not look up. Tiresias had said it plainly: no ship crosses with all hands. The price was counted." },
      { who: "ODYSSEUS", text: "Row. Do not listen. Row." }
    );
    this.audio.sfx("success");
    await this.finish({ hubris: 0, lost });
    const { startNext } = await import("../js/main.js");
    startNext();
  }

  /* ---------------- plumbing ---------------- */

  tick(dt) {
    // atmosphere follows the phase: rose dusk among the sirens,
    // abyss-dark between the monsters
    Fx.setStyle(this.phase === "strait" ? "abyss" : "sirenrose");

    if (this.phase === "sirens") {
      this.tickSirens(dt);
      if (this.r.count >= this.r.total && this.r.notes.every((n) => n.done || !n.el.isConnected)) {
        this.sirensBeaten++;
        if (this.sirensBeaten >= this.r.versesNeeded) this.sirenVictory();
        else {
          this.note("Verse survived. The song changes…");
          this.r.count = 0;
          this.r.next = 1;
          this.r.total = 18 + this.sirensBeaten * 4;
          this.r.resistance = Math.min(100, this.r.resistance + 25);
        }
      }
    }
    if (this.phase === "strait") this.tickStrait(dt);
    this._fl = (this._fl || 0) + dt;
    if (this._fl > 0.3 && this.phase !== "strait") {
      this._fl = 0;
      Fx.spawnEmbers(this.engine.W * 0.86, this.engine.H * 0.42, 2, 8);
    }
  }

  onPointerDown(x, y) {
    if (this.phase === "strait") {
      this._holdSide = y < this.engine.H / 2 ? -1 : 1;
    }
    // taps routed through engine onTap -> handleTap
  }

  /* keyboard: W strikes/holds notes; W/S steer the strait */
  onActionKey(k) {
    if (this.phase === "sirens" && (k === "w" || k === " " || k === "enter")) {
      this.sirenStrike();
    }
  }

  onKeyUp(k) {
    // release a held note early (same judgment as lifting the finger)
    if (k === "w" && this.phase === "sirens" && this.r) {
      this.releaseHolds();
    }
  }

  onPointerUp() {
    this._holdSide = 0;
    this.releaseHolds();
  }

  draw(ctx) {
    const eng = this.engine, W = eng.W, H = eng.H;
    const seaY = H * 0.55;

    if (this.phase === "sirens" || this.phase === "sirenfail" || this.phase === "between") {
      drawSky(ctx, "#4d3a52", "#c98a5a", [W * 0.3, H * 0.2, Math.min(W, H) * 0.3]); // eerie rose dusk
      drawGulls(ctx, W, H, this.t, 4);
      ctx.fillStyle = "#16303f";
      ctx.fillRect(0, seaY, W, H - seaY);
      drawWaves(ctx, seaY + 10, this.t, PAL.aegean, 0.55);
      drawReflections(ctx, seaY, W, H, this.t);

      // siren rocks
      ctx.fillStyle = "#1a1008";
      ctx.beginPath();
      ctx.moveTo(W * 0.78, seaY + 10);
      ctx.lineTo(W * 0.86, seaY - H * 0.34);
      ctx.lineTo(W * 0.96, seaY + 10);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(W * 0.92, seaY + 10);
      ctx.lineTo(W * 0.99, seaY - H * 0.18);
      ctx.lineTo(W * 1.05, seaY + 10);
      ctx.closePath(); ctx.fill();

      // three sirens
      drawSiren(ctx, W * 0.855, seaY - H * 0.3, 1.05, this.t, 0);
      drawSiren(ctx, W * 0.93, seaY - H * 0.16, 0.9, this.t, 2);
      drawSiren(ctx, W * 0.79, seaY - H * 0.2, 0.85, this.t, 4);
      drawNameTag(ctx, W * 0.855, seaY - H * 0.3 - 52 * 1.05, "SIREN");
      drawNameTag(ctx, W * 0.93, seaY - H * 0.16 - 52 * 0.9, "SIREN");
      drawNameTag(ctx, W * 0.79, seaY - H * 0.2 - 52 * 0.85, "SIREN");

      // ship with bound odysseus
      ctx.save();
      ctx.translate(W * 0.32, seaY + H * 0.22);
      drawShip(ctx, 0, 0, 1.05, this.t, true);
      ctx.restore();
      drawOdysseus(ctx, W * 0.32, seaY + H * 0.16, 0.85, 1, this.t, true, false);
      drawNameTag(ctx, W * 0.32, seaY + H * 0.16 - 70, "ODYSSEUS (BOUND)");
    } else {
      // strait — dark cliffs both sides
      drawSky(ctx, "#2c3438", "#10181c");
      ctx.fillStyle = "#16303f";
      ctx.fillRect(0, seaY - H * 0.1, W, H - seaY + H * 0.1);
      const s = this.s || { laneY: 0.5, scroll: 0, obstacles: [] };

      // Scylla's cliff (top)
      ctx.fillStyle = "#1a1008";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let i = 0; i <= 10; i++) {
        ctx.lineTo((i / 10) * W, seaY * 0.42 + Math.sin(i * 2.3 + s.scroll * 0.8) * 14 - 10);
      }
      ctx.lineTo(W, 0); ctx.closePath(); ctx.fill();

      // Charybdis (bottom) — whirlpool ring
      const wx = W * 0.5, wy = H * 0.94;
      for (let k = 0; k < 4; k++) {
        ctx.strokeStyle = `rgba(51,96,125,${0.5 - k * 0.1})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(wx, wy, 30 + k * 22 + Math.sin(this.t * 3 + k) * 5, s.scroll * (1 + k * 0.4), s.scroll * (1 + k * 0.4) + Math.PI * 1.5);
        ctx.stroke();
      }

      // obstacles
      for (const o of s.obstacles) {
        const ox = o.x * W;
        if (o.top) {
          ctx.fillStyle = "#241407";
          ctx.beginPath();
          ctx.moveTo(ox - o.w * W * 0.4, 0);
          ctx.lineTo(ox, seaY * 0.85);
          ctx.lineTo(ox + o.w * W * 0.5, 0);
          ctx.closePath(); ctx.fill();
          // snapping heads when close
          if (Math.abs(o.x - 0.3) < 0.2) {
            ctx.strokeStyle = PAL.blood;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(ox, seaY * 0.85);
            ctx.quadraticCurveTo(ox + 14, seaY * 0.85 + 22, ox - 6, seaY * 0.85 + 40);
            ctx.stroke();
          }
        } else {
          ctx.fillStyle = "rgba(29,61,82,0.9)";
          ctx.beginPath();
          ctx.ellipse(ox, H * 1.02, o.w * W * 0.5, 40, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(140,63,29,0.6)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(ox, H * 1.02, o.w * W * 0.4, 30, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // ship at fixed x, vertical lane
      const sy = s.laneY * H;
      ctx.save();
      ctx.translate(W * 0.3, sy);
      ctx.rotate((s.laneY - 0.5) * 0.4);
      drawShip(ctx, 0, 0, 0.95, this.t, true);
      ctx.restore();

      // crew pips lost counter
      if (s.hits > 0) {
        ctx.fillStyle = PAL.boneDim;
        ctx.font = "12px serif";
        ctx.fillText("Scylla's toll: " + Math.min(6, s.hits), W * 0.04, H * 0.12);
      }
    }

    this.drawBursts(ctx);
  }
}
