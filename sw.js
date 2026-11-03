/* ODYSSEY service worker — offline-first.
   The whole game is ~230KB of static files, so the install-once,
   serve-from-cache strategy is trivial and bulletproof:
   - install: pre-cache every game file (no images/audio — art and
     music are generated in code)
   - fetch: cache-first, refresh the copy in the background
   Version bump the CACHE name whenever you ship new files.        */

const CACHE = "odyssey-v9";
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
