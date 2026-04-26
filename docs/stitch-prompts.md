# GroundVault — Stitch prompts (4 screens)

Use one prompt per screen, sequentially. Stitch doesn't carry memory across separate generations unless you set up a project — set up a GroundVault project first, paste the **Brand brief** below into the project's brief field, then run each screen prompt in turn so the visual language stays consistent.

After each generation: iterate with short feedback ("warmer greens", "shrink the hero", "swap headline font to a slab serif"). Once a screen is locked, hand it off to Lovable for React scaffolding.

---

## Brand brief (paste into the Stitch project, NOT into a screen prompt)

```
Product: GroundVault — confidential real-world-asset (RWA) impact lending vault for Community Land Trusts. Built on iExec Nox + Arbitrum Sepolia for the iExec Vibe Coding Challenge.

Audience:
- Institutional impact investors, Reg D 506(c) accredited.
- Executive directors of nonprofit Community Land Trusts (the "Maria" persona — competing for affordable-housing acquisition bids against speculative buyers who watch on-chain treasuries).

Tone: Serious institutional finance, not Web3 neon. Calm, trustworthy, mission-grounded. Avoid crypto-bro tropes (no purple/cyan gradients, no rocket emojis, no "moon" language).

Color palette:
- Primary: deep forest green (#1F3A2E) and sage (#7DA38A) — community / housing-justice / permanence.
- Earth accents: clay (#B47D5C), warm sand (#E8DDC9).
- Neutrals: off-white background (#F7F4EE), graphite text (#1B1F1A).
- Status: green-success / amber-pending / red-error in the same palette family.

Type:
- Headlines: a slab serif. Recoleta or IBM Plex Serif.
- Body + UI: humanist sans. Inter or IBM Plex Sans.
- Monospace for handles + addresses: IBM Plex Mono.

Iconography: line icons, 1.5px stroke, rounded ends. The Atlanta BeltLine map silhouette is a recurring decorative motif — it appears in the footer of every screen.

Photography: Atlanta Land Trust portfolio shots, the BeltLine, Old Fourth Ward, 960 Lawton St SW (Oakland City). Avoid stock-finance images; avoid glossy real-estate-listing aesthetics.

Layout grid: 1440x900 desktop primary, 12-column with 80px outer padding. Mobile fallback at 390x844.

Persistent global UI:
- Top nav: GroundVault wordmark left; nav links center (Verify / Deposit / Housing / Memo); wallet pill right ("Connect" or "0x9Fba…6f15 · Arbitrum Sepolia"). Network indicator turns amber if on the wrong chain.
- Footer: BeltLine silhouette decoration; links to GitHub, Atlanta Land Trust, iExec Nox, terms.
```

---

## Screen 1 — Investor Verification (`/verify`)

```
TITLE: Investor Verification

NARRATIVE: A first-time accredited investor lands here after connecting their wallet. The screen tells them whether they've cleared the ERC-3643 whitelist and offers a single one-click flow to get verified.

LAYOUT:
- Hero (full bleed, ~360px tall): warm sand background, slab-serif headline left "Confidential capital for the people doing the housing work." Below the headline a one-line subhead "Verified accredited investors only. Reg D 506(c) testnet prototype." Right side: portrait of Maria (composite persona — Black woman, 30s, Atlanta professional, photographed in a community garden or on a renovated porch, NOT a stock office shot).
- Status card (centered below hero, 720px wide, off-white card on green background): one of three states.
  STATE A — unverified: large outline "Not verified" badge, body copy explaining what verified means in two sentences, primary green CTA "Get verified" with subtle Arbitrum Sepolia gas estimate underneath.
  STATE B — pending claim: amber "Pending KYC issuer signature" badge, progress indicator showing step 2 of 4.
  STATE C — verified: large solid-fill green "Verified" badge with checkmark, three rows of monospace metadata: identity contract address with Arbiscan link, country code (840 = US), required claim topics rendered as small chips ("KYC topic 1"). Primary CTA: "Continue to deposit →" routes to /deposit.
- Below the card: a horizontal three-step diagram explaining the flow visually: (1) deploy your Identity contract, (2) issuer signs your KYC claim, (3) we register your wallet. Each step has a one-line caption and a small line icon.
- Below the diagram: a pull-quote panel with the Maria persona disclosure from docs/citations.md ("Maria is a composite persona representing CLT executive directors competing for affordable-housing acquisitions against on-chain bot front-running…"). Italic body, deep-green accent line on the left.

ERROR STATES:
- Wrong network: red banner top of screen, "Switch to Arbitrum Sepolia" CTA, all action UI dimmed.
- Wallet not connected: same hero, status card replaced by a single "Connect wallet" CTA with three brand-styled wallet icons (MetaMask, WalletConnect, Coinbase Wallet).

VISUAL REFERENCES: Stripe Atlas onboarding clarity meets Mercury Compliance dashboard calm. NOT crypto onboarding aesthetic.

PRIVACY NOTE: This screen is fully plaintext — identity verification is the public allowlist signal. No encrypted handles render here.
```

