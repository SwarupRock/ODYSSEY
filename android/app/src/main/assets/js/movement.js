/* ============================================================
   ODYSSEY — movement.js
   Phase 2A: Shared Movement Foundation
   Phase 2B: Vertical Movement & Grounded Jump Physics
   Phase 2C.1: Shared Directional Dodge Foundation

   Modular movement controller supporting:
   - Pixel & normalised coordinate spaces
   - Grounded speed scaling, run multipliers, boundary clamping
   - Vertical physics: GROUNDED / RISING / FALLING states
   - Variable jump height (hold vs. short-hop)
   - 100 ms jump buffer & 100 ms coyote time
   - Simple platform landing model
   - Shared grounded dodge state with smooth displacement and invulnerability
   - Isolated MovementTestScene development harness
   ============================================================ */

import { drawOdysseus, drawGround, drawSky, drawRidge, PAL } from "./art.js";
import { ChapterScene } from "./scenefw.js";
import { Stick } from "./stick.js";
import { HUD } from "./ui.js";

/** Valid movement lifecycle states */
export const MovementState = Object.freeze({
  GROUNDED: "GROUNDED",
  RISING: "RISING",
  FALLING: "FALLING",
  DODGING: "DODGING",
});

/* ============================================================
   MovementController
   Reusable, decoupled movement manager.

   Physics rationale (pixel-space defaults):
   ─────────────────────────────────────────
   baseSpeed  = 240 px/s — a comfortable walk across a 1 920 px
                display in 8 s; matches Prologue feel.
   jumpImpulse= 500 px/s — produces a full-hold apex of ≈83 px
                at 1 500 px/s² gravity (v²/2g ≈ 83 px), which is
                roughly 1.5× the character height. Short-hop (key
                released immediately) cuts velocity by 50 %, giving
                a ≈21 px hop — just enough to clear low hazards.
   gravity    = 1 500 px/s² — snappy fall (~333 ms air time for a
                full jump, 60 fps compatible). Avoids the floaty
                feel of lower gravity values.
   coyoteTime = 0.10 s — standard 6-frame grace period.
   jumpBuffer = 0.10 s — 6-frame look-ahead buffer.
   ============================================================ */
export class MovementController {
  constructor(opts = {}) {
    this.coordMode = opts.coordMode || "pixels"; // "pixels" | "normalized"
    this.baseSpeed = opts.baseSpeed !== undefined ? opts.baseSpeed : (this.coordMode === "pixels" ? 240 : 0.25);
    this.runMultiplier = opts.runMultiplier !== undefined ? opts.runMultiplier : 1.6;
    this.minX = opts.minX !== undefined ? opts.minX : (this.coordMode === "pixels" ? 40 : 0.05);
    this.maxX = opts.maxX !== undefined ? opts.maxX : (this.coordMode === "pixels" ? 800 : 0.95);

    // Capabilities
    this.capabilities = {
      run: opts.capabilities?.run !== undefined ? opts.capabilities.run : true,
      jump: opts.capabilities?.jump !== undefined ? opts.capabilities.jump : true,
      dodge: opts.capabilities?.dodge !== undefined ? opts.capabilities.dodge : false,
    };

    // ── Dodge configuration ──
    this.dodgeDuration = opts.dodgeDuration !== undefined ? opts.dodgeDuration : 0.35;
    this.invulnerabilityDuration = opts.invulnerabilityDuration !== undefined
      ? opts.invulnerabilityDuration : 0.18;
    this.dodgeCooldown = opts.dodgeCooldown !== undefined ? opts.dodgeCooldown : 0.65;
    this.dodgeDistance = opts.dodgeDistance !== undefined ? opts.dodgeDistance : 0.1;
    this.allowAirborneDodge = Boolean(opts.allowAirborneDodge);

    // ── Vertical physics (always pixel-basis regardless of coordMode) ──
    this.jumpImpulse = opts.jumpImpulse !== undefined ? opts.jumpImpulse : 500;  // px/s
    this.gravity = opts.gravity !== undefined ? opts.gravity : 1500; // px/s²
    this.maxJumpHeight = opts.maxJumpHeight !== undefined ? opts.maxJumpHeight : 150; // px (informational cap)

    // Runtime vertical state
    this.verticalVelocity = 0;    // px/s, positive = up
    this.jumpBufferTimer = 0;    // seconds
    this.coyoteTimer = 0;    // seconds
    this.jumpKeyHeld = false;
    this.dodgeTimer = 0;
    this.dodgeCooldownTimer = 0;
    this.invulnerabilityTimer = 0;
    this.dodgeDirection = 0;

    // ── Horizontal state ──
    this.state = MovementState.GROUNDED;
    this.facing = 1;   // 1: right, -1: left
    this.moving = false;
    this.running = false;
    this.currentSpeed = 0;
    this.speedMultiplier = 1;
  }

