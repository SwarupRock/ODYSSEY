# ODYSSEY — The Long Way Home

A story-driven action-adventure across the seven stops of the Odyssey —
Troy to Ithaca — hand-drawn in code on a canvas, with a fully synthesized
lyre score. No installs, no build step, no image or audio assets.

## Play it

**Double-click `Play ODYSSEY.bat`** — it starts a tiny local server and
opens your browser at the game.

(Or any static server pointed at this folder, e.g. `npx http-server -p 8080`.
The game is pure ES modules, so it needs `http://` — opening `index.html`
directly with `file://` will not work.)

Progress saves automatically in the browser.

## Install as a real Android app (APK)

A ready-built APK sits in this folder: **`ODYSSEY.apk`** — copy it to your
phone (USB, email, Drive…) and open it (allow "install unknown apps" when
asked). It launches fullscreen in landscape, runs **completely offline**
(no INTERNET permission at all), and saves progress on the phone.

**Build it yourself in Android Studio:** open the **`android/`** subfolder
(`File → Open…`) — full instructions in `android/README.md`. The Gradle
wrapper config is included; Android Studio handles the rest.

### Which Android option is which?

| | APK (`ODYSSEY.apk`) | WiFi browser (URL below) |
|---|---|---|
| Needs the PC on | **no** | yes |
| Install | sideload once | Add to Home screen |
| Updates | rebuild APK | just reload |
| Best for | keep-it-forever, share | quick try today |

## Play it on your Android phone (browser)

1. Connect the phone to the **same WiFi** as this PC.
2. Make sure the server is running (double-click the .bat, or run
   `node preview/server.js`).
3. In Chrome on the phone, open the URL the server prints, e.g.
   **`http://192.168.10.4:8391/index.html`** (your PC's LAN IP).
4. Tap **⤓ Install on this device** on the title screen (or Chrome menu →
   *Add to Home screen*). The game launches fullscreen in landscape,
   like a native app.

**Offline:** once installed (or after one online load), the game is fully
cached by a service worker — it runs with **no internet and even with the
PC switched off**. Progress saves on the phone.

*Note:* the one-tap Install button appears when the page is a "secure
context" (served over https, or from localhost). On a plain-http LAN URL,
Chrome hides the button but *Add to Home screen* does the same thing.

## Voice overs & sound

The cast speaks: every dialogue line is performed with per-character voices
(Odysseus, Polyphemus, Circe, Penelope…) via the browser's built-in speech —
no downloads, works offline and in the APK. Toggle with the **🗣** button.
Each chapter has its own score (doomed dirge at Troy, cave menace, sailing
song, underworld drone, homecoming theme), and combat sounds are layered
with a generated hall reverb.

## Performance

Tuned for mid-range phones (verified on a Nothing Phone 2a target): all full-screen
effects render from one pre-composed overlay, particles are sprite blits, gradients
are cached, and the joystick uses a cached rect with a deadzone + response curve.
Mobile devices automatically get a lighter particle tier.

## Weapons & arrows — the Armory

From the title screen, **⚔ Armory** lists two racks, three tiers each:

- **Weapons** — Bronze Sword → Moly Blade → **Sword of Hector** (heaviest attacks cleave through crowds)
- **Arrows** — Broadhead Shafts (basic) → **Fire Arrows** (burning, stronger) → **Arrows of Apollo** (golden, best)

Tiers are **won in the story** (cave spoils, Circe's gifts, the shade's bequest) — you can't buy them. Equipping is a style choice: down-equip any tier you own; new bests auto-equip. Arrow tiers change both the damage and the arrow's look in flight (flame tongue / golden halo).

## Attack effects

Sword strikes throw **slash arcs with sparks, impact shockwaves and hit-stop freeze frames**; arrows leave **motion trails** and burst on impact (fire arrows burn, Apollo's flash gold). Heavier gear = heavier feedback.

## Film intro — the Trojan Horse

Starting a fresh voyage opens with a **cinematic title sequence**: title cards, the Horse against burning Troy, the wheel, the sack of the city — then the game begins at the fall. **Tap once to skip**; it only plays once per save.

## Cinematic visuals


Every chapter is color-graded like film: parallax horizon silhouettes, god rays, drifting
dust / embers / rain / fireflies, hero rim lighting, vignette and film grain — all drawn in
code (see `js/fx.js`), still zero image assets. Chapters shift mood live: the Straits turn
from rose dusk to abyss-black between Scylla and Charybdis.

## Controls on touch

- **Move / trim / steer** — press and hold the **left / right half** of the
  screen (the game is one big touch surface; swipe up/down steers the ship
  in Chapter V)
- **Action** (strike, cure, brew, advance story) — **tap**
- **Dodge** — swipe left / right in the Ithaca chapters
- WASD + SPACE still work on a keyboard, and on Android with a gamepad-style
  keyboard attached

## Controls

| Action | Keys |
| --- | --- |
| Move / sneak / trim / steer | **WASD** (or arrow keys) |
| Action — strike, cure, QTE, advance | **SPACE** or **ENTER** |
| Dialogue / choices | Any key advances; **W/S** + **ENTER** pick choices |
| Screens | **ENTER** confirms (never wipes your save), **ESC** backs out |
| Touch | Swipe halves / taps also work everywhere |

## The cast (who is who)

- **ODYSSEUS** — you, in every scene (blue cloak; red in battle)
- **AGAMEMNON** — the king who drags you to Troy (prologue)
- **POLYPHEMUS** — the cyclops (chapter I)
- **EURYLOCHUS** — the crewman who eyes the wind bag (chapter II)
- **POLITES, EURYLOCHUS, PERIMEDES** — your crew, swined by Circe (chapter III)
- **CIRCE** — the witch of Aiaia (chapter III)
- **ELPENOR, ANTICLEIA, AGAMEMNON, ACHILLES** — shades on the road (chapter IV)
- **TIRESIAS** — the blind prophet (chapter IV)
- **THE SIRENS** — three singers on the cliffs (chapter V)
- **SCYLLA** — the cliff above; **CHARYBDIS** — the whirlpool below (chapter V)
- **ANTINOUS** — lead suitor, your duel (chapter VI)
- **PENELOPE** — waiting at the loom (chapter VI ending)

Every character on screen wears a small bronze name tag, so you always
know who is who.

## Chapter III — curing your men (how it works)

1. **Gather** glowing herbs with WASD — walk into them.
2. **Walk to the hall** (center) and press **SPACE** to open the Brewing Bench.
3. Pick **H + M** (herb + mushroom) and press **Brew** — that's the
   Clarifying Draught. Wrong pairs fizzle and hand the ingredients back.
4. **Walk to a pig** (each wears his crewman's name) and press **SPACE** —
   he stands upright. Three cures and Circe comes out.
5. Wolves/lions **lunge** — SPACE mid-lunge drives them off. Curing a pig
   takes priority if both are in reach, so you can't lose your potion
   to a beast standing in the pig pen.

## Files

```
index.html        entry page (one page, everything in it)
styles.css        all styling — pottery palette, no images
js/engine.js      canvas engine, input axes, save system
js/audio.js       synthesized lyre score + SFX (WebAudio)
js/art.js         every character/scene drawn in code
js/ui.js          dialogue, choices, HUD, toasts
js/scenefw.js     chapter scene framework
js/main.js        screens, chapter registry, keyboard router
scenes/*.js       the seven chapters
fonts/            self-hosted Cinzel + Spectral (fully offline)
preview/server.js the little local server the launcher uses
android/          Android Studio project (APK wrapper)
ODYSSEY.apk       pre-built installable app
```
