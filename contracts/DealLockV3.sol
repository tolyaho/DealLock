// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

/**
 * @title DealLockV3
 * @notice Milestone-based escrow with paid adjustments and a fair refund grace period.
 *
 *         V3 builds on V2 and adds a 24-second grace period before any refund becomes
 *         available. This protects providers from normal Ethereum block inclusion delay:
 *         a provider who submits proof just before a deadline may have their transaction
 *         mined slightly after the deadline due to mempool latency. With a grace period
 *         of 2 × 12-second slots, the client cannot immediately grab a refund the moment
 *         the clock ticks past the deadline.
 *
 *         Key behavioral changes from V2:
 *         - Refund eligibility: deadline + REFUND_GRACE_PERIOD (not deadline + 1 second).
 *         - submitMilestone and submitAdjustment no longer enforce a deadline — the provider
 *           can submit until the state changes (via a concurrent refund). This creates a clean
 *           race: whichever transaction is mined first after refund availability wins.
 *
 * @dev    contractVersion() returns uint256(3).
 *         REFUND_GRACE_PERIOD is a public constant (2 × 12s slot time = 24s).
 *         _tryCompleteAgreement() is O(n) over adjustments — acceptable at MVP scale.
 */
contract DealLockV3 {
    // ── Enums ────────────────────────────────────────────────────────────────

    enum AgreementState {
        Proposed,   // 0
        Accepted,   // 1
        Funded,     // 2
        Completed,  // 3
        Cancelled   // 4
    }

    enum MilestoneState {
        Pending,    // 0
        Submitted,  // 1
        Released,   // 2
        Refunded    // 3
    }

    enum AdjustmentState {
        Proposed,   // 0
        Accepted,   // 1
        Funded,     // 2
        Submitted,  // 3
        Released,   // 4
        Refunded,   // 5
        Cancelled   // 6
    }

    // ── Structs ──────────────────────────────────────────────────────────────

    struct Milestone {
        string description;
        uint256 amount;
        uint256 deadline;
        string proof;
        uint256 submittedAt;
        MilestoneState state;
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

    // ── Constants ─────────────────────────────────────────────────────────────

    /**
     * @notice Grace period before a client refund becomes available after a deadline.
     *         Equals 2 × the average Ethereum PoS slot time (2 × 12s = 24s).
     *         A client refund is available only at: deadline + REFUND_GRACE_PERIOD.
     */
    uint256 public constant REFUND_GRACE_PERIOD = 24 seconds;

    // ── Immutables ───────────────────────────────────────────────────────────

    address public immutable client;
    address public immutable provider;
    uint256 public immutable totalAmount;

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

    // ── Events (original V1) ──────────────────────────────────────────────────

    event AgreementAccepted(address indexed provider);
    event AgreementFunded(address indexed client, uint256 amount);
    event MilestoneSubmitted(uint256 indexed milestoneId, string proof);
    event MilestoneReleased(uint256 indexed milestoneId, uint256 amount);
    event MilestoneRefunded(uint256 indexed milestoneId, uint256 amount);

    // ── Events (adjustments — same as V2) ────────────────────────────────────

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

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address provider_,
        string[] memory descriptions,
        uint256[] memory amounts,
        uint256[] memory deadlines
    ) {
        require(provider_ != address(0), "Invalid provider");
        require(descriptions.length > 0, "No milestones");
        require(
            descriptions.length == amounts.length &&
                amounts.length == deadlines.length,
            "Array length mismatch"
        );

        client = msg.sender;
        provider = provider_;
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
                    state: MilestoneState.Pending
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
        return 3;
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

    /**
     * @notice Returns the earliest timestamp at which the client may refund
     *         a pending milestone: deadline + REFUND_GRACE_PERIOD.
     */
    function getMilestoneRefundAvailableAt(uint256 id) external view returns (uint256) {
        require(id < milestones.length, "Invalid milestone id");
        return milestones[id].deadline + REFUND_GRACE_PERIOD;
    }

    /**
     * @notice Returns the earliest timestamp at which the client may refund
     *         a funded adjustment: deadline + REFUND_GRACE_PERIOD.
     */
    function getAdjustmentRefundAvailableAt(uint256 id) external view returns (uint256) {
        require(id < _adjustments.length, "Invalid adjustment id");
        return _adjustments[id].deadline + REFUND_GRACE_PERIOD;
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
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

    function _isResolved(MilestoneState state) internal pure returns (bool) {
        return state == MilestoneState.Released || state == MilestoneState.Refunded;
    }

    function _isAdjustmentTerminal(AdjustmentState state) internal pure returns (bool) {
        return
            state == AdjustmentState.Released ||
            state == AdjustmentState.Refunded ||
            state == AdjustmentState.Cancelled;
    }

    /**
     * @notice Returns the earliest block.timestamp at which a refund becomes available.
     * @dev    refundAvailableAt = deadline + REFUND_GRACE_PERIOD.
     */
    function _refundAvailableAt(uint256 deadline) internal pure returns (uint256) {
        return deadline + REFUND_GRACE_PERIOD;
    }

    function _requirePreviousMilestonesReleased(uint256 milestoneId) internal view {
        for (uint256 i = 0; i < milestoneId; i++) {
            require(
                milestones[i].state == MilestoneState.Released,
                "Previous milestone not released"
            );
        }
    }

    function _requirePreviousMilestonesResolved(uint256 milestoneId) internal view {
        for (uint256 i = 0; i < milestoneId; i++) {
            require(
                _isResolved(milestones[i].state),
                "Previous milestone not resolved"
            );
        }
    }

    function _tryCompleteAgreement() internal {
        if (releasedAmount + refundedAmount != totalAmount) return;
        for (uint256 i = 0; i < _adjustments.length; i++) {
            if (!_isAdjustmentTerminal(_adjustments[i].state)) return;
        }
        agreementState = AgreementState.Completed;
    }

    function _safeTransferTo(address payable to, uint256 amount) internal {
        require(address(this).balance >= amount, "Insufficient contract balance");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "Transfer failed");
    }

    // ── Agreement lifecycle (V1 behavior preserved) ───────────────────────────

    function acceptAgreement() external onlyProvider inState(AgreementState.Proposed) {
        agreementState = AgreementState.Accepted;
        emit AgreementAccepted(provider);
    }

    function fundAgreement() external payable onlyClient inState(AgreementState.Accepted) {
        require(msg.value == totalAmount, "Incorrect funding amount");
        fundedAmount = msg.value;
        agreementState = AgreementState.Funded;
        emit AgreementFunded(client, msg.value);
    }

    /**
     * @notice Provider submits proof for a pending milestone.
     * @dev    V3: no hard deadline on submission. The provider may submit at any time
     *         while the milestone is still Pending. After deadline + REFUND_GRACE_PERIOD
     *         a race begins: whichever transaction (submit or refund) is mined first wins.
     */
    function submitMilestone(
        uint256 milestoneId,
        string calldata proof
    ) external onlyProvider inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        _requirePreviousMilestonesReleased(milestoneId);

        Milestone storage m = milestones[milestoneId];

        require(m.state == MilestoneState.Pending, "Milestone not pending");
        require(bytes(proof).length > 0, "Empty proof");

        m.proof = proof;
        m.submittedAt = block.timestamp;
        m.state = MilestoneState.Submitted;

        emit MilestoneSubmitted(milestoneId, proof);
    }

    function approveMilestone(
        uint256 milestoneId
    ) external onlyClient inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        _requirePreviousMilestonesReleased(milestoneId);

        Milestone storage m = milestones[milestoneId];

        require(m.state == MilestoneState.Submitted, "Milestone not submitted");

        m.state = MilestoneState.Released;
        releasedAmount += m.amount;

        _safeTransferTo(payable(provider), m.amount);

        emit MilestoneReleased(milestoneId, m.amount);
        _tryCompleteAgreement();
    }

    /**
     * @notice Client refunds a pending milestone after the grace window has passed.
     * @dev    V3: refund is available only at block.timestamp >= deadline + REFUND_GRACE_PERIOD.
     *         This gives the provider 24 extra seconds after the deadline to have their
     *         already-broadcast transaction mined.
     */
    function refundExpiredMilestone(
        uint256 milestoneId
    ) external onlyClient inState(AgreementState.Funded) {
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

        _safeTransferTo(payable(client), m.amount);

        emit MilestoneRefunded(milestoneId, m.amount);
        _tryCompleteAgreement();
    }

    // ── Paid adjustment functions (V2 behavior + V3 grace period) ────────────

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
    ) external payable onlyClient inState(AgreementState.Funded) {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        require(a.state == AdjustmentState.Accepted, "Adjustment not accepted");
        require(msg.value == a.amount, "Incorrect funding amount");

        a.state = AdjustmentState.Funded;
        adjustmentFundedAmount += msg.value;

        emit AdjustmentFunded(adjustmentId, msg.value);
    }

    /**
     * @notice Provider submits proof for a funded adjustment.
     * @dev    V3: no hard deadline on submission. Provider may submit at any time while
     *         the adjustment is still Funded. After deadline + REFUND_GRACE_PERIOD a race
     *         begins.
     */
    function submitAdjustment(
        uint256 adjustmentId,
        string calldata proof
    ) external onlyProvider inState(AgreementState.Funded) {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        require(a.state == AdjustmentState.Funded, "Adjustment not funded");
        require(bytes(proof).length > 0, "Empty proof");

        a.proof = proof;
        a.submittedAt = block.timestamp;
        a.state = AdjustmentState.Submitted;

        emit AdjustmentSubmitted(adjustmentId, proof);
    }

    function approveAdjustment(
        uint256 adjustmentId
    ) external onlyClient inState(AgreementState.Funded) {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        require(a.state == AdjustmentState.Submitted, "Adjustment not submitted");

        uint256 amount = a.amount;
        a.state = AdjustmentState.Released;
        adjustmentReleasedAmount += amount;

        _safeTransferTo(payable(provider), amount);

        emit AdjustmentReleased(adjustmentId, amount);
        _tryCompleteAgreement();
    }

    /**
     * @notice Client refunds a funded adjustment after the grace window has passed.
     * @dev    V3: refund available only at block.timestamp >= deadline + REFUND_GRACE_PERIOD.
     */
    function refundExpiredAdjustment(
        uint256 adjustmentId
    ) external onlyClient inState(AgreementState.Funded) {
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

        _safeTransferTo(payable(client), amount);

        emit AdjustmentRefunded(adjustmentId, amount);
        _tryCompleteAgreement();
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
}
