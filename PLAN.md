# GroundVault — Ultra Plan

> Confidential RWA impact lending vault for Community Land Trusts.
> iExec Vibe Coding Challenge. Submission deadline **2026-05-01**. C-Day blackout **2026-04-29** (Nest project).
> Effective build days remaining as of 2026-04-25: **5** (Apr 25, 26, 27, 28, 30).

This plan covers the full project — Hardhat scaffold, smart contracts, deploy, frontend, integrations, demo, submission. It is a tweakable working document. Update phases as scope settles.

---

## Phase 0 — Repo init (today, ~20 min)

**Why first**: `/ultraplan` and other cloud-agent commands require a git repo. Background tasks fail otherwise.

```bash
cd /Users/stephensookra/Desktop/GroundVault
git init -b main
npm init -y
```

Folder structure to create:
```
GroundVault/
├── contracts/
│   ├── interfaces/
│   ├── IdentityRegistry.sol
│   ├── GroundVaultToken.sol
│   ├── GroundVaultCore.sol
│   └── GroundVaultRegistry.sol
├── scripts/
│   └── deploy.js
├── test/
│   └── GroundVault.test.js
├── frontend/                 # added in Phase 4
├── deployments/
├── ground/                   # existing PDFs (rename or move source PDFs in here)
├── .env.example
├── .env                      # gitignored
├── .gitignore
├── hardhat.config.js
├── PLAN.md                   # this file
├── README.md                 # final write-up at Phase 6
└── feedback.md               # **start Day 1**, log every iExec friction point
```

`.gitignore`:
```
node_modules
.env
artifacts
cache
typechain-types
deployments/localhost
frontend/node_modules
frontend/dist
.DS_Store
```

---

## Phase 1 — Hardhat scaffold (today, ~30 min)

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv
npx hardhat init        # choose "Create a JavaScript project" — skip TS for solo speed
npm install @iexec-nox/nox-protocol-contracts @iexec-nox/handle
npm install @openzeppelin/contracts
```

> **Confirmed 2026-04-25**: `@iexec-nox/nox-protocol-contracts` v0.1.0 was published 2026-04-09. Official scope. Discord question still open for any version-specific guidance, but install path is locked.

`hardhat.config.js` (Arbitrum Sepolia, chain 421614):
```js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { PRIVATE_KEY, ARBITRUM_SEPOLIA_RPC_URL, ARBISCAN_API_KEY } = process.env;

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    hardhat: { chainId: 31337 },
    arbitrumSepolia: {
      url: ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: { arbitrumSepolia: ARBISCAN_API_KEY || "" },
    customChains: [{
      network: "arbitrumSepolia",
      chainId: 421614,
      urls: {
        apiURL: "https://api-sepolia.arbiscan.io/api",
        browserURL: "https://sepolia.arbiscan.io"
      }
    }]
  }
};
```

`.env.example`:
```
PRIVATE_KEY=
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
ARBISCAN_API_KEY=
HUD_API_TOKEN=
CHAINGPT_API_KEY=
FRED_API_KEY=
```

Faucets to grab on Day 1:
- ETH: faucets.chain.link/arbitrum-sepolia, QuickNode, thirdweb, Alchemy
- RLC: iExec Discord (#vibe-coding) — needed if Nox runtime requires test RLC

---

## Phase 2 — Smart contracts (Apr 26, full day)

**3 contracts (each <300 lines, NatSpec required) + 1 interface.**

### 2.1 `IdentityRegistry.sol` (simulated ERC-3643 gate)
Owner-managed allowlist. Real T-REX has Identity Contract / Trusted Claim Issuer / Identity Registry / Compliance Module — for the hackathon MVP we collapse all four into a single mapping with the right interface so the architecture is honest about what's mocked.

State + functions:
- `mapping(address => bool) public verified`
- `event Verified(address indexed user)`
- `event Revoked(address indexed user)`
- `registerIdentity(address user) external onlyOwner`
- `revokeIdentity(address user) external onlyOwner`
- `isVerified(address user) external view returns (bool)`

### 2.2 `GroundVaultToken.sol` (ERC-7984 + ERC-3643 gate)
The investor share token. Confidential balances. Only verified addresses hold/transfer.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
```

