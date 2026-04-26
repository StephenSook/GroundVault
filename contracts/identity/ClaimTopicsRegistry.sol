// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {IClaimTopicsRegistry} from "./interfaces/IClaimTopicsRegistry.sol";

/// @title ClaimTopicsRegistry
/// @notice ERC-3643 required-claim-topics registry curated by the token
///         issuer. The IdentityRegistry consults this registry whenever
///         a wallet is checked for verification, and rejects the wallet
///         unless the wallet's Identity carries at least one valid claim
///         per topic listed here.
/// @dev    Storage layout uses a swap-and-pop array with an O(1) index
///         lookup so additions and removals are gas-bounded regardless
///         of how many topics are required.
contract ClaimTopicsRegistry is Ownable2Step, IClaimTopicsRegistry {
    /// @dev Required-topic ids in registration order.
    uint256[] private _claimTopics;

    /// @dev `_claimTopicsIndex[topic]` is `index + 1` so that the value
    ///      `0` doubles as the "topic not present" sentinel.
    mapping(uint256 topic => uint256 indexPlusOne) private _claimTopicsIndex;

    error ClaimTopicAlreadyExists(uint256 topic);
    error ClaimTopicNotFound(uint256 topic);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @inheritdoc IClaimTopicsRegistry
    function addClaimTopic(uint256 topic) external onlyOwner {
        if (_claimTopicsIndex[topic] != 0) revert ClaimTopicAlreadyExists(topic);
        _claimTopics.push(topic);
        _claimTopicsIndex[topic] = _claimTopics.length;
        emit ClaimTopicAdded(topic);
    }

    /// @inheritdoc IClaimTopicsRegistry
    function removeClaimTopic(uint256 topic) external onlyOwner {
        uint256 indexPlusOne = _claimTopicsIndex[topic];
        if (indexPlusOne == 0) revert ClaimTopicNotFound(topic);

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = _claimTopics.length - 1;

        if (index != lastIndex) {
            uint256 lastTopic = _claimTopics[lastIndex];
            _claimTopics[index] = lastTopic;
            _claimTopicsIndex[lastTopic] = indexPlusOne;
        }

        _claimTopics.pop();
        delete _claimTopicsIndex[topic];
        emit ClaimTopicRemoved(topic);
    }

    /// @inheritdoc IClaimTopicsRegistry
    function getClaimTopics() external view returns (uint256[] memory) {
        return _claimTopics;
    }
}