---

## Screen 2 — Confidential Deposit Flow (`/deposit`)

```
TITLE: Confidential Deposit Flow

NARRATIVE: A verified investor moves capital from plain mUSDC into vault shares. Every balance and transfer amount stays encrypted. The four-state stepper makes the privacy property visible at every transition. The marquee moment is the split-screen "public chain view vs your private view" rendered persistently at the bottom — the same data, two ways of seeing it.

LAYOUT:
- Top nav (persistent).
- Stepper rail (horizontal, full-width, ~80px tall, just below nav): four steps — Wrap, Request, Pending, Claim. Active step highlighted in deep green; complete steps with a checkmark; future steps muted. The rail visually advances as the user progresses.
- Main panel (60% width left): the active step's content.
  WRAP: input field for "amount to wrap (mUSDC)", live balance display "Available: 1,000 mUSDC", primary CTA "Wrap to confidential cUSDC". A one-line gloss explains: "Public on-chain after this point: the wrap event. Private after this point: every balance and every transfer."
  REQUEST: amount slider (max = decrypted cUSDC balance), context line "Funding: 960 Lawton St SW · Atlanta Land Trust · 80% AMI", primary CTA "Submit deposit". A two-step micro-explainer: "1. Encrypted transfer to vault · 2. Register encrypted amount as pending."
  PENDING: large encrypted-amount display showing the user's decrypted pending value (e.g., "50.000000 mUSDC"), amber "Awaiting operator processing" pill, plaintext "Submitted at 3:42 PM · Estimated readiness 4:42 PM". Auto-refreshing.
  CLAIM: large decrypted claimable amount, primary CTA "Claim shares". Below: a preview of the share balance after claim ("You will hold 50 confidential shares").
- Side panel (40% width right): "Your private state" — three rows showing decrypted cUSDC, pending vault deposit, GroundVaultToken share balance. Each row pairs the plaintext value with a small monospace handle in a tooltip-on-hover ("This is the encrypted handle that's public on chain").

PRIVACY PROOF DRAWER (persistent, bottom of screen, ~280px tall, can be collapsed):
- Two columns split exactly down the middle.
- LEFT column: heading "Public chain view (everyone)". Renders the user's most recent transaction as it appears on Arbiscan — function name `confidentialTransfer`, parameter list with the 32-byte handle in monospace ("amount: 0xa3fc…2891"), block + tx hash. Background is a slightly darker shade to feel "public infrastructure".
- RIGHT column: heading "Your view (only you, via Nox ACL)". Same transaction, but the amount is decrypted and rendered as a dollar-formatted value. Background is the warm sand brand color, feels "private dashboard".
- A thin vertical divider with a key icon at the midpoint emphasizes the two-window-into-the-same-event framing.

EMPTY STATE:
- Wrap step with zero mUSDC: "You don't have any mUSDC yet. Mint testnet mUSDC →" CTA opens a tiny faucet modal that calls MockUSDC.mint.

ERROR STATES (per-step):
- Custom Solidity error like `RecipientNotVerified` renders as "This wallet hasn't completed KYC yet." with retry CTA.
- `EnforcedPause` renders as "Vault is paused for maintenance — try again shortly."
- Insufficient gas / user-rejected-tx renders inline.

VISUAL REFERENCES: Compound Finance and Aave deposit UI — but with the explicit public-vs-private split that makes the privacy claim visible at every step. The drawer is the demo-recording centerpiece.
```

