// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title IClaimTopicsRegistry
/// @notice ERC-3643 registry of claim topics that every investor identity
///         must satisfy to be verified by an IdentityRegistry. The token
///         issuer (here, GroundVault) curates this list.
/// @dev    Topics use the convention: 1 = KYC, 2 = AML, 7 = Reg D 506(c)
///         accreditation, 9 = US-resident. Topic numbers are arbitrary
///         uint256s — this registry only enforces presence, not meaning.
interface IClaimTopicsRegistry {
    event ClaimTopicAdded(uint256 indexed topic);
    event ClaimTopicRemoved(uint256 indexed topic);

    /// @notice Append `topic` to the required-topics list. Reverts if the
    ///         topic is already present. Owner-only.
    function addClaimTopic(uint256 topic) external;

    /// @notice Remove `topic` from the required-topics list. Reverts if
    ///         the topic is not present. Owner-only.
    function removeClaimTopic(uint256 topic) external;

    /// @notice Read the entire required-topics list.
    function getClaimTopics() external view returns (uint256[] memory);
}
