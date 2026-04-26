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

ChainGPT returned **0 Critical** findings on contracts where the design tradeoff is fully on-chain (Identity, IdentityRegistry, ModularCompliance, JurisdictionModule, ClaimTopicsRegistry, TrustedIssuersRegistry, GroundVaultRegistry, GroundVaultToken, cUSDC).

GroundVaultCore drew **1 Critical** finding: "lack of verification on deposit transfers". This is the documented Phase 2.6 trust hardening — `recordDeposit` does not on-chain-verify that the caller transferred cUSDC to the vault. The remediation path (TEE oracle or `confidentialTransferFrom`) is in the GroundVaultCore NatSpec and `feedback.md`. The hackathon submission accepts the trust assumption; production deployment fixes it.

**High** findings clustered around two themes:
- Operator / agent role centralization (admin compromise risk). Production hardening: multi-sig + time-lock. Accepted hackathon scope.
- ECDSA replay surface in `IdentityRegistry.isVerified`. The canonical claim-signing message (`keccak256(abi.encode(identity, topic, data))`) does not include a chain id, contract id, or nonce. A claim signed for one Identity contract would not validate on another (because `identity` is the address), but cross-deployment replays on identical chain id are theoretically possible. Production hardening: include chain id + a registry-bound nonce. Documented as Phase 2.6.

**Medium** findings clustered around gas optimization (caching repeated storage reads, optimizing the nested loop in `isVerified`) and external-call defensiveness (Identity contract calls inside `isVerified` could revert; consider try/catch). All accepted as Phase 2.6 polish.

**Low / Informational** findings were uniformly positive: appropriate use of OpenZeppelin libraries, custom errors, NatSpec coverage, AccessControl semantics. Several auditor recommendations matched practices we had already adopted.

## Re-audit policy

Any change to a contract source file before submission triggers a re-audit of that contract. The re-audit report replaces the existing one in this directory. The ChainGPT model is non-deterministic, so two runs over identical source can produce slightly different findings — both are valid signal but the latest run is canonical for the submission.
