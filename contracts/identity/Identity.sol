// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {IIdentity} from "./interfaces/IIdentity.sol";

/// @title Identity (simplified ONCHAINID)
/// @notice Per-investor claim store. The wallet that owns this contract
///         decides which claims to attach to itself. Whether a claim is
///         actually trusted is determined at read time by IdentityRegistry,
///         which checks the issuer against the TrustedIssuersRegistry and
///         validates the EIP-191 signature.
/// @dev    Hackathon scope: single-owner key model. ERC-734 multi-purpose
///         keys are deliberately omitted (documented in IIdentity NatSpec
///         and feedback.md). claimId is the deterministic keccak256 of
///         (issuer, topic), so each (issuer, topic) pair has exactly one
///         slot per Identity — re-adding overwrites.
contract Identity is Ownable2Step, IIdentity {
    /// @dev claimId -> stored claim payload.
    mapping(bytes32 claimId => Claim claim) private _claims;

    /// @dev topic -> list of claimIds carrying that topic.
    mapping(uint256 topic => bytes32[] claimIds) private _claimsByTopic;

    /// @dev topic -> claimId -> "index + 1" in `_claimsByTopic[topic]`.
    ///      Zero indicates "not present".
    mapping(uint256 topic => mapping(bytes32 claimId => uint256 indexPlusOne)) private _claimsByTopicIndex;

    error ZeroAddressIssuer();
    error ClaimNotFound(bytes32 claimId);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @inheritdoc IIdentity
    function addClaim(
        uint256 topic,
        uint256 scheme,
        address issuer,
        bytes calldata signature,
        bytes calldata data,
        string calldata uri
    ) external onlyOwner returns (bytes32 claimId) {
        if (issuer == address(0)) revert ZeroAddressIssuer();

        claimId = keccak256(abi.encode(issuer, topic));

        bool isReplacement = _claims[claimId].issuer != address(0);

        _claims[claimId] = Claim({
            topic: topic,
            scheme: scheme,
            issuer: issuer,
            signature: signature,
            data: data,
            uri: uri
        });

        if (!isReplacement) {
            _claimsByTopic[topic].push(claimId);
            _claimsByTopicIndex[topic][claimId] = _claimsByTopic[topic].length;
        }

        emit ClaimAdded(claimId, topic, issuer, signature, data, uri);
    }

    /// @inheritdoc IIdentity
    function removeClaim(bytes32 claimId) external onlyOwner returns (bool) {
        Claim storage claim = _claims[claimId];
        if (claim.issuer == address(0)) revert ClaimNotFound(claimId);

        uint256 topic = claim.topic;
        address issuer = claim.issuer;

        uint256 indexPlusOne = _claimsByTopicIndex[topic][claimId];
        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = _claimsByTopic[topic].length - 1;

        if (index != lastIndex) {
            bytes32 lastId = _claimsByTopic[topic][lastIndex];
            _claimsByTopic[topic][index] = lastId;
            _claimsByTopicIndex[topic][lastId] = indexPlusOne;
        }

        _claimsByTopic[topic].pop();
        delete _claimsByTopicIndex[topic][claimId];
        delete _claims[claimId];

        emit ClaimRemoved(claimId, topic, issuer);
        return true;
    }

    /// @inheritdoc IIdentity
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
        )
    {
        Claim storage claim = _claims[claimId];
        return (claim.topic, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri);
    }

    /// @inheritdoc IIdentity
    function getClaimIdsByTopic(uint256 topic) external view returns (bytes32[] memory) {
        return _claimsByTopic[topic];
    }

    /// @inheritdoc IIdentity
    /// @dev Aliases `Ownable.owner()` so the IIdentity surface is fully
    ///      satisfied even though the inherited function lives upstream.
    function owner() public view virtual override(Ownable, IIdentity) returns (address) {
        return Ownable.owner();
    }
}