  // ─────────────────────────────────────────────────────────
  // Horizontal movement
  // ─────────────────────────────────────────────────────────
  /**
   * @param {number} currentX   coord in configured space
   * @param {number} axisX      [-1, 1]
   * @param {number} dt         seconds
   * @param {Object} inputFlags { shiftRun, stickRun, hitStop }
   * @returns {number} clamped X
   */
  updateHorizontal(currentX, axisX, dt, inputFlags = {}) {
    if (!Number.isFinite(currentX) || !Number.isFinite(dt) || dt <= 0) return currentX;

    const dodgeDt = inputFlags.hitStop ? 0 : dt;
    const wasDodging = this.state === MovementState.DODGING;
    const dodgeStep = wasDodging
      ? Math.min(dodgeDt, this.dodgeTimer) / this.dodgeDuration : 0;
    const rawInput = Number.isFinite(axisX) ? Math.max(-1, Math.min(1, axisX)) : 0;
    const hasInput = Math.abs(rawInput) > 0.05;

    this.moving = hasInput && this.state !== MovementState.DODGING;

    if (hasInput && this.state !== MovementState.DODGING) {
      this.facing = rawInput > 0 ? 1 : -1;

      // Run only via explicit Shift key or joystick deflection > 70 %
      // (keyboard axisX always = ±1, so we cannot use magnitude alone)
      const stickRun = Boolean(inputFlags.stickRun);
      const keyRun = Boolean(inputFlags.shiftRun);
      this.running = Boolean(this.capabilities.run && (stickRun || keyRun));
      this.speedMultiplier = this.running ? this.runMultiplier : 1.0;

      this.currentSpeed = this.baseSpeed * this.speedMultiplier;
      currentX += rawInput * this.currentSpeed * dt;
    } else {
      this.running = false;
      this.speedMultiplier = 1.0;
      this.currentSpeed = 0;
    }

    if (wasDodging) {
      currentX += this.dodgeDirection * this.dodgeDistance * dodgeStep;
    }

    this._tickDodge(dodgeDt);
    return Math.max(this.minX, Math.min(this.maxX, currentX));
  }

  /**
   * Start a grounded directional dodge.
   * @param {number|string} direction signed direction or "left"/"right"
   * @returns {boolean} whether the dodge started
   */
  dodge(direction = 0) {
    if (!this.capabilities.dodge ||
        this.state === MovementState.DODGING ||
        this.dodgeCooldownTimer > 0 ||
        (!this.allowAirborneDodge && !this.isGrounded())) {
      return false;
    }

    let dir = typeof direction === "string"
      ? (direction.toLowerCase() === "left" ? -1 : direction.toLowerCase() === "right" ? 1 : 0)
      : Number(direction);
    if (!Number.isFinite(dir) || Math.abs(dir) <= 0.05) dir = this.facing || 1;
    dir = dir < 0 ? -1 : 1;

    this.dodgeDirection = dir;
    this.dodgeTimer = this.dodgeDuration;
    this.dodgeCooldownTimer = this.dodgeCooldown;
    this.invulnerabilityTimer = this.invulnerabilityDuration;
    this.state = MovementState.DODGING;
    this.moving = false;
    this.running = false;
    this.currentSpeed = 0;
    return true;
  }

