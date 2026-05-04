interface GlossaryEntry {
  term: string;
  definition: string;
}

const ESCROW_GLOSSARY: GlossaryEntry[] = [
  {
    term: "Escrow",
    definition:
      "Funds locked by contract rules until the agreement reaches a release, refund, or settlement state. DealLock does not custody the balance.",
  },
  {
    term: "Milestone",
    definition:
      "A discrete unit of work with its own amount, deadline, and delivery evidence. Funds for each milestone are locked until that milestone is approved.",
  },
  {
    term: "Review period",
    definition:
      "The client's decision window after work is submitted. The client can approve, request fixes, or dispute before the provider can claim after expiry.",
  },
  {
    term: "Deadline grace period",
    definition:
      "A short buffer after a milestone deadline before the client can refund it. Allows the provider a final chance to submit late without losing the funds immediately.",
  },
  {
    term: "Paid adjustment",
    definition:
      "An optional extra scope item negotiated after the original agreement. It follows a short path: proposed, accepted, funded, delivered, released.",
  },
  {
    term: "Revision request",
    definition:
      "A cooperative request for fixes inside the original scope. It sends the milestone back to the provider without immediately freezing funds for settlement.",
  },
  {
    term: "Dispute",
    definition:
      "A formal pause that locks the disputed funds. Both parties then need a settlement agreement before those funds can move.",
  },
  {
    term: "Mutual settlement",
    definition:
      "A negotiated split of disputed funds agreed by both the client and provider. One side proposes a provider share; the other accepts.",
  },
  {
    term: "Wallet authority",
    definition:
      "Every important action, such as fund, submit, approve, revise, dispute, or settle, requires a signature from the correct wallet.",
  },
  {
    term: "Payment asset",
    definition:
      "The asset used to fund the agreement, either native ETH or an ERC-20 token like USDC. It is chosen at creation and stays fixed.",
  },
  {
    term: "ERC-20 approval",
    definition:
      "A wallet permission that lets the agreement pull a specific token amount when you fund. Approval alone does not move funds.",
  },
];

interface Props {
  compact?: boolean;
  terms?: string[];
}

export default function ConceptGlossary({ compact = false, terms }: Props) {
  const entries = terms
    ? ESCROW_GLOSSARY.filter((e) => terms.includes(e.term))
    : ESCROW_GLOSSARY;

  return (
    <dl className={`concept-glossary ${compact ? "concept-glossary--compact" : ""}`}>
      {entries.map((entry) => (
        <div key={entry.term} className="concept-glossary-entry">
          <dt className="concept-glossary-term">{entry.term}</dt>
          <dd className="concept-glossary-def">{entry.definition}</dd>
        </div>
      ))}
    </dl>
  );
}
