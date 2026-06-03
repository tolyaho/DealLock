/*
 * SecurityProofCards — the plain-language trust layer (left column). Four concise
 * cards that explain HOW funds are protected before the user reads any code:
 * where money is held, who can move it, how assets are handled, and where to
 * verify it. Wording is deliberately safe — "inspectable / contract-defined /
 * verifiable on-chain", never "audited" or "formally verified" (DealLock makes no
 * such claim).
 */

import type { ReactNode } from "react";
import {
  LockIcon,
  RulesIcon,
  CoinsIcon,
  CodeGlyph,
} from "./AssetIcons";

type ProofIcon = (p: { className?: string }) => ReactNode;

interface Proof {
  Icon: ProofIcon;
  title: string;
  copy: string;
}

const PROOF: Proof[] = [
  {
    Icon: LockIcon,
    title: "Funds locked on-chain",
    copy: "Funds are held by the escrow contract, not manually by DealLock.",
  },
  {
    Icon: RulesIcon,
    title: "Contract-defined release",
    copy: "Payment moves only through contract-defined actions like approval, refund, or settlement.",
  },
  {
    Icon: CoinsIcon,
    title: "Asset-aware payments",
    copy: "Native ETH and supported ERC-20 assets follow separate funding paths and decimal handling.",
  },
  {
    Icon: CodeGlyph,
    title: "Inspectable source",
    copy: "Key contract logic can be reviewed in the repository and verified on-chain.",
  },
];

export default function SecurityProofCards() {
  return (
    <ul className="dl-sec-proof" role="list">
      {PROOF.map(({ Icon, title, copy }) => (
        <li className="dl-sec-proof-card" key={title}>
          <span className="dl-sec-proof-card__icon">
            <Icon />
          </span>
          <div className="dl-sec-proof-card__body">
            <span className="dl-sec-proof-card__title">{title}</span>
            <span className="dl-sec-proof-card__copy">{copy}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
