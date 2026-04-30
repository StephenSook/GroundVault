# GroundVault

> Confidential capital for Community Land Trusts.
> Private investor positions on a public chain — built on iExec Nox + ERC-7984.

[![Submitted](https://img.shields.io/badge/iExec_Vibe_Coding-Submitted-7d9b7e)](https://x.com/steve_social_/status/2049922873419038732)
[![Chain](https://img.shields.io/badge/chain-Arbitrum%20Sepolia%20(421614)-1f3a2a)](https://sepolia.arbiscan.io/address/0x8D008Fd6c2CCE89A59D50aF08e1DAFCE39cb283b)
[![Standards](https://img.shields.io/badge/ERC--7984%20·%20ERC--3643%20·%20ERC--7540-7d9b7e)](#architecture)
[![Audits](https://img.shields.io/badge/audits-10%2F11%20contracts-7d9b7e)](./audits/README.md)
[![Tests](https://img.shields.io/badge/tests-158%20passing-1f3a2a)](#tests)
[![License](https://img.shields.io/badge/license-MIT-1f3a2a)](./LICENSE)

iExec Vibe Coding Challenge submission · Reg D 506(c) testnet prototype · No real funds at risk.

---

## What it is

GroundVault is a confidential real-world-asset (RWA) impact lending vault. Verified investors deposit confidential dollars into a vault that funds permanent-affordability housing acquisition by Community Land Trusts (CLTs). The public sees aggregate vault health and total homes funded. **Nobody sees individual positions.**

The privacy primitive is the entire point. CLTs in cities like Atlanta have lost properties to predator-bot front-running (see Raymond et al., Georgia Tech 2021, and the WIRED RealT investigation). When a CLT's treasury is publicly readable on-chain, an institutional buyer with a copy of the chain state can outbid them by exactly enough to win every property of interest. ERC-7984 stores balances as bytes32 handles; iExec Nox grants decryption only to ACL-permitted addresses. **Same chain, same numbers, two completely different visibilities.**

## Live demo

| | |
|---|---|
| **Deployed dapp** | [groundvault-app.vercel.app](https://groundvault-app.vercel.app) (Arbitrum Sepolia) |
| **Demo video** | [4-minute walkthrough](https://youtu.be/S2SGKafsxLc) on YouTube |
| **Submission post** | [@steve_social_ on X](https://x.com/steve_social_/status/2049922873419038732) — tagging [@iEx_ec](https://x.com/iEx_ec) and [@Chain_GPT](https://x.com/Chain_GPT) |
| **DoraHacks BUIDL** | [BUIDL #43623](https://dorahacks.io/buidl/43623) on the iExec Vibe Coding Challenge page |
| **Registry contract** | [`0x8D008Fd6c2CCE89A59D50aF08e1DAFCE39cb283b`](https://sepolia.arbiscan.io/address/0x8D008Fd6c2CCE89A59D50aF08e1DAFCE39cb283b) on Arbitrum Sepolia |
| **All 11 contracts** | [`deployments/arbitrumSepolia.json`](./deployments/arbitrumSepolia.json) — every contract source-verified on Arbiscan |
| **Audit reports** | [`audits/`](./audits/README.md) — ChainGPT Smart Contract Auditor, 10/11 contracts (Router deferred on credit cap) |
| **Demo script** | [`docs/demo-script.md`](./docs/demo-script.md) — 4-minute timed walkthrough |
| **Citations** | [`docs/citations.md`](./docs/citations.md) — primary sources behind every numeric claim |

## The four screens

| | Screen | What it does |
|---|---|---|
| 1 | `/verify` | Deploy a per-user OnchainID Identity contract and bind it to `IdentityRegistry` with country claim 840 (US). |
| 2 | `/deposit` | Wrap mUSDC → cUSDC, submit an encrypted deposit, watch operator advance the queue, claim GVT shares. Public chain view shows bytes32 handles only. |
| 3 | `/housing` | Aggregate vault funding strip + the live housing opportunity (960 Lawton St SW, Atlanta) + the `Why confidentiality?` predator-bot panel. |
| 4 | `/housing/:id/memo` | ChainGPT-generated impact memo with HUD CHAS + FRED data, a keccak256 anchor on `GroundVaultRegistry`, and a Provenance card that flips green when the on-chain hash matches the rendered body byte-for-byte. |
| 5 | `/audits` | Severity rollup of every ChainGPT audit report with deep links to the markdown and the verified Solidity source. |
| 6 | `/operator` | Aggregate vault stats for an OPERATOR_ROLE wallet — encrypted total supply handle, deposit-queue throughput, regenerate health. |

## Architecture

Eleven production contracts on Arbitrum Sepolia, in five dependency layers:

```mermaid
flowchart TB
    subgraph identity["Identity layer (ERC-3643 / T-REX)"]
        CTR[ClaimTopicsRegistry]
        TIR[TrustedIssuersRegistry]
        ID[Identity per-user OnchainID]
        IR[IdentityRegistry]
    end

    subgraph compliance["Compliance layer"]
        MC[ModularCompliance]
        JM[JurisdictionModule]
    end

    subgraph token["Token layer (ERC-7984 confidential)"]
        MUSDC[MockUSDC underlying]
        CUSDC[cUSDC confidential wrap]
        GVT[GroundVaultToken share token]
    end

    subgraph vault["Vault"]
        CORE[GroundVaultCore async deposit queue]
    end

    subgraph ancillary["Ancillary"]
        REG[GroundVaultRegistry housing + memo anchor]
        ROUTER[GroundVaultRouter read-only proof]
    end

    IR --> CTR
    IR --> TIR
    IR -.-> ID
    JM --> IR
    MC --> JM
    GVT --> IR
    GVT --> MC
    CUSDC --> MUSDC
    CORE --> CUSDC
    CORE --> GVT
    ROUTER --> GVT
    ROUTER --> CORE

    classDef hilite fill:#7d9b7e,stroke:#1f3a2a,color:#fff
    class CORE,GVT,REG hilite
```

Headline contracts (highlighted): **GroundVaultToken**, **GroundVaultCore**, **GroundVaultRegistry**.

### Memo regenerate provenance flow

How `/housing/:id/memo` produces a real ChainGPT memo with a verifiable on-chain hash, end to end:

```mermaid
sequenceDiagram
    autonumber
    actor Op as Memo bot operator
    participant UI as GroundVault UI
    participant HUD as HUD CHAS
    participant FRED as FRED
    participant Proxy as /api/chaingpt (Vercel Edge)
    participant CG as ChainGPT LLM
    participant Reg as GroundVaultRegistry
    participant LS as Browser localStorage

    Op->>UI: click Regenerate memo
    par live data
        UI->>HUD: GET ?stateId=13&entityId=121
        HUD-->>UI: A17 / D8 / D5 → 23% severely cost-burdened
    and
        UI->>FRED: GET ?seriesId=DGS10
        FRED-->>UI: 4.36% (10-yr US Treasury)
    end
    UI->>Proxy: POST opportunity + context
    alt proxy reaches ChainGPT
        Proxy->>CG: POST /chat/stream
        CG-->>Proxy: streaming markdown
        Proxy-->>UI: { markdown }
    else Cloudflare gate blocks Vercel edge IPs
        UI->>CG: POST /chat/stream (browser-direct fallback)
        CG-->>UI: streaming markdown
    end
    UI->>UI: keccak256(markdown) = 0xb128…
    UI->>LS: stash markdown body for refresh-survival
    UI->>Reg: setMemo(opportunityId, hash, "")
    Reg-->>UI: tx confirmed (block 263998435)
    UI->>UI: re-read chain hash + LS body, recompute keccak
    Note over UI: keccak match → Provenance flips green Verified ✓
```

Tier 3 (local fallback memo with on-chain anchor) preserves the integrity story even if both ChainGPT paths fail — the body is hand-built from live HUD/FRED data, hashed, and anchored, with the Provenance card flipping amber instead of green.

### Confidential deposit lifecycle

What `/deposit` actually moves on chain — every state transition operates on bytes32 encrypted handles, never plaintext amounts:

```mermaid
sequenceDiagram
    autonumber
    actor Inv as Verified investor
    participant cUSDC as cUSDC (ERC-7984)
    participant Nox as iExec Nox TEE
    participant Core as GroundVaultCore (async queue)
    participant GVT as GroundVaultToken
    actor Op as Operator

    Note over Inv,Op: PENDING — confidential deposit submitted
    Inv->>cUSDC: wrap(amount) [amount visible — last public step]
    cUSDC->>Nox: encrypt(amount)
    Nox-->>cUSDC: bytes32 handle
    Inv->>cUSDC: confidentialTransfer(Core, handle)
    Inv->>Core: recordDeposit(handle, ticketId)

    Note over Inv,Op: CLAIMABLE — operator advances queue
    Op->>Core: processDeposit(ticketId)
    Core->>GVT: mint share handle to investor
    Core->>Nox: persist ACL grant to share token

    Note over Inv,Op: CLAIMED — investor takes shares
    Inv->>Core: claimDeposit(ticketId)
    Core->>GVT: transfer share handle to investor

    Note right of Op: Public chain reader sees only<br/>bytes32 handles after wrap.<br/>ACL holders (depositor, share token,<br/>operator) see decrypted dollars via Nox.
```

`cancelDepositTimeout` is stubbed for Phase 2.6 trust hardening — see `GroundVaultCore.sol` NatSpec for the threat model.

### Why a custom queue (not vanilla ERC-7540)

ERC-7540 specifies async deposit/redemption requests in `uint256`. ERC-7984 stores balances as `bytes32` encrypted handles. The two types do not compose: a literal ERC-7540 implementation would have to decrypt every queued amount on chain, which defeats confidentiality. `GroundVaultCore` keeps the lifecycle (PENDING → CLAIMABLE → CLAIMED) but operates entirely on bytes32 handles.

### Frontend

React + Vite + Tailwind + wagmi v2 + ethers v6 + `@iexec-nox/handle`. Vercel Edge proxies for ChainGPT and FRED keep API keys server-side. shadcn/ui + tailwindcss-animate for primitives; IBM Plex Serif/Mono + Inter for type. Forest/sage/cream palette throughout.

## Privacy story

| Public chain view | GroundVault view (with Nox ACL) |
|---|---|
| `confidentialTransfer(address,bytes)` call | `50.00 cUSDC transferred to vault` |
| `0x0000066eee23018f…` (handle) | `Vault aggregate: $4,250,000.00 USDC` |
| `recordDeposit(bytes32,bytes)` call | `pending: $50,000 of $250,000 acquisition` |

Public chain readers see opaque handles. ACL holders (the depositor + the share token + the operator) see decrypted dollars. A predator bot watching mempool sees enough to know an action happened, not enough to front-run it.

## Tests

158 unit tests on the local Hardhat network plus a live end-to-end integration test against the deployed Arbitrum Sepolia contracts. Run from the repo root:

```bash
nvm use                 # Node 20 from .nvmrc
npm install
cp .env.example .env    # fill PRIVATE_KEY, ARBITRUM_SEPOLIA_RPC_URL, ARBISCAN_API_KEY,
                        # CHAINGPT_API_KEY, FRED_API_KEY, HUD_CHAS_TOKEN
npx hardhat compile
npx hardhat test                                                            # 158 unit tests
npx hardhat test test/integration/end-to-end.integration.js \
    --network arbitrumSepolia                                               # live e2e
```

## Frontend dev

```bash
cd frontend
npm install
npm run dev             # http://localhost:8080
npm run build           # production bundle into frontend/dist
```

`VITE_ALLOW_DEMO_BYPASSES=1` enables `?wallet=mock` and `?status=verified` URL bypasses for design-state demos. Production builds should leave it unset.

## Deploying a fresh copy

The existing Arbitrum Sepolia deployment can be reused as-is. To deploy a fresh stack:

```bash
npx hardhat run scripts/deploy-all.js --network arbitrumSepolia
npx hardhat run scripts/verify-all.js --network arbitrumSepolia
```

Outputs go to `deployments/arbitrumSepolia.json`, which is the single source of truth the frontend reads via `frontend/src/lib/contracts.ts`.

## Hackathon framing

- **Reg D 506(c) testnet prototype.** Production launch requires securities counsel and a real KYC issuer. The on-chain compliance machinery is genuine; the identity issuer for the demo is the deployer wallet.
- **TEE = hardware-trust model**, not trustless. Frame as _auditable confidentiality_ — what a public chain reader cannot decrypt, a predator bot cannot front-run, but the steward (and a regulator with the right ACL) still can.
- **The CLT thesis is the point.** Tokenized RWA volume on public chains is ~$35.9B as of Nov 2025; $0 of it is permanent-affordability housing. The privacy primitive is the missing piece, not the marketing.

## Build cadence

5-day timeline visualized with [Gource](https://gource.io/) — 164 commits across 230 files, single contributor, color-matched to the rest of the brand. The day-by-day commit pattern (7 / 81 / 57 / 15 / 4) tells the build arc on its own: scaffold day, contract sprint, deploy + verify, integrations + frontend, demo polish.

[![GroundVault commit history time-lapse](docs/gource-preview.gif)](docs/gource.mp4)

[▶ Watch the full 36s render](docs/gource.mp4)

## Repo layout

```
contracts/         Solidity sources organized by layer
scripts/           Deploy + verify + utility scripts
test/              Hardhat unit tests + live integration tests
frontend/          React + Vite UI (six routes, Vercel-deployable)
deployments/       Network address artifacts (single source of truth)
audits/            ChainGPT Smart Contract Auditor reports + rollup
docs/              demo-script.md, citations.md, architecture notes
PLAN.md            Multi-phase implementation plan
feedback.md        iExec SDK friction log (per challenge requirements)
LICENSE            MIT
```

## License

MIT — see [LICENSE](./LICENSE).

## Acknowledgments

- **iExec** for the Nox protocol and the Vibe Coding Challenge
- **OpenZeppelin + Zama** for the ERC-7984 reference work (finalized 2025-07)
- **Tokeny / ERC3643 Association** for the T-REX standard ($32B+ tokenized assets)
- **Centrifuge / ERC4626-Alliance** for the ERC-7540 reference shape
- **ChainGPT** for the Web3 LLM and Smart Contract Auditor APIs
- **Atlanta Land Trust**, **People's CLT**, **Athens Land Trust**, and the broader CLT movement
- **HUD User CHAS** and **FRED** for the open public-data infrastructure that makes the impact memo possible
