// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

import {IERC7984} from "./interfaces/IERC7984.sol";

/// @title cUSDC
/// @notice Confidential ERC-7984 wrap of {MockUSDC}. Investors call
///         {wrap} to deposit plain mUSDC and receive an encrypted cUSDC
///         balance. From that point on, balances and transfer amounts
///         are encrypted handles — public observers see only that a
///         transfer occurred, never the amount.
/// @dev    Hackathon scope:
///         - Wrap is plain in: the wrap amount is on-chain. This matches
///           the cToken / aToken pattern. Confidentiality applies AFTER
///           wrap, never to the wrap event itself.
///         - Unwrap is intentionally NOT implemented. Releasing plain
///           mUSDC from an encrypted balance requires either a TEE
///           oracle decrypt-and-finalize pattern or full async request
///           lifecycle (the cDeFi Wizard "request -> oracle decrypt ->
///           finalize" flow). That is the Phase 2.6 stretch goal of the
///           GroundVault submission. The demo flow is wrap -> deposit
///           into vault -> claim shares; no unwrap is needed.
///         - The standard ERC-7984 confidentialApprove + allowance +
///           transferFrom triplet is also omitted for the same reason:
///           the demo path is single-step transfer only.
contract cUSDC is IERC7984, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 private immutable _underlying;

    /// @dev account -> encrypted balance handle.
    mapping(address account => euint256 balance) private _balances;

    /// @dev encrypted total wrapped supply.
    euint256 private _totalSupply;

    event Wrapped(address indexed user, uint256 amount);

    error ZeroAmount();
    error ZeroAddressUnderlying();
    error TransferToSelf();
    error TransferToZero();

    constructor(IERC20 underlyingToken) {
        if (address(underlyingToken) == address(0)) revert ZeroAddressUnderlying();
        _underlying = underlyingToken;
    }

    /// @notice The plain ERC-20 token wrapped by this cUSDC contract.
    function underlying() external view returns (IERC20) {
        return _underlying;
    }

    /// @notice Pull `amount` mUSDC from the caller, mint the same amount
    ///         into the caller's encrypted cUSDC balance, and increment
    ///         encrypted total supply. The wrap amount is plain on-chain
    ///         by design — confidentiality begins on the next confidential
    ///         transfer.
    function wrap(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        _underlying.safeTransferFrom(msg.sender, address(this), amount);

        euint256 encryptedAmount = Nox.toEuint256(amount);
        euint256 currentBalance = _balances[msg.sender];

        (, euint256 newBalance, euint256 newTotalSupply) = Nox.mint(
            currentBalance,
            encryptedAmount,
            _totalSupply
        );

        _balances[msg.sender] = newBalance;
        _totalSupply = newTotalSupply;

        Nox.allowThis(newBalance);
        Nox.allow(newBalance, msg.sender);
        Nox.allowThis(newTotalSupply);

        emit Wrapped(msg.sender, amount);
    }

    /// @inheritdoc IERC7984
    function confidentialBalanceOf(address account) external view returns (bytes32) {
        return euint256.unwrap(_balances[account]);
    }

    /// @inheritdoc IERC7984
    function confidentialTotalSupply() external view returns (bytes32) {
        return euint256.unwrap(_totalSupply);
    }

    /// @inheritdoc IERC7984
    function confidentialTransfer(
        address to,
        externalEuint256 inputHandle,
        bytes calldata inputProof
    ) external nonReentrant returns (bytes32) {
        if (to == address(0)) revert TransferToZero();
        if (to == msg.sender) revert TransferToSelf();

        euint256 amount = Nox.fromExternal(inputHandle, inputProof);
        euint256 fromBalance = _balances[msg.sender];
        euint256 toBalance = _balances[to];

        (, euint256 newFromBalance, euint256 newToBalance) = Nox.transfer(
            fromBalance,
            toBalance,
            amount
        );

        _balances[msg.sender] = newFromBalance;
        _balances[to] = newToBalance;

        Nox.allowThis(newFromBalance);
        Nox.allow(newFromBalance, msg.sender);
        Nox.allowThis(newToBalance);
        Nox.allow(newToBalance, to);

        bytes32 amountHandle = euint256.unwrap(amount);
        emit ConfidentialTransfer(msg.sender, to, amountHandle);
        return amountHandle;
    }
}
