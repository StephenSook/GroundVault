# GroundVault — Build Plan (v2)

> Confidential RWA impact lending vault for Community Land Trusts.
> iExec Vibe Coding Challenge. Deadline **2026-05-01**. C-Day (Nest) blackout **2026-04-29**.
> Anchor date this revision: **2026-04-25 evening (Atlanta EDT)**. Effective build days remaining: **4** (Apr 26 + Apr 27 + Apr 28 + Apr 30) plus the setup tail tonight.
> Repo: https://github.com/StephenSook/GroundVault

This is a tweakable working document. Update each phase as scope settles. v2 absorbs: `/ultraplan` cloud review findings, DoraHacks rules ("partial ERC implementations not valid"), and live npm package state for `@iexec-nox/nox-protocol-contracts@0.2.2`.

---

## Locked decisions

- **Stack pins**: Solidity `^0.8.27`, OpenZeppelin Contracts `^5.6.1`, `@iexec-nox/nox-protocol-contracts ^0.2.2`, `@iexec-nox/handle ^0.1.0-beta.10`, `encrypted-types ^0.0.4`, Hardhat `^2.22`, Node 20.
- **Network**: Arbitrum Sepolia, chain `421614`. NoxCompute pre-deployed at `0xd464B198f06756a1d00be223634b85E0a731c229` — we don't deploy it, the library resolves it via chain ID.
- **Encrypted types** (from `encrypted-types/EncryptedTypes.sol`): `ebool`, `euint16`, `euint256`, `eint16`, `eint256`, plus their `external*` request types.
- **ACL pattern**: `Nox.allow(handle, account)` per recipient. There is no `allowAll` in the library; the PDF skeleton was speculative.
- **ERC-3643 implementation**: full T-REX interface set (IIdentityRegistry, IClaimTopicsRegistry, ITrustedIssuersRegistry, IModularCompliance, ONCHAINID-shaped per-investor contract). DoraHacks rules: "partial implementations will not be considered valid." A whitelist-only mock would be disqualifying.
- **ERC-7540 implementation**: full canonical surface area, with encrypted-type adaptation per the rules' "when applicable" clause. Function names, event names, lifecycle (PENDING → CLAIMABLE → CLAIMED), operator/controller/receiver triple — all preserved. Asset/share types swap to `bytes32` handles.
- **ERC-7984 deposit asset**: real one. Mock USDC ERC-20 deployed locally + wrapped to confidential `cUSDC` via cDeFi Wizard. Investors deposit `cUSDC` handles into the vault.
- **Frontend host**: Vercel (winners get hosting covered for 1 year per challenge terms — design for that).
- **Submission flow**: DoraHacks BUIDL form + X post (tagging `@iEx_ec` and `@Chain_GPT`) + public GitHub repo + 4-min demo video + `feedback.md` in repo root.
- **Persona**: Maria is a composite persona modeled on real Atlanta CLT executive directors. Label as composite in the pitch script. Source the predatory-bid pattern via Raymond et al. NLIHC PDF + RealT Detroit case (Wired investigation).

---

## Architecture (8 production contracts + 1 stretch)

```
contracts/
├── identity/
│   ├── Identity.sol                # ONCHAINID-shaped per-investor contract
│   ├── IdentityRegistry.sol        # full ERC-3643 IIdentityRegistry
│   ├── ClaimTopicsRegistry.sol     # IClaimTopicsRegistry
│   └── TrustedIssuersRegistry.sol  # ITrustedIssuersRegistry
├── compliance/
│   ├── ModularCompliance.sol       # IModularCompliance hub
│   └── modules/
│       └── JurisdictionModule.sol  # one real, working compliance module
├── GroundVaultToken.sol            # ERC-7984 confidential share token, ERC-3643 gated, Pausable
├── GroundVaultCore.sol             # full ERC-7540 surface (encrypted-type adapted), Pausable, ReentrancyGuard
├── GroundVaultRegistry.sol         # housing opportunity metadata + ChainGPT memo hash anchor
└── composability/
    └── GroundVaultRouter.sol       # tiny composability proof — reads vault handle, triggers confidential transfer

stretch/
└── iapp/                           # Phase 2.6 — iExec iApp for TEE off-chain share-rate compute
```

