// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

/**
 * @title DealLockV2
 * @notice Milestone-based escrow with paid adjustments (change orders).
 *
 *         V2 preserves the full original V1 milestone workflow and adds an
 *         append-only paid adjustment system. Each adjustment follows the
 *         lifecycle: Proposed → Accepted → Funded → Submitted → Released.
 *         Expired funded adjustments can be refunded by the client.
 *         Unfunded (Proposed/Accepted) adjustments can be cancelled by either
 *         party to prevent a stuck state.
 *
 * @dev    _tryCompleteAgreement() iterates over all adjustments (O(n)).
 *         This is acceptable at current MVP scale. For high-volume production
 *         use, replace with a pending-adjustment counter.
 */
contract DealLockV2 {
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
        Proposed,   // 0 — client requested, provider has not accepted
        Accepted,   // 1 — provider accepted, awaiting client funding
        Funded,     // 2 — client funded, provider can submit proof
        Submitted,  // 3 — provider submitted proof, awaiting client approval
        Released,   // 4 — client approved, provider paid
        Refunded,   // 5 — deadline passed, client refunded
        Cancelled   // 6 — unfunded adjustment cancelled by either party
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

    function contractVersion() external pure returns (uint8) {
        return 2;
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

    /**
     * @dev Transitions to Completed when:
     *      1. All original milestones are resolved (released + refunded == totalAmount)
     *      2. All adjustments are terminal (Released, Refunded, or Cancelled)
     */
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

    // ── V1 functions (behavior preserved) ────────────────────────────────────

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

    function submitMilestone(
        uint256 milestoneId,
        string calldata proof
    ) external onlyProvider inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        _requirePreviousMilestonesReleased(milestoneId);

        Milestone storage m = milestones[milestoneId];

        require(m.state == MilestoneState.Pending, "Milestone not pending");
        require(block.timestamp <= m.deadline, "Deadline passed");
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

    function refundExpiredMilestone(
        uint256 milestoneId
    ) external onlyClient inState(AgreementState.Funded) {
        _checkMilestoneId(milestoneId);
        _requirePreviousMilestonesResolved(milestoneId);

        Milestone storage m = milestones[milestoneId];

        require(m.state == MilestoneState.Pending, "Milestone not pending");
        require(block.timestamp > m.deadline, "Deadline not passed");

        m.state = MilestoneState.Refunded;
        refundedAmount += m.amount;

        _safeTransferTo(payable(client), m.amount);

        emit MilestoneRefunded(milestoneId, m.amount);
        _tryCompleteAgreement();
    }

    // ── V2 adjustment functions ───────────────────────────────────────────────

    /**
     * @notice Client requests a paid adjustment attached to an existing milestone.
     * @param targetMilestoneId  Which original milestone this extra work relates to.
     * @param description        Public on-chain description. Do not include private data.
     * @param amount             Extra payment in wei.
     * @param deadline           Provider's submission deadline for the adjustment proof.
     */
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

    /**
     * @notice Provider accepts the proposed extra work.
     */
    function acceptAdjustment(
        uint256 adjustmentId
    ) external onlyProvider inState(AgreementState.Funded) {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        require(a.state == AdjustmentState.Proposed, "Adjustment not proposed");

        a.state = AdjustmentState.Accepted;
        emit AdjustmentAccepted(adjustmentId);
    }

    /**
     * @notice Client escrows the extra payment amount.
     * @dev    msg.value must equal adjustment.amount exactly.
     */
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
     * @notice Provider submits proof of completion for the funded adjustment.
     * @param proof  Public on-chain reference (URL, commit SHA, IPFS CID, etc.).
     *               Do not include private credentials or confidential data.
     */
    function submitAdjustment(
        uint256 adjustmentId,
        string calldata proof
    ) external onlyProvider inState(AgreementState.Funded) {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        require(a.state == AdjustmentState.Funded, "Adjustment not funded");
        require(block.timestamp <= a.deadline, "Deadline passed");
        require(bytes(proof).length > 0, "Empty proof");

        a.proof = proof;
        a.submittedAt = block.timestamp;
        a.state = AdjustmentState.Submitted;

        emit AdjustmentSubmitted(adjustmentId, proof);
    }

    /**
     * @notice Client approves the submitted proof and releases extra payment to provider.
     */
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
     * @notice Client refunds a funded adjustment if the provider misses the deadline.
     */
    function refundExpiredAdjustment(
        uint256 adjustmentId
    ) external onlyClient inState(AgreementState.Funded) {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        require(a.state == AdjustmentState.Funded, "Adjustment not funded");
        require(block.timestamp > a.deadline, "Deadline not passed");

        uint256 amount = a.amount;
        a.state = AdjustmentState.Refunded;
        adjustmentRefundedAmount += amount;

        _safeTransferTo(payable(client), amount);

        emit AdjustmentRefunded(adjustmentId, amount);
        _tryCompleteAgreement();
    }

    /**
     * @notice Either party can cancel an unfunded (Proposed or Accepted) adjustment
     *         to prevent a stuck state.
     */
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
