import { parseAbi, type Abi } from "viem";

const V1_EVENTS = [
  "event AgreementAccepted(address indexed provider)",
  "event AgreementFunded(address indexed client, uint256 amount)",
  "event MilestoneSubmitted(uint256 indexed milestoneId, string proof)",
  "event MilestoneReleased(uint256 indexed milestoneId, uint256 amount)",
  "event MilestoneRefunded(uint256 indexed milestoneId, uint256 amount)",
] as const;

const ADJUSTMENT_EVENTS = [
  "event AdjustmentRequested(uint256 indexed adjustmentId, uint256 indexed targetMilestoneId, uint256 amount, uint256 deadline, string description)",
  "event AdjustmentAccepted(uint256 indexed adjustmentId)",
  "event AdjustmentFunded(uint256 indexed adjustmentId, uint256 amount)",
  "event AdjustmentSubmitted(uint256 indexed adjustmentId, string proof)",
  "event AdjustmentReleased(uint256 indexed adjustmentId, uint256 amount)",
  "event AdjustmentRefunded(uint256 indexed adjustmentId, uint256 amount)",
  "event AdjustmentCancelled(uint256 indexed adjustmentId)",
] as const;

const V4_EVENTS = [
  "event MilestoneDisputed(uint256 indexed milestoneId, string reason)",
  "event MilestoneAutoReleased(uint256 indexed milestoneId, uint256 amount)",
  "event MilestoneSettlementProposed(uint256 indexed milestoneId, address indexed proposer, uint256 providerAmount, uint256 clientAmount, string note)",
  "event MilestoneSettlementAccepted(uint256 indexed milestoneId, uint256 providerAmount, uint256 clientAmount)",
  "event MilestoneSettlementCancelled(uint256 indexed milestoneId)",
  "event AdjustmentDisputed(uint256 indexed adjustmentId, string reason)",
  "event AdjustmentAutoReleased(uint256 indexed adjustmentId, uint256 amount)",
  "event AdjustmentSettlementProposed(uint256 indexed adjustmentId, address indexed proposer, uint256 providerAmount, uint256 clientAmount, string note)",
  "event AdjustmentSettlementAccepted(uint256 indexed adjustmentId, uint256 providerAmount, uint256 clientAmount)",
  "event AdjustmentSettlementCancelled(uint256 indexed adjustmentId)",
] as const;

const V6_EXTENSION_EVENTS = [
  "event MilestoneDeadlineExtensionRequested(uint256 indexed milestoneId, uint256 oldDeadline, uint256 proposedDeadline, string reason)",
  "event MilestoneDeadlineExtensionAccepted(uint256 indexed milestoneId, uint256 oldDeadline, uint256 newDeadline)",
  "event MilestoneDeadlineExtensionRejected(uint256 indexed milestoneId)",
  "event MilestoneDeadlineExtensionCancelled(uint256 indexed milestoneId)",
  "event AdjustmentDeadlineExtensionRequested(uint256 indexed adjustmentId, uint256 oldDeadline, uint256 proposedDeadline, string reason)",
  "event AdjustmentDeadlineExtensionAccepted(uint256 indexed adjustmentId, uint256 oldDeadline, uint256 newDeadline)",
  "event AdjustmentDeadlineExtensionRejected(uint256 indexed adjustmentId)",
  "event AdjustmentDeadlineExtensionCancelled(uint256 indexed adjustmentId)",
] as const;

const V6_REVISION_EVENTS = [
  "event MilestoneRevisionRequested(uint256 indexed milestoneId, uint256 indexed revisionRound, string reason, uint256 revisionDeadline)",
  "event MilestoneRevisionDeadlineRequested(uint256 indexed milestoneId, uint256 indexed revisionRound, uint256 requestedDeadline, string reason)",
  "event MilestoneRevisionDeadlineUpdated(uint256 indexed milestoneId, uint256 indexed revisionRound, uint256 newDeadline)",
  "event MilestoneRevisionAccepted(uint256 indexed milestoneId, uint256 indexed revisionRound, uint256 finalDeadline)",
  "event MilestoneRevisionRejected(uint256 indexed milestoneId, uint256 indexed revisionRound, string reason)",
  "event MilestoneRevisionEscalated(uint256 indexed milestoneId, uint256 indexed revisionRound, string reason)",
] as const;

export const DEALLOCK_V1_EVENTS = parseAbi([...V1_EVENTS]);
export const DEALLOCK_V2_EVENTS = parseAbi([...V1_EVENTS, ...ADJUSTMENT_EVENTS]);
export const DEALLOCK_V3_EVENTS = DEALLOCK_V2_EVENTS;
export const DEALLOCK_V4_EVENTS = parseAbi([...V1_EVENTS, ...ADJUSTMENT_EVENTS, ...V4_EVENTS]);
export const DEALLOCK_V5_EVENTS = DEALLOCK_V4_EVENTS;
export const DEALLOCK_V6_EVENTS = parseAbi([...V1_EVENTS, ...ADJUSTMENT_EVENTS, ...V4_EVENTS, ...V6_EXTENSION_EVENTS, ...V6_REVISION_EVENTS]);

export function eventAbiForVersion(version: number): Abi {
  if (version === 6) return DEALLOCK_V6_EVENTS;
  if (version === 4 || version === 5) return DEALLOCK_V4_EVENTS;
  if (version === 2 || version === 3) return DEALLOCK_V2_EVENTS;
  return DEALLOCK_V1_EVENTS;
}

export const DEALLOCK_FACTORY_EVENTS = parseAbi([
  "event AgreementCreated(address indexed agreement, address indexed client, address indexed provider, uint256 chainId, uint256 contractVersion, uint256 milestoneCount, uint256 totalAmount, uint256 reviewPeriod, bytes32 metadataHash)",
]);

export const DEALLOCK_FACTORY_V2_EVENTS = parseAbi([
  "event AgreementCreated(address indexed agreement, address indexed client, address indexed provider, uint256 chainId, uint256 contractVersion, address paymentToken, uint256 milestoneCount, uint256 totalAmount, uint256 reviewPeriod, bytes32 metadataHash)",
]);

export const DEALLOCK_FACTORY_V3_EVENTS = DEALLOCK_FACTORY_V2_EVENTS;
