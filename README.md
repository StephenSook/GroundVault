# GroundVault

> Confidential RWA impact lending vault for Community Land Trusts.
> Private capital for public-good housing. Confidential funding. Undeniable impact.

Built for the **iExec Vibe Coding Challenge**. Submission deadline: 2026-05-01.

---

## What it is

GroundVault is a confidential real-world-asset (RWA) impact lending vault. Verified impact investors deposit confidential tokens into a vault that funds affordable housing acquisition by Community Land Trusts (CLTs). The public sees aggregate vault health and total homes funded. Nobody sees individual positions.

Built on:

- **iExec Nox** — TEE-based confidential computing on Arbitrum, with on-chain ACLs for selective disclosure
- **ERC-7984** — Confidential Fungible Token (OpenZeppelin / Zama). Encrypted balances on-chain
- **ERC-3643** — T-REX permissioned token standard for verified investor compliance
- **ERC-7540-style async queue** — custom-implemented with `bytes32` confidential handles (NOT inherited, due to type incompatibility with ERC-7984)
- **Arbitrum Sepolia** — chain ID `421614`

## The problem

CLTs need two things that seem mutually exclusive on a public blockchain:

1. **Transparency** for donors and regulators to verify funds
2. **Privacy** for execution so predatory developers can't monitor a CLT's treasury, identify acquisition targets, and outbid them

Bank accounts give privacy but no programmable composability. Public smart contracts give composability but expose every balance and transaction. iExec Nox + ERC-7984 is the first primitive that holds both.

## Status

**Day 1 of 5 effective build days.** This repository is being scaffolded as part of the hackathon submission.

See [`PLAN.md`](./PLAN.md) for the full multi-phase implementation plan.

## Architecture

Eleven production contracts deployed to Arbitrum Sepolia (chain 421614), organized in five dependency layers. Full deployment manifest: [`deployments/arbitrumSepolia.json`](./deployments/arbitrumSepolia.json).

**Identity layer (ERC-3643 / T-REX 5-piece):**
- `ClaimTopicsRegistry` — required claim topics curated by the issuer
- `TrustedIssuersRegistry` — issuer → topic[] permission table
- `Identity` — per-investor claim store (deployed at onboarding time, not in the deploy batch)
- `IdentityRegistry` — wallet → Identity binding + ECDSA-verified `isVerified` gate

**Compliance layer:**
- `ModularCompliance` — token-bound contract that fans pre/post-transfer hooks out to modules
- `JurisdictionModule` — country allowlist module read from IdentityRegistry

**Token layer (ERC-7984 confidential):**
- `MockUSDC` — testnet ERC-20 underlying (6 decimals, owner-mintable)
- `cUSDC` — confidential wrap of MockUSDC; one-way wrap, encrypted balance + transfer
- `GroundVaultToken` — confidential vault-share token gated by `IdentityRegistry.isVerified` + `ModularCompliance.canTransfer`

**Vault:**
- `GroundVaultCore` — custom encrypted async deposit queue (PENDING → CLAIMABLE → CLAIMED). Adapts the ERC-7540 lifecycle to the bytes32 encrypted handles required by ERC-7984 (the standard's `uint256` shape doesn't fit). Cancel-after-timeout flow stubbed for Phase 2.6.

**Ancillary:**
- `GroundVaultRegistry` — housing opportunity metadata + ChainGPT Impact Risk Memo hash anchor (separate `MEMO_ROLE` so the memo automation account cannot edit asset records)
- `GroundVaultRouter` — read-only third-party composability proof (encrypted total supply, balance, pending, claimable handles)

Headline contracts for the demo: **GroundVaultToken**, **GroundVaultCore**, **GroundVaultRegistry**.

Frontend: React + Vite + Tailwind + wagmi v2 + ethers v6 + `@iexec-nox/handle`. Four screens: Investor Verification, Confidential Deposit Flow, Housing Opportunity Dashboard, ChainGPT Impact Risk Memo.

## Quick start

```bash
nvm use                 # uses .nvmrc -> Node 20
npm install
cp .env.example .env    # then fill PRIVATE_KEY and the API keys
npx hardhat compile
npx hardhat test        # 152 unit tests pass on the local hardhat network

# To deploy a fresh copy (skip if using the existing Sepolia deployment):
npx hardhat run scripts/deploy-all.js --network arbitrumSepolia
npx hardhat run scripts/verify-all.js --network arbitrumSepolia

# To re-run the live end-to-end integration test against the deployed contracts:
npx hardhat test test/integration/end-to-end.integration.js --network arbitrumSepolia
```

```bash
# Install
npm install

# Compile
npx hardhat compile

# Deploy to Arbitrum Sepolia
cp .env.example .env
# fill in PRIVATE_KEY, ARBITRUM_SEPOLIA_RPC_URL, ARBISCAN_API_KEY
npx hardhat run scripts/deploy.js --network arbitrumSepolia
```

## Hackathon framing

- Reg D 506(c) testnet prototype. Production launch requires securities counsel.
- ERC-3643 simulated as a whitelist (Identity Registry interface) for the MVP. The architecture is real; the identity issuer is mocked.
- TEE = hardware-trust model. Frame as "auditable confidentiality," not "trustless."

## Repo layout

```
contracts/         Solidity sources (Phase 2)
scripts/           Deploy + utility scripts
test/              Hardhat tests
frontend/          React + Vite UI (Phase 4)
deployments/       Network address artifacts
audits/            ChainGPT Smart Contract Auditor reports
PLAN.md            Multi-phase build plan
feedback.md        iExec SDK friction log (per challenge requirements)
LICENSE            MIT
```

## License

MIT — see [LICENSE](./LICENSE).

## Acknowledgments

- iExec for the Nox protocol and Vibe Coding Challenge
- OpenZeppelin and Zama for the ERC-7984 reference work
- Tokeny / ERC3643 Association for the T-REX standard
- Centrifuge / ERC4626-Alliance for the ERC-7540 reference
- Atlanta Land Trust, People's CLT, Athens Land Trust, and the broader Community Land Trust movement
- ChainGPT for the Web3 LLM and Smart Contract Auditor APIs