`GroundVaultToken` keeps each investor's balance as `euint256`. `balanceHandleOf` is ACL-gated to the holder (no public reads of any handle). The vault contract receives a transient ACL via `Nox.allowThis` to operate on the handle during the deposit lifecycle.

`GroundVaultCore` implements every required ERC-7540 function:

```
requestDeposit(externalEuint256 enc, bytes proof, address controller, address owner) → uint256 requestId
pendingDepositRequest(uint256 requestId, address controller) view → bytes32 pendingHandle
claimableDepositRequest(uint256 requestId, address controller) view → bytes32 claimableHandle
deposit(uint256 requestId, address receiver, address controller) → bytes32 sharesHandle
mint(uint256 requestId, address receiver, address controller) → bytes32 sharesHandle    // overload form

requestRedeem(externalEuint256 encShares, bytes proof, address controller, address owner) → uint256 requestId
pendingRedeemRequest(uint256 requestId, address controller) view → bytes32 pendingHandle
claimableRedeemRequest(uint256 requestId, address controller) view → bytes32 claimableHandle
redeem(uint256 requestId, address receiver, address controller) → bytes32 assetsHandle
withdraw(uint256 requestId, address receiver, address controller) → bytes32 assetsHandle  // overload form

cancelDeposit(uint256 requestId)             // PENDING only
cancelDepositTimeout(uint256 requestId)      // CLAIMABLE → stuck escape after configurable timeout
setOperator(address operator, bool approved)
isOperator(address controller, address operator) view → bool
```

Events: `DepositRequest`, `RedeemRequest`, `OperatorSet` — canonical names. Plus our own: `DepositFulfilled`, `DepositClaimed`, `DepositCancelled`, `Paused`, `Unpaused`.

Plus internal manager-only: `approveDeposit(uint256 requestId, externalEuint256 encShares, bytes proof)` moves PENDING→CLAIMABLE with the share-rate-encoded handle. In Phase 2.6 stretch, this becomes a call from the iApp's TEE-signed result.

---

## Phase 0 — Setup tail (tonight, Apr 25, ~2 hr)

Git repo + license + initial commit are **already done**. Remaining tonight:

### Code-side (commits)
- `feedback.md` skeleton at repo root — judging requirement, must be present from Day 1
- `.nvmrc` pinning Node 20
- `.github/workflows/ci.yml` — `hardhat compile` + `hardhat test` on push to main + every PR
- `docs/citations.md` — Atlanta property source URL, HUD CHAS docs, RealT Detroit Wired investigation, Raymond et al., research evidence pack

### Operational admin (do in parallel — no commits, but unblock Day 1)
1. **iExec Discord** — confirm joined https://discord.gg/RXYHBJceMe and watching #vibe-coding
2. **HUD CHAS API token** — register at huduser.gov/portal/dataset/chas-api.html (approval can take 24-48 hr — register tonight)
3. **ChainGPT credits** — DM `@vladnazarxyz` on Telegram for free hackathon credits
4. **DoraHacks BUIDL** — register submission at https://dorahacks.io/hackathon/vibe-coding-iexec/detail
5. **Arbitrum Sepolia ETH** — grab from `faucets.chain.link/arbitrum-sepolia` + Alchemy + thirdweb (have 2-3 on hand)
6. **iExec RLC testnet** — claim from RLC faucet via Discord
7. **Atlanta property source** — save Atlanta Land Trust "Trust at Oakland City" listing URL into `docs/citations.md` (964 Lawton St SW, $196,713, ≤80% AMI)
8. **Vercel** — create Vercel project pointed at the GitHub repo (preview deploys from main)

---

## Phase 1 — Hardhat scaffold (Apr 26 morning, ~3 hr)

Per-step commits.

