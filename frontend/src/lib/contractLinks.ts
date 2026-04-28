// Helpers for rendering chain-side contract addresses with both
// (a) the Arbiscan view (bytecode + verified read/write surface) and
// (b) the actual Solidity source on GitHub. The latter is what
// developer-judges actually want to read; Arbiscan alone tells you
// the bytes are deployed, not what they do.

import { DEPLOYMENT, type ContractName } from "@/lib/contracts";

const GITHUB_REPO = "https://github.com/StephenSook/GroundVault";
const GITHUB_BRANCH = "main";
const ARBISCAN_BASE = "https://sepolia.arbiscan.io/address/";

// Per-contract Solidity source path within the repo, relative to repo
// root. Mirrors the layout under `contracts/` so a future structural
// reorg only needs to update this map.
const SOURCE_PATHS: Record<ContractName, string> = {
  ClaimTopicsRegistry: "contracts/identity/ClaimTopicsRegistry.sol",
  TrustedIssuersRegistry: "contracts/identity/TrustedIssuersRegistry.sol",
  IdentityRegistry: "contracts/identity/IdentityRegistry.sol",
  ModularCompliance: "contracts/compliance/ModularCompliance.sol",
  JurisdictionModule: "contracts/compliance/modules/JurisdictionModule.sol",
  MockUSDC: "contracts/mocks/MockUSDC.sol",
  cUSDC: "contracts/token/cUSDC.sol",
  GroundVaultToken: "contracts/token/GroundVaultToken.sol",
  GroundVaultCore: "contracts/vault/GroundVaultCore.sol",
  GroundVaultRegistry: "contracts/registry/GroundVaultRegistry.sol",
  GroundVaultRouter: "contracts/router/GroundVaultRouter.sol",
};

export function arbiscanAddressUrl(address: string): string {
  return `${ARBISCAN_BASE}${address}`;
}

export function githubSourceUrl(name: ContractName): string {
  return `${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${SOURCE_PATHS[name]}`;
}

export function githubAuditUrl(name: ContractName): string {
  return `${GITHUB_REPO}/blob/${GITHUB_BRANCH}/audits/${name}.md`;
}

/** Resolve a `0x…` address to the matching ContractName, if any. */
export function lookupContractName(address: string): ContractName | null {
  const lower = address.toLowerCase();
  for (const [name, c] of Object.entries(DEPLOYMENT.contracts)) {
    if (c.address.toLowerCase() === lower) return name as ContractName;
  }
  return null;
}
