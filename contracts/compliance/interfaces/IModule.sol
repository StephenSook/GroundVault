// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title IModule
/// @notice ERC-3643 compliance module. Registered with a
///         {IModularCompliance} contract; queried per-transfer.
/// @dev    Modules MUST be safe to add/remove without state corruption.
///         The {bindCompliance} / {unbindCompliance} hooks let a module
///         enforce that only its bound compliance can call it.
interface IModule {
    event ComplianceBound(address indexed compliance);
    event ComplianceUnbound(address indexed compliance);

    /// @notice Module registers a compliance contract that may invoke
    ///         it. The compliance MUST call this from {addModule}.
    function bindCompliance(address compliance) external;

    /// @notice Module unregisters a compliance contract.
    function unbindCompliance(address compliance) external;

    /// @notice True if `compliance` is bound to this module.
    function isComplianceBound(address compliance) external view returns (bool);

    /// @notice Authorize or reject a transfer. The bound compliance is
    ///         msg.sender. Modules SHOULD treat any other caller as
    ///         unauthorized and revert.
    function moduleCheck(address from, address to, uint256 amount, address compliance)
        external
        view
        returns (bool);

    /// @notice Post-transfer notification. Module updates state.
    function moduleTransferAction(address from, address to, uint256 amount) external;

    /// @notice Post-mint notification.
    function moduleMintAction(address to, uint256 amount) external;

    /// @notice Post-burn notification.
    function moduleBurnAction(address from, uint256 amount) external;

    /// @notice Human-readable name. Used in audit logs.
    function name() external view returns (string memory);
}
