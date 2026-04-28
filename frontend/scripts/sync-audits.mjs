#!/usr/bin/env node
// Sync <repo>/audits/*.md → frontend/src/data/audits/*.md.
//
// The audit reports live at the repo root for README/GitHub
// discoverability, but the /audits route's auditsManifest.ts uses
// import.meta.glob to inline them at build time and the glob must
// resolve inside the Vite project root (frontend/) for Vercel's
// build container to find them. Run this script whenever the
// upstream audits change to refresh the in-source mirror, then
// commit the updated frontend/src/data/audits/ files.
//
// Run manually: npm run sync-audits
// (The mirror is checked in — NOT regenerated automatically by build.)

import { mkdirSync, copyFileSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const srcDir = join(repoRoot, "audits");
const destDir = resolve(here, "..", "src", "data", "audits");

let entries;
try {
  entries = readdirSync(srcDir, { withFileTypes: true });
} catch (err) {
  console.error(`[sync-audits] cannot read ${srcDir}:`, err.message);
  process.exit(1);
}

rmSync(destDir, { recursive: true, force: true });
mkdirSync(destDir, { recursive: true });

const mdFiles = entries
  .filter((e) => e.isFile() && e.name.endsWith(".md"))
  .map((e) => e.name);

for (const name of mdFiles) {
  copyFileSync(join(srcDir, name), join(destDir, name));
}

console.log(`[sync-audits] copied ${mdFiles.length} markdown files → src/data/audits/`);