---

## Screen 3 — Housing Opportunity Dashboard (`/housing`)

```
TITLE: Housing Opportunity Dashboard

NARRATIVE: This is what GroundVault is funding. A real Atlanta Land Trust townhome at 960 Lawton St SW in Oakland City — 3 bed, 2 bath, $250,000, restricted to ≤80% Area Median Income, currently Available. The page anchors the abstract privacy story to a concrete property and the documented Atlanta displacement context.

LAYOUT:
- Top nav (persistent).
- Property card (full-width hero, ~520px tall, off-white card floating on warm sand background):
  - LEFT 60%: hero image of the property. Use a real photograph of 960 Lawton St SW or a Kronberg Wall rendering of the Trust at Oakland City — a townhome row in early-2020s Atlanta vernacular brick + sage trim. NOT a glossy listing photo.
  - RIGHT 40%: stacked metadata. Slab-serif address headline "960 Lawton St SW", subhead "Atlanta · Oakland City". Status pill in green ("Available"). Specs row: "3 bed · 2 bath · 1,326 sqft". Price row: "$250,000". Affordability row: "≤80% AMI · permanently restricted". Operator chip: "Atlanta Land Trust" linking to atlantalandtrust.org. Co-developer chips: "Cityscape Housing", "Intown Builders", "Atlanta BeltLine", "Kronberg Wall (architect)". Two CTAs: primary green "Read impact memo →" (routes to /housing/1/memo), secondary outline "Deposit confidential capital →" (routes to /deposit, only visible if wallet is verified).
- Vault funding strip (full-width, just below property card, ~200px tall, deep-green background, off-white text):
  - LEFT half: "Funded by GroundVault" headline, then in monospace "Public view: 0xa3fc…2891 — encrypted aggregate supply on Arbitrum Sepolia". Below: "X investors are funding this opportunity" (count is plaintext metadata).
  - RIGHT half (visible only to verified wallet): "Your position" panel with three rows — pending, claimable, shares. Each plaintext value paired with the underlying handle in a tooltip.
- HUD CHAS context panel (60% width left, mid-page): headline "Fulton County, GA — cost-burden context". A horizontal bar chart by income tier showing the % cost-burdened. Caption: "X% of Fulton County renter households spend more than 30% of income on housing. Y% spend more than 50%. Source: HUD CHAS API." Below the chart, a one-line attribution + signup link.
- Atlanta context panel (40% width right, mid-page): three stat blocks stacked vertically.
  - "22,149 Black residents displaced from 16 majority-Black tracts (1980-2020). NCRC."
  - "$46 of white wealth per $1 of Black wealth in Atlanta. Community Foundation for Greater Atlanta."
  - "Atlanta loses ~1,500 affordable units annually. Coxe Curry, 2024."
  Each stat block has a deep-green accent number, body sans subtitle, source attribution in muted gray.
- Other-opportunities row (footer area, ~120px tall): "Coming soon" chip row showing 3-4 future opportunities ("721 Fayetteville Rd SE · 2 bed · ~$250-270K", etc.). Muted styling.

VISUAL REFERENCES: Architectural Digest property listing meets Bloomberg Terminal data panel. Magazine-grade typography on the property card; data-panel discipline below. NOT a Zillow listing.

PRIVACY NOTE: The aggregate supply handle is rendered for everyone in monospace. The user's own position (pending / claimable / shares) is rendered decrypted only for the verified investor whose wallet is connected.
```

---

