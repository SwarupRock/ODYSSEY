/* ODYSSEY service worker — offline-first.
   The whole game is ~230KB of static files, so the install-once,
   serve-from-cache strategy is trivial and bulletproof:
   - install: pre-cache every game file (no images/audio — art and
     music are generated in code)
   - fetch: cache-first, refresh the copy in the background
   Version bump the CACHE name whenever you ship new files.        */

const CACHE = "odyssey-v13";
const FILES = [
  "/index.html",
  "/styles.css",
  "/manifest.webmanifest",
  "/fonts/cinzel-var.woff2",
  "/fonts/spectral-400.woff2",
  "/fonts/spectral-400i.woff2",
  "/fonts/spectral-500.woff2",
  "/fonts/spectral-600.woff2",
  "/js/engine.js",
  "/js/audio.js",
  "/js/art.js",
  "/js/ui.js",
  "/js/scenefw.js",
  "/js/main.js",
  "/js/gear.js",
  "/js/stick.js",
  "/js/fx.js",
  "/js/voice.js",
  "/js/combat.js",
  "/js/updater.js",
  "/js/pixelvfx.js",
  "/js/pixelfx/core/act.js",
  "/js/pixelfx/core/actor.js",
  "/js/pixelfx/core/chain.js",
  "/js/pixelfx/core/color.js",
  "/js/pixelfx/core/font.js",
  "/js/pixelfx/core/fx.js",
  "/js/pixelfx/core/index.js",
  "/js/pixelfx/core/math.js",
  "/js/pixelfx/core/painter.js",
  "/js/pixelfx/core/particles.js",
  "/js/pixelfx/core/poses.js",
  "/js/pixelfx/core/rig.js",
  "/js/pixelfx/core/scene.js",
  "/js/pixelfx/core/shapes.js",
  "/js/pixelfx/core/sim.js",
  "/js/pixelfx/fx/arcane/_lib.js",
  "/js/pixelfx/fx/arcane/magic-circle-cast.js",
  "/js/pixelfx/fx/arcane/rune-circle.js",
  "/js/pixelfx/fx/critters/_lib.js",
  "/js/pixelfx/fx/critters/butterfly.js",
  "/js/pixelfx/fx/critters/ghost.js",
  "/js/pixelfx/fx/critters/wisp.js",
  "/js/pixelfx/fx/explosions/_lib.js",
  "/js/pixelfx/fx/explosions/dirt-explosion.js",
  "/js/pixelfx/fx/explosions/small-explosion.js",
  "/js/pixelfx/fx/explosions/smoke-bomb.js",
  "/js/pixelfx/fx/fire/_lib.js",
  "/js/pixelfx/fx/fire/brazier.js",
  "/js/pixelfx/fx/fire/campfire.js",
  "/js/pixelfx/fx/fire/fire-ring.js",
  "/js/pixelfx/fx/fire/fireball.js",
  "/js/pixelfx/fx/fire/flame-pillar.js",
  "/js/pixelfx/fx/fire/spirit-flame.js",
  "/js/pixelfx/fx/fire/torch.js",
  "/js/pixelfx/fx/holy/_lib.js",
  "/js/pixelfx/fx/holy/blessing.js",
  "/js/pixelfx/fx/holy/divine-shield.js",
  "/js/pixelfx/fx/holy/feather-burst.js",
  "/js/pixelfx/fx/holy/heal.js",
  "/js/pixelfx/fx/holy/holy-pillar.js",
  "/js/pixelfx/fx/holy/smite.js",
  "/js/pixelfx/fx/holy/sunburst.js",
  "/js/pixelfx/fx/impacts/_lib.js",
  "/js/pixelfx/fx/impacts/blunt-hit.js",
  "/js/pixelfx/fx/impacts/crit-hit.js",
  "/js/pixelfx/fx/impacts/ground-slam.js",
  "/js/pixelfx/fx/impacts/heavy-landing.js",
  "/js/pixelfx/fx/impacts/hit-flash.js",
  "/js/pixelfx/fx/impacts/hit-spark.js",
  "/js/pixelfx/fx/impacts/impact-frame.js",
  "/js/pixelfx/fx/impacts/parry.js",
  "/js/pixelfx/fx/impacts/ricochet.js",
  "/js/pixelfx/fx/impacts/shield-block.js",
  "/js/pixelfx/fx/lightning/_lib.js",
  "/js/pixelfx/fx/lightning/lightning-strike.js",
  "/js/pixelfx/fx/lightning/storm-cloud.js",
  "/js/pixelfx/fx/lightning/thunderclap.js",
  "/js/pixelfx/fx/lightning/zap-hit.js",
  "/js/pixelfx/fx/melee/_lib.js",
  "/js/pixelfx/fx/melee/claw-swipe.js",
  "/js/pixelfx/fx/melee/dagger-flurry.js",
  "/js/pixelfx/fx/melee/double-slash.js",
  "/js/pixelfx/fx/melee/hammer-smash.js",
  "/js/pixelfx/fx/melee/heavy-cleave.js",
  "/js/pixelfx/fx/melee/scythe-reap.js",
  "/js/pixelfx/fx/melee/spear-sweep.js",
  "/js/pixelfx/fx/melee/spin-slash.js",
  "/js/pixelfx/fx/melee/sword-slash.js",
  "/js/pixelfx/fx/melee/thrust.js",
  "/js/pixelfx/fx/melee/uppercut.js",
  "/js/pixelfx/fx/melee/whip-crack.js",
  "/js/pixelfx/fx/moves/arrow-shot.js",
  "/js/pixelfx/fx/moves/dash-strike.js",
  "/js/pixelfx/fx/moves/ground-pound.js",
  "/js/pixelfx/fx/moves/sword-combo.js",
  "/js/pixelfx/fx/nature/_lib.js",
  "/js/pixelfx/fx/nature/boulder.js",
  "/js/pixelfx/fx/nature/healing-bloom.js",
  "/js/pixelfx/fx/nature/quake.js",
  "/js/pixelfx/fx/nature/tornado.js",
  "/js/pixelfx/fx/pickups/_lib.js",
  "/js/pixelfx/fx/pickups/collect-burst.js",
  "/js/pixelfx/fx/pickups/loot-beam.js",
  "/js/pixelfx/fx/pickups/potion.js",
  "/js/pixelfx/fx/projectiles/_lib.js",
  "/js/pixelfx/fx/projectiles/arrow.js",
  "/js/pixelfx/fx/spawn/_lib.js",
  "/js/pixelfx/fx/spawn/poof.js",
  "/js/pixelfx/fx/spawn/soul-rise.js",
  "/js/pixelfx/fx/status/_lib.js",
  "/js/pixelfx/fx/status/bleeding.js",
  "/js/pixelfx/fx/status/burning.js",
  "/js/pixelfx/fx/status/rage.js",
  "/js/pixelfx/fx/status/stunned.js",
  "/js/pixelfx/fx/transitions/_lib.js",
  "/js/pixelfx/fx/transitions/slash-wipe.js",
  "/js/pixelfx/fx/ui/_lib.js",
  "/js/pixelfx/fx/ui/combo-counter.js",
  "/js/pixelfx/fx/ui/crit-number.js",
  "/js/pixelfx/fx/ui/damage-number.js",
  "/js/pixelfx/fx/ui/exclamation.js",
  "/js/pixelfx/fx/ui/health-bar-hit.js",
  "/js/pixelfx/fx/water/_lib.js",
  "/js/pixelfx/fx/water/splash.js",
  "/js/pixelfx/fx/water/wave-crash.js",
  "/js/pixelfx/fx/water/whirlpool.js",
  "/js/pixelfx/fx/weather/_lib.js",
  "/js/pixelfx/fx/weather/fireflies.js",
  "/js/pixelfx/fx/weather/god-rays.js",

  "/scenes/prologue.js",
  "/scenes/ch1_cyclops.js",
  "/scenes/ch2_winds.js",
  "/scenes/ch3_circe.js",
  "/scenes/ch4_underworld.js",
  "/scenes/ch5_straits.js",
  "/scenes/ch6_ithaca.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  const add = async (c, f) => {
    try { await c.add(new Request(f, { cache: "reload" })); }
    catch { try { await c.add(new Request(f, { cache: "reload" })); } catch {} }
  };
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.allSettled(FILES.map((f) => add(c, f))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      const refresh = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || refresh;
    })
  );
});
