/* ============================================================
   ODYSSEY — core engine
   Canvas, game loop, touch/mouse/keyboard input, camera,
   save system, chapter registry plumbing.
   ============================================================ */

import { Fx } from "./fx.js";
import { Cinematic } from "./combat.js";

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.W = 0; this.H = 0; this.DPR = 1;

    this.scene = null;              // active scene { update(dt), draw(ctx), onPointerDown/Move/Up, onActionKey/onKeyUp }
    this.running = false;
    this.lastT = 0;
    this.raf = 0;

    // camera (world -> screen)
    this.camera = { x: 0, y: 0, zoom: 1, shake: 0 };

    // input state
    this.pointer = { x: 0, y: 0, down: false, id: null };
    this.dragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.tapHandlers = [];          // tap zones: {x,y,w,h,cb}
    this.keys = new Set();
    this.stickX = 0;                // on-screen joystick (js/stick.js), -1..1
    this.stickY = 0;

    this._bind();
  }

  /* ---------------- sizing ---------------- */
  resize() {
    this.DPR = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.floor(this.W * this.DPR);
    this.canvas.height = Math.floor(this.H * this.DPR);
    this.canvas.style.width = this.W + "px";
    this.canvas.style.height = this.H + "px";
    if (this.camera) this.camera.zoom = Math.min(this.W / 840, this.H / 520);
    Fx.resize(this.W, this.H);
  }

  /* ---------------- loop ---------------- */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();

    const step = (t) => {
      let dt = Math.min((t - this.lastT) / 1000, 0.1);
      this.lastT = t;
      // hit-stop: heavy blows freeze the world for a few frames (combat feel)
      if (this._stop > 0) {
        this._stop -= dt;
        dt = dt * 0.08; // world crawls; FX still read
      }
      if (this.scene && this.scene.update) this.scene.update(dt);
      Fx.update(dt);
      Cinematic.update(dt);
      const ctx = this.ctx;
      ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);
      if (this.scene) {
        Fx.begin(ctx);                       // atmosphere behind the art
        if (this.scene.render) this.scene.render(ctx);
        else if (this.scene.draw) this.scene.draw(ctx);
        Cinematic.draw(ctx);                 // slashes / sparks / trails on top of the world
        Fx.end(ctx, dt);                     // grade / grain / flashes on top
      }
    };
    this._step = step;

    const frame = (t) => {
      this.raf = requestAnimationFrame(frame);
      step(t);
    };
    this.raf = requestAnimationFrame(frame);

    // fallback: when rAF is throttled (hidden tab, some mobile states),
    // keep game time advancing from a wall-clock timer
    this._fallback = setInterval(() => {
      if (performance.now() - this.lastT > 220) step(performance.now());
    }, 33);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    clearInterval(this._fallback);
  }

  setScene(scene) {
    this.scene = scene;
    this.tapHandlers = [];
    this.camera.shake = 0;
    this._stop = 0;
    Cinematic.clear();
  }

  /** hit-stop — freeze frames on heavy hits (seconds, ~0.09 typical) */
  hitStop(sec = 0.09) { this._stop = Math.max(this._stop || 0, sec); }

  addTapZone(x, y, w, h, cb) { this.tapHandlers.push({ x, y, w, h, cb }); }
  clearTapZones() { this.tapHandlers = []; }

  /* ---------------- camera ---------------- */
  shake(amount) { this.camera.shake = Math.max(this.camera.shake, amount); }

  worldToScreen(wx, wy) {
    let sx = (wx - this.camera.x) * this.camera.zoom + this.W / 2;
    let sy = (wy - this.camera.y) * this.camera.zoom + this.H / 2;
    if (this.camera.shake > 0.01) {
      sx += (Math.random() - 0.5) * this.camera.shake * 14;
      sy += (Math.random() - 0.5) * this.camera.shake * 14;
    }
    return { x: sx, y: sy };
  }

  /* ---------------- input ---------------- */
  _bind() {
    const c = this.canvas;

    const pos = (e) => {
      const r = c.getBoundingClientRect();
      const t = e.touches ? e.touches[0] || e.changedTouches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };

    c.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const p = pos(e);
      this.pointer = { ...p, down: true, id: e.pointerId };
      this.dragging = false;
      this.dragStart = { ...p };
      this._downT = performance.now();
      if (this.scene && this.scene.onPointerDown) this.scene.onPointerDown(p.x, p.y);
    });

    c.addEventListener("pointermove", (e) => {
      const p = pos(e);
      this.pointer.x = p.x; this.pointer.y = p.y;
      if (this.pointer.down) {
        const dx = p.x - this.dragStart.x, dy = p.y - this.dragStart.y;
        if (Math.hypot(dx, dy) > 12) this.dragging = true;
        if (this.scene && this.scene.onPointerDrag) this.scene.onPointerDrag(p.x, p.y, dx, dy);
      }
      if (this.scene && this.scene.onPointerMove) this.scene.onPointerMove(p.x, p.y);
    });

    const up = (e) => {
      if (!this.pointer.down) return;
      const p = pos(e);
      this.pointer.down = false;
      const dt = performance.now() - (this._downT || 0);

      // tap zones (screen space)
      if (!this.dragging && dt < 600) {
        for (const z of this.tapHandlers) {
          if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) {
            z.cb();
            break;
          }
        }
        if (this.scene && this.scene.onTap) this.scene.onTap(p.x, p.y);
      }

      // swipe detection
      if (this.dragging && dt < 450) {
        const dx = p.x - this.dragStart.x, dy = p.y - this.dragStart.y;
        const len = Math.hypot(dx, dy);
        if (len > 24) {
          const dir = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? "right" : "left")
            : (dy > 0 ? "down" : "up");
          if (this.scene && this.scene.onSwipe) this.scene.onSwipe(dir, { dx, dy, len });
        }
      }
      this.dragging = false;
      if (this.scene && this.scene.onPointerUp) this.scene.onPointerUp(p.x, p.y);
    };

    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", () => { this.pointer.down = false; this.dragging = false; });

    window.addEventListener("keydown", (e) => {
      this.keys.add(e.key);
      if (e.repeat) return;
      if (this.scene && this.scene.onKey) this.scene.onKey(e.key);
      if (this.scene && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.key);
      if (this.scene && this.scene.onKeyUp) this.scene.onKeyUp(e.key.toLowerCase());
    });

    window.addEventListener("resize", () => this.resize());
  }

  keyDown(...names) { return names.some((n) => this.keys.has(n)); }

  /* continuous movement axes: joystick + WASD + arrow keys → -1..1 */
  axisX() {
    const s = Number.isFinite(this.stickX) ? Math.max(-1, Math.min(1, this.stickX)) : 0;
    return Math.max(-1, Math.min(1, s
      + (this.keyDown("ArrowRight", "d", "D") ? 1 : 0)
      - (this.keyDown("ArrowLeft", "a", "A") ? 1 : 0)));
  }
  axisY() {
    const s = Number.isFinite(this.stickY) ? Math.max(-1, Math.min(1, this.stickY)) : 0;
    return Math.max(-1, Math.min(1, s
      + (this.keyDown("ArrowDown", "s", "S") ? 1 : 0)
      - (this.keyDown("ArrowUp", "w", "W") ? 1 : 0)));
  }
}

/* ============================================================
   SAVE SYSTEM — localStorage, keyed progress
   ============================================================ */
const SAVE_KEY = "odyssey-save-v1";

export const Save = {
  data: {
    unlocked: 1,        // highest chapter index available (1-based; 0 = prologue)
    hubris: 0,          // accumulated hubris points
    completed: [],      // chapter indices finished
    best: {},           // per-chapter stats (e.g. perfect rhythm)
  },

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch { /* private mode etc. */ }
    return this.data;
  },

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch {}
  },

  reset() {
    this.data = { unlocked: 1, hubris: 0, completed: [], best: {} };
    this.save();
  },

  completeChapter(idx, extra = {}) {
    if (!this.data.completed.includes(idx)) this.data.completed.push(idx);
    this.data.unlocked = Math.max(this.data.unlocked, idx + 1);
    this.data.best[idx] = { ...(this.data.best[idx] || {}), ...extra };
    this.save();
  },

  addHubris(n) {
    this.data.hubris = Math.max(0, this.data.hubris + n);
    this.save();
  },
};

/* roundRect polyfill for older WebViews */
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(typeof r === "number" ? r : 4, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    return this;
  };
}
