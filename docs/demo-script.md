# GroundVault — Demo Script

Target length: **4 minutes**. Beats locked, copy editable. Two-screen recording: Arbiscan tab on the left, deployed dapp on the right.

---

## 0:00 — 0:30 · Hook (30s)

> "Maria runs an Atlanta Community Land Trust. In the last year she's lost three properties to predatory developer bots that monitored her on-chain treasury, saw exactly how much capital she had, and outbid her by exactly enough to win."

**Visual:** open browser to deployed GroundVault URL. Land on `/verify` (or `/housing` if wallet auto-connects). Pause on the hero illustration of three Atlanta craftsman homes.

**Why this hook:** anchors a real persona, real city, real failure mode. Names the predator-bot pattern documented in the WIRED RealT investigation and Raymond et al. (Georgia Tech 2021) — both linked from the Citations panel.

---

## 0:30 — 1:00 · Gap (30s)

> "Here's where we are. Less than 0.13% of global assets are on-chain. Of the $35.9 billion of tokenized real-world assets that did cross over, zero is in permanent-affordability housing. The blocker is the same in both cases — public chains expose every balance to the people Maria is bidding against."

**Visual:** click into `/housing` → scroll to **"Why confidentiality? Same chain, two predator surfaces."** panel → expand it.

Pause on the side-by-side. Left column shows what an Ethereum mainnet vault would expose ($4.25M total, $84,200 per investor, $50k pending acquisition). Right column shows the same state on GroundVault as bytes32 encrypted handles.

**Read the closing line out loud:** "Same numbers, two different surfaces. What a public chain reader cannot decrypt, a predator bot cannot front-run."

