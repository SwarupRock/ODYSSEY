/* ============================================================
   ODYSSEY — art library
   All visuals are code-drawn (canvas 2D) in a red-figure /
   black-figure pottery style: terracotta ground, near-black
   figures with bronze/bone detail lines, strong silhouettes.
   No image assets required.
   ============================================================ */

export const PAL = {
  terra: "#b45a32",
  terraDeep: "#8c3f1d",
  terraDark: "#5e2c13",
  terraBlack: "#1a1008",
  ink: "#21160b",
  aegean: "#33607d",
  aegeanDeep: "#1d3d52",
  olive: "#7a7f46",
  bronze: "#c9973f",
  bronzeBright: "#e6c069",
  bone: "#ecdfc3",
  boneDim: "#cdbfa0",
  blood: "#8e2f25",
  sand: "#c8a86a",
  fire: "#e88c3a",
  fireBright: "#f5c56b",
};

/* ============================================================
   PRIMITIVES
   ============================================================ */

/** background wash: sky gradient + sun disc */
/* gradient cache — createLinearGradient is real per-frame work on
   mid phones; skies/grounds never change, so build once, reuse */
const _lgCache = new Map();
function _lg(ctx, key, x0, y0, x1, y1, c0, c1) {
  let g = _lgCache.get(key);
  if (!g) {
    g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    _lgCache.set(key, g);
  }
  return g;
}

/* cached radial glow sprite — firelight pools etc. Cost per frame:
   one drawImage instead of building a full-screen gradient. */
const _glowCache = new Map();
export function getGlow(rgb, size = 512, alpha = 0.5) {
  const key = `${rgb}:${size}:${alpha}`;
  let c = _glowCache.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    grd.addColorStop(0, `rgba(${rgb},${alpha})`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    _glowCache.set(key, c);
  }
  return c;
}

export function drawSky(ctx, top, bottom, sun = null) {
  const H = ctx.canvas.height, W = ctx.canvas.width;
  ctx.fillStyle = _lg(ctx, `sky:${top}:${bottom}:${H}`, 0, 0, 0, H, top, bottom);
  ctx.fillRect(0, 0, W, H);
  if (sun) {
    const [sx, sy, r] = sun;
    const key = `sun:${Math.round(sx)}:${Math.round(sy)}:${Math.round(r)}`;
    let sg = _lgCache.get(key);
    if (!sg) {
      sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, r);
      sg.addColorStop(0, "rgba(230,192,105,0.75)");
      sg.addColorStop(0.5, "rgba(200,110,50,0.28)");
      sg.addColorStop(1, "rgba(200,110,50,0)");
      _lgCache.set(key, sg);
    }
    ctx.fillStyle = sg;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    ctx.fillStyle = "rgba(240,205,130,0.9)";
    ctx.beginPath(); ctx.arc(sx, sy, r * 0.16, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawGround(ctx, y, h, base, dark) {
  const key = `gnd:${base}:${dark}:${Math.round(y)}:${Math.round(h)}`;
  ctx.fillStyle = _lg(ctx, key, 0, y, 0, y + h, base, dark);
  ctx.fillRect(0, 0, ctx.canvas.width, h);
}

/** rocky ridge silhouette */
export function drawRidge(ctx, yBase, amp, color, seed = 7, step = 90) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-40, ctx.canvas.height);
  let x = -40, i = 0;
  while (x < ctx.canvas.width + 40) {
    const y = yBase - (Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453 % 1 + 1) % 1 * amp;
    ctx.lineTo(x, y);
    x += step * (0.6 + ((i * 37) % 10) / 16);
    i++;
  }
  ctx.lineTo(ctx.canvas.width + 40, ctx.canvas.height);
  ctx.closePath(); ctx.fill();
}

