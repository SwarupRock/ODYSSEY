import assert from "node:assert/strict";
import test from "node:test";
import { MovementController } from "../js/movement.js";
import { Ch1Scene } from "../scenes/ch1_cyclops.js";
import { Ch6Scene } from "../scenes/ch6_ithaca.js";
import { Cinematic } from "../js/combat.js";
import { Stick } from "../js/stick.js";

function makeCh6(axisX = 0, shift = false) {
  const scene = Object.create(Ch6Scene.prototype);
  scene.engine = {
    W: 1000,
    axisX: () => axisX,
    keyDown: (key) => key === "Shift" && shift,
  };
  scene.controller = new MovementController({
    coordMode: "normalized",
    baseSpeed: 0.3,
    minX: 0.08,
    maxX: 0.72,
    capabilities: { run: true, jump: false, dodge: true },
    dodgeDistance: 0.13,
  });
  scene.playerX = 0.3;
  scene._holdDir = 0;
  scene.phase = "volley";
  scene.volleySurvive = 10;
  scene.volleyTimer = 10;
  scene.throwers = [false, false, false];
  scene.volley = [];
  scene.enemies = [];
  scene.audio = { sfx() {} };
  scene.setCounter = () => {};
  scene.tickArrows = () => {};
  return scene;
}

test("Chapter VI volley advances once per frame and applies run once", () => {
  const scene = makeCh6(1, false);
  let updates = 0;
  const update = scene.controller.updateHorizontal.bind(scene.controller);
  scene.controller.updateHorizontal = (...args) => {
    updates++;
    return update(...args);
  };

  scene.tickVolley(0.1, { hitStop: false });
  assert.equal(updates, 1);
  assert.ok(Math.abs(scene.playerX - 0.33) < 1e-12);

  scene.engine.keyDown = (key) => key === "Shift";
  scene.tickVolley(0.1, { hitStop: false });
  assert.equal(updates, 2);
  assert.ok(Math.abs(scene.playerX - 0.378) < 1e-12);
});

test("Chapter VI volley retains controller dodge distance, bounds, and hit-stop input", () => {
  const scene = makeCh6();
  const seenFlags = [];
  const update = scene.controller.updateHorizontal.bind(scene.controller);
  scene.controller.updateHorizontal = (x, axis, dt, flags) => {
    seenFlags.push(flags);
    return update(x, axis, dt, flags);
  };
  assert.equal(scene.controller.dodge(1), true);
  scene.tickVolley(0.35, { hitStop: false });
  assert.ok(Math.abs(scene.playerX - 0.43) < 1e-12);
  assert.equal(seenFlags.length, 1);
  scene.playerX = 0.71;
  scene.controller.resetDodge();
  assert.equal(scene.controller.dodge(1), true);
  scene.tickVolley(0.1, { hitStop: true });
  assert.equal(scene.playerX, 0.71, "hit-stop freezes controller dodge progress");
  assert.equal(seenFlags.at(-1).hitStop, true);
  scene.tickVolley(0.35, { hitStop: false });
  assert.equal(scene.playerX, 0.72, "active dodge remains clamped at the arena boundary");
});

function makeCh1(t) {
  const scene = Object.create(Ch1Scene.prototype);
  const W = 1000;
  scene.engine = { W, H: 800, axisX: () => 0, keyDown: () => false };
  scene.controller = new MovementController({
    coordMode: "pixels",
    baseSpeed: 300,
    minX: W * 0.06,
    maxX: W * 0.6,
    capabilities: { run: true, jump: false, dodge: true },
    dodgeDistance: W * 0.2,
  });
  scene.playerX = 200;
  scene.facing = 1;
  scene.state = "fight";
  scene.fight = {
    phase: "staggered", bossX: 700, baseBossX: 700, timer: 10,
    hitFlash: 0, guardT: 0, parryT: 0, atkCd: 0, spinCd: 0,
    upperCd: 0, spearCd: 0, dashCd: 0, comboT: 0, staggers: 0,
    boulders: [],
  };
  scene.controller.setBoundaries(W * 0.06, Math.min(W * 0.72, scene.fight.bossX - 42));
  scene.groundY = () => 640;
  scene.tickArrows = () => {};
  scene.audio = { sfx: (name) => t.sounds.push(name) };
  scene.burst = (...args) => t.bursts.push(args);
  t.sounds = [];
  t.cooldowns = [];
  t.moves = [];
  t.bursts = [];
  t.originalCooldown = Stick.cooldown;
  t.originalPerformMove = Cinematic.performMove;
  Stick.cooldown = (...args) => t.cooldowns.push(args);
  Cinematic.performMove = (...args) => t.moves.push(args);
  t.after(() => {
    Stick.cooldown = t.originalCooldown;
    Cinematic.performMove = t.originalPerformMove;
  });
  return scene;
}

test("Chapter I dodge moves through MovementController once over its duration", (t) => {
  const scene = makeCh1(t);
  const startX = scene.playerX;
  assert.equal(scene.controller.dodgeDistance, 200);
  assert.equal(scene.dodge(1), true);
  assert.equal(scene.playerX, startX, "starting dodge must not move player immediately");
  assert.equal(scene.controller.dodgeCooldownTimer, 0.65);
  assert.equal(scene.controller.invulnerabilityTimer, 0.18);
  assert.equal(t.cooldowns.length, 1);
  assert.deepEqual(t.cooldowns[0], ["btn-dash", 380]);
  assert.equal(t.moves.length, 1);
  assert.deepEqual(t.sounds, ["footstep"]);
  assert.equal(t.bursts[0][0], startX + 200, "dash burst remains at the clamped dodge destination");
  assert.equal(scene.dodge(-1), false, "cooldown rejects a second dodge");

  scene.tickFight(0.175);
  assert.ok(Math.abs(scene.playerX - (startX + 100)) < 1e-9);
  assert.ok(scene.controller.isInvulnerable());
  scene.tickFight(0.175);
  assert.ok(Math.abs(scene.playerX - (startX + 200)) < 1e-9);
  assert.equal(scene.controller.isInvulnerable(), false);
  assert.ok(Math.abs(scene.controller.dodgeCooldownTimer - 0.3) < 1e-12);
  scene.tickFight(0.301);
  assert.equal(scene.controller.dodgeCooldownTimer, 0);
  assert.equal(scene.dodge(-1), true, "dodge becomes available after cooldown expires");
});

test("Chapter I dodge displacement clamps to the boss arena boundary", (t) => {
  const scene = makeCh1(t);
  scene.playerX = 650;
  assert.equal(scene.dodge(1), true);
  assert.equal(scene.playerX, 650, "arena clamp applies during controller updates");
  assert.equal(t.bursts[0][0], 658, "dash burst destination obeys the arena boundary");
  scene.tickFight(0.35);
  assert.equal(scene.playerX, 658);
});
