/* ============================================================
   ODYSSEY — pixelvfx.js — patch-gg/pixelfx runtime & sheet baker
   Bridges ODYSSEY's responsive Canvas 2D engine with pixelfx's
   dual-buffer (color + additive light) procedural pixel-art VFX:
   - Pooled live buffers for dynamic combat / impact / spell effects
   - Lazy on-demand sprite-sheet grid baking for looping props
     (torches, campfires, braziers, whirlpools, wisps, ghosts)
   - Authentic Greek pottery / Mediterranean color ramps
   ============================================================ */

import { createFrame, clearFrame, createFx, composite } from "./pixelfx/core/index.js";

// ---- Curated pixelfx modules ----
import * as melee_sword_slash from "./pixelfx/fx/melee/sword-slash.js";
import * as melee_double_slash from "./pixelfx/fx/melee/double-slash.js";
import * as melee_heavy_cleave from "./pixelfx/fx/melee/heavy-cleave.js";
import * as melee_thrust from "./pixelfx/fx/melee/thrust.js";
import * as melee_hammer_smash from "./pixelfx/fx/melee/hammer-smash.js";
import * as melee_claw_swipe from "./pixelfx/fx/melee/claw-swipe.js";
import * as melee_spear_sweep from "./pixelfx/fx/melee/spear-sweep.js";
import * as melee_spin_slash from "./pixelfx/fx/melee/spin-slash.js";
import * as melee_uppercut from "./pixelfx/fx/melee/uppercut.js";
import * as melee_dagger_flurry from "./pixelfx/fx/melee/dagger-flurry.js";
import * as melee_scythe_reap from "./pixelfx/fx/melee/scythe-reap.js";
import * as melee_whip_crack from "./pixelfx/fx/melee/whip-crack.js";

import * as impacts_hit_spark from "./pixelfx/fx/impacts/hit-spark.js";
import * as impacts_crit_hit from "./pixelfx/fx/impacts/crit-hit.js";
import * as impacts_blunt_hit from "./pixelfx/fx/impacts/blunt-hit.js";
import * as impacts_shield_block from "./pixelfx/fx/impacts/shield-block.js";
import * as impacts_parry from "./pixelfx/fx/impacts/parry.js";
import * as impacts_ground_slam from "./pixelfx/fx/impacts/ground-slam.js";
import * as impacts_heavy_landing from "./pixelfx/fx/impacts/heavy-landing.js";
import * as impacts_impact_frame from "./pixelfx/fx/impacts/impact-frame.js";
import * as impacts_hit_flash from "./pixelfx/fx/impacts/hit-flash.js";
import * as impacts_ricochet from "./pixelfx/fx/impacts/ricochet.js";

import * as fire_torch from "./pixelfx/fx/fire/torch.js";
import * as fire_campfire from "./pixelfx/fx/fire/campfire.js";
import * as fire_brazier from "./pixelfx/fx/fire/brazier.js";
import * as fire_fireball from "./pixelfx/fx/fire/fireball.js";
import * as fire_flame_pillar from "./pixelfx/fx/fire/flame-pillar.js";
import * as fire_fire_ring from "./pixelfx/fx/fire/fire-ring.js";
import * as fire_spirit_flame from "./pixelfx/fx/fire/spirit-flame.js";

import * as explosions_small_explosion from "./pixelfx/fx/explosions/small-explosion.js";
import * as explosions_dirt_explosion from "./pixelfx/fx/explosions/dirt-explosion.js";
import * as explosions_smoke_bomb from "./pixelfx/fx/explosions/smoke-bomb.js";

import * as water_whirlpool from "./pixelfx/fx/water/whirlpool.js";
import * as water_wave_crash from "./pixelfx/fx/water/wave-crash.js";
import * as water_splash from "./pixelfx/fx/water/splash.js";

import * as lightning_lightning_strike from "./pixelfx/fx/lightning/lightning-strike.js";
import * as lightning_storm_cloud from "./pixelfx/fx/lightning/storm-cloud.js";
import * as lightning_thunderclap from "./pixelfx/fx/lightning/thunderclap.js";
import * as lightning_zap_hit from "./pixelfx/fx/lightning/zap-hit.js";

