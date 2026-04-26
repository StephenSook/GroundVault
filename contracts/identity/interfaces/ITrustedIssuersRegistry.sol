// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title ITrustedIssuersRegistry
/// @notice ERC-3643 registry of which issuer addresses are allowed to
///         attest each claim topic. Used by IdentityRegistry.isVerified
///         to validate that a stored claim was signed by an authority
///         the token issuer trusts for that topic.
interface ITrustedIssuersRegistry {
    event TrustedIssuerAdded(address indexed issuer, uint256[] claimTopics);
    event TrustedIssuerRemoved(address indexed issuer);
    event ClaimTopicsUpdated(address indexed issuer, uint256[] claimTopics);

    /// @notice Register `issuer` as trusted for the given `claimTopics`.
    ///         Reverts if the issuer is already registered. Owner-only.
    function addTrustedIssuer(address issuer, uint256[] calldata claimTopics) external;

    /// @notice Deregister `issuer`. Owner-only.
    function removeTrustedIssuer(address issuer) external;

    /// @notice Replace the topic list for an already-registered issuer.
    ///         Owner-only.
    function updateIssuerClaimTopics(address issuer, uint256[] calldata claimTopics) external;

    /// @notice True if `issuer` is registered.
    function isTrustedIssuer(address issuer) external view returns (bool);

    /// @notice True if `issuer` is registered AND trusted for `topic`.
    function hasClaimTopic(address issuer, uint256 topic) external view returns (bool);

    /// @notice All topics `issuer` is trusted for.
    function getTrustedIssuerClaimTopics(address issuer) external view returns (uint256[] memory);

    /// @notice All issuers trusted for `topic`. Used by IdentityRegistry
    ///         to enumerate candidate signers when validating a claim.
    function getTrustedIssuersForClaimTopic(uint256 topic)
        external
        view
        returns (address[] memory);
}
