// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title IIdentity (simplified ONCHAINID)
/// @notice Stores claims attesting facts about the address that owns this
///         Identity contract. Verifiable on-chain by any compliance gate
///         (e.g. {IIdentityRegistry.isVerified}). For the GroundVault
///         hackathon submission this is intentionally simpler than the
///         full ERC-734/735 ONCHAINID stack: single-owner key model,
///         no multi-purpose keys, no claim signer separation. Claim
///         signature verification is delegated to the IdentityRegistry.
/// @dev    Required ERC-3643 interface surface only.
interface IIdentity {
    /// @notice Stored claim attestation.
    /// @param topic     ERC-3643 claim topic (e.g. 1=KYC, 7=accreditation).
    /// @param scheme    Signature scheme identifier (1 = ECDSA over EIP-191).
    /// @param issuer    Address that signed the claim. Must be a trusted
    ///                  issuer for `topic` per the TrustedIssuersRegistry.
    /// @param signature Issuer signature over (identity, topic, data).
    /// @param data      Arbitrary claim payload (e.g. KYC reference id).
    /// @param uri       Off-chain reference URI (optional).
    struct Claim {
        uint256 topic;
        uint256 scheme;
        address issuer;
        bytes signature;
        bytes data;
        string uri;
    }

    event ClaimAdded(
        bytes32 indexed claimId,
        uint256 indexed topic,
        address indexed issuer,
        bytes signature,
        bytes data,
        string uri
    );

    event ClaimRemoved(bytes32 indexed claimId, uint256 indexed topic, address indexed issuer);

    /// @notice Add or replace a claim. Only the identity owner may call.
    ///         Emits {ClaimAdded}. Returns the deterministic claim id
    ///         keccak256(abi.encode(issuer, topic)).
    function addClaim(
        uint256 topic,
        uint256 scheme,
        address issuer,
        bytes calldata signature,
        bytes calldata data,
        string calldata uri
    ) external returns (bytes32 claimId);

    /// @notice Remove an existing claim by id. Only the identity owner.
    ///         Emits {ClaimRemoved}.
    function removeClaim(bytes32 claimId) external returns (bool);

    /// @notice Read a single claim by id.
    function getClaim(bytes32 claimId)
        external
        view
        returns (
            uint256 topic,
            uint256 scheme,
            address issuer,
            bytes memory signature,
            bytes memory data,
            string memory uri
        );

    /// @notice List all claim ids stored against `topic`.
    function getClaimIdsByTopic(uint256 topic) external view returns (bytes32[] memory);

    /// @notice Address that controls this identity.
    function owner() external view returns (address);
}
