// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {ITrustedIssuersRegistry} from "./interfaces/ITrustedIssuersRegistry.sol";

/// @title TrustedIssuersRegistry
/// @notice ERC-3643 registry of which issuer addresses are allowed to
///         attest each claim topic. Maintains a forward index
///         (issuer -> topics) and a reverse index (topic -> issuers) so
///         IdentityRegistry.isVerified can enumerate candidate signers
///         for a topic in O(issuers_for_topic) without scanning the
///         full set of registered issuers.
/// @dev    All array writes use swap-and-pop with an "index + 1" lookup
///         so adds and removes stay O(1) per element regardless of how
///         many issuers are registered.
contract TrustedIssuersRegistry is Ownable2Step, ITrustedIssuersRegistry {
    /// @dev Topics each issuer is trusted for, in registration order.
    mapping(address issuer => uint256[] topics) private _issuerTopics;

    /// @dev Issuers trusted for each topic, in registration order.
    mapping(uint256 topic => address[] issuers) private _topicIssuers;

    /// @dev `_topicIssuerIndex[topic][issuer]` is `index + 1` in the
    ///      `_topicIssuers[topic]` array, or 0 if not present.
    mapping(uint256 topic => mapping(address issuer => uint256 indexPlusOne)) private _topicIssuerIndex;

    /// @dev True if the issuer is registered (any topic count).
    mapping(address issuer => bool registered) private _isRegistered;

    error IssuerAlreadyRegistered(address issuer);
    error IssuerNotRegistered(address issuer);
    error EmptyClaimTopics();
    error ZeroAddressIssuer();

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @inheritdoc ITrustedIssuersRegistry
    function addTrustedIssuer(address issuer, uint256[] calldata claimTopics) external onlyOwner {
        if (issuer == address(0)) revert ZeroAddressIssuer();
        if (_isRegistered[issuer]) revert IssuerAlreadyRegistered(issuer);
        if (claimTopics.length == 0) revert EmptyClaimTopics();

        _isRegistered[issuer] = true;
        for (uint256 i = 0; i < claimTopics.length; ++i) {
            uint256 topic = claimTopics[i];
            _issuerTopics[issuer].push(topic);
            _topicIssuers[topic].push(issuer);
            _topicIssuerIndex[topic][issuer] = _topicIssuers[topic].length;
        }

        emit TrustedIssuerAdded(issuer, claimTopics);
    }

    /// @inheritdoc ITrustedIssuersRegistry
    function removeTrustedIssuer(address issuer) external onlyOwner {
        if (!_isRegistered[issuer]) revert IssuerNotRegistered(issuer);

        uint256[] memory topics = _issuerTopics[issuer];
        for (uint256 i = 0; i < topics.length; ++i) {
            _removeIssuerFromTopic(topics[i], issuer);
        }

        delete _issuerTopics[issuer];
        _isRegistered[issuer] = false;

        emit TrustedIssuerRemoved(issuer);
    }

    /// @inheritdoc ITrustedIssuersRegistry
    function updateIssuerClaimTopics(address issuer, uint256[] calldata claimTopics) external onlyOwner {
        if (!_isRegistered[issuer]) revert IssuerNotRegistered(issuer);
        if (claimTopics.length == 0) revert EmptyClaimTopics();

        uint256[] memory previous = _issuerTopics[issuer];
        for (uint256 i = 0; i < previous.length; ++i) {
            _removeIssuerFromTopic(previous[i], issuer);
        }
        delete _issuerTopics[issuer];

        for (uint256 i = 0; i < claimTopics.length; ++i) {
            uint256 topic = claimTopics[i];
            _issuerTopics[issuer].push(topic);
            _topicIssuers[topic].push(issuer);
            _topicIssuerIndex[topic][issuer] = _topicIssuers[topic].length;
        }

        emit ClaimTopicsUpdated(issuer, claimTopics);
    }

    /// @inheritdoc ITrustedIssuersRegistry
    function isTrustedIssuer(address issuer) external view returns (bool) {
        return _isRegistered[issuer];
    }

    /// @inheritdoc ITrustedIssuersRegistry
    function hasClaimTopic(address issuer, uint256 topic) external view returns (bool) {
        return _topicIssuerIndex[topic][issuer] != 0;
    }

    /// @inheritdoc ITrustedIssuersRegistry
    function getTrustedIssuerClaimTopics(address issuer) external view returns (uint256[] memory) {
        return _issuerTopics[issuer];
    }

    /// @inheritdoc ITrustedIssuersRegistry
    function getTrustedIssuersForClaimTopic(uint256 topic) external view returns (address[] memory) {
        return _topicIssuers[topic];
    }

    function _removeIssuerFromTopic(uint256 topic, address issuer) private {
        uint256 indexPlusOne = _topicIssuerIndex[topic][issuer];
        if (indexPlusOne == 0) return;

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = _topicIssuers[topic].length - 1;

        if (index != lastIndex) {
            address lastIssuer = _topicIssuers[topic][lastIndex];
            _topicIssuers[topic][index] = lastIssuer;
            _topicIssuerIndex[topic][lastIssuer] = indexPlusOne;
        }

        _topicIssuers[topic].pop();
        delete _topicIssuerIndex[topic][issuer];
    }
}
