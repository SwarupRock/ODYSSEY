/* ============================================================
   ODYSSEY — fx.js — cinematic atmosphere layer (perf build)
   Design rules for phone framerates:
   - EVERY full-screen effect (vignette + color grade + grain)
     is pre-composed into ONE half-res overlay canvas at
     setStyle/resize; per frame it costs a single drawImage.
   - All particles are blits of one small tinted sprite — no
     per-particle arc()+fill, no per-frame gradient creation.
   - The engine calls Fx.begin/end around each scene's draw.
   ============================================================ */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/* one soft round dot sprite, tinted per use — every particle is a
   drawImage of this (or its screen-blend twin) instead of arc+fill */
function makeDot(rgb) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(8, 8, 0.5, 8, 8, 8);
  grd.addColorStop(0, `rgba(${rgb},1)`);
  grd.addColorStop(0.55, `rgba(${rgb},0.55)`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 16, 16);
  return c;
}

export const Fx = {
  style: null,
  time: 0,
  _frame: 0,
  mobile: false,

  styles: {
    troyburn: {
      grade: "rgba(120,30,10,0.16)", grade2: "rgba(20,5,0,0.30)",
      rays: 0.10, dust: 26, dustC: "216,120,60", dustA: 0.16, dustDrift: -30,
      embers: 14, rain: 0, flies: 0, ash: false,
      back: ["#1c0c06", "#2e1409", "#4a2410"],
      vign: "rgba(10,3,0,0.62)",
    },
    firelight: {
      grade: "rgba(150,70,20,0.13)", grade2: "rgba(5,2,0,0.42)",
      rays: 0.14, dust: 40, dustC: "236,168,90", dustA: 0.20, dustDrift: 8,
      embers: 16, rain: 0, flies: 0, ash: false,
      back: null,
      vign: "rgba(4,1,0,0.70)",
    },
    storm: {
      grade: "rgba(40,70,95,0.20)", grade2: "rgba(2,8,14,0.34)",
      rays: 0, dust: 0, dustC: "0,0,0", dustA: 0, dustDrift: 0,
      embers: 0, rain: 64, flies: 0, ash: false,
      back: ["#101c26", "#182c3a", "#22404f"],
      vign: "rgba(2,6,10,0.60)",
    },
    circe: {
      grade: "rgba(160,150,60,0.12)", grade2: "rgba(30,26,4,0.18)",
      rays: 0.20, dust: 30, dustC: "235,225,150", dustA: 0.18, dustDrift: 12,
      embers: 0, rain: 0, flies: 10, ash: false,
      back: ["#3d4a26", "#57683a", "#728551"],
      vign: "rgba(20,18,2,0.45)",
    },
    underworld: {
      grade: "rgba(60,90,110,0.16)", grade2: "rgba(4,8,12,0.36)",
      rays: 0.07, dust: 34, dustC: "190,205,215", dustA: 0.13, dustDrift: -14,
      embers: 0, rain: 0, flies: 0, ash: true,
      back: ["#0d151c", "#14222c", "#1c3240"],
      vign: "rgba(2,4,7,0.66)",
    },
    sirenrose: {
      grade: "rgba(150,70,90,0.14)", grade2: "rgba(10,4,14,0.30)",
      rays: 0.12, dust: 18, dustC: "230,170,190", dustA: 0.14, dustDrift: -22,
      embers: 0, rain: 0, flies: 0, ash: false,
      back: ["#20121c", "#33202c", "#4a2f40"],
      vign: "rgba(8,2,8,0.58)",
    },
    abyss: {
      grade: "rgba(20,35,50,0.24)", grade2: "rgba(0,2,4,0.44)",
      rays: 0, dust: 0, dustC: "0,0,0", dustA: 0, dustDrift: 0,
      embers: 0, rain: 30, flies: 0, ash: false,
      back: ["#050a0e", "#0a1218", "#101c24"],
      vign: "rgba(0,1,2,0.72)",
    },
    gold: {
      grade: "rgba(180,130,40,0.13)", grade2: "rgba(12,6,0,0.34)",
      rays: 0.16, dust: 32, dustC: "245,205,120", dustA: 0.20, dustDrift: 6,
      embers: 18, rain: 0, flies: 0, ash: false,
      back: null,
      vign: "rgba(6,3,0,0.60)",
    },
  },

  setStyle(name) {
    if (name === null || this.styles[name]) {
      if (this.style !== name) {
        this.style = name;
        this._buildParallax();
        if (this._W) {
          this._buildOverlay();   // grade+vignette in one canvas
          this._seedParticles();
        }
      }
    }
  },

  resize(W, H) {
    this._W = W; this._H = H;
    this.mobile = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent) || Math.min(W, H) < 500;
    this._buildParallax();
    this._buildOverlay();
    this._buildRays(W, H);
    this._seedParticles();
    this._heroSprite = null;
  },

  _buildParallax() {
    const st = this.style ? this.styles[this.style] : null;
    if (!st || !st.back || !this._W) { this.ridges = null; return; }
    const rnd = lcg(1234);
    this.ridges = st.back.map((color, li) => {
      const pts = [];
      const segs = 9 + li * 3;
      const baseY = this._H * (0.66 + li * 0.075);
      const amp = this._H * (0.11 - li * 0.025);
      for (let i = 0; i <= segs; i++) {
        pts.push({ x: (i / segs) * this._W * 1.3, y: baseY - rnd() * amp });
      }
      return { color, pts, par: 0.25 + li * 0.3 };
    });
  },

  /* THE optimization: vignette + front grade + grain pre-flattened
     into one half-res canvas. Per-frame cost: one drawImage. */
  _buildOverlay() {
    const st = this.style ? this.styles[this.style] : null;
    const W = this._W, H = this._H;
    const c = document.createElement("canvas");
    const s = 0.5;
    c.width = Math.max(2, Math.floor(W * s));
    c.height = Math.max(2, Math.floor(H * s));
    const g = c.getContext("2d");

    // color grade (front wash)
    if (st && st.grade2) { g.fillStyle = st.grade2; g.fillRect(0, 0, c.width, c.height); }

    // vignette
    const rad = g.createRadialGradient(
      c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.42,
      c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.72);
    rad.addColorStop(0, "rgba(0,0,0,0)");
    rad.addColorStop(1, st ? st.vign : "rgba(8,5,2,0.5)");
    g.fillStyle = rad;
    g.fillRect(0, 0, c.width, c.height);

    // film grain baked in (static position reads as texture, not noise —
    // and costs zero per frame)
    const gr = document.createElement("canvas");
    gr.width = gr.height = 128;
    const gg = gr.getContext("2d");
    const img = gg.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (118 + Math.random() * 74) | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    gg.putImageData(img, 0, 0);
    g.globalAlpha = 0.05;
    g.globalCompositeOperation = "overlay";
    g.fillStyle = g.createPattern(gr, "repeat");
    g.fillRect(0, 0, c.width, c.height);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";

    this.overlay = c;
  },

  _buildRays(W, H) {
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.floor(W / 2)); c.height = Math.max(2, Math.floor(H / 2));
    const g = c.getContext("2d");
    const rnd = lcg(777);
    g.translate(c.width * 0.15, 0);
    g.rotate(0.32);
    for (let i = 0; i < 5; i++) {
      const x = (i / 5) * c.width * 1.4 + rnd() * 30;
      const w = 14 + rnd() * 46;
      const lg = g.createLinearGradient(x, 0, x + w, 0);
      lg.addColorStop(0, "rgba(255,220,160,0)");
      lg.addColorStop(0.5, "rgba(255,220,160,0.85)");
      lg.addColorStop(1, "rgba(255,220,160,0)");
      g.fillStyle = lg;
      g.fillRect(x, -c.height * 0.2, w, c.height * 1.6);
    }
    this.godRay = c;
  },

  _seedParticles() {
    const st = this.style ? this.styles[this.style] : null;
    const scale = this.mobile ? 0.55 : 1;
    const n = st ? Math.round(st.dust * scale) : 12;
    this.dust = [];
    for (let i = 0; i < n; i++) this.dust.push(this._newDust(true));
    this.embers = [];
    this.rain = [];
    const rn = st ? Math.round(st.rain * scale) : 0;
    for (let i = 0; i < rn; i++) {
      this.rain.push({ x: Math.random() * this._W, y: Math.random() * this._H, l: 9 + Math.random() * 13, s: 620 + Math.random() * 380 });
    }
    this.flies = [];
    const fn = st ? Math.round(st.flies * scale) : 0;
    for (let i = 0; i < fn; i++) {
      this.flies.push({ x: Math.random() * this._W, y: this._H * (0.35 + Math.random() * 0.45), p: Math.random() * 9, sp: 0.6 + Math.random() });
    }
    // sprite cache (tinted dots)
    this._spr = {
      dust: makeDot(st ? st.dustC : "200,190,170"),
      emberA: makeDot("255,210,122"),
      emberB: makeDot("255,138,60"),
      fly: makeDot("235,255,170"),
    };
  },

  _newDust(spread) {
    return {
      x: Math.random() * this._W,
      y: spread ? Math.random() * this._H : -8,
      r: 0.6 + Math.random() * 1.9,
      vy: this.style && this.styles[this.style].ash ? 9 + Math.random() * 12 : -(4 + Math.random() * 10),
      vx: Math.random() * 8 - 4,
      p: Math.random() * 9,
    };
  },

  update(dt) {
    this.time += dt;
    this._frame++;
    const W = this._W, H = this._H;
    if (!W) return;
    const st = this.style ? this.styles[this.style] : null;

    for (const d of this.dust) {
      d.x += (d.vx + (st ? st.dustDrift : 0)) * dt + Math.sin(this.time * 0.7 + d.p) * 6 * dt;
      d.y += d.vy * dt;
      if (d.y < -12 || d.y > H + 12 || d.x < -12 || d.x > W + 12) Object.assign(d, this._newDust(false));
    }
    for (const e of this.embers) {
      e.y -= e.s * dt; e.x += Math.sin(this.time * 3 + e.p) * 22 * dt;
      e.a -= dt * 0.55;
    }
    if (this.embers.length && this._frame % 8 === 0) this.embers = this.embers.filter((e) => e.a > 0);
    for (const r of this.rain) {
      r.y += r.s * dt; r.x += 130 * dt;
      if (r.y > H) { r.y = -20; r.x = Math.random() * W * 1.2 - W * 0.2; }
    }
    for (const f of this.flies) {
      f.p += dt * f.sp;
      f.x += Math.sin(f.p * 1.3) * 26 * dt;
      f.y += Math.cos(f.p * 0.9) * 14 * dt;
    }
    if (this._hit > 0.01) this._hit = Math.max(0, this._hit - dt * 2.6);
  },

  spawnEmbers(x, y, n = 8, spread = 16) {
    const cap = this.mobile ? 26 : 46;
    for (let i = 0; i < n; i++) {
      if (this.embers.length > cap) break;
      this.embers.push({ x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread * 0.6, s: 30 + Math.random() * 60, a: 0.8 + Math.random() * 0.2, r: 1 + Math.random() * 2.2, p: Math.random() * 9 });
    }
  },

  /** parallax + rays + back wash — BEHIND the scene */
  begin(ctx) {
    const W = this._W, H = this._H, st = this.style && this.styles[this.style];
    if (!st) return;

    if (this.ridges) {
      for (const r of this.ridges) {
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = r.color;
        const off = (this.time * 4 * r.par) % (W * 0.3);
        ctx.beginPath();
        ctx.moveTo(-off, r.pts[0].y);
        for (const p of r.pts) ctx.lineTo(p.x - off, p.y);
        ctx.lineTo(W * 1.3 - off, H); ctx.lineTo(-off, H);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    if (st.rays > 0 && this.godRay) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = st.rays * (0.8 + 0.2 * Math.sin(this.time * 0.5));
      ctx.drawImage(this.godRay, 0, 0, W, H);
      ctx.restore();
    }

    if (st.grade) {
      ctx.fillStyle = st.grade;
      ctx.fillRect(0, 0, W, H);
    }
  },

  /** hero rim, particles, one composed overlay — IN FRONT */
  end(ctx) {
    const W = this._W, H = this._H;

    // hero rim light — one cached sprite blit, not a gradient
    const hs = this._hero;
    if (hs) {
      const size = Math.round(180 * (hs.s || 1));
      if (!this._heroSprite || this._heroSprite.size !== size) {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const g = c.getContext("2d");
        const grd = g.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
        grd.addColorStop(0, "rgba(255,205,130,0.22)");
        grd.addColorStop(0.55, "rgba(255,180,90,0.10)");
        grd.addColorStop(1, "rgba(255,170,80,0)");
        g.fillStyle = grd;
        g.fillRect(0, 0, size, size);
        this._heroSprite = { c, size };
      }
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.drawImage(this._heroSprite.c, hs.x - size / 2, hs.y - size / 2);
      ctx.restore();
    }

    const st = this.style && this.styles[this.style];
    if (st) {
      // dust / ash — sprite blits
      if (this.dust.length && st.dustA > 0) {
        ctx.save();
        const spr = this._spr.dust;
        for (const d of this.dust) {
          ctx.globalAlpha = st.dustA * (0.6 + 0.4 * Math.sin(this.time * 1.3 + d.p));
          const s = d.r * 6;
          ctx.drawImage(spr, d.x - s / 2, d.y - s / 2, s, s);
        }
        ctx.restore();
      }
      // embers
      if (this.embers.length) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        for (const e of this.embers) {
          ctx.globalAlpha = Math.max(0, e.a) * 0.9;
          const spr = e.a > 0.5 ? this._spr.emberA : this._spr.emberB;
          const s = e.r * 5;
          ctx.drawImage(spr, e.x - s / 2, e.y - s / 2, s, s);
        }
        ctx.restore();
      }
      // rain — one path stroke (unchanged, already cheap)
      if (this.rain.length) {
        ctx.save();
        ctx.strokeStyle = "rgba(170,200,220,0.34)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const r of this.rain) { ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - 3, r.y + r.l); }
        ctx.stroke();
        ctx.restore();
      }
      // fireflies — cached glow sprite
      if (this.flies.length) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const spr = this._spr.fly;
        for (const f of this.flies) {
          const a = 0.35 + 0.65 * Math.abs(Math.sin(f.p * 1.7));
          ctx.globalAlpha = a;
          ctx.drawImage(spr, f.x - 7, f.y - 7, 14, 14);
        }
        ctx.restore();
      }
    }

    // the one composed overlay (grade + vignette + grain)
    if (this.overlay) ctx.drawImage(this.overlay, 0, 0, W, H);

    // damage flash — edge vignette, only while armed
    if (this._hit > 0.01) {
      ctx.save();
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, "rgba(140,20,10,0)");
      g.addColorStop(1, `rgba(150,20,8,${0.5 * this._hit})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  },

  _hit: 0,
  _hero: null,
  hit(strength = 1) { this._hit = Math.min(1, this._hit + 0.6 * strength); },
  hero(x, y, s = 1) { this._hero = { x, y, s }; },
  clearHero() { this._hero = null; },
};
