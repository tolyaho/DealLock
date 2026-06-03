/*
 * faqData — the approved trust-architecture FAQ copy (docs/prompts/
 * deallock_faq_agent_pack/docs/03_approved_faq_content.md). Answers are verbatim
 * and deliberately careful: "non-custodial design / contract-defined rules /
 * inspectable / verifiable on-chain / review + dispute path" — NEVER "audited",
 * "insured", "regulated", "legally guaranteed", or "risk-free". If the contract
 * scope changes, edit these strings to stay true; don't add claims the project
 * doesn't make.
 *
 * Data-driven on purpose — the accordion maps over this array rather than
 * hand-writing ten JSX blocks, so reordering or editing is a one-line change.
 */

export interface FaqItem {
  /** Stable slug — also drives the aria id pair (button ⇄ panel). */
  id: string;
  question: string;
  answer: string;
}

export const FAQ_TITLE = "Questions before you lock funds";
export const FAQ_SUBTEXT =
  "DealLock is built to make escrow understandable before either side commits.";

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "funds-held",
    question: "Where are the funds held?",
    answer:
      "Funds are locked inside the escrow smart contract for the agreement. DealLock does not manually hold the money or move it from a company account. The contract keeps the funds locked until the release conditions are met.",
  },
  {
    id: "can-release",
    question: "Can DealLock release or take the funds?",
    answer:
      "No. Funds move only through the rules defined in the agreement contract. Actions like funding, approval, release, refund, or settlement are executed through the smart contract flow, not by DealLock manually deciding where the money goes.",
  },
  {
    id: "provider-paid",
    question: "When does the provider get paid?",
    answer:
      "The provider gets paid when the client approves the submitted milestone, or when the contract rules allow release after the review period. This gives the client time to review the work while giving the provider a clear path to payment.",
  },
  {
    id: "client-no-response",
    question: "What happens if the client does not respond?",
    answer:
      "The agreement can include a review period. After the provider submits the work, the client has a defined amount of time to review it. If there is no dispute during that window, the provider can request release according to the contract rules.",
  },
  {
    id: "client-not-satisfied",
    question: "What happens if the client is not satisfied?",
    answer:
      "The client can dispute the submitted milestone during the review period. Disputed funds are not released automatically. The agreement moves into a resolution path, such as mutual settlement, depending on the contract version and enabled features.",
  },
  {
    id: "provider-knows",
    question: "What does the provider know before starting?",
    answer:
      "The provider can see the milestone terms, payment amount, deadline, selected asset, and whether the funds are locked. This avoids the common freelance problem of starting work without knowing if the client has actually funded the job.",
  },
  {
    id: "payment-assets",
    question: "What payment assets does DealLock support?",
    answer:
      "DealLock supports native ETH and configured ERC-20 assets. In the current flow, USDC can be handled as an ERC-20 example with 6 decimals when the configured address matches the supported network. Unsupported tokens should not be treated as safely supported unless they are added to the asset registry.",
  },
  {
    id: "custodial",
    question: "Is DealLock custodial?",
    answer:
      "DealLock is designed as non-custodial escrow. Wallets sign actions, and the smart contract enforces the agreement logic. DealLock provides the interface and workflow, while contract authority remains on-chain.",
  },
  {
    id: "inspect-contract",
    question: "Can I inspect the contract logic?",
    answer:
      "Yes. The important escrow logic should be visible through the Security section and linked to the repository or block explorer. Users can review how funding, asset handling, approval, and release are implemented.",
  },
  {
    id: "legal",
    question: "Does DealLock replace legal agreements?",
    answer:
      "No. DealLock helps automate payment custody and release logic for client-provider work. It does not replace legal advice, written contracts, tax obligations, or compliance requirements for a specific jurisdiction.",
  },
];

/*
 * The section is sized to ONE screen, so the accordion renders only the curated core
 * below, ordered to lead with the questions that reduce the most anxiety: where the
 * money lives, whether DealLock can take it, what happens if the client disappears or
 * rejects the work, when the provider is paid, and where to verify it all. (The first
 * item is open by default — "Where are the funds held?" sets the reassuring frame.)
 *
 * The trimmed items (provider-knows, payment-assets — answered by the Security ERC-20
 * tab, custodial — redundant with funds-held + can-release, legal — a disclaimer) stay
 * in FAQ_ITEMS above; add an id here to surface one (mind the one-screen budget).
 */
export const FEATURED_FAQ_IDS = [
  "funds-held",
  "can-release",
  "client-no-response",
  "client-not-satisfied",
  "provider-paid",
  "inspect-contract",
] as const;

const FAQ_BY_ID = new Map(FAQ_ITEMS.map((item) => [item.id, item]));

export const FEATURED_FAQ_ITEMS: FaqItem[] = FEATURED_FAQ_IDS.map(
  (id) => FAQ_BY_ID.get(id)!,
);
