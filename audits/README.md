# ChainGPT Smart Contract Audits

Each contract was submitted to the ChainGPT Smart Contract Auditor (model `smart_contract_auditor`) for security review. Reports are stored alongside this index.

Date: 2026-04-26
Submission: iExec Vibe Coding Challenge
Network of deployed contracts: Arbitrum Sepolia (chain 421614)

Total contracts audited: 10/11

| Contract | Status | Response time | Report size |
|---|---|---|---|
| [ClaimTopicsRegistry](ClaimTopicsRegistry.md) | ✓ | 11259 ms | 2960 B |
| [TrustedIssuersRegistry](TrustedIssuersRegistry.md) | ✓ | 13955 ms | 3450 B |
| [Identity](Identity.md) | ✓ | 12256 ms | 3288 B |
| [IdentityRegistry](IdentityRegistry.md) | ✓ | 10620 ms | 3025 B |
| [ModularCompliance](ModularCompliance.md) | ✓ | 13922 ms | 3151 B |
| [JurisdictionModule](JurisdictionModule.md) | ✓ | 10282 ms | 2628 B |
| [cUSDC](cUSDC.md) | ✓ | 12931 ms | 3077 B |
| [GroundVaultToken](GroundVaultToken.md) | ✓ | 14867 ms | 3360 B |
| [GroundVaultCore](GroundVaultCore.md) | ✓ | 10565 ms | 3137 B |
| [GroundVaultRegistry](GroundVaultRegistry.md) | ✓ | 24084 ms | 2957 B |
| GroundVaultRouter | deferred | — | hit ChainGPT free-tier credit limit on the 11th call; Router is the simplest contract in the suite (read-only pass-through over GroundVaultToken + GroundVaultCore) so the gap is acceptable for the initial audit batch. Will re-run once additional ChainGPT credits land. |

## Reading the reports

Each report leads with the auditor's findings categorized by severity (Critical, High, Medium, Low, Informational). Critical and High findings, if any, are tracked in the GroundVault PR list and addressed before submission. Lower-severity findings are documented for transparency but may not all be addressed in the hackathon scope.

## Hackathon-scope context

Several of the audited contracts implement intentional simplifications versus the production T-REX / ERC-7540 specs. These are documented in the contract NatSpec and `feedback.md`, and the auditor is expected to flag them. Examples: single-owner ONCHAINID Identity (no ERC-734 multi-key), folded IdentityRegistryStorage, `confidentialTransferFrom` omitted on cUSDC, `cancelDepositTimeout` stubbed out for Phase 2.6 hardening.

## Findings rollup

ChainGPT returned three **Critical** findings across the 10 audited contracts. Each is addressed below; one is genuine accepted hackathon scope, two are false positives where existing mitigations were not surfaced clearly to the auditor.

### Critical findings

**1. `GroundVaultCore` — lack of verification on deposit transfers.** The `recordDeposit` function does not on-chain-verify that the caller transferred cUSDC to the vault. **Status: accepted hackathon scope.** This is the documented Phase 2.6 trust hardening; the remediation path (TEE oracle or `confidentialTransferFrom` on cUSDC) is in `GroundVaultCore.sol` NatSpec and `feedback.md`. Production deployment fixes it.

**2. `Identity` — reentrancy in `removeClaim`.** The auditor flagged that state changes precede event emission. **Status: false positive.** `removeClaim` follows Checks-Effects-Interactions: claim id is validated, all storage writes complete, then the event is emitted. There is no external call between the state mutation and the event. Re-entry from inside the event-emit step is not a viable attack vector in Solidity 0.8.x (events are not callable contracts).

**3. `cUSDC` — reentrancy on `wrap` via the Nox external call.** The auditor flagged the call to `Nox.toEuint256` and `Nox.mint` inside `wrap` as a reentrancy surface. **Status: false positive, layered mitigation already present.** `wrap` is decorated with `nonReentrant`, the Nox precompile is not user-controlled (deployed and audited by the iExec team at a fixed address per the chainid switch), and `safeTransferFrom` precedes the Nox calls so the underlying balance is moved before any encrypted-state mutation. Documented in the cUSDC NatSpec.

### High findings (production hardening, accepted hackathon scope)

The High findings clustered around operator and agent role centralization — a single admin key controls each registry. Production hardening would attach a multi-signature wallet and time-lock to `DEFAULT_ADMIN_ROLE`, `OPERATOR_ROLE`, and `AGENT_ROLE`. The hackathon submission uses a single key (the deployer wallet) for all roles to keep the demo flow legible.

### Medium findings

Gas optimization (caching repeated storage reads, optimizing the nested loop in `IdentityRegistry.isVerified`) and external-call defensiveness (Identity contract calls inside `isVerified` could revert; auditor suggests try/catch). Accepted as Phase 2.6 polish.

### Low / Informational findings

Uniformly positive: appropriate use of OpenZeppelin libraries, custom errors, NatSpec coverage, AccessControl semantics. Several auditor recommendations matched practices already in place.

### Self-identified Phase 2.6 hardening (NOT a ChainGPT finding)

In addition to the auditor's flags, the team has self-identified the following hardening item that the audit did not surface explicitly: the `IdentityRegistry.isVerified` claim-signing canonical message — `toEthSignedMessageHash(keccak256(abi.encode(identity, topic, data)))` — does not include a chain id or a registry-bound nonce. A claim signed for one Identity contract address would not validate against another (because `identity` is part of the digest), but cross-deployment replay on the same chain id is theoretically possible if the identity address collides. Production hardening: include chain id + a registry-bound nonce. Documented as Phase 2.6.

## Re-audit policy

Any change to a contract source file before submission triggers a re-audit of that contract. The re-audit report replaces the existing one in this directory. The ChainGPT model is non-deterministic, so two runs over identical source can produce slightly different findings — both are valid signal but the latest run is canonical for the submission.
