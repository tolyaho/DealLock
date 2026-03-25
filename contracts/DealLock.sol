// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DealLock {
    enum AgreementState {
        Proposed,
        Accepted,
        Funded,
        Completed,
        Cancelled
    }

    enum MilestoneState {
        Pending,
        Submitted,
        Released,
        Refunded
    }

    struct Milestone {
        string description;
        uint256 amount;
        uint256 deadline;
        string proof;
        uint256 submittedAt;
        MilestoneState state;
    }

    address public immutable client;
    address public immutable provider;
    uint256 public immutable totalAmount;

    uint256 public fundedAmount;
    uint256 public releasedAmount;
    uint256 public refundedAmount;

    AgreementState public agreementState;

    Milestone[] private milestones;

    event AgreementAccepted(address indexed provider);
    event AgreementFunded(address indexed client, uint256 amount);
    event MilestoneSubmitted(uint256 indexed milestoneId, string proof);
    event MilestoneReleased(uint256 indexed milestoneId, uint256 amount);
    event MilestoneRefunded(uint256 indexed milestoneId, uint256 amount);

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

    receive() external payable {
        revert("Use fundAgreement");
    }

    fallback() external payable {
        revert("Invalid call");
    }

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
        return (
            m.description,
            m.amount,
            m.deadline,
            m.proof,
            m.submittedAt,
            m.state
        );
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function isAgreementCompleted() external view returns (bool) {
        return agreementState == AgreementState.Completed;
    }

    function _checkMilestoneId(uint256 milestoneId) internal view {
        require(milestoneId < milestones.length, "Invalid milestone id");
    }

    function _isResolved(MilestoneState state) internal pure returns (bool) {
        return state == MilestoneState.Released || state == MilestoneState.Refunded;
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
        if (releasedAmount + refundedAmount == totalAmount) {
            agreementState = AgreementState.Completed;
        }
    }

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
        require(address(this).balance >= m.amount, "Insufficient contract balance");

        m.state = MilestoneState.Released;
        releasedAmount += m.amount;

        (bool ok, ) = payable(provider).call{value: m.amount}("");
        require(ok, "Transfer failed");

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
        require(address(this).balance >= m.amount, "Insufficient contract balance");

        m.state = MilestoneState.Refunded;
        refundedAmount += m.amount;

        (bool ok, ) = payable(client).call{value: m.amount}("");
        require(ok, "Refund failed");

        emit MilestoneRefunded(milestoneId, m.amount);
        _tryCompleteAgreement();
    }
}