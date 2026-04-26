// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {IModularCompliance} from "./interfaces/IModularCompliance.sol";
import {IModule} from "./interfaces/IModule.sol";

/// @title ModularCompliance
/// @notice ERC-3643 modular compliance contract. The bound token calls
///         {canTransfer} pre-transfer and {transferred} / {created} /
///         {destroyed} post-state-change. This contract fans the calls
///         out to every registered module.
/// @dev    `amount` is passed through verbatim. When the bound token is
///         ERC-7984 (encrypted balances), the token MUST pass zero for
///         `amount` and modules MUST treat zero as "amount unknown".
///         Address-based modules (jurisdiction, KYC) are unaffected by
///         this; amount-based modules require off-chain TEE compute,
///         which is the Phase 2.6 stretch.
contract ModularCompliance is Ownable2Step, IModularCompliance {
    address private _tokenBound;

    /// @dev Module address -> registered.
    mapping(address module => bool registered) private _isModule;

    /// @dev Modules in registration order, for fan-out iteration.
    address[] private _modules;

    /// @dev "index + 1" lookup for O(1) removal.
    mapping(address module => uint256 indexPlusOne) private _moduleIndex;

    error TokenAlreadyBound();
    error TokenNotBound();
    error ZeroAddressToken();
    error ZeroAddressModule();
    error ModuleAlreadyRegistered(address module);
    error ModuleNotRegistered(address module);
    error CallerNotToken();

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyToken() {
        if (msg.sender != _tokenBound) revert CallerNotToken();
        _;
    }

    /// @inheritdoc IModularCompliance
    function bindToken(address token) external onlyOwner {
        if (token == address(0)) revert ZeroAddressToken();
        if (_tokenBound != address(0)) revert TokenAlreadyBound();
        _tokenBound = token;
        emit TokenBound(token);
    }

    /// @inheritdoc IModularCompliance
    function unbindToken() external onlyOwner {
        address current = _tokenBound;
        if (current == address(0)) revert TokenNotBound();
        _tokenBound = address(0);
        emit TokenUnbound(current);
    }

    /// @inheritdoc IModularCompliance
    function addModule(address module) external onlyOwner {
        if (module == address(0)) revert ZeroAddressModule();
        if (_isModule[module]) revert ModuleAlreadyRegistered(module);

        _isModule[module] = true;
        _modules.push(module);
        _moduleIndex[module] = _modules.length;

        IModule(module).bindCompliance(address(this));
        emit ModuleAdded(module);
    }

    /// @inheritdoc IModularCompliance
    function removeModule(address module) external onlyOwner {
        if (!_isModule[module]) revert ModuleNotRegistered(module);

        uint256 indexPlusOne = _moduleIndex[module];
        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = _modules.length - 1;

        if (index != lastIndex) {
            address lastModule = _modules[lastIndex];
            _modules[index] = lastModule;
            _moduleIndex[lastModule] = indexPlusOne;
        }

        _modules.pop();
        delete _moduleIndex[module];
        _isModule[module] = false;

        IModule(module).unbindCompliance(address(this));
        emit ModuleRemoved(module);
    }

    /// @inheritdoc IModularCompliance
    function tokenBound() external view returns (address) {
        return _tokenBound;
    }

    /// @inheritdoc IModularCompliance
    function isModuleBound(address module) external view returns (bool) {
        return _isModule[module];
    }

    /// @inheritdoc IModularCompliance
    function getModules() external view returns (address[] memory) {
        return _modules;
    }

    /// @inheritdoc IModularCompliance
    function canTransfer(address from, address to, uint256 amount) external view returns (bool) {
        uint256 length = _modules.length;
        for (uint256 i = 0; i < length; ++i) {
            if (!IModule(_modules[i]).moduleCheck(from, to, amount, address(this))) {
                return false;
            }
        }
        return true;
    }

    /// @inheritdoc IModularCompliance
    function transferred(address from, address to, uint256 amount) external onlyToken {
        uint256 length = _modules.length;
        for (uint256 i = 0; i < length; ++i) {
            IModule(_modules[i]).moduleTransferAction(from, to, amount);
        }
    }

    /// @inheritdoc IModularCompliance
    function created(address to, uint256 amount) external onlyToken {
        uint256 length = _modules.length;
        for (uint256 i = 0; i < length; ++i) {
            IModule(_modules[i]).moduleMintAction(to, amount);
        }
    }

    /// @inheritdoc IModularCompliance
    function destroyed(address from, uint256 amount) external onlyToken {
        uint256 length = _modules.length;
        for (uint256 i = 0; i < length; ++i) {
            IModule(_modules[i]).moduleBurnAction(from, amount);
        }
    }
}
