/* ============================================================
   ODYSSEY — scripts/bump-update.mjs
   Generates / bumps version.json for Over-The-Air APK updates.
   Usage:
     node scripts/bump-update.mjs "Short patch note"
     node scripts/bump-update.mjs --init "Initial OTA release"
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(root, "version.json");

const INCLUDE_DIRS = ["js", "scenes", "fonts", "icons", "audio"];
const INCLUDE_ROOT_FILES = ["index.html", "styles.css", "manifest.webmanifest", "sw.js"];

function walk(dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  const out = [];
  for (const e of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.posix.join(dir.replace(/\\/g, "/"), e.name);
    if (e.isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

const files = [
  ...INCLUDE_ROOT_FILES.filter((f) => fs.existsSync(path.join(root, f))),
  ...INCLUDE_DIRS.flatMap(walk),
].sort();

const h = crypto.createHash("sha256");
for (const rel of files) {
  h.update(rel + "\n");
  h.update(fs.readFileSync(path.join(root, rel)));
}
const hash = h.digest("hex").slice(0, 12);

const args = process.argv.slice(2);
const isInit = args.includes("--init");
const verIdx = args.indexOf("--ver");
const customVer = verIdx >= 0 ? args[verIdx + 1] : null;
const notesArgs = args.filter((a, i) => a !== "--init" && a !== "--ver" && (verIdx < 0 || i !== verIdx + 1));
const notes = notesArgs.join(" ").trim() || "Bug fixes, combat & visual polish";

let prev = { version: "1.2.0", build: 2 };
if (fs.existsSync(manifestPath)) {
  try {
    prev = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {}
}

let nextBuild = isInit ? (prev.build || 2) : (Number(prev.build) || 2) + 1;
let nextVer = customVer || prev.version || "1.2.0";
if (!isInit && !customVer && prev.version) {
  const parts = prev.version.split(".").map((n) => parseInt(n, 10));
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    parts[2] += 1;
    nextVer = parts.join(".");
  }
}

const manifest = {
  version: nextVer,
  build: nextBuild,
  mandatory: true,
  hash,
  notes,
  baseUrl: prev.baseUrl || "https://raw.githubusercontent.com/SwarupRock/ODYSSEY/main/",
  files,
};

const jsonText = JSON.stringify(manifest, null, 2) + "\n";
fs.writeFileSync(manifestPath, jsonText, "utf8");
const assetsManifest = path.join(root, "android", "app", "src", "main", "assets", "version.json");
if (fs.existsSync(path.dirname(assetsManifest))) {
  fs.writeFileSync(assetsManifest, jsonText, "utf8");
}

console.log(`Generated version.json -> v${manifest.version} (build ${manifest.build}, hash ${manifest.hash}, ${files.length} files)`);

