/* ============================================================
   ODYSSEY — Chapter 4: The Underworld (Nekyia)
   Atmospheric walking chapter. Minimal mechanics: hold to walk,
   release to listen. Ghosts of the dead; Tiresias prophecy.
   Dialogue-heavy by design.
   ============================================================ */

import { PAL, drawSky, drawGround, drawRidge, drawGhost, drawTiresias, drawOdysseus, drawMeander, drawNameTag } from "../js/art.js";
import { ChapterScene, sleep } from "../js/scenefw.js";
import { Gear } from "../js/gear.js";
import { HUD, Mech, Choices } from "../js/ui.js";

const GHOST_LINES = [
  { who: "ELPENOR'S SHADE", text: "Captain… my bones lie unbured on Circe's floor. Bury me, and my ghost can rest." },
  { who: "ANTICLEIA'S SHADE", text: "My son. Your mother died of waiting. Not of war — of waiting. Do not let waiting kill what war could not." },
  { who: "AGAMEMNON'S SHADE", text: "I came home a victor. My queen's welcome was a blade in the bath. Trust no floor you cannot see under." },
  { who: "ACHILLES' SHADE", text: "Better a living serf than a king of all the dead. I would trade every verse they sing of me for one gray morning." },
];

// name tags for the shades, in meet order
const GHOST_TAGS = ["ELPENOR", "ANTICLEIA", "AGAMEMNON", "ACHILLES"];

export class Ch4Scene extends ChapterScene {
  initState() {
    this.audio.startAmbience("underworld");
    this.audio.playChapterMusic(4); // mourning drone

    this.progress = 0;         // 0..1 through the asphodel road
    this.met = 0;              // ghosts met
    this.hold = 0;             // walking input
    this.state = "walk";
    this._spoken = new Set();

    Mech.set(`<div class="vitals"><div class="vit-chip" id="uw-hint">hold anywhere — walk</div></div>`);
    HUD.health(-1);
  }

  async intro() {
    await this.say(
      { who: "NARRATOR", text: "No bird sang. No wind moved. The ship beached itself on a shore made of night, and the crew sat down and wept." },
      { who: "CIRCE", text: "Dig the pit. Pour the honey, the wine, the blood. The dead will come to drink — and speak. Guard the pit. Guard it with your life." },
      { who: "ODYSSEUS", text: "And Tiresias?" },
      { who: "CIRCE", text: "He comes last. The true things are said last." }
    );
    this.objective("Walk the road of shades — hold <span class=\"kbd\">D</span> to move; stop for the dead who drink");
  }

  onPointerDown() { this.hold = 1; }
  onPointerUp() { this.hold = 0; }

  tick(dt) {
    if (this.state === "walk") {
      const kbd = this.engine.axisX() > 0 ? 1 : 0;
      const walking = (this.hold || kbd) > 0;
      if (walking) {
        this.progress = Math.min(1, this.progress + dt * 0.035);
        this.stepAcc = (this.stepAcc || 0) + dt;
        if (this.stepAcc > 0.5) { this.stepAcc = 0; this.audio.sfx("footstep"); }
      }

      // ghost encounters at fixed points
      const points = [0.2, 0.4, 0.6, 0.8];
      if (this.met < points.length && this.progress >= points[this.met] - 0.02) {
        this.state = "meet";
        this.hold = 0;
        this.ghostMeet(this.met);
      }

      if (this.progress >= 0.92 && !this._tiresiasCalled) {
        this._tiresiasCalled = true;
        this.state = "tiresias";
        this.tiresiasScene();
      }
    }
  }

  async ghostMeet(i) {
    const line = GHOST_LINES[i];
    await this.say(
      { who: "NARRATOR", text: "A shade broke from the flock of the dead and drank deep of the black blood. Its eyes found yours — eyes that remembered." },
      line
    );
    if (line.who.startsWith("AGAMEMNON")) {
      await this.say(
        { who: "ODYSSEUS", text: "You were the proudest man on the sea. Now look at you." },
        { who: "AGAMEMNON'S SHADE", text: "And you sing the same tune, Odysseus. Sacker of cities. Tamer of monsters. Say it quieter, where the gods cannot count it." }
      );
    }
    this.met++;
    this.state = "walk";
  }

  async tiresiasScene() {
    this.audio.sfx("gate");
    await this.say(
      { who: "NARRATOR", text: "Last of all came the blind prophet, staff in hand, knowing the way without eyes." },
      { who: "TIRESIAS", text: "Odysseus. You want the road home. First hear the price of it." },
      { who: "TIRESIAS", text: "The cattle of the Sun graze ahead of you. Touch one hoof of them — and your ship, your crew, your homecoming burn." },
      { who: "TIRESIAS", text: "You will come home late, alone, on a stranger's boat. Pride already sank nine days of fair wind. Pride will kill the rest." },
      { who: "ODYSSEUS", text: "Then I will hold my tongue, my hands, and my men. I swear it." },
      { who: "TIRESIAS", text: "Swear it again when the Sirens sing. Words are cheap in a warm room. You are not in a warm room, king of Ithaca." }
    );

    // a quiet choice — the theme beat
    Choices.show([
      {
        label: "“I will hide my name from the world.”",
        cb: async () => {
          await this.say(
            { who: "TIRESIAS", text: "A good start. But a name you hide from sailors is not the name that haunts you. That one you must master, not bury." },
            { who: "NARRATOR", text: "The prophet faded into the dark flock, and the road of shades grew quiet." }
          );
          this.endChapter();
        },
      },
      {
        label: "“I will bring my pride home as a trophy.”",
        cb: async () => {
          await this.say(
            { who: "TIRESIAS", text: "Trophies have a way of walking home behind you, armed." },
            { who: "NARRATOR", text: "The words hung in the dark longer than the prophet did." }
          );
          this.hubrisFlag = true;
          this.endChapter();
        },
      },
    ]);
  }

