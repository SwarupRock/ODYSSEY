#!/usr/bin/env node
/**
 * Bump VR live OTA version & hash in vr/vr_version.json so any connected Quest 3S running odyssey VR
 * receives the mandatory Home-Screen update notice and locks gameplay until updated.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vrManifestPath = path.join(root, 'vr', 'vr_version.json');
const current = JSON.parse(fs.readFileSync(vrManifestPath, 'utf8'));

const nextBuild = Number(current.build || 1) + 1;
const parts = String(current.version || '1.0.0').split('.').map(n => Number(n) || 0);
const nextVersion = `${parts[0]}.${parts[1]}.${(parts[2] || 0) + 1}`;
const noteArg = process.argv.slice(2).join(' ').trim();

current.build = nextBuild;
current.version = nextVersion;
if (noteArg) current.notes = noteArg;
current.hash = crypto
  .createHash('sha256')
  .update(JSON.stringify({ build: nextBuild, version: nextVersion, tuning: current.tuning, ts: Date.now() }))
  .digest('hex')
  .slice(0, 12);

fs.writeFileSync(vrManifestPath, JSON.stringify(current, null, 2) + '\n', 'utf8');
console.log(`Bumped VR OTA -> v${current.version} (build #${current.build}, hash=${current.hash})`);

