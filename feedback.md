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

### Open questions (raised in Discord)
- _(placeholder — will fill as Discord replies come back)_

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
