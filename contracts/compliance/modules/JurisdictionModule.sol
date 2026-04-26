// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {IModule} from "../interfaces/IModule.sol";
import {IIdentityRegistry} from "../../identity/interfaces/IIdentityRegistry.sol";

/// @title JurisdictionModule
/// @notice ERC-3643 compliance module that enforces a country allowlist
///         on the recipient of every transfer. Reads ISO 3166-1 numeric
///         country codes from the bound IdentityRegistry. The owner
///         (token issuer) curates the allowlist.
/// @dev    {moduleCheck} treats `to == address(0)` as a burn and
///         skips the recipient check; mints (`from == address(0)`) are
///         still checked because the new holder must be in an allowed
///         jurisdiction. The token transfer hook is responsible for
///         calling {moduleCheck} regardless of `amount`, which is
///         passed through verbatim and ignored by this module.
contract JurisdictionModule is Ownable2Step, IModule {
    string private constant _NAME = "JurisdictionModule";

    IIdentityRegistry private _identityRegistry;

    mapping(address compliance => bool bound) private _bound;

    /// @dev country code -> allowed.
    mapping(uint16 country => bool allowed) private _isAllowed;

    /// @dev allowlist in registration order, for enumeration.
    uint16[] private _allowedCountries;

    /// @dev "index + 1" lookup for O(1) removal.
    mapping(uint16 country => uint256 indexPlusOne) private _allowedIndex;

    error ZeroAddressIdentityRegistry();
    error CountryAlreadyAllowed(uint16 country);
    error CountryNotAllowed(uint16 country);

    event IdentityRegistrySet(IIdentityRegistry indexed registry);
    event AllowedCountryAdded(uint16 indexed country);
    event AllowedCountryRemoved(uint16 indexed country);

    constructor(address initialOwner, IIdentityRegistry registry) Ownable(initialOwner) {
        if (address(registry) == address(0)) revert ZeroAddressIdentityRegistry();
        _identityRegistry = registry;
        emit IdentityRegistrySet(registry);
    }

    // --- IModule binding ----------------------------------------------

    /// @inheritdoc IModule
    function bindCompliance(address compliance) external override {
        _bound[compliance] = true;
        emit ComplianceBound(compliance);
    }

    /// @inheritdoc IModule
    function unbindCompliance(address compliance) external override {
        _bound[compliance] = false;
        emit ComplianceUnbound(compliance);
    }

    /// @inheritdoc IModule
    function isComplianceBound(address compliance) external view override returns (bool) {
        return _bound[compliance];
    }

    // --- Allowlist curation -------------------------------------------

    /// @notice Replace the IdentityRegistry this module reads from.
    function setIdentityRegistry(IIdentityRegistry registry) external onlyOwner {
        if (address(registry) == address(0)) revert ZeroAddressIdentityRegistry();
        _identityRegistry = registry;
        emit IdentityRegistrySet(registry);
    }

    /// @notice Add `country` to the allowlist. Owner-only. Reverts on
    ///         duplicate.
    function addAllowedCountry(uint16 country) external onlyOwner {
        if (_isAllowed[country]) revert CountryAlreadyAllowed(country);
        _isAllowed[country] = true;
        _allowedCountries.push(country);
        _allowedIndex[country] = _allowedCountries.length;
        emit AllowedCountryAdded(country);
    }

    /// @notice Remove `country` from the allowlist. Owner-only. Reverts
    ///         if not present.
    function removeAllowedCountry(uint16 country) external onlyOwner {
        if (!_isAllowed[country]) revert CountryNotAllowed(country);

        uint256 indexPlusOne = _allowedIndex[country];
        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = _allowedCountries.length - 1;

        if (index != lastIndex) {
            uint16 last = _allowedCountries[lastIndex];
            _allowedCountries[index] = last;
            _allowedIndex[last] = indexPlusOne;
        }

        _allowedCountries.pop();
        delete _allowedIndex[country];
        _isAllowed[country] = false;

        emit AllowedCountryRemoved(country);
    }

    /// @notice True if `country` is on the allowlist.
    function isCountryAllowed(uint16 country) external view returns (bool) {
        return _isAllowed[country];
    }

    /// @notice The full allowlist, in registration order.
    function getAllowedCountries() external view returns (uint16[] memory) {
        return _allowedCountries;
    }

    /// @notice The IdentityRegistry this module reads from.
    function identityRegistry() external view returns (IIdentityRegistry) {
        return _identityRegistry;
    }

    // --- IModule transfer surface -------------------------------------

    /// @inheritdoc IModule
    function moduleCheck(address, address to, uint256, address)
        external
        view
        override
        returns (bool)
    {
        if (to == address(0)) return true; // burn
        return _isAllowed[_identityRegistry.investorCountry(to)];
    }

    /// @inheritdoc IModule
    function moduleTransferAction(address, address, uint256) external override {
        // No per-transfer state for jurisdiction enforcement.
    }

    /// @inheritdoc IModule
    function moduleMintAction(address, uint256) external override {
        // No per-mint state.
    }

    /// @inheritdoc IModule
    function moduleBurnAction(address, uint256) external override {
        // No per-burn state.
    }

    /// @inheritdoc IModule
    function name() external pure override returns (string memory) {
        return _NAME;
    }
}
