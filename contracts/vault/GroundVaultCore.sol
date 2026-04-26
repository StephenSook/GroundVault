// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

import {IIdentityRegistry} from "../identity/interfaces/IIdentityRegistry.sol";
import {IERC7984} from "../token/interfaces/IERC7984.sol";
import {GroundVaultToken} from "../token/GroundVaultToken.sol";

/// @title GroundVaultCore
/// @notice Custom encrypted async deposit queue. Implements the
///         ERC-7540 lifecycle (PENDING -> CLAIMABLE -> CLAIMED) adapted
///         for ERC-7984 encrypted balances. The deposit asset is cUSDC
///         (encrypted-wrapped MockUSDC); the share token is
///         GroundVaultToken (ERC-7984 + ERC-3643 transfer gate).
/// @dev    Hackathon-scope simplifications, all documented:
///
///         - State is aggregated per controller per ERC-7540: a single
///           pending and a single claimable per address. Multiple
///           requestDeposit calls fold into one pending balance.
///
///         - Share ratio is 1:1 at processDeposit time. NAV-based
///           pricing is the Phase 2.6 stretch.
///
///         - {recordDeposit} performs no on-chain verification that the
///           caller actually transferred cUSDC to this vault. The user
///           is expected to have already executed
///           cUSDC.confidentialTransfer(vault, amount, proof) and to
///           pass the same encrypted handle into recordDeposit. A
///           production deployment would either pull cUSDC via a
///           confidentialTransferFrom (requires adding allowance to
///           cUSDC), or use a TEE oracle to verify atomically. This is
///           the Phase 2.6 trust hardening.
///
///         - {cancelDepositTimeout} reverts with NotYetImplemented so
///           the surface exists for the audit story but the refund
///           flow is deferred. It needs a vault-only confidential
///           transfer on cUSDC, which is a parallel refactor of the
///           same shape as the GroundVaultToken internal-handle mint.
///
///         - Redemption flow (shares -> cUSDC) is intentionally out of
///           scope for the initial Phase 2c commit. The deposit demo
///           is the priority for the Apr 28 EOD milestone.
contract GroundVaultCore is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    struct DepositRequest {
        euint256 pending;
        euint256 claimable;
        uint64 createdAt;
    }

    IIdentityRegistry private _identityRegistry;
    GroundVaultToken private _shareToken;
    IERC7984 private _depositAsset;
    uint64 private _timeout;

    mapping(address controller => DepositRequest request) private _deposits;

    event IdentityRegistrySet(IIdentityRegistry indexed registry);
    event ShareTokenSet(GroundVaultToken indexed shareToken);
    event DepositAssetSet(IERC7984 indexed depositAsset);
    event TimeoutSet(uint64 timeout);
    event DepositRecorded(address indexed controller, bytes32 amountHandle, uint64 createdAt);
    event DepositProcessed(address indexed controller, bytes32 newClaimableHandle);
    event DepositClaimed(address indexed controller, bytes32 sharesHandle);

    error ZeroAddressIdentityRegistry();
    error ZeroAddressShareToken();
    error ZeroAddressDepositAsset();
    error NotVerified(address user);
    error NotYetImplemented();

    constructor(
        address admin,
        IIdentityRegistry identityRegistry_,
        GroundVaultToken shareToken_,
        IERC7984 depositAsset_,
        uint64 timeout_
    ) {
        if (address(identityRegistry_) == address(0)) revert ZeroAddressIdentityRegistry();
        if (address(shareToken_) == address(0)) revert ZeroAddressShareToken();
        if (address(depositAsset_) == address(0)) revert ZeroAddressDepositAsset();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);

        _identityRegistry = identityRegistry_;
        _shareToken = shareToken_;
        _depositAsset = depositAsset_;
        _timeout = timeout_;

        emit IdentityRegistrySet(identityRegistry_);
        emit ShareTokenSet(shareToken_);
        emit DepositAssetSet(depositAsset_);
        emit TimeoutSet(timeout_);
    }

    // --- Admin --------------------------------------------------------

    function setIdentityRegistry(IIdentityRegistry registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(registry) == address(0)) revert ZeroAddressIdentityRegistry();
        _identityRegistry = registry;
        emit IdentityRegistrySet(registry);
    }

    function setShareToken(GroundVaultToken shareToken_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(shareToken_) == address(0)) revert ZeroAddressShareToken();
        _shareToken = shareToken_;
        emit ShareTokenSet(shareToken_);
    }

    function setDepositAsset(IERC7984 depositAsset_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(depositAsset_) == address(0)) revert ZeroAddressDepositAsset();
        _depositAsset = depositAsset_;
        emit DepositAssetSet(depositAsset_);
    }

    function setTimeout(uint64 timeout_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _timeout = timeout_;
        emit TimeoutSet(timeout_);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // --- Reads --------------------------------------------------------

    function identityRegistry() external view returns (IIdentityRegistry) {
        return _identityRegistry;
    }

    function shareToken() external view returns (GroundVaultToken) {
        return _shareToken;
    }

    function depositAsset() external view returns (IERC7984) {
        return _depositAsset;
    }

    function timeout() external view returns (uint64) {
        return _timeout;
    }

    function pendingDepositOf(address controller) external view returns (bytes32) {
        return euint256.unwrap(_deposits[controller].pending);
    }

    function claimableDepositOf(address controller) external view returns (bytes32) {
        return euint256.unwrap(_deposits[controller].claimable);
    }

    function depositCreatedAt(address controller) external view returns (uint64) {
        return _deposits[controller].createdAt;
    }

    // --- Lifecycle ----------------------------------------------------

    /// @notice Register a deposit request. The caller is expected to
    ///         have already executed
    ///         cUSDC.confidentialTransfer(this, amount, proof) in a
    ///         prior transaction; this call commits the encrypted
    ///         amount to the vault's pending state.
    function recordDeposit(externalEuint256 inputHandle, bytes calldata inputProof)
        external
        whenNotPaused
        nonReentrant
        returns (bytes32 amountHandle)
    {
        if (!_identityRegistry.isVerified(msg.sender)) revert NotVerified(msg.sender);

        euint256 amount = Nox.fromExternal(inputHandle, inputProof);

        DepositRequest storage req = _deposits[msg.sender];
        euint256 newPending = Nox.add(req.pending, amount);

        req.pending = newPending;
        req.createdAt = uint64(block.timestamp);

        Nox.allowThis(newPending);
        Nox.allow(newPending, msg.sender);

        amountHandle = euint256.unwrap(amount);
        emit DepositRecorded(msg.sender, amountHandle, req.createdAt);
    }

    /// @notice Move a controller's pending state to claimable. Operator-
    ///         only. Uses 1:1 share ratio for the hackathon; NAV-based
    ///         pricing is the Phase 2.6 stretch.
    function processDeposit(address controller) external whenNotPaused onlyRole(OPERATOR_ROLE) {
        DepositRequest storage req = _deposits[controller];

        euint256 newClaimable = Nox.add(req.claimable, req.pending);
        euint256 zero = Nox.toEuint256(0);

        req.claimable = newClaimable;
        req.pending = zero;

        Nox.allowThis(newClaimable);
        Nox.allow(newClaimable, controller);
        Nox.allowThis(zero);

        emit DepositProcessed(controller, euint256.unwrap(newClaimable));
    }

    /// @notice Claim shares for the caller. The claimable amount is
    ///         minted as encrypted GroundVaultToken to the caller. The
    ///         claimable slot is reset to encrypted zero.
    function claimDeposit() external whenNotPaused nonReentrant returns (bytes32 sharesHandle) {
        if (!_identityRegistry.isVerified(msg.sender)) revert NotVerified(msg.sender);

        DepositRequest storage req = _deposits[msg.sender];
        euint256 amount = req.claimable;

        // The share token will need to read this handle, so transient-
        // ACL it for the cross-call.
        Nox.allowTransient(amount, address(_shareToken));

        sharesHandle = _shareToken.confidentialMintInternal(msg.sender, amount);

        euint256 zero = Nox.toEuint256(0);
        req.claimable = zero;
        Nox.allowThis(zero);

        emit DepositClaimed(msg.sender, sharesHandle);
    }

    /// @notice Cancel a pending deposit and reclaim the cUSDC after the
    ///         timeout window has passed. NOT YET IMPLEMENTED — the
    ///         refund flow needs a vault-only confidential transfer on
    ///         cUSDC, which is a parallel refactor that ships in a
    ///         later commit.
    function cancelDepositTimeout() external pure {
        revert NotYetImplemented();
    }
}
