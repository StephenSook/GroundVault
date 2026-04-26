# feedback.md — iExec Vibe Coding Challenge

> Required by the challenge (⭐⭐). Started 2026-04-25. Append daily through 2026-04-30. Honest beats silent.

This file documents the developer experience of building **GroundVault** with iExec's Nox protocol, Confidential Tokens, and the broader confidential-DeFi tooling stack. What worked, what didn't, what the docs missed, what we'd want next.

---

## Setup phase (2026-04-25 evening)

### What worked
- `@iexec-nox/nox-protocol-contracts@0.2.2` published to npm as expected. Quick `npm view` confirmed the package and inspected the API surface before committing to it.
- The library ships pre-deployed `NoxCompute` artifacts for Arbitrum Sepolia at `0xd464B198f06756a1d00be223634b85E0a731c229`. The SDK auto-resolves the address by `block.chainid`, so no environment-specific configuration is required for the demo network.
- Public `cdefi.iex.ec` demo + faucet provided fast hands-on validation of the wrap/unwrap flow before writing any local code.

### Friction points
- The npm namespace (`@iexec-nox/*` vs the historical `@iexec/*`) wasn't immediately obvious from the getting-started docs and required a Discord question to confirm. The Vibe Coding channel resolved it quickly, but the docs landing page at `docs.iex.ec/nox-protocol/getting-started/welcome` could call out the new scope explicitly.
- `MasterContext` reference snippets shared with the challenge used `Nox.allowAll(handle)` — the actual library exposes `Nox.allow(handle, account)` and `Nox.allowThis(handle)` with no `allowAll`. Migration was trivial but unexpected. Recommend the iExec quickstart link to `package/contracts/sdk/Nox.sol` as the source of truth.
- Solidity pragma is `^0.8.27`, which forces `viaIR: true` for Hardhat compilation when working with stacks of `euint256` operations. Worth flagging in the Hardhat starter docs.
- `@iexec-nox/handle` is still on a beta tag (`0.1.0-beta.10`). Pinning a beta in a hackathon submission is fine but the docs don't yet describe a stable release timeline.

### Open questions (raised in Discord)
- _(placeholder — will fill as Discord replies come back)_

---

## Phase 1 — Hardhat scaffold (2026-04-26 early AM)

### What worked
- Single `npm install` resolved the entire confidential stack cleanly: `hardhat@^2.22`, `@nomicfoundation/hardhat-toolbox@^5`, `@iexec-nox/nox-protocol-contracts@0.2.2`, `@openzeppelin/contracts@^5.6.1`, `encrypted-types@^0.0.4`. No peer-dep conflicts.
- `Nox.sol` resolves at `node_modules/@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol` exactly where the docs imply, so Solidity imports work without remappings.
- `npx hardhat compile` reports "Nothing to compile" with the new config, confirming Solidity 0.8.27 + viaIR + cancun all parse cleanly even before any contract source lands.

### Friction points
- Hardhat 2.x emits a Node-version warning under Node 25 (`WARNING: You are currently using Node.js v25.2.0, which is not supported by Hardhat`). LTS is 18/20/22; pinning `.nvmrc` to 20 keeps CI deterministic, but local dev gets a warning on every command. Worth Hardhat documenting the LTS-only support window more visibly, especially as Node 25 ships with current macOS Homebrew defaults.
- `npm install` reports 42 vulnerabilities (21 low / 14 moderate / 7 high) immediately on a fresh install, all transitive in Hardhat's tooling tree. The first-time-builder reaction is panic; the actual exposure is dev-time only and out of Hardhat's direct control. iExec quickstart could pre-empt the surprise with a one-liner: "audit warnings on initial install are inherited from upstream Hardhat tooling and do not affect compiled contract security."
- `.gitignore` patterns needed an explicit `!.env.example` rescue line because `.env.*` matches the example file too. Worth flagging in the recommended `.gitignore` for the iExec starter so builders don't accidentally hide their own example.
- The hardhat-verify plugin bundled with `@nomicfoundation/hardhat-toolbox@^5` rejects the legacy `apiKey: { arbitrumSepolia: ... }` + `customChains` shape and demands the new Etherscan V2 unified-key syntax (`apiKey: <single string>`). The deprecation date Etherscan cited in the warning was 2025-05-31, almost a year before this hackathon, but every iExec / Arbitrum Sepolia tutorial we read still showed the old per-chain shape — including the iExec docs' Hardhat snippet. Builders following those guides will get a confusing "deprecated V1 endpoint" failure on their first verify. Recommend the docs be updated to V2 syntax explicitly.
- A live-deploy + verify round-trip on Arbitrum Sepolia (Counter at `0xDC7dDFaa1560871E4CF54AE4Fd3839377a74fDE4`) consumed roughly 0.000011 ETH for the deploy and zero ETH for verify, well within a Sepolia faucet's typical drip. Worth iExec putting a "you need ~0.01 ETH on Arbitrum Sepolia for the full tutorial" line on the Hello World page so newcomers don't over-bridge.

