/* ============================================================
   ODYSSEY — on-screen touch controls (mobile)
   A virtual joystick (left) + ACT / BOW buttons (right).
   Pure DOM + pointer events; feeds engine.stickX/stickY and the
   same onActionKey router the keyboard uses. Touch-only: the
   whole rig stays display:none on machines with a fine pointer
   (mouse) so desktop play is unchanged.
   ============================================================ */

import { Gear } from "./gear.js";

export const Stick = {
  built: false,
  interactive: false,
  inGame: false,
  bowAllowed: false,
  stickId: null,
  buttonPointers: new Map(),

  init(engine, getActionTarget) {
    this.engine = engine;
    this.getActionTarget = getActionTarget; // () => current scene or null
    if (this.built) return;
    this.built = true;
    this.build();
    window.addEventListener("blur", () => this.reset());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") this.reset();
    });
    window.addEventListener("odyssey-input-reset", () => this.reset());
  },

  build() {
    const wrap = document.createElement("div");
    wrap.id = "touch-controls";
    wrap.innerHTML = `
      <div id="stick-zone">
        <div id="stick-base"><div id="stick-nub"></div></div>
      </div>
      <div id="action-buttons">
        <div class="tbtn-arc">
          <button id="btn-bow" class="tbtn tbtn-sm" title="Bow (B)">🏹<span>BOW</span></button>
          <button id="btn-dodge" class="tbtn tbtn-sm" title="Dodge (C / K)">↔<span>DODGE</span></button>
          <button id="btn-dash" class="tbtn tbtn-sm tbtn-combat" title="Dash (R)">⚡<span>DASH</span></button>
          <button id="btn-block" class="tbtn tbtn-sm tbtn-combat" title="Guard / Parry (F)">🛡<span>PARRY</span></button>
          <button id="btn-spear" class="tbtn tbtn-sm tbtn-combat" title="Spear Sweep (L)">🔱<span>SPEAR</span></button>
          <button id="btn-spin" class="tbtn tbtn-sm tbtn-combat" title="Spin Slash (I)">🌀<span>SPIN</span></button>
          <button id="btn-upper" class="tbtn tbtn-sm tbtn-combat" title="Uppercut (U)">⬆<span>UPPER</span></button>
        </div>
        <button id="btn-act" class="tbtn tbtn-main" title="Slash / Action (Space)">⚔<span>SLASH</span></button>
      </div>`;
    document.body.appendChild(wrap);

    // ---- joystick ----
    const zone = document.getElementById("stick-zone");
    const base = document.getElementById("stick-base");
    const nub = document.getElementById("stick-nub");
    let zoneRect = null;            // cached; re-measured only on down/resize
    const remeasure = () => { zoneRect = zone.getBoundingClientRect(); };
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, { passive: true });
    remeasure();

    const setNub = (dx, dy) => {
      nub.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    zone.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!this.interactive || this.stickId !== null) return;
      this.stickId = e.pointerId;
      remeasure(); // rect changes (orientation, layout) between touches
      try { zone.setPointerCapture(e.pointerId); } catch { /* synthetic/edge pointers */ }
      this.move(e);
    });
    zone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.stickId || !this.interactive) return;
      this.move(e);
    });
    const release = (e) => {
      if (e.pointerId !== this.stickId) return;
      this.releaseStickPointer(e.pointerId);
    };
    zone.addEventListener("pointerup", release);
    zone.addEventListener("pointercancel", release);
    zone.addEventListener("pointerleave", (e) => {
      if (e.pointerId === this.stickId) this.releaseStickPointer(e.pointerId);
    });

    this.releaseStickPointer = (pointerId = this.stickId) => {
      if (pointerId === null || pointerId !== this.stickId) return;
      try {
        if (zone.hasPointerCapture?.(pointerId)) zone.releasePointerCapture(pointerId);
      } catch { /* pointer may already be cancelled */ }
      this.stickId = null;
      this.engine.stickX = 0;
      this.engine.stickY = 0;
      base.classList.remove("live");
      setNub(0, 0);
    };

    this.move = (e) => {
      const r = zoneRect;
      const max = r.width * 0.32;
      if (max <= 0) { remeasure(); return; } // hidden/zero-rect (not a touch device)
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
      // normalized deflection with a 12% deadzone and a quadratic
      // response curve — full speed at ~70% throw, no thumb jitter
      let nx = dx / max, ny = dy / max;
      const mag = Math.hypot(nx, ny);
      const DZ = 0.12;
      if (mag < DZ) { nx = 0; ny = 0; }
      else {
        const shaped = ((mag - DZ) / (1 - DZ)) ** 2;
        nx = (nx / mag) * shaped;
        ny = (ny / mag) * shaped;
      }
      this.engine.stickX = Math.max(-1, Math.min(1, nx));
      this.engine.stickY = Math.max(-1, Math.min(1, ny));
      base.classList.add("live");
      setNub(dx, dy);
    };

    // ---- buttons ----
    const press = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (!this.interactive || this.buttonPointers.has(id)) return;
        if (key === "bow" && !this.canUseBow()) return;
        this.buttonPointers.set(id, { pointerId: e.pointerId, key, scene: this.getActionTarget() });
        el.classList.add("pressed");
        try { if (navigator.vibrate) navigator.vibrate(12); } catch {}
        const sc = this.buttonPointers.get(id).scene;
        if (!sc) return;
        if (sc.onActionKey) sc.onActionKey(key);
        else if (key === " " && sc.handleTap) sc.handleTap();
      });
      const up = (e) => {
        const active = this.buttonPointers.get(id);
        if (!active || (e.pointerId !== undefined && active.pointerId !== e.pointerId)) return;
        this.buttonPointers.delete(id);
        el.classList.remove("pressed");
        try {
          if (el.hasPointerCapture?.(active.pointerId)) el.releasePointerCapture(active.pointerId);
        } catch { /* pointer may already be cancelled */ }
        if (active.scene?.onKeyUp) active.scene.onKeyUp(key);
      };
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", up);
      el.addEventListener("lostpointercapture", up);
    };
    press("btn-act", " ");
    press("btn-bow", "bow");
    press("btn-dodge", "dodge");
    press("btn-upper", "u");
    press("btn-spin", "i");
    press("btn-spear", "l");
    press("btn-block", "f");
    press("btn-dash", "r");

    // scene-owned bow capability and combat cluster are off by default
    this.setCombatMode(false);
    this.setBowAvailable(false);
  },

  /** toggle combat move buttons ("uppercut", "spin", "spear", "parry", "dash") */
  setCombatMode(on) {
    const box = document.getElementById("action-buttons");
    const act = document.getElementById("btn-act");
    if (box) box.classList.toggle("combat-on", !!on);
    if (act) act.innerHTML = on ? "⚔<span>SLASH</span>" : "ACT";
    if (!on) {
      for (const id of ["btn-dash", "btn-block", "btn-spear", "btn-spin", "btn-upper"]) {
        this.releaseButton(id);
      }
    }
  },

  setDodgeVisible(on) {
    const b = document.getElementById("btn-dodge");
    if (b) b.classList.toggle("hidden", !on);
    if (!on) this.releaseButton("btn-dodge");
  },

  /** brief cooldown pulse on an action button */
  cooldown(id, ms = 600) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("cd");
    clearTimeout(el._cdTimer);
    el._cdTimer = setTimeout(() => el.classList.remove("cd"), ms);
  },

  /** Scene-owned bow capability, additionally constrained by equipment. */
  setBowAvailable(on) {
    this.bowAllowed = !!on;
    this.refreshBow();
  },

  canUseBow() {
    return this.inGame && this.interactive && this.bowAllowed && !!Gear.kit().bow.power;
  },

  /** hide/show the bow button from scene capability and gear state */
  refreshBow() {
    const b = document.getElementById("btn-bow");
    if (!b) return;
    b.classList.toggle("hidden", !this.bowAllowed || !Gear.kit().bow.power);
  },

  /** screens want the pad out of the way; scenes want it back */
  setInGame(on) {
    this.inGame = !!on;
    if (!this.inGame) this.bowAllowed = false;
    const el = document.getElementById("touch-controls");
    if (el) el.classList.toggle("hidden", !on);
    this.refreshBow();
    this.setInteractive(this.inGame && !document.body.classList.contains("dlg-open"));
  },

  setInteractive(on) {
    this.interactive = !!on;
    const wrap = document.getElementById("touch-controls");
    if (!wrap) return;
    wrap.setAttribute("aria-disabled", String(!this.interactive));
    wrap.inert = !this.interactive;
    const controls = [document.getElementById("stick-zone"), ...wrap.querySelectorAll("button")];
    for (const control of controls) {
      if (control) control.style.pointerEvents = this.interactive ? "" : "none";
    }
    if (!this.interactive) this.reset();
  },

  releaseButton(id) {
    const active = this.buttonPointers.get(id);
    const el = document.getElementById(id);
    if (!active) {
      el?.classList.remove("pressed");
      return;
    }
    this.buttonPointers.delete(id);
    el?.classList.remove("pressed");
    if (active.scene?.onKeyUp) active.scene.onKeyUp(active.key);
  },

  reset() {
    this.releaseStickPointer?.();
    for (const id of [...this.buttonPointers.keys()]) this.releaseButton(id);
    for (const el of document.querySelectorAll("#touch-controls .pressed")) {
      el.classList.remove("pressed");
    }
    this.engine.stickX = 0;
    this.engine.stickY = 0;
  },
};
