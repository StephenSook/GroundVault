// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title IModularCompliance
/// @notice ERC-3643 modular compliance contract. The token bound to this
///         contract calls {canTransfer} pre-transfer and {transferred} /
///         {created} / {destroyed} post-state-change. The compliance
///         contract fans the calls out to its registered modules.
/// @dev    Note re: ERC-7984 pairing: with confidential token amounts the
///         `amount` argument here is a placeholder zero. Modules cannot
///         enforce amount-based rules without TEE support. Address-based
///         modules (jurisdiction, KYC) are unaffected.
interface IModularCompliance {
    event TokenBound(address indexed token);
    event TokenUnbound(address indexed token);
    event ModuleAdded(address indexed module);
    event ModuleRemoved(address indexed module);

    /// @notice Bind the token contract this compliance applies to. Can
    ///         only be called once. Owner-only.
    function bindToken(address token) external;

    /// @notice Unbind the currently-bound token. Owner-only.
    function unbindToken() external;

    /// @notice Append a compliance module. Owner-only. Reverts if already
    ///         registered.
    function addModule(address module) external;

    /// @notice Remove a compliance module. Owner-only.
    function removeModule(address module) external;

    /// @notice Bound token address (or zero if none).
    function tokenBound() external view returns (address);

    /// @notice True if `module` is registered.
    function isModuleBound(address module) external view returns (bool);

    /// @notice All registered modules in registration order.
    function getModules() external view returns (address[] memory);

    /// @notice Aggregate transfer authorization. Returns false if any
    ///         module returns false. Token MUST consult this before
    ///         executing a transfer.
    function canTransfer(address from, address to, uint256 amount) external view returns (bool);

    /// @notice Token-only post-transfer hook. Modules use this to update
    ///         per-investor counters, holding caps, etc.
    function transferred(address from, address to, uint256 amount) external;

    /// @notice Token-only post-mint hook.
    function created(address to, uint256 amount) external;

    /// @notice Token-only post-burn hook.
    function destroyed(address from, uint256 amount) external;
}