### Open questions (raised in Discord)
- _(placeholder — will fill as Discord replies come back)_

---

## Phase 2 — Smart contracts

_To be filled Apr 26-27. Topics planned to cover: ERC-7984 wrapping flow, ERC-3643 T-REX integration friction, ERC-7540 lifecycle vs encrypted-type adaptation, gas costs of confidential ops on Sepolia._

---

## Phase 3 — Deploy + audit (2026-04-26)

### What worked
- Single deploy-all.js script orchestrated all 11 production contracts plus 7 configuration calls in dependency-respecting order with no state issues. Total gas burned: 0.000194 ETH against the 0.04 ETH bridge budget — almost two full orders of magnitude under the estimate.
- hardhat-verify on the Etherscan V2 unified-key syntax verified all 11 contracts on the first batch (after the V1-deprecation migration we logged in Phase 1). Zero retries needed beyond hardhat-verify's own internal backoff.
- ChainGPT Smart Contract Auditor returned structured Critical/High/Medium/Low/Informational reports on the first call. Average response time: 13 seconds per contract. Findings caught the EXACT design tradeoffs we documented as Phase 2.6 hardening (deposit verification on GroundVaultCore, single-owner Identity, claim signature replay surface), so the auditor's signal aligns with what an external reviewer would independently surface.
- The Nox library shipped pre-deployed on Arbitrum Sepolia at the address in Nox.sol's chainid switch, so deploy required zero address juggling — the SDK auto-resolves at runtime.

### Friction points
- ChainGPT free-tier credits ran out on the 11th audit call (GroundVaultRouter, the smallest contract). Single-call cost is opaque from the API response — no remaining-credit header, just an HTTP 400 once you exceed. Worth ChainGPT documenting credit-per-model pricing more visibly so builders can budget.
- The Nox precompile is not deployed on the local hardhat network despite the chainid switch in Nox.sol mapping `chainid 31337 -> 0x44C00...8236`. There is no reference mock provided by `@iexec-nox/nox-protocol-contracts`, so unit tests for any contract that calls Nox can only exercise the pre-Nox revert paths. End-to-end behaviour has to be verified on Arbitrum Sepolia. This is a real friction point — a `MockNoxCompute` that ships with the package would unlock fully-local CI test coverage of the encrypted paths.
- Deploy gas estimate (0.04 ETH for 12 contracts) was off by ~200x in the safe direction. iExec docs could publish a "typical Phase 1+3 gas budget" line so first-time builders don't over-bridge.

### Open questions (raised in Discord)
- Does iExec ship a Nox precompile mock for hardhat-network unit tests?
- Is there a recommended pattern for confidentialTransferFrom on ERC-7984 wrappers, or is the spec deliberately leaving that flow application-specific?

### Live Sepolia integration test (2026-04-26)
- `@iexec-nox/handle@0.1.0-beta.10` worked first-try with no debugging needed. `createEthersHandleClient(signer)` factory + `encryptInput(value, "uint256", applicationContract)` for inputs, `decrypt(handle)` for outputs — exactly what the README claimed. Six sequential live steps (Identity + KYC + wrap + confidentialTransfer + recordDeposit + processDeposit + claimDeposit) all passed in 24 s wall clock.
- Per-step latency on Arbitrum Sepolia averaged 2.5 s after the warm-up step. The encrypt + sign + broadcast + decrypt cycle is fast enough that the demo-recording flow (Phase 6) does not need to fake any latency.
- The handle SDK requires the encrypted input to be bound to a specific `applicationContract` address. When recording a deposit, the user must therefore encrypt twice — once for cUSDC.confidentialTransfer (bound to cUSDC), once for vault.recordDeposit (bound to vault). This is correct ACL behaviour but worth documenting up front in the iExec docs so builders don't try to reuse a handle across contracts.

### Hardhat-network confidential mock
- _Open question: does the Nox library expose a Hardhat-network mock for unit tests, or are we required to run integration tests against Sepolia? Will document either way._

---

## Phase 4 — Frontend integration

_To be filled Apr 28 + Apr 30. Topics planned: `@iexec-nox/handle` ergonomics, `createEthersHandleClient` decrypt UX, wagmi v2 + ethers v6 compatibility with Nox handles, fallback states when TEE decrypt fails._

---

## Phase 5 — Real data integration

_To be filled Apr 28._

---

## Phase 6 — Submission

_To be filled Apr 30._

---

## Aggregate ask of the iExec team

_To be summarized at the end. Top 3 things that would 10x the next builder's experience._
