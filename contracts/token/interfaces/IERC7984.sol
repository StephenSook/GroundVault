// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "encrypted-types/EncryptedTypes.sol";

/// @title IERC7984
/// @notice Minimal Confidential Fungible Token surface used by GroundVault.
/// @dev    The full ERC-7984 spec also includes confidentialApprove,
///         confidentialAllowance, and confidentialTransferFrom. The
///         hackathon submission is single-step transfer-only and omits
///         the allowance flow; this is documented in the GroundVault
///         README and the feedback.md file. The contract surface here
///         is the subset required by the GroundVault deposit + transfer
///         demo path.
interface IERC7984 {
    /// @notice Emitted whenever encrypted balances change. The amount
    ///         field is the encrypted handle, not the plaintext.
    event ConfidentialTransfer(address indexed from, address indexed to, bytes32 amountHandle);

    /// @notice Encrypted balance handle for `account`. The handle alone
    ///         reveals nothing — decryption requires Nox ACL access.
    function confidentialBalanceOf(address account) external view returns (bytes32);

    /// @notice Encrypted total supply handle.
    function confidentialTotalSupply() external view returns (bytes32);

    /// @notice Atomic encrypted transfer from msg.sender to `to`.
    ///         Returns the handle for the encrypted amount that was
    ///         actually moved (which can be zero if the TEE detected
    ///         insufficient balance — caller learns nothing about the
    ///         outcome without a decryption pass).
    function confidentialTransfer(
        address to,
        externalEuint256 inputHandle,
        bytes calldata inputProof
    ) external returns (bytes32 amountHandle);
}