import * as holy_heal from "./pixelfx/fx/holy/heal.js";
import * as holy_divine_shield from "./pixelfx/fx/holy/divine-shield.js";
import * as holy_blessing from "./pixelfx/fx/holy/blessing.js";
import * as holy_holy_pillar from "./pixelfx/fx/holy/holy-pillar.js";
import * as holy_smite from "./pixelfx/fx/holy/smite.js";
import * as holy_sunburst from "./pixelfx/fx/holy/sunburst.js";
import * as holy_feather_burst from "./pixelfx/fx/holy/feather-burst.js";

import * as arcane_magic_circle_cast from "./pixelfx/fx/arcane/magic-circle-cast.js";
import * as arcane_rune_circle from "./pixelfx/fx/arcane/rune-circle.js";

import * as nature_boulder from "./pixelfx/fx/nature/boulder.js";
import * as nature_quake from "./pixelfx/fx/nature/quake.js";
import * as nature_healing_bloom from "./pixelfx/fx/nature/healing-bloom.js";
import * as nature_tornado from "./pixelfx/fx/nature/tornado.js";

import * as spawn_poof from "./pixelfx/fx/spawn/poof.js";
import * as spawn_soul_rise from "./pixelfx/fx/spawn/soul-rise.js";

import * as pickups_collect_burst from "./pixelfx/fx/pickups/collect-burst.js";
import * as pickups_potion from "./pixelfx/fx/pickups/potion.js";
import * as pickups_loot_beam from "./pixelfx/fx/pickups/loot-beam.js";

import * as critters_ghost from "./pixelfx/fx/critters/ghost.js";
import * as critters_wisp from "./pixelfx/fx/critters/wisp.js";
import * as critters_butterfly from "./pixelfx/fx/critters/butterfly.js";

import * as status_rage from "./pixelfx/fx/status/rage.js";
import * as status_stunned from "./pixelfx/fx/status/stunned.js";
import * as status_burning from "./pixelfx/fx/status/burning.js";
import * as status_bleeding from "./pixelfx/fx/status/bleeding.js";

import * as ui_exclamation from "./pixelfx/fx/ui/exclamation.js";
import * as ui_crit_number from "./pixelfx/fx/ui/crit-number.js";
import * as ui_damage_number from "./pixelfx/fx/ui/damage-number.js";
import * as ui_combo_counter from "./pixelfx/fx/ui/combo-counter.js";
import * as ui_health_bar_hit from "./pixelfx/fx/ui/health-bar-hit.js";

import * as transitions_slash_wipe from "./pixelfx/fx/transitions/slash-wipe.js";

import * as weather_fireflies from "./pixelfx/fx/weather/fireflies.js";
import * as weather_god_rays from "./pixelfx/fx/weather/god-rays.js";

import * as projectiles_arrow from "./pixelfx/fx/projectiles/arrow.js";

import * as moves_sword_combo from "./pixelfx/fx/moves/sword-combo.js";
import * as moves_dash_strike from "./pixelfx/fx/moves/dash-strike.js";
import * as moves_ground_pound from "./pixelfx/fx/moves/ground-pound.js";
import * as moves_arrow_shot from "./pixelfx/fx/moves/arrow-shot.js";

