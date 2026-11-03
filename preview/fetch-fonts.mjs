/* Dev-only helper: self-host the game's Google Fonts.
   Downloads the latin woff2 for each face styles.css uses and writes
   them into odyssey/fonts/. Run once: node preview/fetch-fonts.mjs   */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "fonts");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const CSS_URL =
  "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap";

// [family, style, weight, filename] — the faces the game actually styles with
const WANT = [
  ["Cinzel", "normal", 400, "cinzel-400.woff2"],
  ["Cinzel", "normal", 600, "cinzel-600.woff2"],
  ["Cinzel", "normal", 700, "cinzel-700.woff2"],
  ["Spectral", "normal", 400, "spectral-400.woff2"],
  ["Spectral", "italic", 400, "spectral-400i.woff2"],
  ["Spectral", "normal", 500, "spectral-500.woff2"],
  ["Spectral", "normal", 600, "spectral-600.woff2"],
];

const css = await fetch(CSS_URL, { headers: { "User-Agent": UA } }).then((r) => {
  if (!r.ok) throw new Error("css fetch " + r.status);
  return r.text();
});
const blocks = css.split("@font-face").slice(1);

fs.mkdirSync(OUT, { recursive: true });
let failures = 0;
for (const [family, style, weight, file] of WANT) {
  let url = null;
  for (const b of blocks) {
    if (!b.includes(`font-family: '${family}'`)) continue;
    if (!b.includes(`font-style: ${style}`)) continue;
    if (!b.includes(`font-weight: ${weight};`)) continue;
    if (!/unicode-range:[^;]*U\+0000-00FF/i.test(b)) continue; // latin subset
    const m = b.match(/url\((https:[^)]+\.woff2)\)/);
    if (m) url = m[1];
  }
  if (!url) {
    console.error("NO LATIN FACE for", family, style, weight);
    failures++;
    continue;
  }
  const buf = Buffer.from(await fetch(url, { headers: { "User-Agent": UA } }).then((r) => r.arrayBuffer()));
  fs.writeFileSync(path.join(OUT, file), buf);
  console.log(`${file}  ${Math.round(buf.length / 1024)}KB  ${url.slice(-24)}`);
}
if (failures) { console.error(`${failures} faces failed`); process.exit(1); }
console.log("all fonts written to", OUT);