```bash
# verify package (already done — 0.2.2 confirmed live)
npm view @iexec-nox/nox-protocol-contracts version

# init non-interactive (avoid hardhat init prompts)
npm init -y
npm install --save-dev hardhat@^2.22 @nomicfoundation/hardhat-toolbox dotenv
npm install @openzeppelin/contracts@^5.6.1 \
            @iexec-nox/nox-protocol-contracts@^0.2.2 \
            @iexec-nox/handle@^0.1.0-beta.10 \
            encrypted-types@^0.0.4

# write hardhat.config.js manually (non-interactive)
# write .env.example manually
# write a Counter.sol smoke test contract → hardhat compile → confirm Solidity 0.8.27 toolchain works
```

`hardhat.config.js` (Solidity 0.8.27 + viaIR for confidential type stack-depth headroom + Arbiscan v2):

```js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { PRIVATE_KEY, ARBITRUM_SEPOLIA_RPC_URL, ARBISCAN_API_KEY } = process.env;

module.exports = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true                        // confidential types push the stack; viaIR avoids "stack too deep"
    }
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

End-of-Phase-1 sanity: empty `Counter.sol` compiles, deploys to Sepolia, Etherscan-verifies. Catches toolchain breakage before any complex work.

---

## Phase 2 — Smart contracts (Apr 26 afternoon + Apr 27 full day, ~12 hr)

Each contract = its own commit minimum. Big files split (interface commit + impl commit) where helpful for git history clarity.

### 2.1 Mock USDC + cUSDC wrap
- Deploy a 6-decimal `MockUSDC.sol` (mintable to whitelisted addresses for the demo)
- Use cDeFi Wizard (cdefi-wizard.iex.ec) to generate `cUSDC.sol` — ERC-7984 confidential wrapper
- Investors `wrap(USDC) → cUSDC` before depositing, `unwrap(cUSDC) → USDC` after redeeming
- Frame in pitch as: "real ERC-20 in, confidential balance out"

### 2.2 ERC-3643 / T-REX full implementation
Five contracts. Each <300 lines.
- `Identity.sol` — ONCHAINID-shaped per-investor contract. Holds claims (KYC done, accredited investor, jurisdiction). Functions: `addClaim`, `removeClaim`, `getClaim`, `getKey`, `keyHasPurpose`.
- `ClaimTopicsRegistry.sol` — admin-managed list of required claim topics for vault eligibility
- `TrustedIssuersRegistry.sol` — admin-managed list of issuer addresses authorized to issue claims for specific topics
- `IdentityRegistry.sol` — wires the above. `registerIdentity`, `deleteIdentity`, `updateIdentity`, `isVerified`, `identity(address)`, `investorCountry`, `contains`. `isVerified` checks every required claim topic is signed by a trusted issuer.
- `ModularCompliance.sol` — pluggable compliance module hub. `bindToken`, `addModule`, `removeModule`, `canTransfer(from, to, amount)`, `transferred(from, to, amount)`, `created(to, amount)`, `destroyed(from, amount)`. One real module wired:
- `compliance/modules/JurisdictionModule.sol` — blocks transfers from sanctioned jurisdictions; allowlist of `country → bool`

For the demo, the deployer is registered as a Trusted Issuer for the KYC topic, and the demo investor address is registered with a real on-chain claim. The architecture is real; only the off-chain KYC oracle is the deployer's signature instead of a third-party provider — flagged in pitch script.

### 2.3 GroundVaultToken — ERC-7984 confidential share + ERC-3643 gated
```solidity
import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {IIdentityRegistry} from "./identity/IIdentityRegistry.sol";
import {IModularCompliance} from "./compliance/IModularCompliance.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
```

Members:
- `IIdentityRegistry public immutable identityRegistry`
- `IModularCompliance public immutable compliance`
- `address public core`                                   // GroundVaultCore — sole minter/burner
- `mapping(address => euint256) private _balances`

Functions:
- modifier `onlyCore` and modifier `onlyVerified(address a)` checks `identityRegistry.isVerified(a)`
- `balanceHandleOf(address account) external view returns (bytes32)` — **ACL-gated**: requires `msg.sender == account` OR `compliance.isAuditor(msg.sender)`. No public reads.
- `mint(address to, externalEuint256 enc, bytes proof) external onlyCore onlyVerified(to) whenNotPaused` — `Nox.fromExternal` → `Nox.add`, `Nox.allow(newBalance, to)`, `compliance.created(to, ...)` (encrypted amount semantics adapted)
- `burn(address from, euint256 amountHandle) external onlyCore whenNotPaused`
- `confidentialTransfer(address to, externalEuint256 enc, bytes proof) external onlyVerified(msg.sender) onlyVerified(to) whenNotPaused` — ERC-7984 transfer flow
- `pause() / unpause() onlyOwner`
- Events: `ConfidentialMint(address indexed to)`, `ConfidentialBurn(address indexed from)`, `ConfidentialTransfer(address indexed from, address indexed to)` — no readable amounts

### 2.4 GroundVaultCore — full ERC-7540 surface (encrypted-type adapted)
Functions, events, lifecycle from the Architecture section above.
- `Pausable` + `ReentrancyGuard` (OZ) on every external state-mutating function
- `cancelDepositTimeout(uint256)` activates after `depositTimeoutSec` (default 7 days) — configurable by owner. Refunds via ACL re-grant.
- `manager`-only `approveDeposit(...)` accepts the share-rate handle. In Phase 2.6 stretch this is replaced with iApp TEE-signed input.
- Plaintext public counters: `totalRequestsClaimed`, `totalHomesFunded` — these are aggregate-only, never per-investor.
- NatSpec `///` on every external function.

