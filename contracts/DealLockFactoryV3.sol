// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import "./DealLockMultiAssetV2Deployer.sol";

/**
 * @title DealLockFactoryV3
 * @notice Multi-asset factory for DealLock escrow agreements.
 *         Deploys DealLockMultiAssetV2 instances (contractVersion 6) through a
 *         stateless deployer helper, with the caller
 *         as the on-chain client. Records every deployed agreement in an on-chain registry
 *         and emits a payment-aware AgreementCreated event.
 *
 *         The factory does NOT hold funds, approve work, release payments, refund clients,
 *         arbitrate disputes, collect fees, or control any deployed agreement in any way.
 *         Its only purpose is deployment and discovery.
 *
 * @dev    factoryVersion() returns 3.
 */
contract DealLockFactoryV3 {
    // ── Registry storage ─────────────────────────────────────────────────────

    DealLockMultiAssetV2Deployer public immutable agreementDeployer;

    address[] private _agreements;
    mapping(address => bool) public isDealLockAgreement;
    mapping(address => address[]) private _agreementsByClient;
    mapping(address => address[]) private _agreementsByProvider;

    // ── Events ────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when a new agreement is created through the factory.
     * @dev    agreement, client, and provider are indexed for efficient filtering.
     *         metadataHash is an optional off-chain correlation value — do NOT include
     *         emails, proof links, dispute reasons, or any private data.
     */
    event AgreementCreated(
        address indexed agreement,
        address indexed client,
        address indexed provider,
        uint256 chainId,
        uint256 contractVersion,
        address paymentToken,
        uint256 milestoneCount,
        uint256 totalAmount,
        uint256 reviewPeriod,
        bytes32 metadataHash
    );

    // ── Version ───────────────────────────────────────────────────────────────

    constructor(address _agreementDeployer) {
        require(_agreementDeployer != address(0), "Invalid deployer");
        require(_agreementDeployer.code.length > 0, "Deployer not contract");
        agreementDeployer = DealLockMultiAssetV2Deployer(_agreementDeployer);
    }

    function factoryVersion() external pure returns (uint256) {
        return 3;
    }

    // ── Create ────────────────────────────────────────────────────────────────

    /**
     * @notice Deploy a new multi-asset escrow agreement.
     *         The caller becomes the on-chain client of the deployed agreement.
     * @param provider      Address of the service provider (must differ from caller).
     * @param paymentToken  address(0) for native ETH, otherwise an ERC-20 token address.
     * @param descriptions  Milestone description strings (stored on-chain).
     * @param amounts       Milestone amounts in wei; must be > 0 each.
     * @param deadlines     Milestone deadline timestamps (Unix); must be future and nondecreasing.
     * @param reviewPeriod  Review period in seconds (1 hour ≤ reviewPeriod ≤ 14 days).
     * @param metadataHash  Optional 32-byte correlation hash; use bytes32(0) if unused.
     * @return agreement    Address of the deployed escrow contract.
     */
    function createAgreement(
        address provider,
        address paymentToken,
        string[] calldata descriptions,
        uint256[] calldata amounts,
        uint256[] calldata deadlines,
        uint256 reviewPeriod,
        bytes32 metadataHash
    ) external returns (address agreement) {
        require(provider != address(0), "Invalid provider");
        require(provider != msg.sender, "Provider must differ from client");
        require(descriptions.length > 0, "No milestones");
        require(
            descriptions.length == amounts.length &&
                amounts.length == deadlines.length,
            "Array length mismatch"
        );

        // Deploy the agreement — constructor validates amounts, deadlines, and reviewPeriod.
        address agreementAddr = agreementDeployer.deploy(
            msg.sender,
            provider,
            paymentToken,
            descriptions,
            amounts,
            deadlines,
            reviewPeriod
        );

        // Register in factory storage.
        _agreements.push(agreementAddr);
        isDealLockAgreement[agreementAddr] = true;
        _agreementsByClient[msg.sender].push(agreementAddr);
        _agreementsByProvider[provider].push(agreementAddr);

        // Compute totalAmount for the event — mirrors what the agreement constructor computed.
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        emit AgreementCreated(
            agreementAddr,
            msg.sender,
            provider,
            block.chainid,
            6,
            paymentToken,
            descriptions.length,
            totalAmount,
            reviewPeriod,
            metadataHash
        );

        return agreementAddr;
    }

    // ── Registry reads ────────────────────────────────────────────────────────

    function agreementCount() external view returns (uint256) {
        return _agreements.length;
    }

    function getAgreement(uint256 index) external view returns (address) {
        require(index < _agreements.length, "Index out of bounds");
        return _agreements[index];
    }

    function getAgreements(uint256 offset, uint256 limit) external view returns (address[] memory) {
        return _paginate(_agreements, offset, limit);
    }

    function getClientAgreementCount(address client_) external view returns (uint256) {
        return _agreementsByClient[client_].length;
    }

    function getProviderAgreementCount(address provider_) external view returns (uint256) {
        return _agreementsByProvider[provider_].length;
    }

    function getClientAgreements(
        address client_,
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory) {
        return _paginate(_agreementsByClient[client_], offset, limit);
    }

    function getProviderAgreements(
        address provider_,
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory) {
        return _paginate(_agreementsByProvider[provider_], offset, limit);
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _paginate(
        address[] storage arr,
        uint256 offset,
        uint256 limit
    ) internal view returns (address[] memory) {
        uint256 total = arr.length;
        if (offset >= total || limit == 0) return new address[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = arr[i];
        }
        return result;
    }
}
