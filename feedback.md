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

## Phase 1 — Hardhat scaffold

_To be filled Apr 26._

---

## Phase 2 — Smart contracts

_To be filled Apr 26-27. Topics planned to cover: ERC-7984 wrapping flow, ERC-3643 T-REX integration friction, ERC-7540 lifecycle vs encrypted-type adaptation, gas costs of confidential ops on Sepolia._

---

## Phase 3 — Deploy + tests

_To be filled Apr 27-28._

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