Members:
- `IIdentityRegistry public immutable identityRegistry`
- `address public core`                          // GroundVaultCore — only minter/burner of share handles
- `mapping(address => euint256) private _balances`
- `event ConfidentialMint(address indexed to)`   // amounts encrypted
- `event ConfidentialBurn(address indexed from)`
- `event ConfidentialTransfer(address indexed from, address indexed to)`

Functions:
- `modifier onlyVerified(address a)` — `require(identityRegistry.isVerified(a))`
- `modifier onlyCore()` — `require(msg.sender == core)`
- `setCore(address _core)` — owner once
- `mint(address to, externalEuint256 calldata encAmount, bytes calldata proof) external onlyCore onlyVerified(to)` — `Nox.fromExternal` → `Nox.add` to balance, `Nox.allow(handle, to)`
- `burn(address from, euint256 amountHandle) external onlyCore` — `Nox.sub`
- `confidentialTransfer(address to, externalEuint256 calldata enc, bytes calldata proof) external onlyVerified(msg.sender) onlyVerified(to)`
- `balanceHandleOf(address a) external view returns (bytes32)` — for client decrypt

### 2.3 `GroundVaultCore.sol` (custom confidential async queue)
**No ERC-7540 inheritance.** ERC-7984 handles are `bytes32` / `euint256`; ERC-7540 expects `uint256`. Custom queue mirrors the three-state pattern + event names so external integrators recognize it.

State:
- `enum RequestState { NONE, PENDING, CLAIMABLE, CLAIMED, CANCELLED }`
- `struct Request { address controller; address receiver; bytes32 amountHandle; bytes32 sharesHandle; RequestState state; uint64 createdAt; uint64 updatedAt; }`
- `mapping(uint256 => Request) public requests`
- `uint256 public nextRequestId`
- `address public manager` (CLT director address)
- `GroundVaultToken public immutable shareToken`
- `IIdentityRegistry public immutable identityRegistry`
- Plaintext public counters: `uint256 public totalRequestsClaimed; uint256 public totalHomesFunded;`

Events (ERC-7540-style names):
- `event DepositRequested(uint256 indexed requestId, address indexed controller, bytes32 amountHandle)`
- `event DepositFulfilled(uint256 indexed requestId, bytes32 sharesHandle)`
- `event DepositClaimed(uint256 indexed requestId, address indexed receiver)`
- `event DepositCancelled(uint256 indexed requestId)`