  _tickDodge(dt) {
    this.dodgeCooldownTimer = Math.max(0, this.dodgeCooldownTimer - dt);
    this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
    if (this.state === MovementState.DODGING) {
      this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
      if (this.dodgeTimer <= 0) {
        this.state = MovementState.GROUNDED;
        this.dodgeDirection = 0;
      }
    }
  }

  setBoundaries(minX, maxX) {
    if (minX !== undefined) this.minX = minX;
    if (maxX !== undefined) this.maxX = maxX;
  }

  // ─────────────────────────────────────────────────────────
  // Vertical movement
  // ─────────────────────────────────────────────────────────
  /**
   * Update vertical offset.
   *
   * groundY is the effective ground level for the current X position
   * (base ground = 0; elevated platform = platform height above 0).
   * Returns the new vertical offset (always >= 0 when grounded).
   *
   * @param {number} currentY    vertical offset in px (0 = on ground)
   * @param {number} groundY     effective ground level (px above base, 0 for base)
   * @param {number} dt          seconds
   * @param {Object} inputFlags  { jumpHeld: boolean } — raw key-down state; controller derives edges internally
   * @returns {number}           new vertical offset
   */
  updateVertical(currentY, groundY, dt, inputFlags = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return currentY;
    groundY = Number.isFinite(groundY) ? groundY : 0;

    // Tick timers
    if (this.coyoteTimer > 0) this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    const wasGrounded = this.state === MovementState.GROUNDED;
    // jumpHeld = raw "is jump key currently down" (continuous)
    // jumpPressed = rising edge (caller may compute it, or we derive from held vs prior held)
    const jumpHeld = Boolean(inputFlags.jumpHeld !== undefined ? inputFlags.jumpHeld : inputFlags.jumpPressed);
    const jumpPressed = jumpHeld && !this.jumpKeyHeld;
    const jumpReleased = !jumpHeld && this.jumpKeyHeld;

    // ── Jump input edge detection ──
    if (jumpPressed) {
      this.jumpKeyHeld = true;
      if (this.capabilities.jump) {
        if (this.state === MovementState.GROUNDED || this.coyoteTimer > 0) {
          this._startJump(groundY);
          this.coyoteTimer = 0;
        } else {
          this.jumpBufferTimer = 0.1; // buffer for 100 ms
        }
      }
    } else if (jumpReleased) {
      this.jumpKeyHeld = false;
      // Variable jump: releasing key early = short hop
      if (this.state === MovementState.RISING && this.verticalVelocity > 0) {
        this.verticalVelocity *= 0.5;
      }
    }

    // ── Gravity integration ──
    if (this.state !== MovementState.GROUNDED && this.state !== MovementState.DODGING) {
      this.verticalVelocity -= this.gravity * dt;
      currentY += this.verticalVelocity * dt;
    }

    // ── Landing ──
    // Only land when FALLING or velocity is zero (never snap down while RISING)
    if (currentY <= groundY && this.state === MovementState.FALLING) {
      currentY = groundY;
      this.verticalVelocity = 0;
      this.state = MovementState.GROUNDED;

      // Consume buffered jump immediately on landing
      if (this.jumpBufferTimer > 0) {
        this.jumpBufferTimer = 0;
        this._startJump(groundY);
      }
    } else if (currentY <= groundY &&
      (this.state === MovementState.GROUNDED || this.state === MovementState.DODGING)) {
      // Stay snapped to ground
      currentY = groundY;
    } else if (currentY > groundY && this.state !== MovementState.DODGING) {
      // In air — maintain correct state
      if (this.state === MovementState.GROUNDED) {
        // Walked off a platform edge
        this.state = MovementState.FALLING;
        this.verticalVelocity = 0;
      }
      this.state = this.verticalVelocity > 0 ? MovementState.RISING : MovementState.FALLING;
    }

    // ── Coyote time — start when we leave ground unintentionally ──
    if (wasGrounded && this.state !== MovementState.GROUNDED && !jumpPressed) {
      this.coyoteTimer = 0.1;
    }

    return currentY;
  }