/** meander (greek key) border strip */
export function drawMeander(ctx, x, y, w, h, color = PAL.bronze, alpha = 0.5) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, h * 0.16);
  const u = h;
  for (let px = x; px < x + w - u; px += u) {
    ctx.beginPath();
    ctx.moveTo(px, y + h); ctx.lineTo(px, y);
    ctx.lineTo(px + u * 0.75, y); ctx.lineTo(px + u * 0.75, y + h * 0.5);
    ctx.lineTo(px + u * 0.3, y + h * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

/** torch: pole + animated flame; returns particles handled by caller */
export function drawTorch(ctx, x, y, t, h = 90) {
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  const fw = 14 + Math.sin(t * 9 + x) * 3;
  const fh = 26 + Math.cos(t * 11 + x * 2) * 5;
  ctx.fillStyle = PAL.fire;
  ctx.beginPath();
  ctx.moveTo(x - fw, y - h);
  ctx.quadraticCurveTo(x - fw * 0.4, y - h - fh * 0.6, x, y - h - fh);
  ctx.quadraticCurveTo(x + fw * 0.4, y - h - fh * 0.6, x + fw, y - h);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.fireBright;
  ctx.beginPath();
  ctx.moveTo(x - fw * 0.5, y - h);
  ctx.quadraticCurveTo(x, y - h - fh * 0.7, x + fw * 0.5, y - h);
  ctx.closePath(); ctx.fill();
}

/** fire particles layer — call with t; returns nothing */
export class FireParticles {
  constructor(n = 60) { this.p = Array.from({ length: n }, () => this._new(true)); }
  _new(init = false) {
    return {
      x: Math.random(), y: init ? Math.random() : 1 + Math.random() * 0.1,
      vy: 0.15 + Math.random() * 0.25, vx: (Math.random() - 0.5) * 0.03,
      r: 2 + Math.random() * 5, a: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.5,
    };
  }
  update(dt, windX = 0) {
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i];
      p.y -= p.vy * dt; p.x += (p.vx + windX) * dt; p.a += dt * 6;
      if (p.y < -0.05) this.p[i] = this._new();
    }
  }
  draw(ctx, x, y, w, h, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha;
    for (const p of this.p) {
      ctx.globalAlpha = alpha * Math.max(0, 1 - p.y) * 0.75;
      ctx.fillStyle = p.hue ? PAL.fire : PAL.fireBright;
      const wob = Math.sin(p.a) * 4;
      ctx.beginPath();
      ctx.arc(x + p.x * w + wob, y + p.y * h, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/* ============================================================
   CHARACTERS — strong silhouettes, pottery detail lines.
   All draw facing right by default; dir=-1 flips.
   s = scale (1 => ~110px tall figure)
   ============================================================ */

function _flip(ctx, x, dir, fn) {
  ctx.save();
  ctx.translate(x, 0);
  if (dir < 0) ctx.scale(-1, 1);
  fn(0);
  ctx.restore();
}

function _body(ctx, y, s, skin, tint) {
  // legs
  ctx.strokeStyle = tint; ctx.lineWidth = 9 * s; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, y - 44 * s); ctx.lineTo(-7 * s, y - 22 * s); ctx.lineTo(-6 * s, y - 2 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, y - 44 * s); ctx.lineTo(9 * s, y - 22 * s); ctx.lineTo(10 * s, y - 2 * s); ctx.stroke();
  // torso
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.moveTo(-10 * s, y - 66 * s);
  ctx.quadraticCurveTo(-13 * s, y - 50 * s, -9 * s, y - 42 * s);
  ctx.lineTo(11 * s, y - 42 * s);
  ctx.quadraticCurveTo(14 * s, y - 54 * s, 10 * s, y - 66 * s);
  ctx.closePath(); ctx.fill();
  // head
  ctx.beginPath(); ctx.arc(2 * s, y - 76 * s, 9.5 * s, 0, Math.PI * 2); ctx.fill();
  // skin accents (face/hands)
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(5 * s, y - 75 * s, 6 * s, -0.9, 1.4); ctx.fill();
  return { handX: 10 * s, handY: y - 56 * s, headX: 2 * s, headY: y - 76 * s };
}

/**
 * ODYSSEUS — travel cloak, sword. battle=true adds blood stripe + dents.
 * `kit` = Gear.kit() → { armor, sword, bow }: armor id draws plating
 * (pauldron at 2+, crest at 3), bow drawn only when equipped.
 * Cinematic pass: ground shadow, torch-side rim light, cloak fold.
 */
export function drawOdysseus(ctx, x, y, s, dir, t, battle = false, moving = false, kit = null) {
  // grounded shadow ellipse — anchors the figure in the scene
  ctx.save();
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(x, y + 2 * s, 16 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  _flip(ctx, x, dir, () => {
    const skin = PAL.sand, tint = PAL.ink;
    const bob = moving ? Math.sin(t * 10) * 2 * s : Math.sin(t * 2) * 1 * s;
    ctx.save(); ctx.translate(0, bob);
    // cloak — deep dyed wool with a lit fold catching firelight
    const tier = kit ? (kit.armor ? kit.armor.id : 0) : 0;
    ctx.fillStyle = battle ? PAL.blood : (tier >= 2 ? "#3a5a74" : PAL.aegean);
    ctx.beginPath();
    ctx.moveTo(-4 * s, y - 66 * s);
    ctx.quadraticCurveTo(-22 * s, y - 52 * s, -18 * s, y - 6 * s);
    ctx.lineTo(-8 * s, y - 10 * s);
    ctx.quadraticCurveTo(-10 * s, y - 40 * s, -2 * s, y - 60 * s);
    ctx.closePath(); ctx.fill();
    // cloak fold highlight (light source at +x)
    ctx.strokeStyle = "rgba(236,180,110,0.35)";
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(-4 * s, y - 62 * s);
    ctx.quadraticCurveTo(-16 * s, y - 46 * s, -13 * s, y - 14 * s);
    ctx.stroke();
    // armor plating (Arms of the Hero tiers)
    if (tier >= 1) {
      ctx.fillStyle = tier >= 3 ? PAL.bronzeBright : PAL.bronze;
      ctx.beginPath();
      ctx.moveTo(-8 * s, y - 60 * s); ctx.lineTo(10 * s, y - 60 * s);
      ctx.lineTo(8 * s, y - 46 * s); ctx.lineTo(-6 * s, y - 46 * s);
      ctx.closePath(); ctx.fill();
      if (tier >= 2) { // pauldron
        ctx.beginPath(); ctx.arc(-7 * s, y - 62 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
      }
      // (tier-3 crest retired — Odysseus now always wears his red-crested war helm)
    }
    const b = _body(ctx, y, s, skin, tint);
    // CORINTHIAN WAR HELM — dark bronze with the tall scarlet crest
    // (red-figure, cf. the Troy battle look)
    ctx.fillStyle = "#2e2a24"; // near-black bronze skullcap
    ctx.beginPath(); ctx.arc(2 * s, y - 77 * s, 10 * s, Math.PI * 0.95, Math.PI * 2.08); ctx.fill();
    ctx.fillStyle = "#3a352d"; // nose guard + cheek plate hint
    ctx.fillRect(3.5 * s, y - 74 * s, 2.6 * s, 8 * s);
    ctx.strokeStyle = "rgba(236,180,110,0.5)"; ctx.lineWidth = 1.4 * s; // lit bronze edge
    ctx.beginPath(); ctx.arc(2 * s, y - 77 * s, 10 * s, Math.PI * 1.02, Math.PI * 1.5); ctx.stroke();
    // crest: high scarlet arc + tail flowing down the back
    ctx.strokeStyle = PAL.blood; ctx.lineWidth = 4.6 * s; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-8 * s, y - 82 * s);
    ctx.quadraticCurveTo(2 * s, y - 104 * s, 12 * s, y - 80 * s); ctx.stroke();
    ctx.strokeStyle = "rgba(150,38,28,0.85)"; ctx.lineWidth = 2.2 * s;
    ctx.beginPath(); ctx.moveTo(11 * s, y - 79 * s);
    ctx.quadraticCurveTo(16 * s, y - 70 * s, 13 * s, y - 58 * s); ctx.stroke();
    ctx.lineCap = "butt";
    // sword at hip (upgrades glint brighter)
    ctx.strokeStyle = tier >= 2 ? PAL.bronzeBright : PAL.bronze; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(6 * s, y - 44 * s); ctx.lineTo(16 * s, y - 34 * s); ctx.stroke();
    // bow across the back (only when actually equipped)
    if (kit && kit.bow && kit.bow.power > 0) {
      ctx.strokeStyle = "#6b4a26"; ctx.lineWidth = 2.4 * s;
      ctx.beginPath(); ctx.arc(-8 * s, y - 52 * s, 14 * s, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
      ctx.strokeStyle = "rgba(230,192,105,0.5)"; ctx.lineWidth = 1 * s;
      ctx.beginPath(); ctx.moveTo(-17 * s, y - 44 * s); ctx.lineTo(-16 * s, y - 61 * s); ctx.stroke();
    }
    // beard
    ctx.fillStyle = tint;
    ctx.beginPath(); ctx.arc(7 * s, y - 71 * s, 5.5 * s, -0.4, 1.7); ctx.fill();
    // rim light — warm edge on the lit side (screen-safe: plain stroke)
    ctx.strokeStyle = "rgba(255,190,110,0.55)";
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.arc(b.headX + 3 * s, b.headY, 9.5 * s, -1.2, 0.9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10 * s, y - 64 * s); ctx.lineTo(13 * s, y - 52 * s); ctx.stroke();
    ctx.restore();
  });
}

/** AGAMEMNON — High King of Mycenae: dark Corinthian helm, charcoal armor, gold medallions, commanding presence */
export function drawAgamemnon(ctx, x, y, s, dir, t, aura = 0) {
  _flip(ctx, x, dir, () => {
    // ── Subtle ambient aura: just a dim ground presence glow, no blinding rings ──
    if (aura > 0) {
      ctx.save();
      const pulse = 1 + Math.sin(t * 2.2) * 0.04;

      // Faint under-body god light — cinematic rim, not a spotlight
      const rimG = ctx.createRadialGradient(0, y - 40 * s, 5 * s, 0, y - 40 * s, 55 * s * pulse);
      rimG.addColorStop(0, `rgba(180,140,60,${0.10 * aura})`);
      rimG.addColorStop(0.6, `rgba(120,80,20,${0.06 * aura})`);
      rimG.addColorStop(1, "rgba(100,60,0,0)");
      ctx.fillStyle = rimG;
      ctx.beginPath(); ctx.ellipse(0, y - 40 * s, 48 * s, 60 * s, 0, 0, Math.PI * 2); ctx.fill();

      // Subtle ground haze — like firelight spilling under him
      const groundG = ctx.createRadialGradient(0, y, 2, 0, y, 36 * s);
      groundG.addColorStop(0, `rgba(200,140,50,${0.22 * aura})`);
      groundG.addColorStop(1, "rgba(200,140,50,0)");
      ctx.fillStyle = groundG;
      ctx.beginPath(); ctx.ellipse(0, y, 36 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();

      // Very thin golden rim light on his left edge (cinematic backlighting)
      ctx.strokeStyle = `rgba(220,175,70,${0.18 * aura})`;
      ctx.lineWidth = 3.5 * s;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-12 * s, y - 8 * s);
      ctx.quadraticCurveTo(-18 * s, y - 50 * s, -8 * s, y - 78 * s);
      ctx.stroke();

      ctx.restore();
    }

    const ink = PAL.ink;

    // ── DARK CAMPAIGN CAPE — deep charcoal/navy, heavy fabric ──
    ctx.fillStyle = "#1c1e2a";
    ctx.beginPath();
    ctx.moveTo(-4 * s, y - 68 * s);
    ctx.quadraticCurveTo(-42 * s, y - 48 * s, -38 * s, y - 2 * s);
    ctx.lineTo(-10 * s, y - 6 * s);
    ctx.quadraticCurveTo(-22 * s, y - 40 * s, -2 * s, y - 62 * s);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(10,10,18,0.7)";
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.moveTo(-8 * s, y - 60 * s);
    ctx.quadraticCurveTo(-28 * s, y - 38 * s, -26 * s, y - 10 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-16 * s, y - 50 * s);
    ctx.quadraticCurveTo(-32 * s, y - 30 * s, -30 * s, y - 14 * s);
    ctx.stroke();

    _body(ctx, y, s * 1.14, PAL.sand, ink);

    // ── DARK STEEL CUIRASS ──
    ctx.fillStyle = "#2a2d35";
    ctx.beginPath();
    ctx.moveTo(-11 * s, y - 63 * s);
    ctx.lineTo(13 * s, y - 63 * s);
    ctx.lineTo(11 * s, y - 33 * s);
    ctx.lineTo(-9 * s, y - 33 * s);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(80,90,110,0.5)";
    ctx.lineWidth = 1 * s;
    ctx.beginPath(); ctx.moveTo(-9 * s, y - 63 * s); ctx.lineTo(-9 * s, y - 33 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(11 * s, y - 63 * s); ctx.lineTo(11 * s, y - 33 * s); ctx.stroke();

    // ── GOLD LION MEDALLIONS ──
    const medalPos = [
      [0, y - 56 * s, 5.8 * s],
      [-6 * s, y - 46 * s, 5.2 * s],
      [6.5 * s, y - 46 * s, 5.0 * s],
    ];
    for (const [mx, my, mr] of medalPos) {
      ctx.fillStyle = "#8a6520";
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PAL.bronzeBright;
      ctx.beginPath(); ctx.arc(mx, my, mr * 0.72, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#5a3c08"; ctx.lineWidth = 0.9 * s;
      ctx.beginPath(); ctx.arc(mx, my, mr * 0.42, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx - mr * 0.3, my); ctx.lineTo(mx + mr * 0.3, my);
      ctx.moveTo(mx, my - mr * 0.3); ctx.lineTo(mx, my + mr * 0.3);
      ctx.stroke();
    }

    ctx.fillStyle = "#242830";
    ctx.beginPath(); ctx.arc(-9 * s, y - 65 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#9a7028";
    ctx.beginPath(); ctx.arc(-9 * s, y - 65 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PAL.bronzeBright;
    ctx.beginPath(); ctx.arc(-9 * s, y - 65 * s, 2 * s, 0, Math.PI * 2); ctx.fill();

    // ── CORINTHIAN HELM ──
    ctx.fillStyle = "#1e2128";
    ctx.beginPath();
    ctx.moveTo(-13 * s, y - 70 * s);
    ctx.lineTo(-15 * s, y - 78 * s);
    ctx.arc(1 * s, y - 82 * s, 14 * s, Math.PI * 0.8, Math.PI * 0.15, false);
    ctx.lineTo(14 * s, y - 78 * s);
    ctx.lineTo(12 * s, y - 70 * s);
    ctx.quadraticCurveTo(8 * s, y - 67 * s, 1 * s, y - 68 * s);
    ctx.quadraticCurveTo(-6 * s, y - 67 * s, -13 * s, y - 70 * s);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#161820";
    ctx.fillRect(-1.8 * s, y - 79 * s, 3.6 * s, 10 * s);

    ctx.fillStyle = "rgba(5,3,2,0.88)";
    ctx.beginPath(); ctx.ellipse(-5 * s, y - 77 * s, 4 * s, 2.4 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7 * s, y - 77 * s, 4 * s, 2.4 * s, 0, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = "rgba(90,100,120,0.45)";
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.arc(1 * s, y - 82 * s, 13.4 * s, Math.PI * 0.85, Math.PI * 0.12, false);
    ctx.stroke();

    ctx.strokeStyle = "#7a5810";
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    ctx.moveTo(-14 * s, y - 72 * s);
    ctx.quadraticCurveTo(0 * s, y - 74 * s, 13 * s, y - 72 * s);
    ctx.stroke();

    // ── HORSEHAIR CREST ──
    ctx.fillStyle = "#8a6520";
    ctx.beginPath(); ctx.ellipse(1 * s, y - 95 * s, 3 * s, 1.5 * s, 0, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = "#0d0d12";
    ctx.lineWidth = 9 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(1 * s, y - 94 * s);
    ctx.quadraticCurveTo(6 * s, y - 132 * s, 22 * s, y - 106 * s);
    ctx.stroke();

    ctx.strokeStyle = "#1a1a24";
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(2 * s, y - 96 * s);
    ctx.quadraticCurveTo(9 * s, y - 134 * s, 26 * s, y - 104 * s);
    ctx.stroke();

    ctx.strokeStyle = "#2a2a38";
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.moveTo(20 * s, y - 108 * s);
    ctx.quadraticCurveTo(30 * s, y - 114 * s, 28 * s, y - 102 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(18 * s, y - 110 * s);
    ctx.quadraticCurveTo(26 * s, y - 120 * s, 32 * s, y - 108 * s);
    ctx.stroke();

    // ── SPEAR ──
    ctx.strokeStyle = "#38240e";
    ctx.lineWidth = 2.8 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(15 * s, y + 2 * s);
    ctx.lineTo(18 * s, y - 100 * s);
    ctx.stroke();
    ctx.fillStyle = PAL.bronze;
    ctx.beginPath();
    ctx.moveTo(18 * s, y - 108 * s);
    ctx.lineTo(14 * s, y - 96 * s);
    ctx.lineTo(22 * s, y - 96 * s);
    ctx.closePath();
    ctx.fill();

    ctx.lineCap = "butt";
  });
}

/** SOLDIER (generic greek w/ spear + shield) */
export function drawSoldier(ctx, x, y, s, dir, t, moving = false) {
  _flip(ctx, x, dir, () => {
    const bob = moving ? Math.sin(t * 9 + x) * 2 : 0;
    ctx.save(); ctx.translate(0, bob);
    const tint = PAL.ink, skin = PAL.sand;
    // shield on back
    ctx.fillStyle = PAL.terraDeep;
    ctx.beginPath(); ctx.arc(-9 * s, y - 54 * s, 12 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.arc(-9 * s, y - 54 * s, 12 * s, 0, Math.PI * 2); ctx.stroke();
    _body(ctx, y, s, skin, tint);
    // spear
    ctx.strokeStyle = "#4a3016"; ctx.lineWidth = 2.6 * s;
    ctx.beginPath(); ctx.moveTo(8 * s, y - 4 * s); ctx.lineTo(16 * s, y - 92 * s); ctx.stroke();
    ctx.fillStyle = PAL.bronze;
    ctx.beginPath(); ctx.moveTo(16 * s, y - 100 * s); ctx.lineTo(12 * s, y - 88 * s); ctx.lineTo(20 * s, y - 88 * s); ctx.closePath(); ctx.fill();
    // crested helmet
    ctx.fillStyle = tint;
    ctx.beginPath(); ctx.arc(2 * s, y - 77 * s, 10 * s, Math.PI, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = PAL.blood; ctx.lineWidth = 3.4 * s;
    ctx.beginPath(); ctx.moveTo(-8 * s, y - 82 * s);
    ctx.quadraticCurveTo(2 * s, y - 96 * s, 12 * s, y - 84 * s); ctx.stroke();
    ctx.restore();
  });
}

/** POLYPHEMUS — one-eyed giant, club. eyeGlow = exposure 0..1 */
export function drawCyclops(ctx, x, y, s, dir, t, state = "idle", eyeGlow = 0) {
  _flip(ctx, x, dir, () => {
    const skin = "#a8714a", tint = "#2c1a0e";
    const breathe = Math.sin(t * 2) * 2 * s;
    // legs
    ctx.strokeStyle = tint; ctx.lineWidth = 22 * s; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-6 * s, y - 60 * s); ctx.lineTo(-18 * s, y - 30 * s); ctx.lineTo(-16 * s, y - 4 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10 * s, y - 60 * s); ctx.lineTo(22 * s, y - 30 * s); ctx.lineTo(24 * s, y - 4 * s); ctx.stroke();
    // torso
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(-26 * s, y - 100 * s + breathe);
    ctx.quadraticCurveTo(-34 * s, y - 60 * s, -20 * s, y - 48 * s);
    ctx.lineTo(26 * s, y - 48 * s);
    ctx.quadraticCurveTo(38 * s, y - 66 * s, 30 * s, y - 100 * s + breathe);
    ctx.closePath(); ctx.fill();
    // detail lines (pottery style)
    ctx.strokeStyle = "rgba(33,22,11,0.6)"; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(-18 * s, y - 80 * s); ctx.quadraticCurveTo(0, y - 72 * s, 20 * s, y - 80 * s); ctx.stroke();
    // head
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(6 * s, y - 116 * s + breathe, 17 * s, 0, Math.PI * 2); ctx.fill();
    // single eye — the weak point
    const ex = 12 * s, ey = y - 120 * s + breathe;
    if (eyeGlow > 0) {
      const g = ctx.createRadialGradient(ex, ey, 1, ex, ey, 16 * s * eyeGlow);
      g.addColorStop(0, "rgba(245,197,107,0.95)");
      g.addColorStop(1, "rgba(245,197,107,0)");
      ctx.fillStyle = g;
      ctx.fillRect(ex - 20 * s, ey - 20 * s, 40 * s, 40 * s);
    }
    ctx.fillStyle = PAL.bone;
    ctx.beginPath(); ctx.arc(ex, ey, 6.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = eyeGlow > 0.4 ? PAL.blood : PAL.ink;
    ctx.beginPath(); ctx.arc(ex, ey, 2.6 * s + eyeGlow * 1.6 * s, 0, Math.PI * 2); ctx.fill();
    // horn + messy hair
    ctx.fillStyle = tint;
    ctx.beginPath(); ctx.arc(0, y - 130 * s + breathe, 12 * s, Math.PI, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = tint; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(-6 * s, y - 128 * s); ctx.lineTo(-12 * s, y - 138 * s); ctx.stroke();
    // arm + club
    const swing = state === "windup" ? -1.9 : state === "swing" ? 0.7 : -0.5 + Math.sin(t * 2) * 0.12;
    ctx.save();
    ctx.translate(20 * s, y - 90 * s + breathe);
    ctx.rotate(swing);
    ctx.strokeStyle = skin; ctx.lineWidth = 14 * s;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(26 * s, 12 * s); ctx.stroke();
    // club
    ctx.fillStyle = "#5a3c20";
    ctx.beginPath();
    ctx.roundRect(24 * s, 2 * s, 58 * s, 16 * s, 7 * s);
    ctx.fill();
    ctx.strokeStyle = "rgba(33,22,11,0.7)"; ctx.lineWidth = 2 * s;
    ctx.stroke();
    ctx.fillStyle = PAL.bronze;
    ctx.beginPath(); ctx.arc(74 * s, 10 * s, 9 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // other arm
    ctx.strokeStyle = skin; ctx.lineWidth = 13 * s;
    ctx.beginPath(); ctx.moveTo(-14 * s, y - 88 * s); ctx.lineTo(-30 * s, y - 62 * s); ctx.stroke();
  });
}

/** SHEEP (cave flock) */
export function drawSheep(ctx, x, y, s, t, i = 0) {
  const bob = Math.sin(t * 3 + i) * 1.5 * s;
  ctx.save(); ctx.translate(x, y + bob);
  ctx.fillStyle = PAL.boneDim;
  ctx.beginPath();
  ctx.ellipse(0, -8 * s, 13 * s, 8.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.ink;
  ctx.beginPath(); ctx.arc(11 * s, -12 * s, 4.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2 * s; ctx.lineCap = "round";
  for (const lx of [-6, 0, 5]) {
    ctx.beginPath(); ctx.moveTo(lx * s, -3 * s); ctx.lineTo(lx * s, 1 * s); ctx.stroke();
  }
  ctx.restore();
}

/** CIRCE — purple-robed sorceress with staff */
export function drawCirce(ctx, x, y, s, dir, t) {
  _flip(ctx, x, dir, () => {
    const skin = PAL.sand;
    // gown
    ctx.fillStyle = "#5d3a63";
    ctx.beginPath();
    ctx.moveTo(0, y - 66 * s);
    ctx.quadraticCurveTo(-16 * s, y - 30 * s, -14 * s, y - 2 * s);
    ctx.lineTo(14 * s, y - 2 * s);
    ctx.quadraticCurveTo(16 * s, y - 34 * s, 0, y - 66 * s);
    ctx.closePath(); ctx.fill();
    // torso
    ctx.fillStyle = PAL.ink;
    ctx.beginPath();
    ctx.moveTo(-8 * s, y - 66 * s); ctx.lineTo(8 * s, y - 66 * s);
    ctx.lineTo(6 * s, y - 46 * s); ctx.lineTo(-6 * s, y - 46 * s);
    ctx.closePath(); ctx.fill();
    // head + hair
    ctx.beginPath(); ctx.arc(1 * s, y - 74 * s, 9 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2c1a3a";
    ctx.beginPath(); ctx.arc(-1 * s, y - 76 * s, 10 * s, Math.PI * 0.8, Math.PI * 2.3); ctx.fill();
    // staff with glow
    ctx.strokeStyle = "#4a3016"; ctx.lineWidth = 2.6 * s;
    ctx.beginPath(); ctx.moveTo(12 * s, y); ctx.lineTo(12 * s, y - 88 * s); ctx.stroke();
    const g = ctx.createRadialGradient(12 * s, y - 90 * s, 1, 12 * s, y - 90 * s, 12 * s);
    g.addColorStop(0, "rgba(230,192,105,0.8)"); g.addColorStop(1, "rgba(230,192,105,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 102 * s, 26 * s, 26 * s);
    ctx.fillStyle = PAL.bronzeBright;
    ctx.beginPath(); ctx.arc(12 * s, y - 90 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill();
  });
}

/** PIG (transformed crew) */
export function drawPig(ctx, x, y, s, t, i = 0) {
  const bob = Math.sin(t * 4 + i) * 1.4 * s;
  ctx.save(); ctx.translate(x, y + bob);
  ctx.fillStyle = "#c98a94";
  ctx.beginPath(); ctx.ellipse(0, -7 * s, 11 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(9 * s, -10 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PAL.ink;
  ctx.beginPath(); ctx.arc(11.5 * s, -11 * s, 1.1 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(13.5 * s, -8.5 * s, 2.2 * s, 1.6 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.6 * s;
  ctx.beginPath(); ctx.moveTo(9 * s, -14 * s); ctx.lineTo(8 * s, -17 * s); ctx.stroke(); // ear
  ctx.restore();
}

/** GUARDIAN BEAST (Circe's wolves/lions) */
export function drawBeast(ctx, x, y, s, dir, t) {
  ctx.save(); ctx.translate(x, y);
  if (dir < 0) ctx.scale(-1, 1);
  const lunge = Math.sin(t * 8) * 2 * s;
  ctx.fillStyle = PAL.ink;
  ctx.beginPath();
  ctx.ellipse(0, -9 * s, 15 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(13 * s, -13 * s + lunge * 0.4, 6 * s, 0, Math.PI * 2); ctx.fill();
  // ears
  ctx.beginPath(); ctx.moveTo(9 * s, -18 * s); ctx.lineTo(11 * s, -24 * s); ctx.lineTo(13 * s, -18 * s); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(14 * s, -18 * s); ctx.lineTo(16 * s, -24 * s); ctx.lineTo(18 * s, -18 * s); ctx.closePath(); ctx.fill();
  // legs
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3 * s; ctx.lineCap = "round";
  for (const [lx, ph] of [[-9, 0], [-3, Math.PI], [4, Math.PI], [10, 0]]) {
    ctx.beginPath(); ctx.moveTo(lx * s, -4 * s);
    ctx.lineTo((lx + Math.sin(t * 10 + ph) * 2) * s, 0); ctx.stroke();
  }
  // bronze collar (Circe's mark)
  ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 2.4 * s;
  ctx.beginPath(); ctx.arc(11 * s, -11 * s, 5 * s, -0.6, 2.4); ctx.stroke();
  // eye
  ctx.fillStyle = PAL.blood;
  ctx.beginPath(); ctx.arc(15.5 * s, -14 * s, 1.3 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** TIRESIAS — ghost prophet (semi-transparent, bone-toned) */
export function drawTiresias(ctx, x, y, s, t) {
  ctx.save();
  ctx.globalAlpha = 0.55 + Math.sin(t * 1.6) * 0.12;
  ctx.translate(x, y);
  const float = Math.sin(t * 1.4) * 3;
  ctx.translate(0, float);
  ctx.fillStyle = PAL.aegeanDeep;
  // shrouded figure — hooded robe silhouette
  ctx.beginPath();
  ctx.moveTo(0, y - 70 * s);
  ctx.quadraticCurveTo(-16 * s, y - 40 * s, -13 * s, y);
  ctx.lineTo(13 * s, y);
  ctx.quadraticCurveTo(16 * s, y - 40 * s, 0, y - 70 * s);
  ctx.closePath(); ctx.fill();
  // hood
  ctx.beginPath(); ctx.arc(0, y - 70 * s, 10 * s, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
  // blind eyes — two pale stitches
  ctx.strokeStyle = PAL.bone; ctx.lineWidth = 1.6 * s;
  ctx.beginPath(); ctx.moveTo(-3 * s, y - 72 * s); ctx.lineTo(1 * s, y - 72 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3 * s, y - 72 * s); ctx.lineTo(7 * s, y - 72 * s); ctx.stroke();
  // staff
  ctx.strokeStyle = PAL.boneDim; ctx.lineWidth = 2 * s;
  ctx.beginPath(); ctx.moveTo(10 * s, y + 2 * s); ctx.lineTo(10 * s, y - 84 * s); ctx.stroke();
  ctx.restore();
}

/** GHOST (underworld shades) */
export function drawGhost(ctx, x, y, s, t, i = 0) {
  ctx.save();
  ctx.globalAlpha = 0.28 + Math.sin(t * 1.8 + i * 2) * 0.1;
  const drift = Math.sin(t * 0.7 + i * 1.7) * 12;
  const float = Math.sin(t * 1.1 + i) * 5;
  ctx.fillStyle = PAL.aegeanDeep;
  ctx.beginPath();
  const yy = y + float;
  ctx.moveTo(x + drift, yy - 34 * s);
  ctx.quadraticCurveTo(x + drift - 10 * s, yy - 16 * s, x + drift - 8 * s, yy);
  // wavy hem
  for (let k = 0; k < 4; k++) {
    ctx.quadraticCurveTo(
      x + drift - 8 * s + (k * 2 + 1) * 4 * s, yy + 4 * s * (k % 2 ? -1 : 1),
      x + drift - 8 * s + (k + 1) * 4 * s, yy
    );
  }
  ctx.quadraticCurveTo(x + drift + 10 * s, yy - 16 * s, x + drift, yy - 34 * s);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** SIREN — perched on rocks, singing */
export function drawSiren(ctx, x, y, s, t, i = 0) {
  ctx.save(); ctx.translate(x, y);
  const sway = Math.sin(t * 2 + i * 2) * 3 * s;
  // tail
  ctx.fillStyle = PAL.aegean;
  ctx.beginPath();
  ctx.moveTo(0, -40 * s);
  ctx.quadraticCurveTo(-10 * s, -20 * s, -6 * s, 0);
  ctx.lineTo(6 * s, 0);
  ctx.quadraticCurveTo(10 * s, -22 * s, 0, -40 * s);
  ctx.closePath(); ctx.fill();
  // fluke
  ctx.beginPath();
  ctx.moveTo(-6 * s, 0); ctx.lineTo(-14 * s, 6 * s); ctx.lineTo(-2 * s, 3 * s);
  ctx.lineTo(4 * s, 8 * s); ctx.lineTo(6 * s, 0);
  ctx.closePath(); ctx.fill();
  // torso
  ctx.fillStyle = PAL.bone;
  ctx.beginPath();
  ctx.moveTo(-5 * s + sway, -40 * s);
  ctx.quadraticCurveTo(-8 * s + sway, -54 * s, -4 * s + sway, -62 * s);
  ctx.lineTo(6 * s + sway, -62 * s);
  ctx.quadraticCurveTo(9 * s + sway, -52 * s, 5 * s + sway, -40 * s);
  ctx.closePath(); ctx.fill();
  // head
  ctx.beginPath(); ctx.arc(1 * s + sway, -69 * s, 6.5 * s, 0, Math.PI * 2); ctx.fill();
  // hair
  ctx.fillStyle = "#7c3b23";
  ctx.beginPath(); ctx.arc(0 * s + sway, -71 * s, 7.5 * s, Math.PI * 0.7, Math.PI * 2.2); ctx.fill();
  // arms raised in song
  ctx.strokeStyle = PAL.bone; ctx.lineWidth = 2.6 * s; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-3 * s + sway, -58 * s);
  ctx.lineTo(-10 * s + sway, (-66 - Math.abs(Math.sin(t * 3 + i)) * 4) * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(5 * s + sway, -58 * s);
  ctx.lineTo(11 * s + sway, (-64 + Math.sin(t * 3 + i) * 2) * s); ctx.stroke();
  // song ripples
  ctx.strokeStyle = "rgba(236,223,195,0.5)";
  ctx.lineWidth = 1.4 * s;
  const rp = (t * 0.6 + i * 0.33) % 1;
  ctx.globalAlpha = 1 - rp;
  ctx.beginPath(); ctx.arc(1 * s + sway, -69 * s, (10 + rp * 30) * s, -1.1, 1.1); ctx.stroke();
  ctx.restore();
}

/** SUITOR — reveler with wine cup / spear */
export function drawSuitor(ctx, x, y, s, dir, t, lead = false, moving = false) {
  _flip(ctx, x, dir, () => {
    const bob = moving ? Math.sin(t * 9 + x) * 2 : 0;
    ctx.save(); ctx.translate(0, bob);
    const skin = PAL.sand;
    // tunic (lead gets bronze trim)
    ctx.fillStyle = lead ? "#5e2c13" : "#7a5a30";
    ctx.beginPath();
    ctx.moveTo(-10 * s, y - 64 * s);
    ctx.lineTo(10 * s, y - 64 * s);
    ctx.lineTo(13 * s, y - 24 * s);
    ctx.lineTo(-13 * s, y - 24 * s);
    ctx.closePath(); ctx.fill();
    if (lead) {
      ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.moveTo(-13 * s, y - 28 * s); ctx.lineTo(13 * s, y - 28 * s); ctx.stroke();
    }
    // legs
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 7 * s; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-4 * s, y - 24 * s); ctx.lineTo(-6 * s, y - 2 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4 * s, y - 24 * s); ctx.lineTo(6 * s, y - 2 * s); ctx.stroke();
    // head
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(2 * s, y - 73 * s, 8.5 * s, 0, Math.PI * 2); ctx.fill();
    // feathered cap / bronze helm for lead
    ctx.fillStyle = lead ? PAL.bronze : "#8c3f1d";
    ctx.beginPath(); ctx.arc(2 * s, y - 76 * s, 9 * s, Math.PI, Math.PI * 2); ctx.fill();
    if (lead) {
      ctx.fillStyle = PAL.bone;
      ctx.beginPath(); ctx.moveTo(2 * s, y - 86 * s); ctx.lineTo(5 * s, y - 95 * s); ctx.lineTo(-1 * s, y - 88 * s); ctx.closePath(); ctx.fill();
    }
    // weapon
    if (lead) {
      ctx.strokeStyle = "#4a3016"; ctx.lineWidth = 2.6 * s;
      ctx.beginPath(); ctx.moveTo(10 * s, y); ctx.lineTo(16 * s, y - 84 * s); ctx.stroke();
      ctx.fillStyle = PAL.bronze;
      ctx.beginPath(); ctx.moveTo(16 * s, y - 92 * s); ctx.lineTo(12 * s, y - 80 * s); ctx.lineTo(20 * s, y - 80 * s); ctx.closePath(); ctx.fill();
    } else {
      ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 2.4 * s;
      ctx.beginPath(); ctx.arc(12 * s, y - 50 * s, 5 * s, 0, Math.PI * 2); ctx.stroke(); // cup
    }
    ctx.restore();
  });
}

/** PENELOPE — at her loom */
export function drawPenelope(ctx, x, y, s, t) {
  ctx.save(); ctx.translate(x, y);
  // loom
  ctx.strokeStyle = "#4a3016"; ctx.lineWidth = 3.4 * s;
  ctx.beginPath(); ctx.moveTo(-16 * s, y); ctx.lineTo(-16 * s, y - 88 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(26 * s, y); ctx.lineTo(26 * s, y - 88 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-18 * s, y - 88 * s); ctx.lineTo(28 * s, y - 88 * s); ctx.stroke();
  // warp threads
  ctx.strokeStyle = "rgba(236,223,195,0.45)"; ctx.lineWidth = 1 * s;
  for (let tx = -13; tx <= 23; tx += 3.6) {
    ctx.beginPath(); ctx.moveTo(tx * s, y - 86 * s); ctx.lineTo(tx * s, y - 30 * s); ctx.stroke();
  }
  // woven band
  ctx.fillStyle = PAL.blood;
  ctx.fillRect(-13 * s, y - 52 * s + Math.sin(t * 2) * 2 * s, 36 * s, 7 * s);
  // figure
  const skin = PAL.sand;
  ctx.fillStyle = "#6a7ba3";
  ctx.beginPath();
  ctx.moveTo(2 * s, y - 66 * s);
  ctx.quadraticCurveTo(-8 * s, y - 34 * s, -6 * s, y - 2 * s);
  ctx.lineTo(10 * s, y - 2 * s);
  ctx.quadraticCurveTo(12 * s, y - 36 * s, 2 * s, y - 66 * s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.ink;
  ctx.beginPath(); ctx.arc(2 * s, y - 74 * s, 8.5 * s, 0, Math.PI * 2); ctx.fill();
  // veil
  ctx.fillStyle = "#4a5578";
  ctx.beginPath(); ctx.arc(1 * s, y - 76 * s, 9.5 * s, Math.PI * 0.85, Math.PI * 2.15); ctx.fill();
  ctx.restore();
}

/** AEOLUS — wind god on a cloud of air currents */
export function drawAeolus(ctx, x, y, s, t) {
  ctx.save(); ctx.translate(x, y + Math.sin(t * 1.5) * 4 * s);
  // swirling winds
  ctx.strokeStyle = "rgba(51,96,125,0.65)"; ctx.lineWidth = 2.4 * s;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    const r = (20 + k * 10) * s, sp = t * (1.1 + k * 0.4);
    ctx.arc(0, -46 * s, r, sp, sp + Math.PI * 1.4);
    ctx.stroke();
  }
  // figure
  const skin = PAL.sand;
  ctx.fillStyle = "#d7d2e0";
  ctx.beginPath();
  ctx.moveTo(0, y - 64 * s);
  ctx.quadraticCurveTo(-14 * s, y - 30 * s, -10 * s, y - 6 * s);
  ctx.lineTo(10 * s, y - 6 * s);
  ctx.quadraticCurveTo(14 * s, y - 32 * s, 0, y - 64 * s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.ink;
  ctx.beginPath(); ctx.arc(0, y - 73 * s, 8.5 * s, 0, Math.PI * 2); ctx.fill();
  // flowing beard of wind
  ctx.strokeStyle = "rgba(215,210,224,0.8)"; ctx.lineWidth = 2 * s;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(2 * s, y - 68 * s);
    ctx.quadraticCurveTo(12 * s, y - 62 * s + k * 4 * s, 20 * s + Math.sin(t * 3 + k) * 3 * s, y - 58 * s + k * 5 * s);
    ctx.stroke();
  }
  // the bag of winds — bound sack at his side
  ctx.fillStyle = "#a3511f";
  ctx.beginPath(); ctx.ellipse(16 * s, y - 18 * s, 9 * s, 7 * s, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 1.8 * s;
  ctx.beginPath(); ctx.moveTo(11 * s, y - 22 * s); ctx.lineTo(21 * s, y - 14 * s); ctx.stroke();
  ctx.restore();
}

/** SHIP — side view used in sail chapters */
export function drawShip(ctx, x, y, s, t, sailOpen = true) {
  ctx.save(); ctx.translate(x, y + Math.sin(t * 1.8) * 3 * s);
  // hull
  ctx.fillStyle = "#2c1a0e";
  ctx.beginPath();
  ctx.moveTo(-70 * s, -14 * s);
  ctx.quadraticCurveTo(-78 * s, 6 * s, -52 * s, 14 * s);
  ctx.lineTo(58 * s, 14 * s);
  ctx.quadraticCurveTo(88 * s, 8 * s, 78 * s, -14 * s);
  ctx.closePath(); ctx.fill();
  // hull stripe
  ctx.strokeStyle = PAL.terra; ctx.lineWidth = 2.4 * s;
  ctx.beginPath(); ctx.moveTo(-66 * s, -4 * s); ctx.quadraticCurveTo(0, 4 * s, 74 * s, -6 * s); ctx.stroke();
  // ram
  ctx.fillStyle = PAL.bronze;
  ctx.beginPath(); ctx.moveTo(78 * s, -10 * s); ctx.lineTo(94 * s, -6 * s); ctx.lineTo(78 * s, -2 * s); ctx.closePath(); ctx.fill();
  // mast + sail
  ctx.strokeStyle = "#4a3016"; ctx.lineWidth = 3.4 * s;
  ctx.beginPath(); ctx.moveTo(0, 14 * s); ctx.lineTo(0, -78 * s); ctx.stroke();
  if (sailOpen) {
    const billow = Math.sin(t * 2.2) * 4 * s;
    ctx.fillStyle = "#d9c9a8";
    ctx.beginPath();
    ctx.moveTo(-2 * s, -76 * s);
    ctx.quadraticCurveTo((-44 + billow) * s, -50 * s, -2 * s, -18 * s);
    ctx.quadraticCurveTo((36 - billow) * s, -48 * s, 2 * s, -76 * s);
    ctx.closePath(); ctx.fill();
    // stripe on sail
    ctx.strokeStyle = PAL.terraDeep; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(-26 * s, -46 * s); ctx.quadraticCurveTo(0, -40 * s, 26 * s, -46 * s); ctx.stroke();
  } else {
    ctx.strokeStyle = "#d9c9a8"; ctx.lineWidth = 2.6 * s;
    ctx.beginPath(); ctx.moveTo(-2 * s, -76 * s); ctx.quadraticCurveTo(16 * s, -48 * s, -2 * s, -20 * s); ctx.stroke();
  }
  // oars
  ctx.strokeStyle = "#4a3016"; ctx.lineWidth = 2.2 * s;
  for (let k = -2; k <= 2; k++) {
    const dip = Math.sin(t * 3 + k) * 4 * s;
    ctx.beginPath(); ctx.moveTo(k * 22 * s, 0); ctx.lineTo(k * 22 * s + 14 * s, 14 * s + dip); ctx.stroke();
  }
  // helmsman silhouette
  ctx.fillStyle = PAL.ink;
  ctx.beginPath(); ctx.arc(-56 * s, -24 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-60 * s, -20 * s, 9 * s, 10 * s);
  ctx.restore();
}

/* ============================================================
   ENVIRONMENT EXTRAS
   ============================================================ */

/** cave mouth with darkness gradient */
export function drawCaveMouth(ctx, x, y, w, h) {
  ctx.fillStyle = "#120a05";
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x - w / 2, y - h, x, y - h);
  ctx.quadraticCurveTo(x + w / 2, y - h, x + w / 2, y);
  ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(x, y - h, x, y);
  g.addColorStop(0, "rgba(18,10,5,0)");
  g.addColorStop(1, "rgba(18,10,5,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, y - h, w, h);
}

/** columns (palace / ruins) */
export function drawColumn(ctx, x, y, h, s = 1, color = PAL.terraDark) {
  ctx.fillStyle = color;
  ctx.fillRect(x - 9 * s, y - h, 18 * s, h);
  ctx.fillStyle = "rgba(236,223,195,0.14)";
  ctx.fillRect(x - 9 * s, y - h, 5 * s, h);
  ctx.fillStyle = color;
  ctx.fillRect(x - 13 * s, y - h - 8 * s, 26 * s, 8 * s);
  ctx.fillRect(x - 13 * s, y - 4 * s, 26 * s, 4 * s);
}

/** waves layer for sea chapters */
export function drawWaves(ctx, yBase, t, color = PAL.aegean, alpha = 0.5) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let row = 0; row < 3; row++) {
    const yy = yBase + row * 14;
    ctx.beginPath();
    for (let x = -10; x <= ctx.canvas.width + 10; x += 8) {
      const y = yy + Math.sin(x * 0.02 + t * (1.2 + row * 0.4) + row * 2) * 4;
      x === -10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** small floating name tag above a character (bronze on ink) */
/**
 * Water reflections — shimmering vertical streaks under brights.
 * Cheap: one path, ~12 segments, no per-frame allocation.
 */
export function drawReflections(ctx, ySurface, W, H, t, color = "rgba(255,200,120,") {
  ctx.save();
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 12; i++) {
    const x = W * (0.08 + i * 0.08) + Math.sin(t * 1.1 + i * 2.1) * 5;
    const len = (10 + ((i * 37) % 5) * 9) * (0.7 + 0.3 * Math.sin(t * 2 + i));
    const a = 0.10 + 0.10 * Math.sin(t * 1.7 + i * 1.3);
    if (a <= 0.02) continue;
    ctx.strokeStyle = color + a + ")";
    ctx.beginPath();
    ctx.moveTo(x, ySurface + 4);
    ctx.lineTo(x + Math.sin(t * 2 + i) * 3, ySurface + 4 + len);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawNameTag(ctx, x, y, text) {
  if (!text) return;
  ctx.save();
  ctx.font = "700 10px Georgia, serif";
  ctx.textAlign = "center";
  const w = ctx.measureText(text).width + 20;
  const hw = w / 2, top = y - 14, bot = y;
  // pottery cartouche: main plaque + small side tabs (early greek style)
  const plaque = () => {
    ctx.beginPath();
    ctx.moveTo(x - hw + 4, top);
    ctx.lineTo(x + hw - 4, top);
    ctx.quadraticCurveTo(x + hw, top, x + hw, top + 4);
    ctx.lineTo(x + hw, bot - 4);
    ctx.quadraticCurveTo(x + hw, bot, x + hw - 4, bot);
    ctx.lineTo(x - hw + 4, bot);
    ctx.quadraticCurveTo(x - hw, bot, x - hw, bot - 4);
    ctx.lineTo(x - hw, top + 4);
    ctx.quadraticCurveTo(x - hw, top, x - hw + 4, top);
    ctx.closePath();
  };
  plaque();
  ctx.fillStyle = "rgba(22,13,6,0.82)";
  ctx.fill();
  ctx.strokeStyle = "rgba(201,151,63,0.9)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // side tabs
  ctx.fillStyle = "rgba(201,151,63,0.75)";
  ctx.fillRect(x - hw - 4, top + 5, 3, 4);
  ctx.fillRect(x + hw + 1, top + 5, 3, 4);
  // inner bronze rule
  ctx.strokeStyle = "rgba(201,151,63,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - hw + 3, top + 2.5); ctx.lineTo(x + hw - 3, top + 2.5);
  ctx.stroke();
  ctx.fillStyle = "#e6c069";
  ctx.fillText(text, x, y - 4.5);
  ctx.restore();
}

/** gulls — pottery-style curled-wing birds, t seconds the flock drifts */
export function drawGulls(ctx, W, H, t, n = 3) {
  ctx.save();
  ctx.strokeStyle = "rgba(30,20,10,0.8)";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const gx = ((i * 0.37 + t * 0.014 * (0.7 + (i % 3) * 0.25)) % 1.15 - 0.08) * W;
    const gy = H * (0.12 + 0.05 * Math.sin(t * 0.7 + i * 2.1)) + i * H * 0.03;
    const flap = Math.sin(t * 7 + i * 1.9) * 3.2;
    const s = 5.5 + (i % 2) * 1.6;
    ctx.beginPath();
    ctx.moveTo(gx - s, gy + flap * 0.4);
    ctx.quadraticCurveTo(gx - s * 0.35, gy - s * 0.55 - flap, gx, gy);
    ctx.quadraticCurveTo(gx + s * 0.35, gy - s * 0.55 - flap, gx + s, gy + flap * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}

/** eyeball flash for the blinding (full-screen) */
export function drawBlindFlash(ctx, W, H, strength) {
  if (strength <= 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(255,248,224,${Math.min(1, strength)})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ============================================================
   ARMS OF THE HERO — bow, arrows, sword, shield
   ============================================================ */

/** recurve bow, strung, drawn by `pull` 0..1; faces dir (+1 right) */
export function drawBow(ctx, x, y, dir, pull, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const bend = 0.25 + pull * 0.75;
  ctx.strokeStyle = "#6b4a24";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.quadraticCurveTo(14 * bend + 4, 0, 0, 26);
  ctx.stroke();
  // string
  ctx.strokeStyle = pull > 0.15 ? PAL.fireBright : PAL.boneDim;
  ctx.lineWidth = 1.5;
  const nock = 14 * bend * pull;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(-nock, 0);
  ctx.lineTo(0, 26);
  ctx.stroke();
  ctx.restore();
}

/** arrow in flight; dir ±1; tier: 0 broadhead, 1 fire (flame tongue), 2 apollo (gold glow) */
export function drawArrow(ctx, x, y, dir, angle = 0, tier = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(dir, 1);
  if (tier === 2) { // APOLLO — golden halo
    ctx.fillStyle = "rgba(240,200,90,0.18)";
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = tier === 2 ? "#caa537" : "#6b4a24";
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(12, 0); ctx.stroke();
  ctx.fillStyle = tier === 2 ? "#f2d271" : PAL.bronzeBright;
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(9, -4); ctx.lineTo(9, 4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = PAL.boneDim;
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-10, -4); ctx.moveTo(-14, 0); ctx.lineTo(-10, 4); ctx.stroke();
  if (tier === 1) { // FIRE — flickering tongue on the shaft
    const f = 5 + Math.sin((x + y) * 0.11) * 2;
    ctx.fillStyle = "rgba(238,130,40,0.85)";
    ctx.beginPath();
    ctx.moveTo(-10, -2); ctx.quadraticCurveTo(2, -3 - f, 12, -1); ctx.quadraticCurveTo(2, 3 + f * 0.5, -10, 2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(250,210,110,0.9)";
    ctx.beginPath(); ctx.arc(6, -0.5, f * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** sword with tier look: 1 bronze, 2 moly (pale edge), 3 hector (bronze+ink) */
export function drawSword(ctx, x, y, dir, tier, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.rotate(Math.sin(t * 2.2) * 0.04);
  const blade = tier >= 3 ? "#dfe6d8" : tier === 2 ? "#cfd8ce" : PAL.bronzeBright;
  ctx.fillStyle = blade;
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(30, -3); ctx.lineTo(34, 0); ctx.lineTo(30, 3); ctx.lineTo(0, 6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = tier >= 2 ? PAL.aegeanDeep : "#5a3a1c";
  ctx.fillRect(-8, -3, 8, 6);          // hilt
  ctx.fillStyle = PAL.bronze;
  ctx.fillRect(-3, -9, 3, 18);         // guard
  ctx.restore();
}

/** round hoplite shield (armor visual, shown on the player) */
export function drawShield(ctx, x, y, dir, tier, t) {
  if (tier <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const R = 15 + tier * 1.5;
  ctx.fillStyle = tier >= 3 ? "#7d5a9c" : tier === 2 ? "#4a6b3a" : PAL.bronze;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = "rgba(236,223,195,0.75)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2); ctx.stroke();
  // blazon: gorgon dot / triskele / star
  ctx.fillStyle = PAL.bone;
  ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
