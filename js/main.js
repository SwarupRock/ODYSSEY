/* ============================================================
   ODYSSEY — main entry
   Boots the engine, routes screens (title / map / end),
   starts chapters, chains them via startNext().
   ============================================================ */

import { Engine, Save } from "./engine.js";
import { Audio } from "./audio.js";
import { Dialogue, Choices, Fade, HUD, Mech, showChapterCard } from "./ui.js";
import { Gear } from "./gear.js";
import { Stick } from "./stick.js";
import { Fx } from "./fx.js";
import { Voice } from "./voice.js";
import { SWORDS, ARROWS } from "./gear.js";
import { FilmIntro } from "./combat.js";
import { Updater } from "./updater.js";
import { PrologueScene } from "../scenes/prologue.js";
import { Ch1Scene } from "../scenes/ch1_cyclops.js";
import { Ch2Scene } from "../scenes/ch2_winds.js";
import { Ch3Scene } from "../scenes/ch3_circe.js";
import { Ch4Scene } from "../scenes/ch4_underworld.js";
import { Ch5Scene } from "../scenes/ch5_straits.js";
import { Ch6Scene } from "../scenes/ch6_ithaca.js";

const $ = (id) => document.getElementById(id);

const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI"];

export const CHAPTERS = [
  { cls: PrologueScene, kicker: "Prologue", title: "The Fall of Troy", sub: "hubris has a cost", label: "Prologue — Troy" },
  { cls: Ch1Scene, kicker: "Chapter I", title: "Polyphemus's Cave", sub: "the cyclops", label: "Ch. I — The Cyclops" },
  { cls: Ch2Scene, kicker: "Chapter II", title: "The Bag of Winds", sub: "aeolus's gift", label: "Ch. II — The Bag of Winds" },
  { cls: Ch3Scene, kicker: "Chapter III", title: "Circe's Island", sub: "the witch of Aiaia", label: "Ch. III — Circe's Isle" },
  { cls: Ch4Scene, kicker: "Chapter IV", title: "The Underworld", sub: "the nekyia", label: "Ch. IV — The Underworld" },
  { cls: Ch5Scene, kicker: "Chapter V", title: "Sirens, Scylla & Charybdis", sub: "the straits", label: "Ch. V — The Straits" },
  { cls: Ch6Scene, kicker: "Chapter VI", title: "Return to Ithaca", sub: "homecoming", label: "Ch. VI — Ithaca" },
];

const engine = new Engine($("game-canvas"));
let currentIdx = -1;
let currentScene = null;

// touch controls feed the same axes + action router as the keyboard
Stick.init(engine, () => currentScene);

/* ============================================================
   screens
   ============================================================ */

export function showScreen(name) {
  for (const s of document.querySelectorAll(".screen")) s.classList.add("hidden");
  Stick.setInGame(false);
  Fx.setStyle(null); // screens drop the chapter atmosphere
  Fx.clearHero();
  const btnHome = $("btn-home");
  if (btnHome) btnHome.classList.add("hidden");
  if (name) {
    $("screen-" + name).classList.remove("hidden");
    engine.scene = null;
    if (name === "title") renderTitle();
    if (name === "map") renderMap();
  }
}

let film = null; // active cinematic intro player (null = finished/skipped)

export function returnHome() {
  if (film) {
    film = null;
  }
  if (currentScene) {
    currentScene.done = true;
    if (currentScene.cleanup) {
      try { currentScene.cleanup(); } catch (e) { console.warn(e); }
    }
    currentScene = null;
  }
  currentIdx = -1;
  engine.setScene(null);
  Dialogue.hide();
  Choices.hide();
  HUD.hide();
  Mech.hide();
  const chip = $("gear-chip");
  if (chip) chip.remove();
  const cc = $("chapter-card");
  if (cc) cc.classList.add("hidden");
  if (engine.shake) engine.shake(0);
  Fx.setStyle(null);
  Fx.clearHero();

  Audio.stopAmbience();
  Audio.playChapterMusic(6); // homecoming theme on title screen
  Audio.startAmbience("waves");

  Fade.to(0, 300);
  showScreen("title");
}

function renderTitle() {
  const has = Save.data.completed.length > 0 || Save.data.unlocked > 1;
  $("btn-continue").classList.toggle("hidden", !has);
  $("btn-continue").textContent = "Continue — " + chapterName(Math.min(Save.data.unlocked, 6));
  Updater.render();
}

/* ---------------- the Armory — weapons & arrows, 3 tiers each ---------------- */