## Screen 4 — Impact Risk Memo (`/housing/1/memo`)

```
TITLE: Impact Risk Memo

NARRATIVE: A long-form, plain-English impact and risk memo for the 960 Lawton opportunity. Generated by ChainGPT's Web3 LLM, hash-anchored on chain via GroundVaultRegistry.setMemo. Anyone can read it; only the MEMO_ROLE holder can regenerate. Reads like a Bridgewater investment memo, not a crypto whitepaper.

LAYOUT:
- Top nav (persistent).
- Document header bar (~120px tall, off-white background): breadcrumb "Housing → 960 Lawton St SW → Impact memo" left; provenance chip row right ("Generated 2026-04-26 · ChainGPT Web3 LLM · Anchored on Arbitrum Sepolia"). The provenance chip row is monospace, muted gray.
- Two-column body:
  - LEFT 65%: the memo itself, rendered as long-form markdown. Headline in slab serif "Impact Risk Memo · 960 Lawton St SW". Four numbered sections, each ~2-3 paragraphs:
    1. Opportunity summary — what this property is, why now.
    2. Financial benchmark — vs DGS10 Treasury yield, vs comparable Oakland City market rents.
    3. Social impact thesis — CLT model, permanent affordability, Atlanta displacement context.
    4. Risk caveats — CLT regulatory, hackathon scope, accepted Phase 2.6 hardening items.
    Body text is humanist sans, generous line height, ~16px. Block quotes use a deep-green accent line. Section headers in a smaller slab-serif weight.
  - RIGHT 35%: a sticky "Provenance" panel (off-white card on warm sand background).
    - Row 1: Generator — "ChainGPT Web3 LLM" with model badge.
    - Row 2: Generated at — timestamp.
    - Row 3: Anchor transaction — Arbiscan link to the setMemo tx.
    - Row 4: On-chain hash — keccak256 in monospace, copy-to-clipboard affordance.
    - Row 5: IPFS URI — clickable.
    - Row 6: Integrity check — large green ✓ badge with caption "On-chain hash matches fetched body". On mismatch: amber ⚠ badge, both hashes shown side by side.
    - Footer of the panel: small button "View raw markdown" opens the IPFS body in a new tab.
- Memo bot affordance (below the two-column body, only visible to wallet holding MEMO_ROLE): a thin band with a green outline button "Regenerate memo with ChainGPT". When pressed: a loading state that cycles through "Generating with ChainGPT..." → "Uploading to IPFS..." → "Anchoring hash on chain...". On success the page reloads with new content.

EMPTY STATE: When registry has zero memo hash for the opportunity: full-width centered message "Memo not generated yet" + the regenerate button if the connected wallet is the memo bot.

ERROR STATE: If keccak256 of the fetched body doesn't match the on-chain hash: amber banner across the top "On-chain hash mismatch — the off-chain memo body may have been altered. Compare hashes below." with both values rendered prominently.

VISUAL REFERENCES: Bridgewater investment memo, Hacker News-comment readability, NYT magazine longform layout. NOT a crypto whitepaper PDF.

PRIVACY NOTE: This screen is fully public. The memo is the auditable narrative; investor positions stay encrypted on the deposit screen.
```

---

## After Stitch generates each screen

1. Iterate inside Stitch until the visual is locked.
2. Export to Lovable (Stitch has a one-click handoff).
3. In Lovable, the React scaffold lands. Verify the four routes match `/verify`, `/deposit`, `/housing`, `/housing/:id/memo`.
4. Pull the Lovable scaffold into this repo under `frontend/`.
5. From Cursor (or me), wire up:
   - wagmi v2 + ethers v6 wallet hook.
   - `createEthersHandleClient(signer)` context provider.
   - Contract instances loaded from `deployments/arbitrumSepolia.json` + `artifacts/contracts/**`.
   - Per-screen contract calls listed in `docs/frontend-spec.md`.
   - HUD CHAS + FRED + ChainGPT API clients with `.env` keys.
6. Run locally; record demo on the verified investor flow.
