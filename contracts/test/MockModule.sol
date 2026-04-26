// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IModule} from "../compliance/interfaces/IModule.sol";

/// @title MockModule
/// @notice Test-only stub IModule that records compliance bindings and
///         lets tests toggle a global allow/deny flag. NEVER ship to
///         a production deployment — there is no access control on
///         {setAllowed}.
/// @dev    Lives under `contracts/test` to make its scope unambiguous
///         on a code review.
contract MockModule is IModule {
    mapping(address compliance => bool bound) private _bound;
    bool private _allowed;

    uint256 public transferActionCount;
    uint256 public mintActionCount;
    uint256 public burnActionCount;

    constructor(bool initialAllowed) {
        _allowed = initialAllowed;
    }

    function setAllowed(bool allowed) external {
        _allowed = allowed;
    }

    function bindCompliance(address compliance) external override {
        _bound[compliance] = true;
        emit ComplianceBound(compliance);
    }

    function unbindCompliance(address compliance) external override {
        _bound[compliance] = false;
        emit ComplianceUnbound(compliance);
    }

    function isComplianceBound(address compliance) external view override returns (bool) {
        return _bound[compliance];
    }

    function moduleCheck(address, address, uint256, address) external view override returns (bool) {
        return _allowed;
    }

    function moduleTransferAction(address, address, uint256) external override {
        transferActionCount += 1;
    }

    function moduleMintAction(address, uint256) external override {
        mintActionCount += 1;
    }

    function moduleBurnAction(address, uint256) external override {
        burnActionCount += 1;
    }

    function name() external pure override returns (string memory) {
        return "MockModule";
    }
}