export const FX_MODULES = {
  "melee/sword-slash": melee_sword_slash,
  "melee/double-slash": melee_double_slash,
  "melee/heavy-cleave": melee_heavy_cleave,
  "melee/thrust": melee_thrust,
  "melee/hammer-smash": melee_hammer_smash,
  "melee/claw-swipe": melee_claw_swipe,
  "melee/spear-sweep": melee_spear_sweep,
  "melee/spin-slash": melee_spin_slash,
  "melee/uppercut": melee_uppercut,
  "melee/dagger-flurry": melee_dagger_flurry,
  "melee/scythe-reap": melee_scythe_reap,
  "melee/whip-crack": melee_whip_crack,

  "impacts/hit-spark": impacts_hit_spark,
  "impacts/crit-hit": impacts_crit_hit,
  "impacts/blunt-hit": impacts_blunt_hit,
  "impacts/shield-block": impacts_shield_block,
  "impacts/parry": impacts_parry,
  "impacts/ground-slam": impacts_ground_slam,
  "impacts/heavy-landing": impacts_heavy_landing,
  "impacts/impact-frame": impacts_impact_frame,
  "impacts/hit-flash": impacts_hit_flash,
  "impacts/ricochet": impacts_ricochet,

  "fire/torch": fire_torch,
  "fire/campfire": fire_campfire,
  "fire/brazier": fire_brazier,
  "fire/fireball": fire_fireball,
  "fire/flame-pillar": fire_flame_pillar,
  "fire/fire-ring": fire_fire_ring,
  "fire/spirit-flame": fire_spirit_flame,

  "explosions/small-explosion": explosions_small_explosion,
  "explosions/dirt-explosion": explosions_dirt_explosion,
  "explosions/smoke-bomb": explosions_smoke_bomb,

  "water/whirlpool": water_whirlpool,
  "water/wave-crash": water_wave_crash,
  "water/splash": water_splash,

  "lightning/lightning-strike": lightning_lightning_strike,
  "lightning/storm-cloud": lightning_storm_cloud,
  "lightning/thunderclap": lightning_thunderclap,
  "lightning/zap-hit": lightning_zap_hit,

  "holy/heal": holy_heal,
  "holy/divine-shield": holy_divine_shield,
  "holy/blessing": holy_blessing,
  "holy/holy-pillar": holy_holy_pillar,
  "holy/smite": holy_smite,
  "holy/sunburst": holy_sunburst,
  "holy/feather-burst": holy_feather_burst,

  "arcane/magic-circle-cast": arcane_magic_circle_cast,
  "arcane/rune-circle": arcane_rune_circle,

  "nature/boulder": nature_boulder,
  "nature/quake": nature_quake,
  "nature/healing-bloom": nature_healing_bloom,
  "nature/tornado": nature_tornado,

  "spawn/poof": spawn_poof,
  "spawn/soul-rise": spawn_soul_rise,

  "pickups/collect-burst": pickups_collect_burst,
  "pickups/potion": pickups_potion,
  "pickups/loot-beam": pickups_loot_beam,

  "critters/ghost": critters_ghost,
  "critters/wisp": critters_wisp,
  "critters/butterfly": critters_butterfly,

  "status/rage": status_rage,
  "status/stunned": status_stunned,
  "status/burning": status_burning,
  "status/bleeding": status_bleeding,

  "ui/exclamation": ui_exclamation,
  "ui/crit-number": ui_crit_number,
  "ui/damage-number": ui_damage_number,
  "ui/combo-counter": ui_combo_counter,
  "ui/health-bar-hit": ui_health_bar_hit,

  "transitions/slash-wipe": transitions_slash_wipe,

  "weather/fireflies": weather_fireflies,
  "weather/god-rays": weather_god_rays,

  "projectiles/arrow": projectiles_arrow,

  "moves/sword-combo": moves_sword_combo,
  "moves/dash-strike": moves_dash_strike,
  "moves/ground-pound": moves_ground_pound,
  "moves/arrow-shot": moves_arrow_shot,
};

/** Authentic ODYSSEY Greek pottery & Mediterranean color ramps (dark -> bright) */
export const PALS = {
  bronze:     ["#3a2008", "#744412", "#a86c24", "#c9973f", "#e6c069", "#f7e6ad", "#ffffff"],
  hector:     ["#4a1408", "#8a2210", "#c4421a", "#f27424", "#ffc23d", "#fff3a6", "#ffffff"],
  moly:       ["#1e2e14", "#3d5e24", "#668c3a", "#98ba5a", "#e6e078", "#f7f5c4", "#ffffff"],
  fire:       ["#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
  apollo:     ["#5e3408", "#9c5c12", "#c9973f", "#e6c069", "#f5d882", "#fff4c2", "#ffffff"],
  blood:      ["#2e0808", "#5c1210", "#8e2f25", "#bf4234", "#eb6b56", "#ffbaa8", "#ffffff"],
  underworld: ["#0f1b24", "#1d3d52", "#33607d", "#6297b2", "#9ec7d9", "#cdbfa0", "#ffffff"],
  aegean:     ["#0a151e", "#132938", "#1d3d52", "#33607d", "#5a8da8", "#92bed1", "#cdbfa0", "#ffffff"],
  circe:      ["#241030", "#4d1f66", "#7e3b99", "#b86ad1", "#e6b0f5", "#ffffff"],
  siren:      ["#38101c", "#6e2238", "#a8445c", "#db7a8e", "#f7bcc8", "#ffffff"],
  rock:       ["#1a120a", "#302214", "#4d3822", "#6e5334", "#9e7c52", "#c8a86a", "#ffffff"],
};

const _mobile = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent);
const MAX_ACTIVE = _mobile ? 12 : 22;