### 2.5 GroundVaultRegistry — housing opportunity metadata
```solidity
struct Opportunity {
    uint256 id;
    string name;                          // "Trust at Oakland City - 964 Lawton St SW"
    string locationLabel;                 // "Atlanta, GA 30310"
    uint256 fundingTargetUSD;             // public floor; donor signal
    bytes32 confidentialFundingHandle;    // private exact target visible to manager + auditors
    bytes32 chainGPTMemoHash;             // anchors off-chain memo
    string memoURI;                       // ipfs:// or arweave:// or data: URI
    bool active;
    uint64 fundedAt;
}
```
Functions: `addOpportunity`, `attachMemo`, `markFunded`, `getOpportunity`, `listActive`, `setActive`. `attachMemo` enforces `keccak256(memoBytes) == chainGPTMemoHash` if memo body provided — the frontend re-fetches memo URI and must match the on-chain hash. Without that check, the anchor is theater (cloud reviewer flag).

### 2.6 GroundVaultRouter — composability proof (Pillar 2)
Tiny demo contract. One function:
```solidity
function depositForOpportunity(
    uint256 opportunityId,
    externalEuint256 encAmount,
    bytes calldata proof
) external onlyVerified(msg.sender) {
    require(registry.isActive(opportunityId), "GVR: inactive");
    // calls cUSDC.confidentialTransferFrom → vault
    // calls core.requestDeposit on behalf of msg.sender
    emit RoutedDeposit(opportunityId, msg.sender);
}
```
Reads a `bytes32` confidential handle from `cUSDC` (ERC-7984), passes it through ERC-7540 lifecycle. **Two confidential standards composing in one tx** — the pitch payoff for "privacy + composability."

### 2.7 Phase 2.6 — iApp / TEE off-chain compute (STRETCH, gated on Apr 27 EOD)
**Gate**: only build this if all 8 production contracts are deployed + smoke-tested on Sepolia by Apr 27 EOD. Otherwise defer + frame in pitch as "next iteration."

If on:
- Use `@iexec/iapp` CLI to scaffold a Confidential App
- iApp reads encrypted deposit handles, computes share-rate against off-chain NAV (HUD-anchored), returns signed `externalEuint256` share handle
- Worker pool execution → result delivered to `GroundVaultCore.approveDeposit` via signed message
- Replaces manager-EOA discretion with verifiable TEE computation
- README: "share-rate oracle running in iExec TEE" — judge-leaning sentence

### 2.8 Audit + NatSpec
- Run **ChainGPT Smart Contract Auditor** on every contract; commit JSON reports to `audits/`
- Severity Critical/High → fix before deploy. Med/Low → triage; document in feedback.md if deferred.
- Every external function gets `///` NatSpec with `@notice`, `@param`, `@return`.

---

## Phase 3 — Deploy + tests (Apr 27 evening + Apr 28 morning, ~4 hr)

