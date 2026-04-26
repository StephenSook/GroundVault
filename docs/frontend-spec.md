# GroundVault Frontend Spec

> Ground-truth screen specification for the GroundVault demo frontend.
> Reads as the input to Stitch (visual design), Lovable (React scaffold), and Cursor (wagmi/ethers/handle wiring against the live deployed contracts).
> Last updated: 2026-04-26.

## Stack

- Build: Vite + React + TypeScript + Tailwind
- Wallet: wagmi v2 + ethers v6 + WalletConnect / MetaMask Browser Extension
- Confidential client: `@iexec-nox/handle@0.1.0-beta.10` — `createEthersHandleClient(signer)` factory, `encryptInput(value, "uint256", applicationContract)` / `decrypt(handle)` methods
- Network: Arbitrum Sepolia (chain id 421614)
- Contract addresses: imported from `deployments/arbitrumSepolia.json` (post-review v2 deployment)
- ABIs: imported from `artifacts/contracts/**/X.json` after `npx hardhat compile`

## Information architecture (4 screens)

| Order | Screen | Path | Public access | Authenticated only |
|---|---|---|---|---|
| 1 | Investor Verification | `/verify` | yes (read-only) | yes (action) |
| 2 | Confidential Deposit Flow | `/deposit` | no | yes |
| 3 | Housing Opportunity Dashboard | `/housing` | yes | yes (sees own activity) |
| 4 | Impact Risk Memo | `/housing/:id/memo` | yes | yes (memo bot only writes) |

Top-level nav has all four entries plus a wallet pill (connect/disconnect, network indicator). Screen 1 is the landing screen for an unverified wallet; screen 3 is the landing screen for a verified wallet.

---

## Screen 1 — Investor Verification

