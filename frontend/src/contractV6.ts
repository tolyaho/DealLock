import { DEALLOCK_V4_ABI } from "./contractV4.ts";

export const DEALLOCK_V6_EXTENSION_ABI = [
  {
    type: "function",
    name: "DEADLINE_GRACE_PERIOD",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMilestoneSubmissionClosesAt",
    inputs: [{ name: "milestoneId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAdjustmentSubmissionClosesAt",
    inputs: [{ name: "adjustmentId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMilestoneDeadlineExtensionRequest",
    inputs: [{ name: "milestoneId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "active", type: "bool" },
          { name: "requester", type: "address" },
          { name: "requestedAt", type: "uint256" },
          { name: "proposedDeadline", type: "uint256" },
          { name: "reason", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAdjustmentDeadlineExtensionRequest",
    inputs: [{ name: "adjustmentId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "active", type: "bool" },
          { name: "requester", type: "address" },
          { name: "requestedAt", type: "uint256" },
          { name: "proposedDeadline", type: "uint256" },
          { name: "reason", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "requestMilestoneDeadlineExtension",
    inputs: [
      { name: "milestoneId", type: "uint256" },
      { name: "proposedDeadline", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "acceptMilestoneDeadlineExtension",
    inputs: [{ name: "milestoneId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "rejectMilestoneDeadlineExtension",
    inputs: [{ name: "milestoneId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelMilestoneDeadlineExtension",
    inputs: [{ name: "milestoneId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "requestAdjustmentDeadlineExtension",
    inputs: [
      { name: "adjustmentId", type: "uint256" },
      { name: "proposedDeadline", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "acceptAdjustmentDeadlineExtension",
    inputs: [{ name: "adjustmentId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "rejectAdjustmentDeadlineExtension",
    inputs: [{ name: "adjustmentId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelAdjustmentDeadlineExtension",
    inputs: [{ name: "adjustmentId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ── V6 revision requests ──────────────────────────────────────────────────
  {
    type: "function",
    name: "getMilestoneRevision",
    inputs: [{ name: "milestoneId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "exists", type: "bool" },
          { name: "providerDeadlineRequestExists", type: "bool" },
          { name: "requestedBy", type: "address" },
          { name: "revisionRound", type: "uint256" },
          { name: "requestedAt", type: "uint256" },
          { name: "revisionDeadline", type: "uint256" },
          { name: "providerRequestedDeadline", type: "uint256" },
          { name: "providerDeadlineRequestedAt", type: "uint256" },
          { name: "reason", type: "string" },
          { name: "providerDeadlineReason", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMilestoneRevisionCount",
    inputs: [{ name: "milestoneId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMilestoneRevisionResponseDeadline",
    inputs: [{ name: "milestoneId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "requestMilestoneRevision",
    inputs: [
      { name: "milestoneId", type: "uint256" },
      { name: "reason", type: "string" },
      { name: "revisionDeadline", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "requestRevisionDeadline",
    inputs: [
      { name: "milestoneId", type: "uint256" },
      { name: "requestedDeadline", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setRevisionDeadline",
    inputs: [
      { name: "milestoneId", type: "uint256" },
      { name: "newDeadline", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "acceptMilestoneRevision",
    inputs: [{ name: "milestoneId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "rejectMilestoneRevision",
    inputs: [
      { name: "milestoneId", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "escalateMilestoneRevisionToDispute",
    inputs: [
      { name: "milestoneId", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const DEALLOCK_V6_ABI = [...DEALLOCK_V4_ABI, ...DEALLOCK_V6_EXTENSION_ABI] as const;
