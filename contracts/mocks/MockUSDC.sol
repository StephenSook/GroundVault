// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice Plain ERC-20 stand-in for USD Coin used as the deposit
///         underlying in the GroundVault hackathon submission. The
///         owner can mint freely so testnet users (judges, the demo
///         video, integration tests) can fund themselves without
///         juggling another faucet.
/// @dev    Six decimals matches real USDC. Lives under contracts/mocks
///         so the scope is unambiguous on a code review — this is
///         testnet-only and not part of the production GroundVault
///         surface.
contract MockUSDC is ERC20, Ownable {
    constructor(address initialOwner) ERC20("Mock USDC", "mUSDC") Ownable(initialOwner) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint `amount` mUSDC to `to`. Owner-only. Used by the
    ///         deploy script and tests to fund demo accounts.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
