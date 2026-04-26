// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC7984} from "../token/interfaces/IERC7984.sol";
import {GroundVaultCore} from "../vault/GroundVaultCore.sol";
import {GroundVaultToken} from "../token/GroundVaultToken.sol";

/// @title GroundVaultRouter
/// @notice Read-only third-party composability layer. Demonstrates that
///         a separate protocol (e.g. an impact lending market, an
///         insurance pool, an audit dashboard) can compose with
///         GroundVault by reading vault state without ever breaching
///         investor privacy.
/// @dev    Every value this contract returns is either a public scalar
///         (timestamp, address) or an encrypted handle (bytes32). The
///         encrypted handles reveal nothing without an off-chain Nox
///         decrypt against an ACL grant — so a third-party can wire up
///         "is the vault healthy?" UX without learning who deposited
///         what. This is the privacy-preserving composability claim
///         the GroundVault submission rests on.
contract GroundVaultRouter {
    GroundVaultToken private immutable _shareToken;
    GroundVaultCore private immutable _vault;

    error ZeroAddressShareToken();
    error ZeroAddressVault();

    constructor(GroundVaultToken shareToken_, GroundVaultCore vault_) {
        if (address(shareToken_) == address(0)) revert ZeroAddressShareToken();
        if (address(vault_) == address(0)) revert ZeroAddressVault();
        _shareToken = shareToken_;
        _vault = vault_;
    }

    function shareToken() external view returns (GroundVaultToken) {
        return _shareToken;
    }

    function vault() external view returns (GroundVaultCore) {
        return _vault;
    }

    /// @notice Encrypted total supply of vault shares. A third-party
    ///         can read this for "vault health" UX; the handle alone
    ///         reveals nothing without TEE decryption.
    function aggregateVaultSupply() external view returns (bytes32) {
        return _shareToken.confidentialTotalSupply();
    }

    /// @notice Encrypted balance handle for a specific holder. The
    ///         third-party caller learns the handle but cannot decrypt
    ///         it — only the holder's address (and addresses they
    ///         ACL-grant via Nox.allow) can.
    function holderBalance(address holder) external view returns (bytes32) {
        return _shareToken.confidentialBalanceOf(holder);
    }

    /// @notice Encrypted pending-deposit handle for a specific
    ///         controller, read from the vault.
    function pendingDepositOf(address controller) external view returns (bytes32) {
        return _vault.pendingDepositOf(controller);
    }

    /// @notice Encrypted claimable-shares handle for a specific
    ///         controller, read from the vault.
    function claimableDepositOf(address controller) external view returns (bytes32) {
        return _vault.claimableDepositOf(controller);
    }

    /// @notice Plain createdAt timestamp for a controller's deposit
    ///         request. Public on-chain by design — the privacy property
    ///         applies to amounts, not to the existence of activity.
    function depositCreatedAt(address controller) external view returns (uint64) {
        return _vault.depositCreatedAt(controller);
    }
}
