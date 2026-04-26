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

Three smart contracts, each under 300 lines:

- **GroundVaultToken** — ERC-7984 confidential share token gated by ERC-3643 whitelist
- **GroundVaultCore** — custom confidential async deposit queue (PENDING → CLAIMABLE → CLAIMED → CANCELLED)
- **GroundVaultRegistry** — housing opportunity metadata + ChainGPT Impact Risk Memo hash anchor

Frontend: React + Vite + Tailwind + wagmi v2 + ethers v6. Four screens: Investor Verification, Confidential Deposit Flow, Housing Opportunity Dashboard, ChainGPT Impact Risk Memo.

## Quick start

> Once Phase 1 lands. Pre-scaffold for now.

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