  /** @private */
  _startJump(groundY = 0) {
    this.verticalVelocity = this.jumpImpulse;
    this.state = MovementState.RISING;
    // Ensure we clear the ground surface to avoid instant re-land
    // (will be corrected by next updateVertical if already above groundY)
  }

  // ─────────────────────────────────────────────────────────
  // Accessors
  // ─────────────────────────────────────────────────────────
  isGrounded() { return this.state === MovementState.GROUNDED; }
  isMoving() { return this.moving; }
  isRunning() { return this.running; }
  isInvulnerable() { return this.invulnerabilityTimer > 0; }
  isDodging() { return this.state === MovementState.DODGING; }
  getDodgeTimer() { return this.dodgeTimer; }
  getDodgeCooldownTimer() { return this.dodgeCooldownTimer; }
  getInvulnerabilityTimer() { return this.invulnerabilityTimer; }

  /** Clear transient dodge state when a scene or input lifecycle is reset. */
  resetDodge() {
    this.dodgeTimer = 0;
    this.dodgeCooldownTimer = 0;
    this.invulnerabilityTimer = 0;
    this.dodgeDirection = 0;
    if (this.state === MovementState.DODGING) this.state = MovementState.GROUNDED;
  }

  getVerticalVelocity() { return this.verticalVelocity; }
  getJumpBufferTimer() { return this.jumpBufferTimer; }
  getCoyoteTimer() { return this.coyoteTimer; }
}

/* ============================================================
   Platform definition (used by MovementTestScene)
   { x1, x2, y, label }
   y is the height above base ground in pixels.
   ============================================================ */
const TEST_PLATFORMS = [
  { x1: 300, x2: 480, y: 90, label: "Ledge A" },
  { x1: 560, x2: 720, y: 55, label: "Ledge B" },
  { x1: 160, x2: 300, y: 120, label: "High Shelf" },
];

/* ============================================================
   Hazard definition (test-only)
   { x1, x2 } — grounded hazard at base level
   ============================================================ */
const TEST_HAZARDS = [
  { x1: 450, x2: 540 },
];

const HAZARD_COOLDOWN = 1.0; // seconds between damage hits

/* ============================================================
   MovementTestScene
   Isolated development-only test harness.
   Launch via:  window.odysseyTestMovement()
   ============================================================ */
export class MovementTestScene extends ChapterScene {

  initState() {
    this.coordMode = "pixels";
    this.playerX = 200;
    this.playerY = 0; // vertical offset above groundLevel (0 = on ground)
    this.groundLevel = 0; // set each frame from canvas height
    this.lastDt = 0;

    // Track key states for jump press/release edge detection
    this._jumpWasPressed = false;

    // Hazard state
    this.hazardContact = false;
    this.hazardCooldown = 0;
    this.damageTaken = 0;

    // Landing flash
    this._landFlash = 0;

    // Note messages
    this._notes = [];

    this._buildController();

    HUD.show();
    HUD.setChapter("Movement Test Lab (Dev) — Phase 2C.1");
    HUD.objective("A/D: Move · Shift: Run · Space: Jump · J: Dodge · T: Mode · ESC: Exit");
    Stick.setInGame(true);
  }