### Goal
Onboard a Reg D 506(c) accredited investor (Maria's cohort). The screen tells the visitor whether their wallet has cleared the ERC-3643 whitelist, and lets a visitor request verification if they haven't.

### Entry conditions
- Wallet connected (any state).
- Wrong network → render a `Switch network` CTA, do not run any contract reads.

### Data inputs (all `IdentityRegistry`)
| Source | Method | Type | Use |
|---|---|---|---|
| `IdentityRegistry` | `identity(wallet)` | `address` | Identity contract address; zero = not started |
| `IdentityRegistry` | `investorCountry(wallet)` | `uint16` | ISO 3166-1 numeric country code (840 = US) |
| `IdentityRegistry` | `isVerified(wallet)` | `bool` | True if identity is registered AND every required claim is signed by a trusted issuer |
| `ClaimTopicsRegistry` | `getClaimTopics()` | `uint256[]` | List of required claim topics for display ("KYC" = 1) |

### User actions
**Get verified** (single CTA for the hackathon happy path):
1. Deploy `Identity(wallet)` — wallet pays gas.
2. Build the canonical claim digest: `toEthSignedMessageHash(keccak256(abi.encode(identity, topic, data)))`.
3. Request the issuer signature from a backend endpoint OR the demo's privileged signer (deployer wallet acts as issuer for the hackathon).
4. `Identity.addClaim(topic=1, scheme=1, issuer, signature, data, "")` — wallet pays gas.
5. `IdentityRegistry.registerIdentity(wallet, identity, 840)` — agent (deployer) wallet pays gas.

For the hackathon demo, all four steps run from a single button-press flow with the dashboard backend brokering step 3 + 5. Production flow brokers step 3 to a real KYC provider (Sumsub / Persona) and gates step 5 on legal review.

### States
- `Disconnected` — wallet pill prompts connect.
- `Connected, wrongNetwork` — `Switch to Arbitrum Sepolia` button.
- `Connected, unstarted` — green "Get verified" CTA + checklist of what verified means.
- `Connected, identityDeployed_pendingClaim` — neutral "Identity ready, waiting on KYC issuer signature" intermediate state.
- `Connected, verified` — large ✓ badge + identity address (Arbiscan link), country, claim topics list. CTA: `Continue to deposit →` (route to `/deposit`).
- `Error` — surface error string + retry CTA.

### Decrypt points
None. Identity layer is fully plaintext (it is the public allowlist signal).

### Visual hints
- Hero: Maria persona portrait + one-sentence framing ("Confidential treasury for the people doing the housing work").
- Status badge top-right.
- Wallet address shortened to `0x9Fba…6f15` with full-on-hover.
- "What does verified mean?" expandable explainer linking to ERC-3643 spec.
- Footer: required claim topics rendered as chips ("KYC", "Reg D 506(c) accreditation" — second one is roadmap-only for hackathon).

### Hackathon scope
Single-key Identity (no ERC-734 multi-purpose key flow). Deployer wallet doubles as the trusted KYC issuer. Production splits these and brokers step 3 through a real KYC provider.

---

## Screen 2 — Confidential Deposit Flow

### Goal
Investor moves capital from plain mUSDC to vault shares while balances stay encrypted. Render the four-state ERC-7540-shaped lifecycle as a stepper so the privacy property is visible at every transition.

### Entry conditions
- Verified wallet (else redirect to `/verify`).
- Right network (else `Switch network`).

### State machine
```
            ┌─ Wrap ──┐    ┌─ Request ─┐    ┌─ Pending ─┐    ┌─ Claim ─┐
   mUSDC ─▶ │  cUSDC  │ ─▶ │   vault   │ ─▶ │   queue   │ ─▶ │  shares │
            └─────────┘    └───────────┘    └───────────┘    └─────────┘
```

### Stepper screens

**Stepper 1 — Wrap (mUSDC → cUSDC)**
- Inputs: amount to wrap (number input, max = `mUSDC.balanceOf(wallet)`).
- Reads:
  - `MockUSDC.balanceOf(wallet)` — plaintext mUSDC balance.
  - `cUSDC.confidentialBalanceOf(wallet)` → handle → `handleClient.decrypt(handle).value` → plaintext cUSDC for THIS user (others see only the handle on chain).
- Actions:
  1. `MockUSDC.approve(cUSDC.address, amount)`.
  2. `cUSDC.wrap(amount)`.
- After-success: cUSDC balance updates; advance to Stepper 2.

**Stepper 2 — Request (cUSDC → vault pending)**
- Inputs: deposit amount (slider, max = decrypted cUSDC balance).
- Reads:
  - `cUSDC.confidentialBalanceOf(wallet)` (decrypted for this user).
  - `GroundVaultRegistry.getOpportunity(1)` for "Funding: 960 Lawton St SW…" context line.
- Actions (TWO transactions, one after the other):
  1. `handleClient.encryptInput(amount, "uint256", cUSDC.address)` → handle1 + proof1. Call `cUSDC.confidentialTransfer(vault.address, handle1, proof1)`. The transfer is encrypted; observer sees only the handle on Arbiscan.
  2. `handleClient.encryptInput(amount, "uint256", vault.address)` → handle2 + proof2. Call `vault.recordDeposit(handle2, proof2)`. Vault commits the encrypted amount to pending.
- After-success: pending state populated; advance to Stepper 3.

**Stepper 3 — Pending (await processing)**
- Reads:
  - `vault.pendingDepositOf(wallet)` → handle → decrypt (this user only).
  - `vault.depositCreatedAt(wallet)` → plaintext uint64.
  - Operator activity hint: "Operator processes deposits hourly. Estimated readiness: <createdAt + 1 hour>."
- Auto-poll `claimableDepositOf` every 12 seconds (Arbitrum Sepolia block time ≈ 250ms but polling tighter wastes RPC quota).
- When `claimable > 0` → advance to Stepper 4.

**Stepper 4 — Claim (mint shares)**
- Reads:
  - `vault.claimableDepositOf(wallet)` (decrypted).
  - `GroundVaultToken.confidentialBalanceOf(wallet)` (decrypted) — current share count.
- Action: `vault.claimDeposit()`.
- After-success: GroundVaultToken share balance updates by exactly the prior claimable amount. Show "You hold X confidential shares" + Arbiscan handle link.

### The marquee "shouldn't be possible" demo panel
A persistent split-screen bottom drawer renders:
- LEFT: live Arbiscan iframe of `cUSDC` (or `GroundVaultCore`) showing the user's most recent transaction. Render the encrypted handle in monospace ("amountHandle: 0xa3fc…2891"). Caption: `Public chain view (everyone)`.
- RIGHT: this user's private dashboard tile showing the decrypted amount, pending state, and share balance. Caption: `Your view (only you, via Nox ACL)`.

Same chain, same block. This is the visual that tells the privacy story in one frame.

### Decrypt points
- `cUSDC.confidentialBalanceOf` per user (steppers 1, 2).
- `vault.pendingDepositOf` per user (stepper 3).
- `vault.claimableDepositOf` per user (steppers 3, 4).
- `GroundVaultToken.confidentialBalanceOf` per user (stepper 4).
- ALL via `handleClient.decrypt(handle)`.

### States per stepper
- `Idle` (input editable).
- `EncryptingInput` (handle SDK roundtrip, ~200-500 ms).
- `WaitingSignature` (wallet popup).
- `Broadcasting` (tx submitted, ~1s).
- `Mining` (~10-15s on Arb Sepolia).
- `Decrypting` (handle SDK roundtrip after success, ~500ms-2s).
- `Success`.
- `Error` (with revert reason if available — show custom error name like `ComplianceRejectedTransfer`).

### Hackathon scope
- `processDeposit` is operator-triggered. Demo runs the operator process via a hidden admin button OR pre-records the operator step. Production wires Chainlink Automation / Gelato.
- `cancelDepositTimeout` is intentionally inert (`NotYetImplemented`). UI does not surface it. Documented Phase 2.6 hardening.
- Single-step transfer only — no `confidentialApprove`/`transferFrom` UX.

---

## Screen 3 — Housing Opportunity Dashboard

### Goal
Show what the vault is funding. Anchor the abstract privacy story to a real Atlanta property with verifiable HUD context. Public landing page for unverified visitors; richer for verified investors.

### Entry conditions
- Public, no wallet required.
- Verified wallet sees their own activity overlay.

### Data inputs
| Source | Method | Use |
|---|---|---|
| `GroundVaultRegistry` | `getOpportunity(1)` | Property metadata struct: addressLine, neighborhood, operatorName, amiTier, listPrice, status, memoHash, memoUri |
| `GroundVaultRouter` | `aggregateVaultSupply()` | Encrypted total share supply handle (NOT decrypted publicly — handle only) |
| `GroundVaultRouter` | `pendingDepositOf(wallet)` | Per-user pending handle (only for verified user) |
| `GroundVaultRouter` | `claimableDepositOf(wallet)` | Per-user claimable handle (only for verified user) |
| `GroundVaultRouter` | `depositCreatedAt(wallet)` | Plaintext uint64 (only for verified user) |
| HUD CHAS API | Fulton County GA cost-burden | Backend cache of D9 (`Cost Burden >50% Total`) and related fields |
| FRED API | DGS10 series | 10-year Treasury constant-maturity yield (benchmark rate for memo + dashboard) |

### Components

**Property card** (top, 60% width):
- Hero image: ALT marketing photo of the Trust at Oakland City OR Kronberg Wall rendering. Atlanta BeltLine signage in frame if available.
- Address: 960 Lawton St SW, Atlanta, GA — Oakland City.
- Specs: 3 bed / 2 bath / 1,326 sqft.
- Price: $250,000. Restriction: ≤80% AMI.
- Status pill: `Available`, `Under Contract`, `Sold`, `Withdrawn` (drives color).
- Operator chip: Atlanta Land Trust → links to https://atlantalandtrust.org/get-involved/i-am-looking-for-a-permanently-affordable-home/.
- Co-developers chip row: Cityscape Housing, Intown Builders, Atlanta BeltLine, Kronberg Wall.
- CTA row: `Read impact memo →` (Screen 4) and `Deposit confidential capital →` (Screen 2, if verified).

**Vault funding panel** (right of property card, 40% width):
- Encrypted aggregate supply handle: monospace `0x...` + caption `Public view: encrypted on Arbitrum Sepolia`.
- "X investors funded this opportunity" (count is plaintext metadata stored separately if we add it; encrypted total is the privacy proof).
- For verified user: their own pending / claimable / share holdings (decrypted) inline.

**HUD CHAS context panel** (mid-page):
- Cost-burden chart: Fulton County renter household cost-burden % bucketed by income tier.
- Headline: "X% of Fulton County renter households spend more than 30% of income on housing. Y% spend more than 50%."
- Source attribution: HUD CHAS API + signup link (https://www.huduser.gov/portal/dataset/chas-api.html).

**Atlanta context panel** (bottom):
- 22,149 Black residents displaced from 16 majority-Black tracts (1980-2020) — NCRC.
- $46 of white wealth per $1 of Black wealth — Community Foundation for Greater Atlanta.
- Atlanta loses ~1,500 affordable units annually — Coxe Curry.
- Maria persona disclosure inline link.

**Other opportunities** (footer chip row, future-state):
- "Coming soon: 721 Fayetteville Rd SE; pipeline of 8 ALT properties." See `docs/citations.md` ALT corpus snapshot.

### Decrypt points
- For verified user only: pending, claimable, share balance via `handleClient.decrypt`.
- Aggregate supply: NOT decrypted publicly. Handle is rendered as opaque hex with the caption explaining why.

### Privacy proof rendering
This is the screen where the public-vs-private split is most visible. Aggregate supply renders as `0xa3fc…2891` for everyone. The investor's own balance renders as a dollar figure for the investor only. The ChainGPT memo (Screen 4) provides an auditable narrative without compromising any individual position.

### Hackathon scope
One opportunity. Production has list view + filters + per-opportunity vaults.

---

## Screen 4 — Impact Risk Memo

### Goal
Plain-English memo summarizing impact + risk + financial benchmark for a specific opportunity. AI-generated by ChainGPT, hash-anchored on chain via `GroundVaultRegistry.setMemo`. Accessible to anyone, write-gated to `MEMO_ROLE`.

### Entry conditions
- Public, no wallet required to read.
- `MEMO_ROLE` holder (memo automation account) can regenerate.

### Data inputs
| Source | Method | Use |
|---|---|---|
| `GroundVaultRegistry` | `getOpportunity(id)` | Read `memoHash` and `memoUri` for the opportunity |
| IPFS (or CDN at `memoUri`) | HTTP GET | Memo body markdown |
| ChainGPT API | `POST /chat/stream` model `web3_llm` | Generate memo (write flow only) |

### Components

**Memo body panel** (60% width):
- Rendered markdown of the memo content.
- 4 paragraphs:
  1. Opportunity summary.
  2. Financial benchmark (vs DGS10, vs comparable market rents).
  3. Social impact thesis (CLT model, permanent affordability, Atlanta context).
  4. Risk caveats (CLT regulatory, hackathon scope disclosure).

**Provenance panel** (40% width):
- Generator: `ChainGPT Web3 LLM`.
- Generated at: timestamp.
- Anchor tx: link to Arbiscan `setMemo` transaction.
- On-chain hash: `memoHash` rendered monospace.
- IPFS URI: `memoUri` clickable.
- Integrity: `keccak256(fetchedBody)` computed client-side and compared against on-chain `memoHash`. Render ✓ green if match, ⚠ red if mismatch.

**Generate-memo flow** (admin only):
- Visible only when wallet holds `MEMO_ROLE`.
- Inputs: opportunity id (default: 1).
- Action sequence:
  1. POST to ChainGPT `/chat/stream` with the same KB seed used during the audit pass — opportunity metadata + HUD CHAS slice + FRED rate + Atlanta context. Receive memo markdown.
  2. Upload markdown to IPFS (Pinata / Web3.Storage), receive `ipfs://...`.
  3. Compute `keccak256(markdown)` client-side.
  4. Call `GroundVaultRegistry.setMemo(id, hash, ipfsUri)`.
- After-success: memo refreshes; provenance panel updates.

### Decrypt points
None. Memo is fully public (the privacy property is on the vault, not on the impact narrative).

### States
- `Loading` — fetching memoUri body.
- `IntegrityValid` — ✓ hashes match.
- `IntegrityMismatch` — ⚠ on-chain hash != computed; show both, recommend re-fetch.
- `NoMemoYet` — registry has zero hash; show "Memo not generated yet" + CTA for memo bot.

### Hackathon scope
One opportunity, one memo. Production has memo per-opportunity + version history (each `setMemo` overwrites; could be append-only with a list).

---

## Cross-cutting

### Wallet wiring
```ts
// Pseudocode for the React app root
const { signer } = useWalletClient(); // wagmi v2
const handleClient = useMemo(() => signer && createEthersHandleClient(signer), [signer]);
```

`handleClient` is held in a React context and consumed by every component that needs to encrypt or decrypt.

### Contract loader
```ts
import deployment from "../../deployments/arbitrumSepolia.json";
import IdentityRegistryAbi from "../../artifacts/contracts/identity/IdentityRegistry.sol/IdentityRegistry.json";
// ...
const identityRegistry = new ethers.Contract(
  deployment.contracts.IdentityRegistry.address,
  IdentityRegistryAbi.abi,
  signer
);
```

A single `useContracts()` hook returns every contract instance keyed by name.

### Encrypted handle rendering convention
- For "public view": render handle as `0xa3fc…2891` monospace, with a copy-to-clipboard affordance and an Arbiscan link.
- For "your view": render the decrypted plaintext (e.g., `50.000000 mUSDC`) with a tooltip showing the underlying handle.

This dual rendering reinforces the privacy story at every encrypted field.

### Loading + error UX
- Tx pipeline (idle → encrypting → signing → broadcasting → mining → decrypting → success) is a shared toast / drawer component.
- Custom Solidity errors render with their name and arguments, e.g., `RecipientNotVerified(0x...)`. Map every custom error to a human sentence ("This wallet hasn't completed KYC yet.").

### Brand
- Color palette: greens (housing-justice / community), warm earth tones, off-white backgrounds. Avoid generic Web3 neon.
- Type: serious + readable institutional finance. Pair a humanist sans (Inter / IBM Plex Sans) with a slab serif for headlines (Recoleta / IBM Plex Serif).
- Iconography: Atlanta BeltLine map silhouette as a recurring motif.
- Photography: Atlanta Land Trust portfolio shots, BeltLine, Old Fourth Ward. Avoid stock-finance images.

---

## Appendix — Stitch prompt template

For each screen, the Stitch prompt should bundle:

```
TITLE: <Screen 1 / 2 / 3 / 4 name>
PRODUCT: GroundVault — confidential RWA impact lending vault for Community Land Trusts
AUDIENCE: institutional impact investors (Reg D 506(c) accredited) + nonprofit CLT executive directors
NARRATIVE: <one-line hook from this spec>

HEADER STATE: <hero block + nav>
PRIMARY CONTENT: <main panel>
SECONDARY CONTENT: <side panel(s)>
PRIVACY PROOF (where applicable): <split-screen public-vs-private rendering>
CTAS: <buttons + their destinations>
EMPTY STATE: <what shows pre-action>
ERROR STATES: <listed>
COLOR + TYPE: per cross-cutting brand section above
SCREEN DIMENSIONS: 1440x900 desktop primary; 390x844 mobile fallback
```

Stitch produces the visual; Lovable scaffolds the React from the visual; Cursor wires the wagmi / ethers / handle SDK against the contracts at the deployment-manifest addresses.
