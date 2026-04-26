// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {IIdentity} from "./interfaces/IIdentity.sol";
import {IClaimTopicsRegistry} from "./interfaces/IClaimTopicsRegistry.sol";
import {ITrustedIssuersRegistry} from "./interfaces/ITrustedIssuersRegistry.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

/// @title IdentityRegistry
/// @notice Wallet -> Identity binding plus the canonical {isVerified}
///         gate that GroundVaultToken consults inside its transfer hook.
///         Folds the T-REX 4.0 IdentityRegistryStorage layer into a
///         single contract for the GroundVault hackathon submission.
/// @dev    AGENT_ROLE addresses register, update, and delete investor
///         identities; DEFAULT_ADMIN_ROLE addresses change the
///         ClaimTopicsRegistry and TrustedIssuersRegistry pointers.
///         For a hackathon both roles are typically held by the same
///         operator, but separating them makes the audit story clean
///         and lets the project hand operations to a KYC provider in
///         a production deployment without ceding admin control.
contract IdentityRegistry is AccessControl, IIdentityRegistry {
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    /// @dev wallet -> Identity contract.
    mapping(address user => IIdentity identity) private _identities;

    /// @dev wallet -> ISO 3166-1 numeric country code.
    mapping(address user => uint16 country) private _countries;

    IClaimTopicsRegistry private _claimTopicsRegistry;
    ITrustedIssuersRegistry private _trustedIssuersRegistry;

    error ZeroAddressUser();
    error ZeroAddressIdentity();
    error IdentityAlreadyRegistered(address user);
    error IdentityNotRegistered(address user);
    error ZeroAddressRegistry();

    constructor(
        address admin,
        IClaimTopicsRegistry claimTopics,
        ITrustedIssuersRegistry trustedIssuers
    ) {
        if (address(claimTopics) == address(0) || address(trustedIssuers) == address(0)) {
            revert ZeroAddressRegistry();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(AGENT_ROLE, admin);

        _claimTopicsRegistry = claimTopics;
        _trustedIssuersRegistry = trustedIssuers;

        emit ClaimTopicsRegistrySet(claimTopics);
        emit TrustedIssuersRegistrySet(trustedIssuers);
    }

    // --- Identity binding ----------------------------------------------

    /// @inheritdoc IIdentityRegistry
    function registerIdentity(address user, IIdentity newIdentity, uint16 country)
        external
        onlyRole(AGENT_ROLE)
    {
        if (user == address(0)) revert ZeroAddressUser();
        if (address(newIdentity) == address(0)) revert ZeroAddressIdentity();
        if (address(_identities[user]) != address(0)) revert IdentityAlreadyRegistered(user);

        _identities[user] = newIdentity;
        _countries[user] = country;

        emit IdentityRegistered(user, newIdentity, country);
    }

    /// @inheritdoc IIdentityRegistry
    function deleteIdentity(address user) external onlyRole(AGENT_ROLE) {
        IIdentity existing = _identities[user];
        if (address(existing) == address(0)) revert IdentityNotRegistered(user);

        delete _identities[user];
        delete _countries[user];

        emit IdentityRemoved(user, existing);
    }

    /// @inheritdoc IIdentityRegistry
    function updateIdentity(address user, IIdentity newIdentity) external onlyRole(AGENT_ROLE) {
        if (address(newIdentity) == address(0)) revert ZeroAddressIdentity();
        IIdentity existing = _identities[user];
        if (address(existing) == address(0)) revert IdentityNotRegistered(user);

        _identities[user] = newIdentity;
        emit IdentityUpdated(user, existing, newIdentity);
    }

    /// @inheritdoc IIdentityRegistry
    function updateCountry(address user, uint16 country) external onlyRole(AGENT_ROLE) {
        if (address(_identities[user]) == address(0)) revert IdentityNotRegistered(user);
        _countries[user] = country;
        emit CountryUpdated(user, country);
    }

    // --- Registries ----------------------------------------------------

    /// @inheritdoc IIdentityRegistry
    function setClaimTopicsRegistry(IClaimTopicsRegistry registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(registry) == address(0)) revert ZeroAddressRegistry();
        _claimTopicsRegistry = registry;
        emit ClaimTopicsRegistrySet(registry);
    }

    /// @inheritdoc IIdentityRegistry
    function setTrustedIssuersRegistry(ITrustedIssuersRegistry registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(registry) == address(0)) revert ZeroAddressRegistry();
        _trustedIssuersRegistry = registry;
        emit TrustedIssuersRegistrySet(registry);
    }

    // --- Reads ---------------------------------------------------------

    /// @inheritdoc IIdentityRegistry
    function identity(address user) external view returns (IIdentity) {
        return _identities[user];
    }

    /// @inheritdoc IIdentityRegistry
    function investorCountry(address user) external view returns (uint16) {
        return _countries[user];
    }

    /// @inheritdoc IIdentityRegistry
    function claimTopicsRegistry() external view returns (IClaimTopicsRegistry) {
        return _claimTopicsRegistry;
    }

    /// @inheritdoc IIdentityRegistry
    function trustedIssuersRegistry() external view returns (ITrustedIssuersRegistry) {
        return _trustedIssuersRegistry;
    }

    /// @inheritdoc IIdentityRegistry
    function isVerified(address user) external view returns (bool) {
        IIdentity userIdentity = _identities[user];
        if (address(userIdentity) == address(0)) return false;

        uint256[] memory required = _claimTopicsRegistry.getClaimTopics();
        ITrustedIssuersRegistry issuers = _trustedIssuersRegistry;

        for (uint256 i = 0; i < required.length; ++i) {
            uint256 topic = required[i];

            bytes32[] memory claimIds = userIdentity.getClaimIdsByTopic(topic);
            bool foundValid = false;

            for (uint256 j = 0; j < claimIds.length; ++j) {
                (
                    uint256 storedTopic,
                    ,
                    address issuer,
                    bytes memory signature,
                    bytes memory data,

                ) = userIdentity.getClaim(claimIds[j]);

                if (storedTopic != topic) continue;
                if (!issuers.hasClaimTopic(issuer, topic)) continue;
                if (!_isValidClaimSignature(address(userIdentity), topic, data, signature, issuer)) continue;

                foundValid = true;
                break;
            }

            if (!foundValid) return false;
        }

        return true;
    }

    /// @notice Verify the EIP-191 signature on a claim. The canonical
    ///         message is keccak256(abi.encode(identity, topic, data)).
    function _isValidClaimSignature(
        address identityAddr,
        uint256 topic,
        bytes memory data,
        bytes memory signature,
        address expectedIssuer
    ) internal pure returns (bool) {
        bytes32 dataHash = keccak256(abi.encode(identityAddr, topic, data));
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(dataHash);

        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(ethSignedHash, signature);
        if (err != ECDSA.RecoverError.NoError) return false;
        return recovered == expectedIssuer;
    }
}