`scripts/deploy.js` order:
1. `MockUSDC` → mint to demo wallet
2. `ClaimTopicsRegistry`, `TrustedIssuersRegistry`
3. `Identity` factory deploy + register deployer as Trusted Issuer
4. `IdentityRegistry` (wired to above)
5. `JurisdictionModule` → `ModularCompliance` (bind module)
6. `cUSDC` (cDeFi Wizard ERC-7984 wrapper of MockUSDC)
7. `GroundVaultToken` (registry + compliance addresses)
8. `GroundVaultCore` (token + cUSDC + manager addresses)
9. `GroundVaultRegistry`
10. `GroundVaultRouter` (registry + core + cUSDC)
11. `token.setCore(core)`
12. Register demo investor identity + add KYC claim
13. Add 1 demo opportunity (964 Lawton St SW, Atlanta GA 30310)
14. Save addresses → `deployments/arbitrumSepolia.json`
15. **`npx hardhat verify --network arbitrumSepolia <addr>` for every deployed contract** — Arbiscan-verified source is judge table-stakes

`test/`:
- `test/happy-path.test.js` — full lifecycle on Hardhat local: wrap → request → approve → claim shares → request redeem → claim assets
- `test/access.test.js` — ERC-3643 gate rejects non-verified, manager-only on approve
- `test/state.test.js` — claim only in CLAIMABLE, cancel only in PENDING, timeout escape works
- `test/composability.test.js` — Router runs end-to-end through cUSDC + Core
- If `Nox` library has no Hardhat-network mock → skip locally and run e2e on Sepolia (document in feedback.md)

---

## Phase 4 — Frontend (Apr 28 + Apr 30, ~10 hr split)

Tools: Stitch (design) → Lovable (component gen) → Cursor / Claude Code (wire-up).

### Apr 28 afternoon (~5 hr)
- Stitch the 4 screens visually (prompt locked in MasterContext PDF Section 8)
- Lovable generates React components
- Wire **Screen 1 (VerificationGate)** + **Screen 2 (DepositFlow)**
- Vercel preview deployed off `main`

### Apr 30 morning (~5 hr)
- Wire **Screen 3 (HousingDashboard)** + **Screen 4 (ImpactMemo)**
- Two-screen demo layout (Arbiscan iframe-style left + dashboard right) for the recording
- Polish loading / error / empty states (ciphertext-vs-plaintext fallback if decrypt fails)
- Footer: `"Reg D 506(c) testnet prototype. Production launch requires securities counsel."`

`frontend/src/` layout:
```
components/
├── VerificationGate/    # ERC-3643 KYC gate UI
├── DepositFlow/          # 4-state stepper: Wrap → Request → Pending → Claim
├── HousingDashboard/     # HUD CHAS data + 1 real Atlanta opportunity + aggregate vault stats
└── ImpactMemo/           # ChainGPT-generated plain-English memo, with on-chain hash verification
hooks/
├── useNoxBalance.ts      # createEthersHandleClient → handleClient.decrypt(balanceHandle)
├── useVaultStatus.ts     # poll request state by requestId
├── useHudData.ts         # CHAS API fetch (cached JSON fallback)
├── useChainGPT.ts        # Impact Risk Memo + on-chain hash verify
└── useMemoHashCheck.ts   # keccak256(memoBytes) === registry.chainGPTMemoHash
contracts/
├── abis/                 # auto-copied from ../artifacts post-deploy
└── addresses.ts          # imported from ../deployments/arbitrumSepolia.json
```

Stack: Vite + React + Tailwind + wagmi v2 + RainbowKit + ethers v6 + viem + `@iexec-nox/handle`. Color palette locked: `#1a1a2e` / `#0f3460` / `#533483`.

---

## Phase 5 — Real-data integration (Apr 28 evening, ~3 hr)

Hard-gated by the ⭐⭐⭐ "no mocked data" rule.

