// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

import {IIdentityRegistry} from "../identity/interfaces/IIdentityRegistry.sol";
import {IModularCompliance} from "../compliance/interfaces/IModularCompliance.sol";

import {IERC7984} from "./interfaces/IERC7984.sol";

/// @title GroundVaultToken
/// @notice Confidential vault-share token issued by GroundVaultCore.
///         Stacks two compliance layers on top of ERC-7984 encrypted
///         balances:
///         1. ERC-3643 identity gate via {IIdentityRegistry.isVerified}
///            so only investors holding all required claims (KYC,
///            accreditation, jurisdiction) can hold shares.
///         2. ERC-3643 modular compliance via
///            {IModularCompliance.canTransfer} so the token issuer can
///            attach jurisdiction modules, max-balance modules, and
///            other policy enforcement at runtime.
///
///         Mint and burn are gated on `VAULT_ROLE`. The intent is that
///         the GroundVaultCore async-deposit-queue contract holds that
///         role and is the only address that can issue or redeem
///         shares on behalf of investors.
/// @dev    Hackathon scope: same simplifications as cUSDC apply —
///         single-step transfer only (no confidentialApprove /
///         allowance / transferFrom), and the modular-compliance
///         {canTransfer} call always passes amount = 0 because the
///         token holds encrypted balances. Address-based modules
///         (jurisdiction, KYC) work; amount-based modules need TEE
///         compute (Phase 2.6 stretch).
contract GroundVaultToken is AccessControl, Pausable, ReentrancyGuard, IERC7984 {
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");

    string private constant _NAME = "GroundVault Share";
    string private constant _SYMBOL = "gvSHARE";

    IIdentityRegistry private _identityRegistry;
    IModularCompliance private _compliance;

    mapping(address account => euint256 balance) private _balances;
    euint256 private _totalSupply;

    event IdentityRegistrySet(IIdentityRegistry indexed registry);
    event ComplianceSet(IModularCompliance indexed compliance);
    event ConfidentialMint(address indexed to, bytes32 amountHandle);
    event ConfidentialBurn(address indexed from, bytes32 amountHandle);

    error ZeroAddressIdentityRegistry();
    error ZeroAddressCompliance();
    error TransferToZero();
    error TransferToSelf();
    error MintToZero();
    error BurnFromZero();
    error SenderNotVerified(address sender);
    error RecipientNotVerified(address recipient);
    error ComplianceRejectedTransfer();

    constructor(
        address admin,
        IIdentityRegistry identityRegistry_,
        IModularCompliance compliance_
    ) {
        if (address(identityRegistry_) == address(0)) revert ZeroAddressIdentityRegistry();
        if (address(compliance_) == address(0)) revert ZeroAddressCompliance();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _identityRegistry = identityRegistry_;
        _compliance = compliance_;

        emit IdentityRegistrySet(identityRegistry_);
        emit ComplianceSet(compliance_);
    }

    // --- Metadata (plain) ---------------------------------------------

    function name() external pure returns (string memory) {
        return _NAME;
    }

    function symbol() external pure returns (string memory) {
        return _SYMBOL;
    }

    function decimals() external pure returns (uint8) {
        return 18;
    }

    // --- Admin: registry pointers + pause ------------------------------

    function setIdentityRegistry(IIdentityRegistry registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(registry) == address(0)) revert ZeroAddressIdentityRegistry();
        _identityRegistry = registry;
        emit IdentityRegistrySet(registry);
    }

    function setCompliance(IModularCompliance compliance_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(compliance_) == address(0)) revert ZeroAddressCompliance();
        _compliance = compliance_;
        emit ComplianceSet(compliance_);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function identityRegistry() external view returns (IIdentityRegistry) {
        return _identityRegistry;
    }

    function compliance() external view returns (IModularCompliance) {
        return _compliance;
    }

    // --- Vault-only mint and burn -------------------------------------

    /// @notice Mint encrypted shares to `to` from a user-signed external
    ///         input handle. Caller must hold {VAULT_ROLE}. Use this
    ///         path when the vault is forwarding an investor-signed
    ///         deposit (e.g. recordDeposit -> claim flow where the
    ///         investor's proof is fresh).
    function confidentialMint(
        address to,
        externalEuint256 inputHandle,
        bytes calldata inputProof
    ) external whenNotPaused nonReentrant onlyRole(VAULT_ROLE) returns (bytes32) {
        if (to == address(0)) revert MintToZero();
        if (!_identityRegistry.isVerified(to)) revert RecipientNotVerified(to);
        if (!_compliance.canTransfer(address(0), to, 0)) revert ComplianceRejectedTransfer();

        euint256 amount = Nox.fromExternal(inputHandle, inputProof);
        return _mint(to, amount);
    }

    /// @notice Mint encrypted shares to `to` from a contract-internal
    ///         handle. Caller must hold {VAULT_ROLE}. Use this path
    ///         when the vault has assembled the amount handle internally
    ///         (e.g. via Nox.add over previously-claimable state) and
    ///         no fresh investor proof is available. The handle MUST
    ///         already be allowed for this contract's address.
    function confidentialMintInternal(address to, euint256 amount)
        external
        whenNotPaused
        nonReentrant
        onlyRole(VAULT_ROLE)
        returns (bytes32)
    {
        if (to == address(0)) revert MintToZero();
        if (!_identityRegistry.isVerified(to)) revert RecipientNotVerified(to);
        if (!_compliance.canTransfer(address(0), to, 0)) revert ComplianceRejectedTransfer();

        return _mint(to, amount);
    }

    /// @notice Burn encrypted shares from `from` using a user-signed
    ///         external input handle. Caller must hold {VAULT_ROLE}.
    function confidentialBurn(
        address from,
        externalEuint256 inputHandle,
        bytes calldata inputProof
    ) external whenNotPaused nonReentrant onlyRole(VAULT_ROLE) returns (bytes32) {
        if (from == address(0)) revert BurnFromZero();
        if (!_identityRegistry.isVerified(from)) revert SenderNotVerified(from);

        euint256 amount = Nox.fromExternal(inputHandle, inputProof);
        return _burn(from, amount);
    }

    /// @notice Burn encrypted shares from `from` using a contract-
    ///         internal handle. Caller must hold {VAULT_ROLE}.
    function confidentialBurnInternal(address from, euint256 amount)
        external
        whenNotPaused
        nonReentrant
        onlyRole(VAULT_ROLE)
        returns (bytes32)
    {
        if (from == address(0)) revert BurnFromZero();
        if (!_identityRegistry.isVerified(from)) revert SenderNotVerified(from);

        return _burn(from, amount);
    }

    function _mint(address to, euint256 amount) private returns (bytes32) {
        euint256 toBalance = _balances[to];

        (, euint256 newBalance, euint256 newTotalSupply) = Nox.mint(toBalance, amount, _totalSupply);

        _balances[to] = newBalance;
        _totalSupply = newTotalSupply;

        Nox.allowThis(newBalance);
        Nox.allow(newBalance, to);
        Nox.allowThis(newTotalSupply);

        bytes32 amountHandle = euint256.unwrap(amount);
        _compliance.created(to, 0);
        emit ConfidentialMint(to, amountHandle);
        return amountHandle;
    }

    function _burn(address from, euint256 amount) private returns (bytes32) {
        euint256 fromBalance = _balances[from];

        (, euint256 newBalance, euint256 newTotalSupply) = Nox.burn(fromBalance, amount, _totalSupply);

        _balances[from] = newBalance;
        _totalSupply = newTotalSupply;

        Nox.allowThis(newBalance);
        Nox.allow(newBalance, from);
        Nox.allowThis(newTotalSupply);

        bytes32 amountHandle = euint256.unwrap(amount);
        _compliance.destroyed(from, 0);
        emit ConfidentialBurn(from, amountHandle);
        return amountHandle;
    }

    // --- ERC-7984 reads -----------------------------------------------

    /// @inheritdoc IERC7984
    function confidentialBalanceOf(address account) external view returns (bytes32) {
        return euint256.unwrap(_balances[account]);
    }

    /// @inheritdoc IERC7984
    function confidentialTotalSupply() external view returns (bytes32) {
        return euint256.unwrap(_totalSupply);
    }

    // --- Confidential transfer with ERC-3643 gate ---------------------

    /// @inheritdoc IERC7984
    function confidentialTransfer(
        address to,
        externalEuint256 inputHandle,
        bytes calldata inputProof
    ) external whenNotPaused nonReentrant returns (bytes32) {
        if (to == address(0)) revert TransferToZero();
        if (to == msg.sender) revert TransferToSelf();
        if (!_identityRegistry.isVerified(msg.sender)) revert SenderNotVerified(msg.sender);
        if (!_identityRegistry.isVerified(to)) revert RecipientNotVerified(to);
        if (!_compliance.canTransfer(msg.sender, to, 0)) revert ComplianceRejectedTransfer();

        euint256 amount = Nox.fromExternal(inputHandle, inputProof);
        euint256 fromBalance = _balances[msg.sender];
        euint256 toBalance = _balances[to];

        (, euint256 newFrom, euint256 newTo) = Nox.transfer(fromBalance, toBalance, amount);

        _balances[msg.sender] = newFrom;
        _balances[to] = newTo;

        Nox.allowThis(newFrom);
        Nox.allow(newFrom, msg.sender);
        Nox.allowThis(newTo);
        Nox.allow(newTo, to);

        bytes32 amountHandle = euint256.unwrap(amount);
        _compliance.transferred(msg.sender, to, 0);
        emit ConfidentialTransfer(msg.sender, to, amountHandle);
        return amountHandle;
    }
}