**Source notes (for your own awareness — don't read these):** the 0.13% figure is iExec's own EthCC framing of total onchain capital ($430B onchain ÷ $360T global = 0.12%, rounded up to ≤0.13% for cleaner delivery). The $35.9B comes from RWA.xyz's November 2025 dashboard. Citing both means a judge who's read the iExec article hears alignment, and a judge who hasn't gets a third-party-cited stat too.

---

## 1:00 — 1:20 · Findings (20s)

> "We checked: ERC-7984 was finalized last July by OpenZeppelin and Zama. iExec Nox launched on Arbitrum Sepolia in November. Nobody had stitched them together for housing yet. So we did."

**Visual:** scroll up to **VaultFundingStrip** (the green strip showing the encrypted aggregate supply handle with the pulsing sage dot).

**Why this beat:** answers the implicit "why hasn't this already been built" question.

---

## 1:20 — 1:40 · Solution (20s)

> "The stack is ERC-7984 for confidential balances, ERC-3643 for KYC gating, a custom async deposit queue adapted from ERC-7540, and iExec Nox for the TEE that controls who can decrypt what. 11 contracts on Arbitrum Sepolia, all source-verified."

**Visual:** open the **Footer** of the housing page. Show the on-chain footprint card (chain ID 421614, 11 contracts, registry address linking to Arbiscan, ERC standards list).

---

## 1:40 — 3:10 · Demo (90s)

This is the hero shot. Two windows side by side.

**LEFT WINDOW** (Arbiscan, `https://sepolia.arbiscan.io/address/<cUSDC>` — pre-loaded to a recent confidentialTransfer tx).
**RIGHT WINDOW** (deployed dapp, on `/deposit`).

**1:40 — 1:55 · Wrap (15s)**
On the right: click **Wrap to cUSDC**. MetaMask pops mint → approve → wrap. Three transactions land. The "cUSDC balance" row in the sidebar fills in with a sage pulsing dot next to a bytes32 prefix; the decrypted value (50.00 cUSDC) shows because the demo wallet has the ACL.

**1:55 — 2:25 · Submit deposit (30s)**
Click **Submit deposit** (still 50 mUSDC). MetaMask pops twice (encrypted transfer + recordDeposit). Show the **stepper animating** through Wrap ✓ → Request → Pending. Operator auto-process advances pending → claim. Stepper now ✓✓✓→ Claim.

Cut to the **Privacy Proof drawer** at the bottom of the page. Read the line:
> "Public chain view: function call + bytes32 handle. Your view via Nox ACL: 50 cUSDC."

Tab to the LEFT window — Arbiscan shows the same `confidentialTransfer(address,bytes)` call with an opaque bytes payload. **Same tx hash, same block, two completely different visibilities.**

**2:25 — 2:45 · Claim (20s)**
Right window: click **Claim GVT shares**. One MetaMask tx. The **post-deposit impact summary** card appears: "Your impact share: 0.02% of 960 Lawton St SW. Pooled with other investors, this commits real capital to permanent affordability for an Atlanta CLT family. The covenant on the deed prevents speculative resale."

**2:45 — 3:10 · Memo regenerate (25s)**
Navigate to `/housing/1/memo`. Pause on the "Awaiting on-chain anchor" amber Provenance badge. Click **Regenerate memo with ChainGPT**.

The **RegenerateProgress** card walks through: Fetching HUD CHAS + FRED → Calling ChainGPT → Submitting setMemo tx → Awaiting block confirmation → On-chain hash anchored.

Reload the page. The Provenance badge flips from amber to green: **"Green Integrity Verified — On-chain hash matches the keccak256 of the rendered memo body exactly."**

Scroll to the **Audit log** section below the memo body. The new regenerate appears at the top of the timeline with a sage dot.

---

## 3:10 — 3:30 · Impact (20s)

> "Every deposit is encrypted on chain. Every memo is hashed and anchored. Every CLT acquisition is permanently restricted to ≤80% AMI households via the deed covenant. The audit trail is on-chain. The body is verifiable. The investor is invisible to the front-runners."

**Visual:** scroll to **Citations panel** below the memo body. Expand it. Show the 13 sources backing every numeric claim — HUD CHAS, NCRC, Lincoln Institute, Grounded Solutions, Raymond Georgia Tech 2021, FRED, RWA.xyz.

---

## 3:30 — 3:50 · Close (20s)

> "GroundVault is a Reg D 506(c) testnet prototype. The contracts are deployed on Arbitrum Sepolia, source-verified, audited by ChainGPT's Smart Contract Auditor. The full audit reports are at github.com/StephenSook/GroundVault/audits. Production launch requires securities counsel."

**Visual:** end on the deployed URL with the demo banner visible at the top: "Testnet demo · Reg D 506(c) prototype on Arbitrum Sepolia · No real funds at risk."

**Final beat:** click the GroundVault wordmark or scroll to the OG image-style hero. Hold for 2 seconds. End recording.

---

## 3:50 — 4:00 · Buffer

If the demo runs short, hold on the housing dashboard for the last 10 seconds with the encrypted handle pulsing. If it runs long, cut from the audit log sweep directly to the close.

---

## Shot list — pre-recording checklist

- [ ] Vercel preview URL live with `CHAINGPT_API_KEY` + `FRED_API_KEY` server-side, `VITE_ALLOW_DEMO_BYPASSES=1` set
- [ ] ChainGPT credits topped up
- [ ] MetaMask configured with the deployer wallet (`0x9Fba…676f15`) on Arbitrum Sepolia
- [ ] At least 0.05 Sepolia ETH in the wallet for gas (5+ regenerates worth)
- [ ] 200+ mUSDC pre-wrapped (to avoid the 3-tx wrap dance during recording — use the existing balance instead)
- [ ] Demo banner dismissed (or kept visible — operator's call)
- [ ] Two browser windows: Arbiscan tab pre-loaded to a confidentialTransfer tx, dapp tab pre-loaded to `/housing`
- [ ] OS-level window split (Cmd+arrow on macOS, snap on Windows) at the screen-ratio that works for the recorder
- [ ] Audio test — voiceover gain set, no background noise

## Recording tools

- **macOS:** QuickTime → File → New Screen Recording → drag selection across both windows. Output is .mov; convert with ffmpeg if a different format is needed for submission.
- **OBS:** scene with two captured windows side-by-side. Higher quality, more setup.

## Post-production

- 30 seconds for an opening title card with the OG image (1200×630)
- Closing card with the GitHub URL and Vercel preview URL
- Subtitles via the YouTube auto-caption pipeline if the submission requires accessibility

## Key URLs

- **Live deployment:** https://groundvault-app.vercel.app
- **GitHub:** https://github.com/StephenSook/GroundVault
- **Audits:** https://github.com/StephenSook/GroundVault/tree/main/audits
- **Citations:** https://github.com/StephenSook/GroundVault/blob/main/docs/citations.md
- **Plan:** https://github.com/StephenSook/GroundVault/blob/main/PLAN.md