  _buildController() {
    if (this.coordMode === "pixels") {
      this.controller = new MovementController({
        coordMode: "pixels",
        baseSpeed: 240,
        runMultiplier: 1.6,
        minX: 50,
        maxX: (this.engine.W || 800) - 50,
        capabilities: { run: true, jump: true, dodge: true },
        dodgeDistance: 120,
        jumpImpulse: 500,
        gravity: 1500,
      });
    } else {
      this.controller = new MovementController({
        coordMode: "normalized",
        baseSpeed: 0.28,
        runMultiplier: 1.6,
        minX: 0.06,
        maxX: 0.94,
        capabilities: { run: true, jump: true, dodge: true },
        dodgeDistance: 0.12,
        // Vertical physics always pixel-basis; keep same values
        jumpImpulse: 500,
        gravity: 1500,
      });
    }
  }

  toggleCoordMode() {
    const W = this.engine.W;
    if (this.coordMode === "pixels") {
      this.coordMode = "normalized";
      this.playerX = Math.max(0.06, Math.min(0.94, this.playerX / W));
      this._buildController();
      this.note("Switched to NORMALIZED mode");
    } else {
      this.coordMode = "pixels";
      this.playerX = Math.max(50, Math.min(W - 50, this.playerX * W));
      this._buildController();
      this.note("Switched to PIXEL mode");
    }
  }

  note(msg) {
    this._notes.unshift({ text: msg, ttl: 3 });
    if (this._notes.length > 4) this._notes.length = 4;
  }

  onActionKey(k) {
    if (k === "t") this.toggleCoordMode();
    if (k === "j") {
      const direction = this.engine.axisX();
      this.note(this.controller.dodge(direction) ? "Dodge started" : "Dodge unavailable");
    }
  }
  onKey(key) { if (key === "t" || key === "T") this.toggleCoordMode(); }

  /** Resolve the surface relevant to the player's current vertical position. */
  _effectiveGroundY(px, previousY) {
    // px is always pixel X regardless of coordMode
    // A platform only becomes a landing surface after the player reaches its top.
    // This keeps a player below a platform on base ground and permits upward passage.
    for (const p of TEST_PLATFORMS) {
      if (px >= p.x1 && px <= p.x2 && previousY >= p.y) {
        return p.y;
      }
    }
    return 0; // base ground
  }

  tick(dt, timing = {}) {
    this.lastDt = dt;
    this.groundLevel = this.engine.H * 0.78; // screen Y of base ground surface

    const W = this.engine.W;

    // Pixel X for logic (always pixels)
    const pxX = this.coordMode === "pixels" ? this.playerX : this.playerX * W;

    // Dynamic boundary
    if (this.coordMode === "pixels") {
      this.controller.setBoundaries(50, W - 50);
    }

    // ── Horizontal input ──
    const axisX = this.engine.axisX();
    const shiftRun = this.engine.keyDown("Shift");
    const stickRun = Math.hypot(this.engine.stickX, this.engine.stickY) > 0.70;

    this.playerX = this.controller.updateHorizontal(this.playerX, axisX, dt, {
      shiftRun, stickRun, hitStop: timing.hitStop,
    });

    // ── Jump input (raw key state — controller derives edge internally) ──
    const jumpHeld = this.engine.keyDown(" ", "Space");
    this._jumpWasPressed = jumpHeld; // kept for reference

    // ── Effective ground for current column ──
    const newPxX = this.coordMode === "pixels" ? this.playerX : this.playerX * W;
    const effectiveGroundY = this._effectiveGroundY(newPxX, this.playerY);

    // ── Vertical update ──
    const prevState = this.controller.state;
    this.playerY = this.controller.updateVertical(this.playerY, effectiveGroundY, dt, { jumpHeld });

    // Landing flash
    if (prevState !== MovementState.GROUNDED && this.controller.isGrounded()) {
      this._landFlash = 0.3;
      this.note("Landed!");
    }
    if (this._landFlash > 0) this._landFlash = Math.max(0, this._landFlash - dt);

    // ── Hazard collision ──
    this.hazardCooldown = Math.max(0, this.hazardCooldown - dt);
    this.hazardContact = false;
    for (const hz of TEST_HAZARDS) {
      if (newPxX >= hz.x1 && newPxX <= hz.x2 && this.playerY <= 2) {
        this.hazardContact = true;
        if (this.hazardCooldown <= 0 && !this.controller.isInvulnerable()) {
          this.damageTaken++;
          this.hazardCooldown = HAZARD_COOLDOWN;
          this.note(`Hazard hit! (total: ${this.damageTaken})`);
        }
        break;
      }
    }

    // ── Tick note TTLs ──
    this._notes = this._notes.filter(n => {
      n.ttl -= dt;
      return n.ttl > 0;
    });
  }