// Pool offscreen { frame, canvas, ctx, imgData } surfaces by "W:H"
const _surfacePool = new Map();
function acquireSurface(w, h) {
  const key = w + ":" + h;
  let arr = _surfacePool.get(key);
  if (arr && arr.length) return arr.pop();
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  return {
    key,
    w,
    h,
    canvas,
    ctx,
    imgData: ctx.createImageData(w, h),
    frame: createFrame(w, h, 0, 0),
  };
}
function releaseSurface(surf) {
  let arr = _surfacePool.get(surf.key);
  if (!arr) {
    arr = [];
    _surfacePool.set(surf.key, arr);
  }
  if (arr.length < 10) arr.push(surf);
}

// Pre-baked looping sprite sheets: key -> { canvas, w, h, ox, oy, cols, count, dur, step }
const _sheetCache = new Map();
function getLoopSheet(id, paletteKey, flip, customPalette) {
  const palName = paletteKey || "default";
  const key = `${id}:${palName}:${flip ? 1 : 0}`;
  let s = _sheetCache.get(key);
  if (s) return s;

  const mod = FX_MODULES[id];
  if (!mod) return null;
  const m = mod.meta || {};
  const [w, h] = m.size || [96, 96];
  const [ox, oy] = m.origin || [Math.floor(w / 2), Math.floor(h / 2)];
  const dur = m.duration || 2;
  // Cap baked fps for tight mobile memory footprint & fast one-time bake
  const bakeFps = Math.min(m.fps || 24, _mobile ? 16 : 20);
  const count = Math.max(4, Math.round(dur * bakeFps));
  const step = dur / count;

  const maxCols = Math.max(1, Math.floor(2048 / w));
  const cols = Math.min(count, maxCols);
  const rows = Math.ceil(count / cols);

  const sheet = document.createElement("canvas");
  sheet.width = cols * w;
  sheet.height = rows * h;
  const sctx = sheet.getContext("2d");

  const tmp = acquireSurface(w, h);
  const px = flip ? w - ox : ox;
  const py = oy;
  const pal = customPalette || (paletteKey && PALS[paletteKey]) || undefined;

  const fxOpts = { x: px, y: py, flip: !!flip, seed: 7 };
  if (pal && m.options && "palette" in m.options) fxOpts.palette = pal;

  const inst = createFx(mod, fxOpts);
  for (let i = 0; i < count; i++) {
    clearFrame(tmp.frame);
    inst.draw(tmp.frame);
    composite(tmp.frame, tmp.imgData.data, null, 1);
    tmp.ctx.putImageData(tmp.imgData, 0, 0);
    const col = i % cols;
    const row = (i / cols) | 0;
    sctx.drawImage(tmp.canvas, col * w, row * h);
    inst.update(step);
  }
  releaseSurface(tmp);

  s = { canvas: sheet, w, h, ox: px, oy: py, cols, count, dur, step };
  _sheetCache.set(key, s);
  return s;
}

let _seedSeq = 1;

