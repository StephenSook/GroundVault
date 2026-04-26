// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IIdentity} from "./IIdentity.sol";
import {IClaimTopicsRegistry} from "./IClaimTopicsRegistry.sol";
import {ITrustedIssuersRegistry} from "./ITrustedIssuersRegistry.sol";

/// @title IIdentityRegistry
/// @notice Maps wallet addresses to their {IIdentity} contracts and
///         exposes the canonical {isVerified} gate that GroundVaultToken
///         consults inside its transfer hook. This is the heart of the
///         ERC-3643 compliance model.
/// @dev    For the GroundVault hackathon submission, IdentityRegistry
///         folds the T-REX 4.0 IdentityRegistryStorage layer into itself.
///         A single contract owns the wallet→identity mapping. This is
///         documented in the implementation NatSpec and the feedback.md
///         file.
interface IIdentityRegistry {
    event IdentityRegistered(address indexed user, IIdentity indexed identity, uint16 indexed country);
    event IdentityRemoved(address indexed user, IIdentity indexed identity);
    event IdentityUpdated(address indexed user, IIdentity indexed oldIdentity, IIdentity indexed newIdentity);
    event CountryUpdated(address indexed user, uint16 indexed country);
    event ClaimTopicsRegistrySet(IClaimTopicsRegistry indexed registry);
    event TrustedIssuersRegistrySet(ITrustedIssuersRegistry indexed registry);

    // --- Identity binding ----------------------------------------------

    /// @notice Bind `user` to `identity` with ISO 3166-1 numeric `country`.
    ///         Agent-only.
    function registerIdentity(address user, IIdentity identity, uint16 country) external;

    /// @notice Remove the identity record for `user`. Agent-only.
    function deleteIdentity(address user) external;

    /// @notice Replace the identity contract bound to `user`. Agent-only.
    function updateIdentity(address user, IIdentity identity) external;

    /// @notice Replace the country code stored for `user`. Agent-only.
    function updateCountry(address user, uint16 country) external;

    // --- Registries ----------------------------------------------------

    /// @notice Set the ClaimTopicsRegistry consulted by {isVerified}.
    function setClaimTopicsRegistry(IClaimTopicsRegistry registry) external;

    /// @notice Set the TrustedIssuersRegistry consulted by {isVerified}.
    function setTrustedIssuersRegistry(ITrustedIssuersRegistry registry) external;

    // --- Reads ---------------------------------------------------------

    /// @notice Identity bound to `user`, or the zero address if none.
    function identity(address user) external view returns (IIdentity);

    /// @notice ISO 3166-1 numeric country for `user`.
    function investorCountry(address user) external view returns (uint16);

    function claimTopicsRegistry() external view returns (IClaimTopicsRegistry);

    function trustedIssuersRegistry() external view returns (ITrustedIssuersRegistry);

    /// @notice True if `user` has a registered identity AND that identity
    ///         carries at least one valid claim per required topic, where
    ///         "valid" means: signed by a trusted issuer for that topic
    ///         using EIP-191 personal_sign over
    ///         keccak256(abi.encode(identity, topic, data)) (the
    ///         implementation calls toEthSignedMessageHash on that inner
    ///         hash before recovery).
    function isVerified(address user) external view returns (bool);
}