function renderArmory() {
  const list = $("armory-list");
  list.innerHTML = "";
  const sections = [
    {
      title: "⚔ WEAPONS", items: SWORDS.slice(1), kind: "sword", owned: Save.data.gear.sword | 0,
      cur: Gear.kit().sword.id, icons: ["🗡", "🗡", "🗡"],
    },
    {
      title: "🏹 ARROWS", items: ARROWS, kind: "arrow", owned: Save.data.gear.arrow | 0,
      cur: Gear.kit().arrow.id, icons: ["➶", "🔥", "☀"],
    },
  ];
  const TAGS = ["BASIC", "STRONGER", "BEST"];
  for (const sec of sections) {
    const h = document.createElement("div");
    h.className = "armory-section-title";
    h.textContent = sec.title;
    list.appendChild(h);
    sec.items.forEach((item, i) => {
      const tier = item.id;
      const locked = tier > sec.owned;
      const equipped = tier === sec.cur;
      const b = document.createElement("button");
      b.className = "armory-row" + (locked ? " locked" : "") + (equipped ? " equipped" : "");
      b.innerHTML =
        `<div class="ar-icon">${sec.icons[i]}</div>
         <div><div class="ar-name">${item.name}</div>
         <div class="ar-desc">${item.desc}</div></div>
         <div class="ar-tag">${locked ? "🔒 not yet won" : equipped ? "EQUIPPED" : "EQUIP"}</div>`;
      if (!locked && !equipped) {
        b.addEventListener("click", () => {
          Gear.equip(sec.kind, tier);
          Audio.sfx("reveal");
          renderArmory();
        });
      }
      list.appendChild(b);
    });
  }
}

function chapterName(i) {
  return CHAPTERS[i] ? CHAPTERS[i].title : "";
}

function renderMap() {
  const list = $("map-list");
  list.innerHTML = "";
  CHAPTERS.forEach((ch, i) => {
    const locked = i > Save.data.unlocked;
    const done = Save.data.completed.includes(i);
    const el = document.createElement("button");
    el.className = "map-chapter" + (locked ? " locked" : "");
    el.innerHTML =
      `<div class="mc-num">${locked ? "🔒" : ROMAN[i]}</div>
       <div>
         <div class="mc-name">${ch.kicker} — ${ch.title} ${done ? "✓" : ""}</div>
         <div class="mc-desc">${locked ? "sail earlier shores to unlock" : ch.sub}</div>
       </div>`;
    if (!locked) el.addEventListener("click", () => startChapter(i));
    list.appendChild(el);
  });
}

/* ============================================================
   chapter lifecycle
   ============================================================ */

export async function startChapter(idx) {
  if (Updater.isLocked()) {
    showScreen("title");
    Updater.render();
    return;
  }
  if (idx < 0 || idx >= CHAPTERS.length) return;
  currentIdx = idx;
  showScreen(null); // hide all screens
  const btnHome = $("btn-home");
  if (btnHome) btnHome.classList.remove("hidden");
  Audio.resume();

  // film-style opening: the Trojan Horse, only for a fresh voyage into the prologue
  if (idx === 0 && !Save.data.introSeen) {
    film = new FilmIntro(engine, Audio, () => {
      film = null;
      Save.data.introSeen = true;
      Save.save();
      beginScene();
    });
    engine.setScene(film);
    return;
  }
  beginScene();
}

async function beginScene() {
  const idx = currentIdx;
  currentScene = new CHAPTERS[idx].cls(engine, Audio, {
    idx,
    kicker: CHAPTERS[idx].kicker,
    title: CHAPTERS[idx].title,
    sub: CHAPTERS[idx].sub,
    chapterLabel: CHAPTERS[idx].label,
  });
  engine.setScene(currentScene);
  Stick.setCombatMode(false);
  Stick.refreshBow();
  Stick.setInGame(true);
  await currentScene.begin();
}

export async function startNext() {
  const next = currentIdx + 1;
  if (next < CHAPTERS.length) {
    await Fade.to(1, 500);
    startChapter(next);
  } else {
    showScreen("map");
  }
}

/* ============================================================
   boot
   ============================================================ */

