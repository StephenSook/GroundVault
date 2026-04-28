#!/usr/bin/env node
// Build-time copy of <repo>/audits/*.md into frontend/src/data/audits/.
//
// The audit reports live at the repo root for README/GitHub
// discoverability. The /audits route's auditsManifest.ts uses
// import.meta.glob to inline them at build time — but Vite's bundler
// only reliably resolves paths inside the Vite project root. When
// Vercel builds with frontend/ as the project root, the original
// glob path of "../../../audits/*.md" resolves to nothing and the
// page renders 0/11 contracts audited.
//
// This script syncs the markdown into frontend/src/data/audits/ so
// the glob path "@/data/audits/*.md" stays inside the project root.
// The destination is gitignored — it's a build artifact, not a
// source-of-truth.

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