Functions:
- `requestDeposit(externalEuint256 calldata enc, bytes calldata proof, address controller, address receiver) external onlyVerified(msg.sender) onlyVerified(receiver) returns (uint256 requestId)`
- `approveRequest(uint256 requestId, externalEuint256 calldata encShares, bytes calldata proof) external onlyManager` — sets state CLAIMABLE, attaches sharesHandle (the manager's share-rate calc happens off-chain in the TEE then is committed back encrypted)
- `claimDeposit(uint256 requestId) external` — only `controller`, requires CLAIMABLE, calls `shareToken.mint(receiver, sharesHandle)`, state → CLAIMED, increments `totalRequestsClaimed`
- `cancelRequest(uint256 requestId) external` — only PENDING, only controller, refunds via ACL, state → CANCELLED
- `markHomesFunded(uint256 n) external onlyManager` — bumps the public aggregate

### 2.4 `GroundVaultRegistry.sol` (housing opportunity metadata)
```solidity
struct Opportunity {
    uint256 id;
    string name;                    // "Trust at Oakland City - 964 Lawton St SW"
    string locationLabel;           // "Atlanta, GA 30310"
    uint256 fundingTargetUSD;       // public — for donor signal
    bytes32 confidentialFundingHandle;  // private exact target visible to manager + auditors
    bytes32 chainGPTMemoHash;       // anchors the off-chain memo
    string memoURI;                 // IPFS / arweave / data: URI
    bool active;
    uint64 fundedAt;
}
```
Functions: `addOpportunity`, `attachMemo(id, hash, uri)`, `markFunded(id)`, `getOpportunity`, `listActive`.

### 2.5 NatSpec + sanity audit
- Every external function gets `/// @notice` + `@param` + `@return`.
- Run **ChainGPT Smart Contract Auditor** on all 4 files — commit the report into `audits/` so it's visible in repo.
- Keep each file under 300 lines (challenge requirement).

---

## Phase 3 — Deploy + smoke tests (Apr 26 evening)

`scripts/deploy.js` flow:
1. Deploy `IdentityRegistry`
2. Deploy `GroundVaultToken(identityRegistry.address)`
3. Deploy `GroundVaultCore(token.address, identityRegistry.address, manager.address)`
4. `token.setCore(core.address)`
5. Deploy `GroundVaultRegistry()`
6. `identityRegistry.registerIdentity(deployer)` + `registerIdentity(<demo investor>)`
7. `registry.addOpportunity("Trust at Oakland City - 964 Lawton St SW", "Atlanta, GA 30310", 196713e18, ...)`
8. Write addresses to `deployments/arbitrumSepolia.json` for the frontend

`test/GroundVault.test.js` — minimum viable:
- Deploy all four locally with mocked Nox helpers (or skip on hardhat network if Nox mock unavailable; rely on Sepolia smoke test instead)
- `requestDeposit` rejects non-verified senders
- `approveRequest` only callable by manager
- `claimDeposit` only callable in CLAIMABLE state
- `cancelRequest` only in PENDING

> If the local Nox mock is unavailable, skip unit tests and rely on a Sepolia-only end-to-end smoke run. Note this in `feedback.md` as iExec SDK friction.

---

## Phase 4 — Frontend (Apr 27, full day)

Workflow: **Stitch (design) → Lovable (component gen) → Cursor / Claude Code (wire-up)**.

**Stitch prompt** (per MasterContext Section 8) is locked. Run that first. Pull React output into `frontend/`.

`frontend/` (Vite + React + Tailwind + wagmi v2 + ethers v6):
```
frontend/src/
├── App.tsx
├── components/
│   ├── VerificationGate/      # Screen 1
│   ├── DepositFlow/           # Screen 2 — 4-state stepper
│   ├── HousingDashboard/      # Screen 3 — HUD data + aggregate stats
│   └── ImpactMemo/            # Screen 4 — ChainGPT memo
├── hooks/
│   ├── useNoxBalance.ts       # createEthersHandleClient → decrypt
│   ├── useVaultStatus.ts      # poll request state by requestId
│   ├── useHudData.ts          # CHAS API
│   └── useChainGPT.ts         # Impact Risk Memo gen
└── contracts/
    ├── abis/                  # copied from ../artifacts after deploy
    └── addresses.ts           # imported from ../deployments/arbitrumSepolia.json
```

Color palette (locked): `#1a1a2e` (navy), `#0f3460` (royal), `#533483` (purple), white text, subtle green for success states.

Two-screen demo setup: open Arbiscan in one window, GroundVault dashboard in the other. Same chain, same block, opposite worlds.

---

## Phase 5 — Real-data integration (Apr 28)

End-to-end "no mocked data" requirement is a hard challenge gate.

1. **HUD CHAS** — register at huduser.gov, get bearer token, GET `/portal/dataset/chas-api` for Fulton County GA cost-burden D9. **Cache** the response into `frontend/src/data/chas-fulton.json` for the demo (rate limits + WiFi risk during recording).
2. **HUD User API** — Fair Market Rent + Income Limits for Atlanta (extra polish on the Housing Dashboard).
3. **Real property anchor** — 964 Lawton St SW, Atlanta GA 30310, $196,713, ≤80% AMI restriction (Atlanta Land Trust, Trust at Oakland City).
4. **ChainGPT Web3 LLM** — POST `https://api.chaingpt.org/chat/stream` with the Impact Risk Memo prompt from MasterContext Section 6; cache one response in case the live call lags during the recording.
5. **ChainGPT Smart Contract Auditor** — POST same base URL, model `smart_contract_auditor`, feed all 4 contract sources. Commit audit JSON.
6. **FRED API** — DGS10 series for "Treasury benchmark yield" display (small but signals maturity).

Day 1 admin tasks (do not skip):
- DM **@vladnazarxyz** on Telegram for free ChainGPT credits.
- Validate ERC-7984 ↔ async-queue assumption in iExec Discord. Even though we're going custom, get the team's blessing in writing — quotable in feedback.md.

---

## Phase 6 — Polish, demo, submit (Apr 30)

Apr 29 = **C-Day blackout** for Nest. GroundVault paused.

Apr 30 (Thu):
1. End-to-end run-through, fix any breakage from the day off.
2. Two-screen demo rehearsal × 20 (Sookra Golden Rule #5 — non-negotiable).
3. Record 4-min video. Script:
   - Hook 30s — Maria + 22.6M cost-burdened renter stat
   - Gap 30s — public chains expose, banks abandon composability
   - Findings 20s — Nox is the first primitive that holds both
   - Solution 20s — confidential vault + ERC-3643 + ERC-7540-style async
   - Demo 90s — two-screen "shouldn't be possible" run
   - Impact 20s — 300+ CLTs, 44k units, $35.9B RWA on-chain, $0 in affordability
   - Close 10s — "The blockchain proved it. Nobody knows who funded it."
4. Finalize `README.md`: install / `npx hardhat run scripts/deploy.js --network arbitrumSepolia` / contract addresses / frontend run / API key list / known limitations.
5. Finalize `feedback.md`: every Nox SDK friction point, every workaround. **Honesty scores better than silence.**
6. Push to public GitHub.
7. Post on X tagging **@iEx_ec** and **@Chain_GPT** with video + repo link.
8. Submit to DoraHacks before May 1 cutoff.

---

## Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ~~`@iexec-nox/*` npm scope wrong~~ | ~~Medium~~ | ~~High~~ | **Resolved 2026-04-25** — v0.1.0 published 2026-04-09, official scope confirmed |
| ERC-7984 + custom async stuck-state bug | Medium | High | `cancelRequest` from day one + Sepolia smoke test before recording |
| HUD API rate-limited during demo | Low | Medium | Cache response, ship JSON in repo |
| ChainGPT credits delayed | Low | Medium | Free tier (20K CGPTc/month) covers backup |
| Nox runtime needs test RLC we don't have | Medium | Medium | RLC faucet via Discord, grab Day 1 |
| Demo breaks during recording | Medium | Fatal | Pre-record one good take + keep backup file |
| `feedback.md` forgotten | Low | High (judging penalty) | Created Day 1, append-only |

---

## Locked design decisions (don't revisit without cause)

- **3 contracts, 4 screens**. Scope creep = lost hackathon.
- **Custom async queue, not ERC-7540 inheritance**. Reason: bytes32 vs uint256 type mismatch. See `feedback_erc7984_async_decision.md` in memory.
- **Real Atlanta property: 964 Lawton St SW**. Already validated in research.
- **ERC-3643 simulated as whitelist**. Frame in pitch as "compliance-by-design pattern", not "production T-REX".
- **Reg D 506(c) testnet prototype**. Never claim mainnet readiness or registered security.

---

## Differentiators (Sookra pillars)

| Pillar | GroundVault content |
|---|---|
| 1. Real problem, named person | Maria, 34, ED of Atlanta CLT, lost 3 properties this year to bot-front-running |
| 2. Structural gap | Privacy + composability impossible on public chains until Nox |
| 3. Human-scale stat | 22.6M U.S. renter households cost-burdened |
| 4. Tech inevitable | Nox + ERC-7984 = only primitive that holds private balances + DeFi composability |
| 5. Business numbers | 0.25% platform fee, $27B–$35.9B RWA TAM, $50K–$500K cost per CLT lost bid |

"One pinpoint problem. One overlooked population. One moment that makes the judge lean forward."
