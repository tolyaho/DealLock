// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

library SafeERC20 {
    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
        bytes memory data = abi.encodeWithSelector(token.transfer.selector, to, amount);
        bytes memory returndata = _call(address(token), data);
        if (returndata.length > 0) {
            require(abi.decode(returndata, (bool)), "ERC20 transfer failed");
        }
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        bytes memory data = abi.encodeWithSelector(token.transferFrom.selector, from, to, amount);
        bytes memory returndata = _call(address(token), data);
        if (returndata.length > 0) {
            require(abi.decode(returndata, (bool)), "ERC20 transferFrom failed");
        }
    }

    function _call(address target, bytes memory data) private returns (bytes memory) {
        require(target.code.length > 0, "SafeERC20: non-contract");
        (bool success, bytes memory returndata) = target.call(data);
        if (!success) {
            if (returndata.length > 0) {
                assembly {
                    revert(add(32, returndata), mload(returndata))
                }
            }
            revert("SafeERC20: call failed");
        }
        return returndata;
    }
}

/**
 * @title DealLockMultiAssetV2
 * @notice Protocol version 6 escrow contract. Preserves V5 multi-asset escrow
 *         behavior and adds a 30-minute deadline grace window with
 *         client-approved deadline extension requests.
 */
contract DealLockMultiAssetV2 {
    using SafeERC20 for IERC20;
    // ── Enums ────────────────────────────────────────────────────────────────

    enum AgreementState {
        Proposed,   // 0
        Accepted,   // 1
        Funded,     // 2
        Completed,  // 3
        Cancelled   // 4
    }

    enum MilestoneState {
        Pending,            // 0
        Submitted,          // 1
        Released,           // 2 — terminal
        Refunded,           // 3 — terminal
        Disputed,           // 4
        Settled,            // 5 — terminal (mutual settlement)
        RevisionRequested   // 6 — cooperative fix requested by client
    }

    enum AdjustmentState {
        Proposed,   // 0
        Accepted,   // 1
        Funded,     // 2
        Submitted,  // 3
        Released,   // 4 — terminal
        Refunded,   // 5 — terminal
        Cancelled,  // 6 — terminal
        Disputed,   // 7
        Settled     // 8 — terminal (mutual settlement)
    }

    // ── Structs ──────────────────────────────────────────────────────────────

    struct Milestone {
        string description;
        uint256 amount;
        uint256 deadline;
        string proof;
        uint256 submittedAt;
        MilestoneState state;
        uint256 revisionCount;
    }

    struct RevisionInfo {
        bool exists;
        bool providerDeadlineRequestExists;
        address requestedBy;
        uint256 revisionRound;
        uint256 requestedAt;
        uint256 revisionDeadline;
        uint256 providerRequestedDeadline;
        uint256 providerDeadlineRequestedAt;
        string reason;
        string providerDeadlineReason;
    }

    struct Adjustment {
        uint256 targetMilestoneId;
        string description;
        uint256 amount;
        uint256 deadline;
        string proof;
        uint256 submittedAt;
        AdjustmentState state;
    }

    struct DisputeInfo {
        bool exists;
        address openedBy;
        string reason;
        uint256 openedAt;
    }

    struct SettlementProposal {
        bool exists;
        address proposer;
        uint256 providerAmount;
        string note;
        uint256 proposedAt;
    }

    struct DeadlineExtensionRequest {
        bool active;
        address requester;
        uint256 requestedAt;
        uint256 proposedDeadline;
        string reason;
    }

    // ── Constants ─────────────────────────────────────────────────────────────

    uint256 public constant DEADLINE_GRACE_PERIOD = 30 minutes;
    uint256 public constant REFUND_GRACE_PERIOD = DEADLINE_GRACE_PERIOD;
    uint256 public constant REVISION_RESPONSE_PERIOD = 3 days;

    // ── Immutables ───────────────────────────────────────────────────────────

    address public immutable client;
    address public immutable provider;
    address public immutable paymentToken;
    uint256 public immutable totalAmount;
    uint256 public immutable reviewPeriod;

    uint256 private _reentrancyGuard;

    // ── Original milestone accounting ────────────────────────────────────────

    uint256 public fundedAmount;
    uint256 public releasedAmount;
    uint256 public refundedAmount;

    // ── Adjustment accounting ────────────────────────────────────────────────

    uint256 public adjustmentFundedAmount;
    uint256 public adjustmentReleasedAmount;
    uint256 public adjustmentRefundedAmount;

    // ── State ────────────────────────────────────────────────────────────────

    AgreementState public agreementState;

    Milestone[] private milestones;
    Adjustment[] private _adjustments;

    // ── Dispute / Settlement state ───────────────────────────────────────────

    mapping(uint256 => DisputeInfo) private _milestoneDisputes;
    mapping(uint256 => SettlementProposal) private _milestoneSettlementProposals;
    mapping(uint256 => DeadlineExtensionRequest) private _milestoneDeadlineExtensionRequests;
    mapping(uint256 => RevisionInfo) private _milestoneRevisions;

    mapping(uint256 => DisputeInfo) private _adjustmentDisputes;
    mapping(uint256 => SettlementProposal) private _adjustmentSettlementProposals;
    mapping(uint256 => DeadlineExtensionRequest) private _adjustmentDeadlineExtensionRequests;

    // ── Events (original V1) ──────────────────────────────────────────────────

    event AgreementAccepted(address indexed provider);
    event AgreementFunded(address indexed client, uint256 amount);
    event MilestoneSubmitted(uint256 indexed milestoneId, string proof);
    event MilestoneReleased(uint256 indexed milestoneId, uint256 amount);
    event MilestoneRefunded(uint256 indexed milestoneId, uint256 amount);

    // ── Events (adjustments) ─────────────────────────────────────────────────

    event AdjustmentRequested(
        uint256 indexed adjustmentId,
        uint256 indexed targetMilestoneId,
        uint256 amount,
        uint256 deadline,
        string description
    );
    event AdjustmentAccepted(uint256 indexed adjustmentId);
    event AdjustmentFunded(uint256 indexed adjustmentId, uint256 amount);
    event AdjustmentSubmitted(uint256 indexed adjustmentId, string proof);
    event AdjustmentReleased(uint256 indexed adjustmentId, uint256 amount);
    event AdjustmentRefunded(uint256 indexed adjustmentId, uint256 amount);
    event AdjustmentCancelled(uint256 indexed adjustmentId);

    // ── Events (V4 milestone dispute / settlement) ────────────────────────────

    event MilestoneDisputed(uint256 indexed milestoneId, string reason);
    event MilestoneAutoReleased(uint256 indexed milestoneId, uint256 amount);
    event MilestoneSettlementProposed(
        uint256 indexed milestoneId,
        address indexed proposer,
        uint256 providerAmount,
        uint256 clientAmount,
        string note
    );
    event MilestoneSettlementAccepted(
        uint256 indexed milestoneId,
        uint256 providerAmount,
        uint256 clientAmount
    );
    event MilestoneSettlementCancelled(uint256 indexed milestoneId);

    // ── Events (V4 adjustment dispute / settlement) ───────────────────────────

    event AdjustmentDisputed(uint256 indexed adjustmentId, string reason);
    event AdjustmentAutoReleased(uint256 indexed adjustmentId, uint256 amount);
    event AdjustmentSettlementProposed(
        uint256 indexed adjustmentId,
        address indexed proposer,
        uint256 providerAmount,
        uint256 clientAmount,
        string note
    );
    event AdjustmentSettlementAccepted(
        uint256 indexed adjustmentId,
        uint256 providerAmount,
        uint256 clientAmount
    );
    event AdjustmentSettlementCancelled(uint256 indexed adjustmentId);

    // ── Events (V6 deadline extensions) ─────────────────────────────────────

    event MilestoneDeadlineExtensionRequested(
        uint256 indexed milestoneId,
        uint256 oldDeadline,
        uint256 proposedDeadline,
        string reason
    );
    event MilestoneDeadlineExtensionAccepted(
        uint256 indexed milestoneId,
        uint256 oldDeadline,
        uint256 newDeadline
    );
    event MilestoneDeadlineExtensionRejected(uint256 indexed milestoneId);
    event MilestoneDeadlineExtensionCancelled(uint256 indexed milestoneId);

    event AdjustmentDeadlineExtensionRequested(
        uint256 indexed adjustmentId,
        uint256 oldDeadline,
        uint256 proposedDeadline,
        string reason
    );
    event AdjustmentDeadlineExtensionAccepted(
        uint256 indexed adjustmentId,
        uint256 oldDeadline,
        uint256 newDeadline
    );
    event AdjustmentDeadlineExtensionRejected(uint256 indexed adjustmentId);
    event AdjustmentDeadlineExtensionCancelled(uint256 indexed adjustmentId);

    // ── Events (V6 revision requests) ───────────────────────────────────────

    event MilestoneRevisionRequested(
        uint256 indexed milestoneId,
        uint256 indexed revisionRound,
        string reason,
        uint256 revisionDeadline
    );
    event MilestoneRevisionDeadlineRequested(
        uint256 indexed milestoneId,
        uint256 indexed revisionRound,
        uint256 requestedDeadline,
        string reason
    );
    event MilestoneRevisionDeadlineUpdated(
        uint256 indexed milestoneId,
        uint256 indexed revisionRound,
        uint256 newDeadline
    );
    event MilestoneRevisionAccepted(
        uint256 indexed milestoneId,
        uint256 indexed revisionRound,
        uint256 finalDeadline
    );
    event MilestoneRevisionRejected(
        uint256 indexed milestoneId,
        uint256 indexed revisionRound,
        string reason
    );
    event MilestoneRevisionEscalated(
        uint256 indexed milestoneId,
        uint256 indexed revisionRound,
        string reason
    );

    // ── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyClient() {
        require(msg.sender == client, "Only client");
        _;
    }

    modifier onlyProvider() {
        require(msg.sender == provider, "Only provider");
        _;
    }

    modifier inState(AgreementState expected) {
        require(agreementState == expected, "Invalid agreement state");
        _;
    }

    modifier nonReentrant() {
        require(_reentrancyGuard == 0, "ReentrancyGuard: reentrant call");
        _reentrancyGuard = 1;
        _;
        _reentrancyGuard = 0;
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _client,
        address _provider,
        address _paymentToken,
        string[] memory descriptions,
        uint256[] memory amounts,
        uint256[] memory deadlines,
        uint256 _reviewPeriod
    ) {
        require(_client != address(0), "Invalid client");
        require(_provider != address(0), "Invalid provider");
        require(_client != _provider, "Client and provider must differ");
        require(descriptions.length > 0, "No milestones");
        require(
            descriptions.length == amounts.length &&
                amounts.length == deadlines.length,
            "Array length mismatch"
        );
        require(_reviewPeriod >= 1 hours, "Review period too short");
        require(_reviewPeriod <= 14 days, "Review period too long");

        client = _client;
        provider = _provider;
        paymentToken = _paymentToken;
        reviewPeriod = _reviewPeriod;
        agreementState = AgreementState.Proposed;

        uint256 sum = 0;
        uint256 prevDeadline = 0;

        for (uint256 i = 0; i < descriptions.length; i++) {
            require(bytes(descriptions[i]).length > 0, "Empty description");
            require(amounts[i] > 0, "Zero milestone amount");
            require(deadlines[i] > block.timestamp, "Deadline must be future");

            if (i > 0) {
                require(deadlines[i] >= prevDeadline, "Deadlines not sorted");
            }

            milestones.push(
                Milestone({
                    description: descriptions[i],
                    amount: amounts[i],
                    deadline: deadlines[i],
                    proof: "",
                    submittedAt: 0,
                    state: MilestoneState.Pending,
                    revisionCount: 0
                })
            );

            sum += amounts[i];
            prevDeadline = deadlines[i];
        }

        require(sum > 0, "Zero total amount");
        totalAmount = sum;
    }

    // ── Fallback ─────────────────────────────────────────────────────────────

    receive() external payable {
        revert("Use fundAgreement or fundAdjustment");
    }

    fallback() external payable {
        revert("Invalid call");
    }

    // ── Version ──────────────────────────────────────────────────────────────

    function contractVersion() external pure returns (uint256) {
        return 6;
    }

    function isNativePayment() public view returns (bool) {
        return paymentToken == address(0);
    }

    // ── Read helpers ─────────────────────────────────────────────────────────

    function getMilestoneCount() external view returns (uint256) {
        return milestones.length;
    }

    function getMilestone(
        uint256 milestoneId
    )
        external
        view
        returns (
            string memory description,
            uint256 amount,
            uint256 deadline,
            string memory proof,
            uint256 submittedAt,
            MilestoneState state
        )
    {
        _checkMilestoneId(milestoneId);
        Milestone storage m = milestones[milestoneId];
        return (m.description, m.amount, m.deadline, m.proof, m.submittedAt, m.state);
    }

    function getAdjustmentCount() external view returns (uint256) {
        return _adjustments.length;
    }

    function getAdjustment(
        uint256 adjustmentId
    )
        external
        view
        returns (
            uint256 targetMilestoneId,
            string memory description,
            uint256 amount,
            uint256 deadline,
            string memory proof,
            uint256 submittedAt,
            AdjustmentState state
        )
    {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        return (
            a.targetMilestoneId,
            a.description,
            a.amount,
            a.deadline,
            a.proof,
            a.submittedAt,
            a.state
        );
    }

    function getMilestoneRefundAvailableAt(uint256 id) external view returns (uint256) {
        require(id < milestones.length, "Invalid milestone id");
        return milestones[id].deadline + REFUND_GRACE_PERIOD;
    }

    function getMilestoneSubmissionClosesAt(uint256 milestoneId) external view returns (uint256) {
        _checkMilestoneId(milestoneId);
        return milestones[milestoneId].deadline + DEADLINE_GRACE_PERIOD;
    }

    function getAdjustmentRefundAvailableAt(uint256 id) external view returns (uint256) {
        require(id < _adjustments.length, "Invalid adjustment id");
        return _adjustments[id].deadline + REFUND_GRACE_PERIOD;
    }

    function getAdjustmentSubmissionClosesAt(uint256 adjustmentId) external view returns (uint256) {
        _checkAdjustmentId(adjustmentId);
        return _adjustments[adjustmentId].deadline + DEADLINE_GRACE_PERIOD;
    }

    function getMilestoneReviewDeadline(uint256 milestoneId) external view returns (uint256) {
        _checkMilestoneId(milestoneId);
        uint256 sat = milestones[milestoneId].submittedAt;
        if (sat == 0) return 0;
        return sat + reviewPeriod;
    }

    function canClaimMilestoneAfterReview(uint256 milestoneId) external view returns (bool) {
        _checkMilestoneId(milestoneId);
        Milestone storage m = milestones[milestoneId];
        return m.state == MilestoneState.Submitted &&
               m.submittedAt > 0 &&
               block.timestamp > m.submittedAt + reviewPeriod;
    }

    function getMilestoneDispute(uint256 milestoneId) external view returns (DisputeInfo memory) {
        _checkMilestoneId(milestoneId);
        return _milestoneDisputes[milestoneId];
    }

    function getMilestoneSettlementProposal(uint256 milestoneId) external view returns (SettlementProposal memory) {
        _checkMilestoneId(milestoneId);
        return _milestoneSettlementProposals[milestoneId];
    }

    function getAdjustmentReviewDeadline(uint256 adjustmentId) external view returns (uint256) {
        _checkAdjustmentId(adjustmentId);
        uint256 sat = _adjustments[adjustmentId].submittedAt;
        if (sat == 0) return 0;
        return sat + reviewPeriod;
    }

    function canClaimAdjustmentAfterReview(uint256 adjustmentId) external view returns (bool) {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        return a.state == AdjustmentState.Submitted &&
               a.submittedAt > 0 &&
               block.timestamp > a.submittedAt + reviewPeriod;
    }

    function getAdjustmentDispute(uint256 adjustmentId) external view returns (DisputeInfo memory) {
        _checkAdjustmentId(adjustmentId);
        return _adjustmentDisputes[adjustmentId];
    }

    function getAdjustmentSettlementProposal(uint256 adjustmentId) external view returns (SettlementProposal memory) {
        _checkAdjustmentId(adjustmentId);
        return _adjustmentSettlementProposals[adjustmentId];
    }

    function getMilestoneDeadlineExtensionRequest(
        uint256 milestoneId
    ) external view returns (DeadlineExtensionRequest memory) {
        _checkMilestoneId(milestoneId);
        return _milestoneDeadlineExtensionRequests[milestoneId];
    }

    function getAdjustmentDeadlineExtensionRequest(
        uint256 adjustmentId
    ) external view returns (DeadlineExtensionRequest memory) {
        _checkAdjustmentId(adjustmentId);
        return _adjustmentDeadlineExtensionRequests[adjustmentId];
    }

    function getMilestoneRevision(uint256 milestoneId) external view returns (RevisionInfo memory) {
        _checkMilestoneId(milestoneId);
        return _milestoneRevisions[milestoneId];
    }

    function getMilestoneRevisionCount(uint256 milestoneId) external view returns (uint256) {
        _checkMilestoneId(milestoneId);
        return milestones[milestoneId].revisionCount;
    }

    function getMilestoneRevisionResponseDeadline(uint256 milestoneId) external view returns (uint256) {
        _checkMilestoneId(milestoneId);
        RevisionInfo storage r = _milestoneRevisions[milestoneId];
        if (!r.exists) return 0;
        return r.requestedAt + REVISION_RESPONSE_PERIOD;
    }

    function getContractBalance() external view returns (uint256) {
        return _contractPaymentBalance();
    }

    function isAgreementCompleted() external view returns (bool) {
        return agreementState == AgreementState.Completed;
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    function _checkMilestoneId(uint256 milestoneId) internal view {
        require(milestoneId < milestones.length, "Invalid milestone id");
    }

    function _checkAdjustmentId(uint256 adjustmentId) internal view {
        require(adjustmentId < _adjustments.length, "Invalid adjustment id");
    }

    function _isMilestoneTerminal(MilestoneState state) internal pure returns (bool) {
        return
            state == MilestoneState.Released ||
            state == MilestoneState.Refunded ||
            state == MilestoneState.Settled;
    }

    function _isAdjustmentTerminal(AdjustmentState state) internal pure returns (bool) {
        return
            state == AdjustmentState.Released ||
            state == AdjustmentState.Refunded ||
            state == AdjustmentState.Cancelled ||
            state == AdjustmentState.Settled;
    }

    function _refundAvailableAt(uint256 deadline) internal pure returns (uint256) {
        return deadline + DEADLINE_GRACE_PERIOD;
    }

    function _requireSubmissionWindowOpen(uint256 deadline) internal view {
        require(block.timestamp <= deadline + DEADLINE_GRACE_PERIOD, "Submission window closed");
    }

    function _requirePreviousMilestonesReleased(uint256 milestoneId) internal view {
        for (uint256 i = 0; i < milestoneId; i++) {
            require(
                milestones[i].state == MilestoneState.Released ||
                milestones[i].state == MilestoneState.Settled,
                "Previous milestone not released"
            );
        }
    }

    function _requirePreviousMilestonesResolved(uint256 milestoneId) internal view {
        for (uint256 i = 0; i < milestoneId; i++) {
            require(
                _isMilestoneTerminal(milestones[i].state),
                "Previous milestone not resolved"
            );
        }
    }

    function _tryCompleteAgreement() internal {
        if (releasedAmount + refundedAmount != totalAmount) return;
        for (uint256 i = 0; i < milestones.length; i++) {
            if (!_isMilestoneTerminal(milestones[i].state)) return;
        }
        for (uint256 i = 0; i < _adjustments.length; i++) {
            if (!_isAdjustmentTerminal(_adjustments[i].state)) return;
        }
        if (adjustmentReleasedAmount + adjustmentRefundedAmount != adjustmentFundedAmount) return;
        agreementState = AgreementState.Completed;
    }

    function _contractPaymentBalance() internal view returns (uint256) {
        if (isNativePayment()) return address(this).balance;
        return IERC20(paymentToken).balanceOf(address(this));
    }

    function _collectPayment(uint256 amount) internal {
        if (isNativePayment()) {
            require(msg.value == amount, "Incorrect funding amount");
            return;
        }

        require(msg.value == 0, "ETH not accepted");
        IERC20 token = IERC20(paymentToken);
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(client, address(this), amount);
        uint256 afterBalance = token.balanceOf(address(this));
        require(afterBalance - beforeBalance == amount, "Unsupported token transfer");
    }

    function _sendPayment(address payable to, uint256 amount) internal {
        require(_contractPaymentBalance() >= amount, "Insufficient contract balance");
        if (isNativePayment()) {
            (bool ok, ) = to.call{value: amount}("");
            require(ok, "Transfer failed");
        } else {
            IERC20(paymentToken).safeTransfer(to, amount);
        }
    }

    // ── Agreement lifecycle ──────────────────────────────────────────────────

    function acceptAgreement() external onlyProvider inState(AgreementState.Proposed) {
        agreementState = AgreementState.Accepted;
        emit AgreementAccepted(provider);
    }

    function fundAgreement() external payable onlyClient inState(AgreementState.Accepted) nonReentrant {
        _collectPayment(totalAmount);
        fundedAmount = totalAmount;
        agreementState = AgreementState.Funded;
        emit AgreementFunded(client, totalAmount);
    }

    function submitMilestone(
        uint256 milestoneId,
        string calldata proof
    ) external onlyProvider inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        _requirePreviousMilestonesReleased(milestoneId);

        Milestone storage m = milestones[milestoneId];
        require(m.state == MilestoneState.Pending, "Milestone not pending");
        _requireSubmissionWindowOpen(m.deadline);
        require(bytes(proof).length > 0, "Empty proof");

        m.proof = proof;
        m.submittedAt = block.timestamp;
        m.state = MilestoneState.Submitted;

        emit MilestoneSubmitted(milestoneId, proof);
    }

    function approveMilestone(
        uint256 milestoneId
    ) external onlyClient inState(AgreementState.Funded) nonReentrant {
        _checkMilestoneId(milestoneId);
        _requirePreviousMilestonesReleased(milestoneId);

        Milestone storage m = milestones[milestoneId];
        require(m.state == MilestoneState.Submitted, "Milestone not submitted");

        m.state = MilestoneState.Released;
        releasedAmount += m.amount;

        _sendPayment(payable(provider), m.amount);

        emit MilestoneReleased(milestoneId, m.amount);
        _tryCompleteAgreement();
    }

    function refundExpiredMilestone(
        uint256 milestoneId
    ) external onlyClient inState(AgreementState.Funded) nonReentrant {
        _checkMilestoneId(milestoneId);
        _requirePreviousMilestonesResolved(milestoneId);

        Milestone storage m = milestones[milestoneId];
        require(m.state == MilestoneState.Pending, "Milestone not pending");
        require(
            block.timestamp >= _refundAvailableAt(m.deadline),
            "Refund not available yet"
        );

        m.state = MilestoneState.Refunded;
        refundedAmount += m.amount;

        _sendPayment(payable(client), m.amount);

        emit MilestoneRefunded(milestoneId, m.amount);
        _tryCompleteAgreement();
    }

    // ── V6 Milestone deadline extension requests ────────────────────────────

    function requestMilestoneDeadlineExtension(
        uint256 milestoneId,
        uint256 proposedDeadline,
        string calldata reason
    ) external onlyProvider inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        Milestone storage m = milestones[milestoneId];
        require(m.state == MilestoneState.Pending, "Milestone not pending");
        _requireSubmissionWindowOpen(m.deadline);
        require(proposedDeadline > m.deadline, "Proposed deadline must be later");
        require(bytes(reason).length > 0, "Empty reason");

        _milestoneDeadlineExtensionRequests[milestoneId] = DeadlineExtensionRequest({
            active: true,
            requester: msg.sender,
            requestedAt: block.timestamp,
            proposedDeadline: proposedDeadline,
            reason: reason
        });

        emit MilestoneDeadlineExtensionRequested(milestoneId, m.deadline, proposedDeadline, reason);
    }

    function acceptMilestoneDeadlineExtension(
        uint256 milestoneId
    ) external onlyClient inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        Milestone storage m = milestones[milestoneId];
        DeadlineExtensionRequest storage request = _milestoneDeadlineExtensionRequests[milestoneId];
        require(request.active, "No active extension request");
        require(m.state == MilestoneState.Pending, "Milestone not pending");
        require(request.proposedDeadline > m.deadline, "Proposed deadline must be later");

        uint256 oldDeadline = m.deadline;
        uint256 newDeadline = request.proposedDeadline;
        m.deadline = newDeadline;
        delete _milestoneDeadlineExtensionRequests[milestoneId];

        emit MilestoneDeadlineExtensionAccepted(milestoneId, oldDeadline, newDeadline);
    }

    function rejectMilestoneDeadlineExtension(
        uint256 milestoneId
    ) external onlyClient inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        DeadlineExtensionRequest storage request = _milestoneDeadlineExtensionRequests[milestoneId];
        require(request.active, "No active extension request");
        delete _milestoneDeadlineExtensionRequests[milestoneId];
        emit MilestoneDeadlineExtensionRejected(milestoneId);
    }

    function cancelMilestoneDeadlineExtension(
        uint256 milestoneId
    ) external onlyProvider inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        DeadlineExtensionRequest storage request = _milestoneDeadlineExtensionRequests[milestoneId];
        require(request.active, "No active extension request");
        delete _milestoneDeadlineExtensionRequests[milestoneId];
        emit MilestoneDeadlineExtensionCancelled(milestoneId);
    }

    // ── V6 Milestone revision requests ───────────────────────────────────────

    function requestMilestoneRevision(
        uint256 milestoneId,
        string calldata reason,
        uint256 revisionDeadline
    ) external onlyClient inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        Milestone storage m = milestones[milestoneId];
        require(m.state == MilestoneState.Submitted, "Milestone not submitted");
        require(bytes(reason).length > 0, "Empty reason");
        require(block.timestamp <= m.submittedAt + reviewPeriod, "Review period expired");
        require(revisionDeadline > block.timestamp, "Deadline must be future");

        uint256 nextRound = m.revisionCount + 1;
        m.state = MilestoneState.RevisionRequested;
        _milestoneRevisions[milestoneId] = RevisionInfo({
            exists: true,
            providerDeadlineRequestExists: false,
            requestedBy: msg.sender,
            revisionRound: nextRound,
            requestedAt: block.timestamp,
            revisionDeadline: revisionDeadline,
            providerRequestedDeadline: 0,
            providerDeadlineRequestedAt: 0,
            reason: reason,
            providerDeadlineReason: ""
        });

        emit MilestoneRevisionRequested(milestoneId, nextRound, reason, revisionDeadline);
    }

    function requestRevisionDeadline(
        uint256 milestoneId,
        uint256 requestedDeadline,
        string calldata reason
    ) external onlyProvider inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        Milestone storage m = milestones[milestoneId];
        require(m.state == MilestoneState.RevisionRequested, "Revision not requested");
        require(requestedDeadline > block.timestamp, "Deadline must be future");
        require(bytes(reason).length > 0, "Empty reason");

        RevisionInfo storage r = _milestoneRevisions[milestoneId];
        r.providerDeadlineRequestExists = true;
        r.providerRequestedDeadline = requestedDeadline;
        r.providerDeadlineReason = reason;
        r.providerDeadlineRequestedAt = block.timestamp;

        emit MilestoneRevisionDeadlineRequested(milestoneId, r.revisionRound, requestedDeadline, reason);
    }

    function setRevisionDeadline(
        uint256 milestoneId,
        uint256 newDeadline
    ) external onlyClient inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        Milestone storage m = milestones[milestoneId];
        require(m.state == MilestoneState.RevisionRequested, "Revision not requested");
        require(newDeadline > block.timestamp, "Deadline must be future");

        RevisionInfo storage r = _milestoneRevisions[milestoneId];
        r.revisionDeadline = newDeadline;

        emit MilestoneRevisionDeadlineUpdated(milestoneId, r.revisionRound, newDeadline);
    }

    function acceptMilestoneRevision(
        uint256 milestoneId
    ) external onlyProvider inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        Milestone storage m = milestones[milestoneId];
        require(m.state == MilestoneState.RevisionRequested, "Revision not requested");
        RevisionInfo storage r = _milestoneRevisions[milestoneId];
        require(r.exists, "No revision request");
        require(r.revisionDeadline > block.timestamp, "Revision deadline expired");

        uint256 round = r.revisionRound;
        uint256 finalDeadline = r.revisionDeadline;

        m.revisionCount += 1;
        m.deadline = finalDeadline;
        m.proof = "";
        m.submittedAt = 0;
        m.state = MilestoneState.Pending;

        delete _milestoneRevisions[milestoneId];
        delete _milestoneSettlementProposals[milestoneId];

        emit MilestoneRevisionAccepted(milestoneId, round, finalDeadline);
    }

    function rejectMilestoneRevision(
        uint256 milestoneId,
        string calldata reason
    ) external onlyProvider inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        Milestone storage m = milestones[milestoneId];
        require(m.state == MilestoneState.RevisionRequested, "Revision not requested");
        require(bytes(reason).length > 0, "Empty reason");

        uint256 round = _milestoneRevisions[milestoneId].revisionRound;

        m.state = MilestoneState.Disputed;
        _milestoneDisputes[milestoneId] = DisputeInfo({
            exists: true,
            openedBy: msg.sender,
            reason: reason,
            openedAt: block.timestamp
        });
        delete _milestoneRevisions[milestoneId];

        emit MilestoneRevisionRejected(milestoneId, round, reason);
    }

    function escalateMilestoneRevisionToDispute(
        uint256 milestoneId,
        string calldata reason
    ) external onlyClient inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        Milestone storage m = milestones[milestoneId];
        require(m.state == MilestoneState.RevisionRequested, "Revision not requested");
        require(bytes(reason).length > 0, "Empty reason");

        RevisionInfo storage r = _milestoneRevisions[milestoneId];
        require(r.exists, "No revision request");
        require(
            block.timestamp > r.requestedAt + REVISION_RESPONSE_PERIOD,
            "Revision response period active"
        );

        uint256 round = r.revisionRound;
        m.state = MilestoneState.Disputed;
        _milestoneDisputes[milestoneId] = DisputeInfo({
            exists: true,
            openedBy: msg.sender,
            reason: reason,
            openedAt: block.timestamp
        });
        delete _milestoneRevisions[milestoneId];

        emit MilestoneRevisionEscalated(milestoneId, round, reason);
    }

    // ── V4 Milestone dispute / review / settlement ────────────────────────────

    function disputeMilestone(
        uint256 milestoneId,
        string calldata reason
    ) external onlyClient inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        Milestone storage m = milestones[milestoneId];

        require(m.state == MilestoneState.Submitted, "Milestone not submitted");
        require(bytes(reason).length > 0, "Empty reason");
        require(
            block.timestamp <= m.submittedAt + reviewPeriod,
            "Review period expired"
        );

        m.state = MilestoneState.Disputed;
        _milestoneDisputes[milestoneId] = DisputeInfo({
            exists: true,
            openedBy: msg.sender,
            reason: reason,
            openedAt: block.timestamp
        });

        emit MilestoneDisputed(milestoneId, reason);
    }

    function claimMilestoneAfterReview(
        uint256 milestoneId
    ) external onlyProvider inState(AgreementState.Funded) nonReentrant {
        _checkMilestoneId(milestoneId);
        Milestone storage m = milestones[milestoneId];

        require(m.state == MilestoneState.Submitted, "Milestone not submitted");
        require(
            block.timestamp > m.submittedAt + reviewPeriod,
            "Review period not expired"
        );

        uint256 amount = m.amount;
        m.state = MilestoneState.Released;
        releasedAmount += amount;

        _sendPayment(payable(provider), amount);

        emit MilestoneAutoReleased(milestoneId, amount);
        _tryCompleteAgreement();
    }

    function proposeMilestoneSettlement(
        uint256 milestoneId,
        uint256 providerAmount,
        string calldata note
    ) external inState(AgreementState.Funded) {
        require(msg.sender == client || msg.sender == provider, "Only client or provider");
        _checkMilestoneId(milestoneId);
        Milestone storage m = milestones[milestoneId];

        require(m.state == MilestoneState.Disputed, "Milestone not disputed");
        require(providerAmount <= m.amount, "Provider amount exceeds milestone amount");

        uint256 clientAmount = m.amount - providerAmount;
        _milestoneSettlementProposals[milestoneId] = SettlementProposal({
            exists: true,
            proposer: msg.sender,
            providerAmount: providerAmount,
            note: note,
            proposedAt: block.timestamp
        });

        emit MilestoneSettlementProposed(milestoneId, msg.sender, providerAmount, clientAmount, note);
    }

    function acceptMilestoneSettlement(
        uint256 milestoneId
    ) external inState(AgreementState.Funded) nonReentrant {
        require(msg.sender == client || msg.sender == provider, "Only client or provider");
        _checkMilestoneId(milestoneId);
        Milestone storage m = milestones[milestoneId];

        require(m.state == MilestoneState.Disputed, "Milestone not disputed");
        SettlementProposal storage proposal = _milestoneSettlementProposals[milestoneId];
        require(proposal.exists, "No settlement proposal");
        require(proposal.proposer != msg.sender, "Cannot accept own proposal");

        uint256 pAmount = proposal.providerAmount;
        uint256 cAmount = m.amount - pAmount;

        m.state = MilestoneState.Settled;
        releasedAmount += pAmount;
        refundedAmount += cAmount;
        proposal.exists = false;

        if (pAmount > 0) _sendPayment(payable(provider), pAmount);
        if (cAmount > 0) _sendPayment(payable(client), cAmount);

        emit MilestoneSettlementAccepted(milestoneId, pAmount, cAmount);
        _tryCompleteAgreement();
    }

    function cancelMilestoneSettlement(
        uint256 milestoneId
    ) external inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        SettlementProposal storage proposal = _milestoneSettlementProposals[milestoneId];
        require(proposal.exists, "No settlement proposal");
        require(proposal.proposer == msg.sender, "Only proposer can cancel");

        proposal.exists = false;
        emit MilestoneSettlementCancelled(milestoneId);
    }

    // ── Paid adjustment functions ─────────────────────────────────────────────

    function requestAdjustment(
        uint256 targetMilestoneId,
        string calldata description,
        uint256 amount,
        uint256 deadline
    ) external onlyClient inState(AgreementState.Funded) {
        _checkMilestoneId(targetMilestoneId);
        require(bytes(description).length > 0, "Empty description");
        require(amount > 0, "Zero adjustment amount");
        require(deadline > block.timestamp, "Deadline must be future");

        uint256 adjustmentId = _adjustments.length;
        _adjustments.push(
            Adjustment({
                targetMilestoneId: targetMilestoneId,
                description: description,
                amount: amount,
                deadline: deadline,
                proof: "",
                submittedAt: 0,
                state: AdjustmentState.Proposed
            })
        );

        emit AdjustmentRequested(adjustmentId, targetMilestoneId, amount, deadline, description);
    }

    function acceptAdjustment(
        uint256 adjustmentId
    ) external onlyProvider inState(AgreementState.Funded) {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        require(a.state == AdjustmentState.Proposed, "Adjustment not proposed");

        a.state = AdjustmentState.Accepted;
        emit AdjustmentAccepted(adjustmentId);
    }

    function fundAdjustment(
        uint256 adjustmentId
    ) external payable onlyClient inState(AgreementState.Funded) nonReentrant {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        require(a.state == AdjustmentState.Accepted, "Adjustment not accepted");
        uint256 amount = a.amount;
        _collectPayment(amount);

        a.state = AdjustmentState.Funded;
        adjustmentFundedAmount += amount;

        emit AdjustmentFunded(adjustmentId, amount);
    }

    function submitAdjustment(
        uint256 adjustmentId,
        string calldata proof
    ) external onlyProvider inState(AgreementState.Funded) {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        require(a.state == AdjustmentState.Funded, "Adjustment not funded");
        _requireSubmissionWindowOpen(a.deadline);
        require(bytes(proof).length > 0, "Empty proof");

        a.proof = proof;
        a.submittedAt = block.timestamp;
        a.state = AdjustmentState.Submitted;

        emit AdjustmentSubmitted(adjustmentId, proof);
    }

    function approveAdjustment(
        uint256 adjustmentId
    ) external onlyClient inState(AgreementState.Funded) nonReentrant {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        require(a.state == AdjustmentState.Submitted, "Adjustment not submitted");

        uint256 amount = a.amount;
        a.state = AdjustmentState.Released;
        adjustmentReleasedAmount += amount;

        _sendPayment(payable(provider), amount);

        emit AdjustmentReleased(adjustmentId, amount);
        _tryCompleteAgreement();
    }

    function refundExpiredAdjustment(
        uint256 adjustmentId
    ) external onlyClient inState(AgreementState.Funded) nonReentrant {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        require(a.state == AdjustmentState.Funded, "Adjustment not funded");
        require(
            block.timestamp >= _refundAvailableAt(a.deadline),
            "Refund not available yet"
        );

        uint256 amount = a.amount;
        a.state = AdjustmentState.Refunded;
        adjustmentRefundedAmount += amount;

        _sendPayment(payable(client), amount);

        emit AdjustmentRefunded(adjustmentId, amount);
        _tryCompleteAgreement();
    }

    // ── V6 Adjustment deadline extension requests ───────────────────────────

    function requestAdjustmentDeadlineExtension(
        uint256 adjustmentId,
        uint256 proposedDeadline,
        string calldata reason
    ) external onlyProvider inState(AgreementState.Funded) {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        require(a.state == AdjustmentState.Funded, "Adjustment not funded");
        _requireSubmissionWindowOpen(a.deadline);
        require(proposedDeadline > a.deadline, "Proposed deadline must be later");
        require(bytes(reason).length > 0, "Empty reason");

        _adjustmentDeadlineExtensionRequests[adjustmentId] = DeadlineExtensionRequest({
            active: true,
            requester: msg.sender,
            requestedAt: block.timestamp,
            proposedDeadline: proposedDeadline,
            reason: reason
        });

        emit AdjustmentDeadlineExtensionRequested(adjustmentId, a.deadline, proposedDeadline, reason);
    }

    function acceptAdjustmentDeadlineExtension(
        uint256 adjustmentId
    ) external onlyClient inState(AgreementState.Funded) {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        DeadlineExtensionRequest storage request = _adjustmentDeadlineExtensionRequests[adjustmentId];
        require(request.active, "No active extension request");
        require(a.state == AdjustmentState.Funded, "Adjustment not funded");
        require(request.proposedDeadline > a.deadline, "Proposed deadline must be later");

        uint256 oldDeadline = a.deadline;
        uint256 newDeadline = request.proposedDeadline;
        a.deadline = newDeadline;
        delete _adjustmentDeadlineExtensionRequests[adjustmentId];

        emit AdjustmentDeadlineExtensionAccepted(adjustmentId, oldDeadline, newDeadline);
    }

    function rejectAdjustmentDeadlineExtension(
        uint256 adjustmentId
    ) external onlyClient inState(AgreementState.Funded) {
        _checkAdjustmentId(adjustmentId);
        DeadlineExtensionRequest storage request = _adjustmentDeadlineExtensionRequests[adjustmentId];
        require(request.active, "No active extension request");
        delete _adjustmentDeadlineExtensionRequests[adjustmentId];
        emit AdjustmentDeadlineExtensionRejected(adjustmentId);
    }

    function cancelAdjustmentDeadlineExtension(
        uint256 adjustmentId
    ) external onlyProvider inState(AgreementState.Funded) {
        _checkAdjustmentId(adjustmentId);
        DeadlineExtensionRequest storage request = _adjustmentDeadlineExtensionRequests[adjustmentId];
        require(request.active, "No active extension request");
        delete _adjustmentDeadlineExtensionRequests[adjustmentId];
        emit AdjustmentDeadlineExtensionCancelled(adjustmentId);
    }

    function cancelAdjustment(
        uint256 adjustmentId
    ) external inState(AgreementState.Funded) {
        require(msg.sender == client || msg.sender == provider, "Only client or provider");
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        require(
            a.state == AdjustmentState.Proposed || a.state == AdjustmentState.Accepted,
            "Adjustment cannot be cancelled"
        );

        a.state = AdjustmentState.Cancelled;
        emit AdjustmentCancelled(adjustmentId);
        _tryCompleteAgreement();
    }

    // ── V4 Adjustment dispute / review / settlement ───────────────────────────

    function disputeAdjustment(
        uint256 adjustmentId,
        string calldata reason
    ) external onlyClient inState(AgreementState.Funded) {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];

        require(a.state == AdjustmentState.Submitted, "Adjustment not submitted");
        require(bytes(reason).length > 0, "Empty reason");
        require(
            block.timestamp <= a.submittedAt + reviewPeriod,
            "Review period expired"
        );

        a.state = AdjustmentState.Disputed;
        _adjustmentDisputes[adjustmentId] = DisputeInfo({
            exists: true,
            openedBy: msg.sender,
            reason: reason,
            openedAt: block.timestamp
        });

        emit AdjustmentDisputed(adjustmentId, reason);
    }

    function claimAdjustmentAfterReview(
        uint256 adjustmentId
    ) external onlyProvider inState(AgreementState.Funded) nonReentrant {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];

        require(a.state == AdjustmentState.Submitted, "Adjustment not submitted");
        require(
            block.timestamp > a.submittedAt + reviewPeriod,
            "Review period not expired"
        );

        uint256 amount = a.amount;
        a.state = AdjustmentState.Released;
        adjustmentReleasedAmount += amount;

        _sendPayment(payable(provider), amount);

        emit AdjustmentAutoReleased(adjustmentId, amount);
        _tryCompleteAgreement();
    }

    function proposeAdjustmentSettlement(
        uint256 adjustmentId,
        uint256 providerAmount,
        string calldata note
    ) external inState(AgreementState.Funded) {
        require(msg.sender == client || msg.sender == provider, "Only client or provider");
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];

        require(a.state == AdjustmentState.Disputed, "Adjustment not disputed");
        require(providerAmount <= a.amount, "Provider amount exceeds adjustment amount");

        uint256 clientAmount = a.amount - providerAmount;
        _adjustmentSettlementProposals[adjustmentId] = SettlementProposal({
            exists: true,
            proposer: msg.sender,
            providerAmount: providerAmount,
            note: note,
            proposedAt: block.timestamp
        });

        emit AdjustmentSettlementProposed(adjustmentId, msg.sender, providerAmount, clientAmount, note);
    }

    function acceptAdjustmentSettlement(
        uint256 adjustmentId
    ) external inState(AgreementState.Funded) nonReentrant {
        require(msg.sender == client || msg.sender == provider, "Only client or provider");
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];

        require(a.state == AdjustmentState.Disputed, "Adjustment not disputed");
        SettlementProposal storage proposal = _adjustmentSettlementProposals[adjustmentId];
        require(proposal.exists, "No settlement proposal");
        require(proposal.proposer != msg.sender, "Cannot accept own proposal");

        uint256 pAmount = proposal.providerAmount;
        uint256 cAmount = a.amount - pAmount;

        a.state = AdjustmentState.Settled;
        adjustmentReleasedAmount += pAmount;
        adjustmentRefundedAmount += cAmount;
        proposal.exists = false;

        if (pAmount > 0) _sendPayment(payable(provider), pAmount);
        if (cAmount > 0) _sendPayment(payable(client), cAmount);

        emit AdjustmentSettlementAccepted(adjustmentId, pAmount, cAmount);
        _tryCompleteAgreement();
    }

    function cancelAdjustmentSettlement(
        uint256 adjustmentId
    ) external inState(AgreementState.Funded) {
        _checkAdjustmentId(adjustmentId);
        SettlementProposal storage proposal = _adjustmentSettlementProposals[adjustmentId];
        require(proposal.exists, "No settlement proposal");
        require(proposal.proposer == msg.sender, "Only proposer can cancel");

        proposal.exists = false;
        emit AdjustmentSettlementCancelled(adjustmentId);
    }
}