  draw(ctx) {
    const W = this.engine.W, H = this.engine.H;
    const gy = this.groundLevel; // screen Y of base ground surface

    // ── Sky & ground ──
    drawSky(ctx, "#261a12", "#0d0905", [W * 0.5, H * 0.2, Math.min(W, H) * 0.4]);
    drawRidge(ctx, gy - H * 0.2, H * 0.04, "rgba(42,22,12,0.5)", 4, 140);
    drawGround(ctx, gy, H - gy, "#3d1e0f", "#170c06");

    // ── Platforms ──
    for (const p of TEST_PLATFORMS) {
      const platScreenY = gy - p.y;
      ctx.save();
      ctx.fillStyle = "#5c3217";
      ctx.strokeStyle = PAL.bronze;
      ctx.lineWidth = 2;
      ctx.fillRect(p.x1, platScreenY, p.x2 - p.x1, 10);
      ctx.strokeRect(p.x1, platScreenY, p.x2 - p.x1, 10);
      ctx.font = "9px monospace";
      ctx.fillStyle = PAL.bronze;
      ctx.fillText(p.label, p.x1 + 4, platScreenY - 4);
      ctx.restore();
    }

    // ── Hazards ──
    for (const hz of TEST_HAZARDS) {
      ctx.save();
      ctx.fillStyle = this.hazardContact ? "rgba(255,60,20,0.6)" : "rgba(200,40,10,0.3)";
      ctx.strokeStyle = "#ff3c14";
      ctx.lineWidth = 2;
      ctx.fillRect(hz.x1, gy - 14, hz.x2 - hz.x1, 14);
      ctx.strokeRect(hz.x1, gy - 14, hz.x2 - hz.x1, 14);
      ctx.font = "9px monospace";
      ctx.fillStyle = "#ff9988";
      ctx.fillText("HAZARD", hz.x1 + 4, gy - 2);
      ctx.restore();
    }

    // ── Boundaries (pixel mode only) ──
    ctx.save();
    ctx.strokeStyle = PAL.bronzeBright;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    const minPx = this.coordMode === "pixels" ? this.controller.minX : this.controller.minX * W;
    const maxPx = this.coordMode === "pixels" ? this.controller.maxX : this.controller.maxX * W;
    ctx.beginPath();
    ctx.moveTo(minPx, gy - 90); ctx.lineTo(minPx, gy + 10);
    ctx.moveTo(maxPx, gy - 90); ctx.lineTo(maxPx, gy + 10);
    ctx.stroke();
    ctx.restore();

    // ── Player ──
    const pxX = this.coordMode === "pixels" ? this.playerX : this.playerX * W;
    const renderY = gy - this.playerY; // subtract vertical offset (up = higher on screen)

    // Landing flash tint
    if (this._landFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this._landFlash * 3);
      ctx.fillStyle = "#ffcc44";
      ctx.beginPath();
      ctx.arc(pxX, renderY - 10, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawOdysseus(
      ctx,
      pxX,
      renderY + 26,
      1.05,
      this.controller.facing,
      this.t,
      false,
      this.controller.isMoving()
    );

    // ── Telemetry ──
    this._drawTelemetry(ctx, pxX, renderY);
    this._drawNotes(ctx, W);
  }

  _drawTelemetry(ctx, px, py) {
    ctx.save();
    const boxW = 310, boxH = 220;
    const bx = 16, by = 55;

    ctx.fillStyle = "rgba(14, 9, 5, 0.90)";
    ctx.strokeStyle = PAL.bronze;
    ctx.lineWidth = 1.5;
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.font = "11px monospace";

    const c = this.controller;
    const speedU = this.coordMode === "pixels" ? "px/s" : "ratio/s";
    const posStr = this.coordMode === "pixels"
      ? `${this.playerX.toFixed(1)} px`
      : `${(this.playerX * 100).toFixed(1)} %`;

    const lines = [
      { text: `[MOVEMENT TEST LAB — PHASE 2C.1]`, col: PAL.bronzeBright },
      { text: `Coord Mode   : ${this.coordMode.toUpperCase()}`, col: PAL.bone },
      { text: `Player X     : ${posStr}`, col: PAL.bone },
      { text: `Vertical Y   : ${this.playerY.toFixed(1)} px`, col: PAL.bone },
      { text: `State        : ${c.state}`, col: c.isGrounded() ? "#aaffaa" : "#ffcc88" },
      { text: `Moving       : ${c.isMoving()} (${c.facing > 0 ? "→" : "←"})`, col: PAL.bone },
      { text: `Running      : ${c.isRunning()} (×${c.speedMultiplier.toFixed(1)})`, col: PAL.bone },
      { text: `Speed        : ${c.currentSpeed.toFixed(1)} ${speedU}`, col: PAL.bone },
      { text: `V. Velocity  : ${c.getVerticalVelocity().toFixed(1)} px/s`, col: PAL.bone },
      { text: `Coyote       : ${(c.getCoyoteTimer() * 1000).toFixed(0)} ms`, col: c.getCoyoteTimer() > 0 ? "#88ffcc" : PAL.bone },
      { text: `Jump Buffer  : ${(c.getJumpBufferTimer() * 1000).toFixed(0)} ms`, col: c.getJumpBufferTimer() > 0 ? "#88ffcc" : PAL.bone },
      { text: `Dodge        : ${c.isDodging()} (${(c.getDodgeTimer() * 1000).toFixed(0)} ms)`, col: c.isDodging() ? "#88ffcc" : PAL.bone },
      { text: `Invulnerable : ${c.isInvulnerable()} (${(c.getInvulnerabilityTimer() * 1000).toFixed(0)} ms)`, col: c.isInvulnerable() ? "#88ffcc" : PAL.bone },
      { text: `Dodge CD     : ${(c.getDodgeCooldownTimer() * 1000).toFixed(0)} ms`, col: c.getDodgeCooldownTimer() > 0 ? "#ffcc88" : PAL.bone },
      { text: `Hazard Hit   : ${this.hazardContact} (dmg: ${this.damageTaken})`, col: this.hazardContact ? "#ff7755" : PAL.bone },
      { text: `Delta Time   : ${(this.lastDt * 1000).toFixed(1)} ms`, col: PAL.bone },
    ];

    lines.forEach((l, i) => {
      ctx.fillStyle = l.col;
      ctx.fillText(l.text, bx + 12, by + 20 + i * 15);
    });

    ctx.restore();
  }

  _drawNotes(ctx, W) {
    if (!this._notes.length) return;
    ctx.save();
    ctx.font = "13px monospace";
    this._notes.forEach((n, i) => {
      const alpha = Math.min(1, n.ttl * 2);
      ctx.fillStyle = `rgba(255, 220, 100, ${alpha})`;
      ctx.fillText(n.text, W - 340, 70 + i * 20);
    });
    ctx.restore();
  }

  cleanup() {
    this.controller?.resetDodge();
    HUD.hide();
    Stick.setInGame(false);
  }
}
