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

  init(engine, getActionTarget) {
    this.engine = engine;
    this.getActionTarget = getActionTarget; // () => current scene or null
    if (this.built) return;
    this.built = true;
    this.build();
  },

  build() {
    const wrap = document.createElement("div");
    wrap.id = "touch-controls";
    wrap.innerHTML = `
      <div id="stick-zone">
        <div id="stick-base"><div id="stick-nub"></div></div>
      </div>
      <div id="action-buttons">
        <button id="btn-bow" class="tbtn">🏹</button>
        <button id="btn-act" class="tbtn">ACT</button>
      </div>`;
    document.body.appendChild(wrap);

    // ---- joystick ----
    const zone = document.getElementById("stick-zone");
    const base = document.getElementById("stick-base");
    const nub = document.getElementById("stick-nub");
    let stickId = null;
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
      if (stickId !== null) return;
      stickId = e.pointerId;
      remeasure(); // rect changes (orientation, layout) between touches
      try { zone.setPointerCapture(e.pointerId); } catch { /* synthetic/edge pointers */ }
      this.move(e);
    });
    zone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== stickId) return;
      this.move(e);
    });
    const release = (e) => {
      if (e.pointerId !== stickId) return;
      stickId = null;
      this.engine.stickX = 0;
      this.engine.stickY = 0;
      base.classList.remove("live");
      setNub(0, 0);
    };
    zone.addEventListener("pointerup", release);
    zone.addEventListener("pointercancel", release);

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
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        el.classList.add("pressed");
        const sc = this.getActionTarget();
        if (!sc) return;
        if (sc.onActionKey) sc.onActionKey(key);
        else if (key === " " && sc.handleTap) sc.handleTap();
      });
      const up = () => {
        if (!el.classList.contains("pressed")) return;
        el.classList.remove("pressed");
        const sc = this.getActionTarget();
        if (sc && sc.onKeyUp) sc.onKeyUp(key);
      };
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", up);
    };
    press("btn-act", " ");
    press("btn-bow", "bow");

    // show BOW only when the hero owns one
    this.refreshBow();
  },

  /** hide/show the bow button from gear state (called by main on chapter start) */
  refreshBow() {
    const b = document.getElementById("btn-bow");
    if (!b) return;
    b.classList.toggle("hidden", !Gear.kit().bow.power);
  },

  /** screens want the pad out of the way; scenes want it back */
  setInGame(on) {
    const el = document.getElementById("touch-controls");
    if (el) el.classList.toggle("hidden", !on);
  },
};
