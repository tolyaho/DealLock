// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

/**
 * @title DealLockV5
 * @notice Factory-deployed escrow contract. Identical to DealLockV4 but accepts an explicit
 *         _client constructor argument so that DealLockFactory can deploy it without becoming
 *         the client itself. contractVersion() returns 4 — the frontend and indexer treat
 *         this identically to DealLockV4.
 *
 * @dev    All escrow logic, milestone lifecycle, paid adjustments, grace period, review period,
 *         disputes, and mutual settlement are identical to DealLockV4.
 *         The only constructor difference is that client = _client (not msg.sender).
 */
contract DealLockV5 {
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
        Released,   // 2 — terminal
        Refunded,   // 3 — terminal
        Disputed,   // 4
        Settled     // 5 — terminal (mutual settlement)
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

    // ── Constants ─────────────────────────────────────────────────────────────

    uint256 public constant REFUND_GRACE_PERIOD = 24 seconds;

    // ── Immutables ───────────────────────────────────────────────────────────

    address public immutable client;
    address public immutable provider;
    uint256 public immutable totalAmount;
    uint256 public immutable reviewPeriod;

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

    mapping(uint256 => DisputeInfo) private _adjustmentDisputes;
    mapping(uint256 => SettlementProposal) private _adjustmentSettlementProposals;

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
        address _client,
        address _provider,
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
        return 4;
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

    function getAdjustmentRefundAvailableAt(uint256 id) external view returns (uint256) {
        require(id < _adjustments.length, "Invalid adjustment id");
        return _adjustments[id].deadline + REFUND_GRACE_PERIOD;
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
        return deadline + REFUND_GRACE_PERIOD;
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

    function _safeTransferTo(address payable to, uint256 amount) internal {
        require(address(this).balance >= amount, "Insufficient contract balance");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "Transfer failed");
    }

    // ── Agreement lifecycle ──────────────────────────────────────────────────

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
    ) external onlyProvider inState(AgreementState.Funded) {
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

        _safeTransferTo(payable(provider), amount);

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
    ) external inState(AgreementState.Funded) {
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

        if (pAmount > 0) _safeTransferTo(payable(provider), pAmount);
        if (cAmount > 0) _safeTransferTo(payable(client), cAmount);

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
    ) external payable onlyClient inState(AgreementState.Funded) {
        _checkAdjustmentId(adjustmentId);
        Adjustment storage a = _adjustments[adjustmentId];
        require(a.state == AdjustmentState.Accepted, "Adjustment not accepted");
        require(msg.value == a.amount, "Incorrect funding amount");

        a.state = AdjustmentState.Funded;
        adjustmentFundedAmount += msg.value;

        emit AdjustmentFunded(adjustmentId, msg.value);
    }

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
    ) external onlyProvider inState(AgreementState.Funded) {
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

        _safeTransferTo(payable(provider), amount);

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
    ) external inState(AgreementState.Funded) {
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

        if (pAmount > 0) _safeTransferTo(payable(provider), pAmount);
        if (cAmount > 0) _safeTransferTo(payable(client), cAmount);

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