1. **HUD CHAS API** → real GET for Fulton County GA cost-burden (D9). Cache JSON to `frontend/src/data/chas-fulton.json` so the demo recording is rate-limit-immune.
2. **ChainGPT Web3 LLM** → POST `api.chaingpt.org/chat/stream` with the Impact Risk Memo prompt (MasterContext §6). Cache one response per opportunity.
3. **ChainGPT Smart Contract Auditor** → run on all 8 contracts pre-deploy. Commit JSON reports to `audits/`.
4. **FRED API** → DGS10 series for "Treasury benchmark yield" small comparison widget. Skip if time tight — decorative not load-bearing.
5. **Citations** → `docs/citations.md` lists Atlanta Land Trust source URL + every research source. Judges who challenge stats can verify.

---

## Phase 6 — Polish + submit (Apr 28 night backup record + Apr 30 final, ~6 hr)

### Apr 28 evening (~1 hr)
- Backup demo recording with whatever's live. Saved to disk + Drive.
- Risk insurance — if Apr 30 demo breaks during the live recording, this exists.

### Apr 30 (~5 hr)
1. Rehearse demo 5-10× (full 20× rehearsal already happens between Apr 28 and Apr 30 in pieces)
2. Record final 4-min demo (script in MasterContext §10 / locked):
   - Hook 30s | Gap 30s | Findings 20s | Solution 20s | Demo 90s | Impact 20s | Close 10s
3. Finalize `README.md`: project description, install, deploy, ABIs, contract addresses, frontend run, API key list, known limitations, security disclaimer
4. Finalize `feedback.md`: every iExec SDK friction point, what worked, what didn't. **Honesty scores. Required for ⭐⭐.**
5. Pre-flight: GitHub repo public ✓, all contracts Arbiscan-verified ✓, ChainGPT audits committed ✓, video uploaded to durable host (YouTube unlisted) ✓, Vercel deploy live ✓
6. Submit to **DoraHacks BUIDL** form
7. Post on **X**: 1-paragraph project description + video link + repo link, **tag `@iEx_ec` and `@Chain_GPT`**

---

## Risks + mitigations (v2)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Solidity 0.8.27 toolchain version conflict | Medium | High | viaIR enabled, Hardhat ^2.22 confirmed support; sanity Counter.sol compile end of Phase 1 |
| T-REX full surface too big for 4 days | Medium | High | Minimal-valid set fallback: 4 contracts (drop ModularCompliance modular swap, hardcode JurisdictionModule into Token if needed) |
| Phase 2.6 iApp blows the schedule | Medium | High | Hard gate at Apr 27 EOD. If contracts not on Sepolia by then, defer iApp and frame as next iteration in pitch |
| HUD CHAS approval delayed >48h | Low | Medium | Token registration tonight, not Apr 28. If still pending, fallback: HUD User API endpoints not requiring approval (public AMI/FMR data) |
| ChainGPT credits delayed | Low | Medium | DM @vladnazarxyz tonight; free tier 20K CGPTc/month is the backup |
| Demo breaks during recording | Medium | Fatal | Backup take recorded Apr 28; final take Apr 30 |
| `feedback.md` forgotten | Low | High | Created tonight Phase 0; appended to throughout |
| Composability router pulls in unexpected ERC-7984 quirks | Low | Medium | Build router last in Phase 2; if it doesn't compose cleanly, ship without and frame Pillar 2 via the cUSDC → vault flow alone |
| Vercel deploy fails on encrypted-types stack imports | Low | Medium | Test deploy at end of Phase 4 wave 1, not last day |

---

## Differentiators (Sookra pillars — final framing)

| Pillar | GroundVault content |
|---|---|
| 1. Real problem, named person | Maria (composite, modeled on real Atlanta CLT EDs), 34, lost 3 properties this year |
| 2. Structural gap | Privacy + composability impossible on public chains until Nox; Router contract demonstrates both in one tx |
| 3. Human-scale stat | 22.6M U.S. renter households cost-burdened |
| 4. Tech inevitable | Nox + ERC-7984 + full T-REX + full ERC-7540 = the only compliant confidential RWA primitive set on EVM today |
| 5. Business numbers | 0.25% platform fee, $35.9B RWA TAM, $50K-$500K cost per CLT lost bid, $1500 prize pool / 1-year hosted dApp |

"One pinpoint problem. One overlooked population. One moment that makes the judge lean forward."