  async endChapter() {
    await this.say(
      { who: "NARRATOR", text: "You rose from the pit with gray in your face. The crew did not ask. The dead's silence followed you up the ladder like a coat." },
      { who: "ODYSSEUS", text: "Rig the mast. We sail past the worst song in the world." }
    );

    // the shade of Achilles surrenders his armor
    const { Gear } = await import("../js/gear.js");
    if (Gear.award("armor", 3)) {
      this.showGearChip();
      this.audio.sfx("reveal");
      await this.say(
        { who: "ACHILLES", text: "I would rather be a living thrall than a crowned king of the dead. Take my armor — it is wasted on a ghost." },
        { who: "NARRATOR", text: "The Armor of Achilles: no cup, no club, no sword bites deep through it." }
      );
    }
    if (Gear.award("sword", 3)) {
      this.showGearChip();
      await this.say(
        { who: "NARRATOR", text: "And from the war's own shadow, the sword of Hector — which once cut the shield you now carry on your back." }
      );
    }
    await this.finish({ hubris: this.hubrisFlag ? 1 : 0 });
    const { startNext } = await import("../js/main.js");
    startNext();
  }

  /** screen anchor of the hero for the rim-light pass */
  heroScreen() {
    return { x: this.engine.W * 0.3, y: this.engine.H * 0.8 - 55, s: 1.05 };
  }

  draw(ctx) {
    const eng = this.engine, W = eng.W, H = eng.H;
    const gy = H * 0.8;
    const scroll = this.progress * W * 2.2;

    // asphodel gloom — muted, NOT literal black (per art direction)
    drawSky(ctx, "#22303c", "#0f1a22");

    // distant dead mountains
    ctx.fillStyle = "rgba(29,61,82,0.5)";
    ctx.beginPath();
    ctx.moveTo(0, gy - H * 0.22);
    ctx.lineTo(W * 0.18, gy - H * 0.36);
    ctx.lineTo(W * 0.36, gy - H * 0.2);
    ctx.lineTo(W * 0.6, gy - H * 0.34);
    ctx.lineTo(W * 0.85, gy - H * 0.22);
    ctx.lineTo(W, gy - H * 0.3);
    ctx.lineTo(W, gy); ctx.lineTo(0, gy);
    ctx.closePath(); ctx.fill();

    drawGround(ctx, gy, H - gy, "#1a2a33", "#0d151b");

    // asphodel flowers (pale ghostly stalks)
    ctx.strokeStyle = "rgba(205,191,160,0.22)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const fx = ((i * 97 - scroll) % (W + 40) + W + 40) % (W + 40) - 20;
      const fh = 16 + ((i * 53) % 20);
      ctx.beginPath(); ctx.moveTo(fx, gy); ctx.lineTo(fx, gy - fh); ctx.stroke();
      ctx.fillStyle = "rgba(205,191,160,0.3)";
      ctx.beginPath(); ctx.arc(fx, gy - fh - 2, 2.2, 0, Math.PI * 2); ctx.fill();
    }

    // the blood pit at start (behind)
    if (this.progress < 0.12) {
      ctx.fillStyle = "#3a1410";
      ctx.beginPath(); ctx.ellipse(W * 0.1, gy + 8, 40, 10, 0, 0, Math.PI * 2); ctx.fill();
    }

    // ghost flock
    for (let i = 0; i < 7; i++) {
      const gx = ((i * 260 + 130 - scroll) % (W + 160) + W + 160) % (W + 160) - 80;
      drawGhost(ctx, gx, gy - 4, 0.9, this.t, i);
    }

    // the ghost currently speaking glows a little brighter
    if (this.state === "meet") {
      drawGhost(ctx, W * 0.68, gy - 4, 1.25, this.t, 99);
      drawNameTag(ctx, W * 0.68, gy - 102, (GHOST_TAGS[this.met] || "SHADE") + "'S SHADE");
    }

    // tiresias appears at the end
    if (this.progress > 0.85 || this.state === "tiresias") {
      drawTiresias(ctx, W * 0.72, gy - 2, 1.2, this.t);
      drawNameTag(ctx, W * 0.72, gy - 92, "TIRESIAS");
    }

    // odysseus walks in place; world scrolls
    drawOdysseus(ctx, W * 0.3, gy, 1.05, 1, this.t, true, this.state === "walk" && this.hold > 0, Gear.kit());
    drawNameTag(ctx, W * 0.3, gy - 88, "ODYSSEUS");

    this.drawBursts(ctx);
  }
}
