// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title GroundVaultRegistry
/// @notice Owner-curated registry of housing opportunities the vault
///         is positioned to fund, plus the on-chain anchor for the
///         ChainGPT-generated impact memo associated with each one.
///         The memo itself lives off-chain (IPFS, S3, or a CDN); this
///         contract stores a keccak256 hash of the memo body so that a
///         reader can independently verify the off-chain document
///         hasn't been silently rewritten.
/// @dev    Two roles:
///         - DEFAULT_ADMIN_ROLE: full control over opportunity records.
///         - MEMO_ROLE: can update the memo hash for an opportunity but
///           cannot modify the underlying metadata. Intended for the
///           ChainGPT memo automation account so it never has the
///           authority to change the asset itself, only to refresh its
///           description.
contract GroundVaultRegistry is AccessControl {
    bytes32 public constant MEMO_ROLE = keccak256("MEMO_ROLE");

    enum OpportunityStatus {
        Available,
        UnderContract,
        Sold,
        Withdrawn
    }

    struct Opportunity {
        string addressLine;
        string neighborhood;
        string operatorName;
        uint16 amiTier;        // 60, 80, 100, 120 — percent of Area Median Income
        uint256 listPrice;     // in USD cents to keep on-chain math integer
        OpportunityStatus status;
        bytes32 memoHash;      // keccak256 of the off-chain ChainGPT memo
        string memoUri;        // ipfs:// or https:// pointer to the memo
        uint64 createdAt;
        uint64 updatedAt;
    }

    mapping(uint256 id => Opportunity opportunity) private _opportunities;
    uint256 private _nextId = 1;

    event OpportunityAdded(uint256 indexed id, string addressLine, uint16 amiTier);
    event OpportunityUpdated(uint256 indexed id);
    event OpportunityStatusChanged(uint256 indexed id, OpportunityStatus indexed status);
    event MemoUpdated(uint256 indexed id, bytes32 memoHash, string memoUri);

    error OpportunityNotFound(uint256 id);
    error EmptyAddressLine();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MEMO_ROLE, admin);
    }

    /// @notice Add a new opportunity. Returns the assigned id.
    function addOpportunity(
        string calldata addressLine,
        string calldata neighborhood,
        string calldata operatorName,
        uint16 amiTier,
        uint256 listPrice,
        OpportunityStatus initialStatus,
        bytes32 memoHash,
        string calldata memoUri
    ) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256 id) {
        if (bytes(addressLine).length == 0) revert EmptyAddressLine();

        id = _nextId++;
        uint64 nowTs = uint64(block.timestamp);

        _opportunities[id] = Opportunity({
            addressLine: addressLine,
            neighborhood: neighborhood,
            operatorName: operatorName,
            amiTier: amiTier,
            listPrice: listPrice,
            status: initialStatus,
            memoHash: memoHash,
            memoUri: memoUri,
            createdAt: nowTs,
            updatedAt: nowTs
        });

        emit OpportunityAdded(id, addressLine, amiTier);
    }

    /// @notice Replace mutable fields of an existing opportunity.
    ///         Address line and createdAt are immutable.
    function updateOpportunity(
        uint256 id,
        string calldata neighborhood,
        string calldata operatorName,
        uint16 amiTier,
        uint256 listPrice
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Opportunity storage op = _requireOpportunity(id);
        op.neighborhood = neighborhood;
        op.operatorName = operatorName;
        op.amiTier = amiTier;
        op.listPrice = listPrice;
        op.updatedAt = uint64(block.timestamp);

        emit OpportunityUpdated(id);
    }

    /// @notice Update only the status field. Splits authority from
    ///         {updateOpportunity} so settlement automation can mark a
    ///         property "Under Contract" without holding edit rights on
    ///         the rest of the record.
    function setStatus(uint256 id, OpportunityStatus newStatus) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Opportunity storage op = _requireOpportunity(id);
        op.status = newStatus;
        op.updatedAt = uint64(block.timestamp);
        emit OpportunityStatusChanged(id, newStatus);
    }

    /// @notice Update the memo hash and memo URI. MEMO_ROLE only.
    ///         Allows the ChainGPT memo automation account to refresh
    ///         the impact memo without holding any authority over the
    ///         underlying asset record.
    function setMemo(uint256 id, bytes32 memoHash, string calldata memoUri)
        external
        onlyRole(MEMO_ROLE)
    {
        Opportunity storage op = _requireOpportunity(id);
        op.memoHash = memoHash;
        op.memoUri = memoUri;
        op.updatedAt = uint64(block.timestamp);

        emit MemoUpdated(id, memoHash, memoUri);
    }

    function getOpportunity(uint256 id) external view returns (Opportunity memory) {
        return _requireOpportunity(id);
    }

    function exists(uint256 id) external view returns (bool) {
        return _opportunities[id].createdAt != 0;
    }

    function nextId() external view returns (uint256) {
        return _nextId;
    }

    function _requireOpportunity(uint256 id) private view returns (Opportunity storage op) {
        op = _opportunities[id];
        if (op.createdAt == 0) revert OpportunityNotFound(id);
    }
}