function bindUI() {
  Updater.init((locked) => {
    if (locked && currentIdx >= 0) returnHome();
    Updater.render();
  });

  $("btn-new-game").addEventListener("click", () => {
    if (Updater.isLocked()) return;
    Audio.resume();
    Save.reset();
    startChapter(0);
  });

  $("btn-continue").addEventListener("click", () => {
    if (Updater.isLocked()) return;
    Audio.resume();
    startChapter(Math.min(Save.data.unlocked, 6));
  });

  $("btn-chapters").addEventListener("click", () => {
    if (Updater.isLocked()) return;
    showScreen("map");
  });
  $("btn-map-back").addEventListener("click", () => showScreen("title"));
  if ($("btn-map-back-top")) $("btn-map-back-top").addEventListener("click", () => showScreen("title"));

  $("btn-armory").addEventListener("click", () => { if (Updater.isLocked()) return; showScreen("armory"); renderArmory(); });
  $("btn-armory-back").addEventListener("click", () => showScreen("title"));
  if ($("btn-armory-back-top")) $("btn-armory-back-top").addEventListener("click", () => showScreen("title"));

  $("btn-end-map").addEventListener("click", () => showScreen("map"));
  $("btn-end-again").addEventListener("click", () => {
    Save.reset();
    startChapter(0);
  });

  // home toggle
  const btnHome = $("btn-home");
  if (btnHome) btnHome.addEventListener("click", () => returnHome());

  // audio toggle
  $("btn-audio").addEventListener("click", () => {
    Audio.resume();
    Audio.setMuted(!Audio.muted);
    $("btn-audio").classList.toggle("muted", Audio.muted);
  });

  // voice-over toggle
  Voice.init();
  $("btn-voice").classList.toggle("muted", !Voice.enabled);
  $("btn-voice").addEventListener("click", () => {
    Voice.setEnabled(!Voice.enabled);
    $("btn-voice").classList.toggle("muted", !Voice.enabled);
    if (Voice.enabled) {
      Audio.resume();
      // a word from the hero so the toggle is audible
      Voice.say("ODYSSEUS", "My voice returns to the tale.");
    }
  });

  // dialogue advance: tap the box or the canvas
  $("dialogue").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    Dialogue.advance();
  });
  $("game-canvas").addEventListener("pointerdown", () => {
    if (Dialogue.active) Dialogue.advance();
  });

  /* ---------------- keyboard (WASD + arrows) ---------------- */
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return; // movement keys are polled, not edge-triggered
    const k = e.key.toLowerCase();

    // in-game escape: return to home screen (or exit dev test scene)
    if (k === "escape" && (currentIdx >= 0 || currentScene)) {
      returnHome();
      e.preventDefault();
      return;
    }

    // screens: keyboard-only navigation
    if (currentIdx < 0) {
      const visible = document.querySelector(".screen:not(.hidden)");
      if (visible) {
        if (k === "enter" || k === " ") {
          let target = "btn-map-back";
          if (visible.id === "screen-title") {
            // never wipe a save by accident: prefer Continue when it exists
            target = $("btn-continue") && !$("btn-continue").classList.contains("hidden")
              ? "btn-continue" : "btn-new-game";
          } else if (visible.id === "screen-end") {
            target = "btn-end-map"; // safe default over "Sail Again" (which resets)
          } else if (visible.id === "screen-armory") {
            target = "btn-armory-back";
          }
          const b = $(target);
          if (b && !b.classList.contains("hidden")) b.click();
        }
        if (k === "escape") {
          if (visible.id === "screen-map") $("btn-map-back").click();
          if (visible.id === "screen-armory") $("btn-armory-back").click();
        }
      }
      return;
    }

    // film intro: any key skips
    if (film) {
      film.skip();
      e.preventDefault();
      return;
    }

    // dialogue + choices consume everything
    if (Choices.visible()) {
      if (k === "w" || k === "arrowup") Choices.move(-1);
      else if (k === "s" || k === "arrowdown") Choices.move(1);
      else if (k === "enter" || k === " ") Choices.confirm();
      e.preventDefault();
      return;
    }
    if (Dialogue.active) {
      if (k === "enter" || k === " " || k === "w" || k === "s" || k === "d" || k === "a") {
        Dialogue.advance();
        e.preventDefault();
      }
      return;
    }

    // scene-specific key actions (movement itself is polled via axisX/axisY)
    const sc = currentScene;
    if (!sc) return;
    if (k === "b") { // bow on a key too (B like the touch button)
      if (sc.onActionKey) sc.onActionKey("bow");
      return;
    }
    if (k === "c" || k === "k") {
      if (sc.onActionKey) sc.onActionKey("dodge");
      e.preventDefault();
      return;
    }
    if (sc.onActionKey) { sc.onActionKey(k); return; }
    if (k === " ") { // generic fallback: center-screen tap
      sc.handleTap && sc.handleTap(engine.W / 2, engine.H / 2);
    }
  });

  // first gesture unlocks audio (mobile browsers)
  const unlock = () => {
    Audio.resume();
    if (!Audio._started) {
      Audio._started = true;
      Audio.playChapterMusic(6); // the homecoming theme on the title
      Audio.startAmbience("waves");
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
}

/* boot — any boot failure is surfaced in the console */
try {
  Save.load();
  Gear.load();
  Voice.init();
  engine.resize();
  engine.start();
  bindUI();
  showScreen("title");

  // Development-only test scene launcher for Phase 2A
  window.odysseyTestMovement = async () => {
    try {
      const { MovementTestScene } = await import("./movement.js");
      if (currentScene && currentScene.cleanup) {
        try { currentScene.cleanup(); } catch (e) { console.warn(e); }
      }
      currentIdx = -100; // special non-campaign index
      showScreen(null);
      const btnHome = $("btn-home");
      if (btnHome) btnHome.classList.remove("hidden");
      currentScene = new MovementTestScene(engine, Audio, {
        title: "Movement Test Lab",
        chapterLabel: "Dev Lab",
      });
      engine.setScene(currentScene);
      await currentScene.begin();
      console.log("ODYSSEY: MovementTestScene active. Press ESC or click Home to return.");
    } catch (err) {
      console.error("Failed to launch odysseyTestMovement:", err);
    }
  };
} catch (e) {
  console.error("boot failed", e);
}
