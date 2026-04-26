// Refresh frontend/src/abis/*.json + frontend/src/lib/deployment.json from
// the project-root Hardhat artifacts and deployment manifest. Run after
// any contract redeploy.
//
// Usage (from frontend/):  node scripts/sync-deployment.js

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = join(here, "..");
const REPO_ROOT = join(FRONTEND_ROOT, "..");

const CONTRACTS = [
  "identity/ClaimTopicsRegistry",
  "identity/TrustedIssuersRegistry",
  "identity/Identity",
  "identity/IdentityRegistry",
  "compliance/ModularCompliance",
  "compliance/modules/JurisdictionModule",
  "token/cUSDC",
  "token/GroundVaultToken",
  "vault/GroundVaultCore",
  "registry/GroundVaultRegistry",
  "router/GroundVaultRouter",
  "mocks/MockUSDC",
];

const abisDir = join(FRONTEND_ROOT, "src", "abis");
if (!existsSync(abisDir)) mkdirSync(abisDir, { recursive: true });

for (const c of CONTRACTS) {
  const name = c.split("/").pop();
  const src = join(REPO_ROOT, "artifacts", "contracts", `${c}.sol`, `${name}.json`);
  const data = readFileSync(src).toString("utf8");
  if (!data) {
    console.warn(`  [warn] ${name}: empty artifact, skipping`);
    continue;
  }
  const json = JSON.parse(data);
  writeFileSync(
    join(abisDir, `${name}.json`),
    JSON.stringify({ abi: json.abi }, null, 2),
  );
  console.log(`  ${name} -> ${json.abi.length} entries`);
}

const manifestSrc = join(REPO_ROOT, "deployments", "arbitrumSepolia.json");
const manifestDst = join(FRONTEND_ROOT, "src", "lib", "deployment.json");
writeFileSync(manifestDst, readFileSync(manifestSrc));
console.log(`\nDeployment manifest copied -> ${manifestDst}`);
