// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title Counter
/// @notice Pipeline smoke-test contract used to validate the Hardhat
///         scaffold (Solidity 0.8.27 + viaIR + cancun), the Arbitrum
///         Sepolia deploy path, and the Etherscan V2 verify flow before
///         the real GroundVault contracts land in Phase 2. Not used by
///         GroundVault itself.
contract Counter {
    uint256 public count;

    event Incremented(uint256 newCount);

    function increment() external {
        unchecked {
            count += 1;
        }
        emit Incremented(count);
    }
}
