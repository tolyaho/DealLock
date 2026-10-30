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
      "Every agreement sets a review window — anywhere from an hour to two weeks. After the provider submits, the client has that window to approve or dispute. If the client does nothing before it closes, the provider can claim the payment themselves, so an unresponsive client can't lock the funds up.",
  },
  {
    id: "client-not-satisfied",
    question: "What happens if the client is not satisfied?",
    answer:
      "The client can dispute a submitted milestone during the review window. Disputed funds are frozen — they don't release and can't be refunded unilaterally. They move only when both parties accept a proposed split: there is no automatic winner and no outside arbiter, so resolving a dispute takes agreement from both sides.",
  },
  {
    id: "fees",
    question: "Does DealLock take a fee?",
    answer:
      "No. There is no platform fee anywhere in the contracts. When a milestone is approved the full amount goes to the provider, and a mutual settlement splits the exact milestone amount between the two sides with nothing skimmed off.",
  },
  {
    id: "refund-deadline",
    question: "What if the provider misses the deadline?",
    answer:
      "If a milestone's deadline passes with nothing submitted, the client can refund that milestone from escrow after a short grace window. Once work has been submitted it can't be refunded away — it has to be approved, disputed, or claimed after the review window.",
  },
  {
    id: "demo-real-money",
    question: "Does the interactive demo move real money?",
    answer:
      "No. The demo on this page is a deterministic, browser-only simulation — no wallet, no account, no backend, and no blockchain transaction. Every amount and event is illustrative and labelled “Simulated”; it shows how the real contracts behave without touching any funds.",
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
  "provider-paid",
  "client-no-response",
  "client-not-satisfied",
  "fees",
  "demo-real-money",
  "inspect-contract",
] as const;

const FAQ_BY_ID = new Map(FAQ_ITEMS.map((item) => [item.id, item]));

export const FEATURED_FAQ_ITEMS: FaqItem[] = FEATURED_FAQ_IDS.map(
  (id) => FAQ_BY_ID.get(id)!,
);