export const PixelVFX = {
  PALS,
  active: [],

  /** Responsive baseline pixel scale for crisp retro-pottery VFX */
  baseScale(ctx) {
    const H = ctx.canvas.clientHeight || ctx.canvas.height || 520;
    return Math.max(1.5, Math.min(3.1, H / 250));
  },

  /**
   * Spawn a live one-shot (or transient) effect at screen coords (x, y).
   * opts: {
   *   flip, angle, scale, palette ("bronze"|"fire"|hex[]), sparks, light,
   *   layer ("front"|"back"), alpha, seed, engine, hitStopScale
   * }
   */
  spawn(id, x, y, opts = {}) {
    const mod = FX_MODULES[id];
    if (!mod) return null;
    if (this.active.length >= MAX_ACTIVE) {
      const oldest = this.active.shift();
      releaseSurface(oldest.surf);
    }

    const m = mod.meta || {};
    const [w0, h0] = m.size || [96, 96];
    const [ox0, oy0] = m.origin || [Math.floor(w0 / 2), Math.floor(h0 / 2)];
    const flip = !!opts.flip;
    const angle = opts.angle || 0;
    const pad = angle ? Math.ceil(Math.max(w0, h0) * 0.35) : 0;
    const w = w0 + pad * 2;
    const h = h0 + pad * 2;
    const localOx = (flip ? w0 - ox0 : ox0) + pad;
    const localOy = oy0 + pad;

    const fxOpts = {
      x: localOx,
      y: localOy,
      flip,
      angle,
      seed: opts.seed !== undefined ? opts.seed : ((_seedSeq = (_seedSeq * 1664525 + 1013904223) >>> 0) % 997) + 1,
      light: opts.light !== undefined ? opts.light : 1.05,
    };

    const pal = typeof opts.palette === "string" ? PALS[opts.palette] : opts.palette;
    if (pal && m.options && "palette" in m.options) fxOpts.palette = pal;
    if (opts.sparks && m.options && "sparks" in m.options) {
      fxOpts.sparks = typeof opts.sparks === "string" ? PALS[opts.sparks] : opts.sparks;
    }

    // Forward effect-specific options cleanly (e.g. text, value, radius, etc.)
    if (m.options) {
      for (const k of Object.keys(m.options)) {
        if (k !== "palette" && k !== "sparks" && opts[k] !== undefined) fxOpts[k] = opts[k];
      }
    }

    const surf = acquireSurface(w, h);
    const inst = createFx(mod, fxOpts);
    const entry = {
      id,
      mod,
      inst,
      surf,
      x,
      y,
      ox: localOx,
      oy: localOy,
      scale: opts.scale || 1,
      alpha: opts.alpha !== undefined ? opts.alpha : 1,
      layer: opts.layer || "front",
      engine: opts.engine || null,
      hitIdx: 0,
      hits: (opts.autoHits && mod.act && mod.act.hits) ? mod.act.hits : null,
      anchor: opts.anchor || null, // optional () => {x, y}
    };
    this.active.push(entry);
    return entry;
  },

  update(dt) {
    if (!this.active.length) return;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.inst.update(dt);
      if (e.hits && e.hitIdx < e.hits.length) {
        const h = e.hits[e.hitIdx];
        if (e.inst.t >= h.t) {
          e.hitIdx++;
          if (e.engine) {
            if (h.stop) e.engine.hitStop(h.stop * 0.75);
            if (h.amp) e.engine.shake(Math.min(2.2, h.amp * 0.5));
          }
        }
      }
      if (e.inst.done()) {
        releaseSurface(e.surf);
        this.active.splice(i, 1);
      }
    }
  },

  /** Draw active live effects (default "front") */
  draw(ctx, layer = "front") {
    if (!this.active.length) return;
    const baseS = this.baseScale(ctx);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const e of this.active) {
      if (e.layer !== layer) continue;
      if (e.anchor) {
        const pt = e.anchor();
        if (pt) { e.x = pt.x; e.y = pt.y; }
      }
      const f = clearFrame(e.surf.frame);
      e.inst.draw(f);
      composite(f, e.surf.imgData.data, null, 1);
      e.surf.ctx.putImageData(e.surf.imgData, 0, 0);

      const s = baseS * e.scale;
      ctx.globalAlpha = e.alpha;
      ctx.drawImage(
        e.surf.canvas,
        Math.round(e.x - e.ox * s),
        Math.round(e.y - e.oy * s),
        Math.round(e.surf.w * s),
        Math.round(e.surf.h * s)
      );
    }
    ctx.restore();
  },

  /**
   * Draw an animated pre-baked looping sprite effect (zero per-frame sim cost).
   * opts: { scale, palette ("fire"|"aegean"|...), customPalette, flip, alpha }
   */
  drawLoop(ctx, id, x, y, t, opts = {}) {
    const palKey = typeof opts.palette === "string" ? opts.palette : null;
    const sheet = getLoopSheet(id, palKey, !!opts.flip, Array.isArray(opts.palette) ? opts.palette : null);
    if (!sheet) return;

    const tt = ((t % sheet.dur) + sheet.dur) % sheet.dur;
    const idx = Math.floor(tt / sheet.step) % sheet.count;
    const col = idx % sheet.cols;
    const row = (idx / sheet.cols) | 0;

    const s = this.baseScale(ctx) * (opts.scale || 1);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    ctx.drawImage(
      sheet.canvas,
      col * sheet.w,
      row * sheet.h,
      sheet.w,
      sheet.h,
      Math.round(x - sheet.ox * s),
      Math.round(y - sheet.oy * s),
      Math.round(sheet.w * s),
      Math.round(sheet.h * s)
    );
    ctx.restore();
  },

  clear() {
    for (const e of this.active) releaseSurface(e.surf);
    this.active.length = 0;
  },
};

