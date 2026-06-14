/*
 * SecuritySection — "Readable on-chain security." Plain-language trust first, then
 * inspectable code as proof. The transparency panel on the shared matte wall,
 * below the workflow.
 *
 * Composition:
 *   header  — eyebrow / headline / subcopy (centred; subcopy types in)
 *   body    — left:  <SecurityProofCards/>  (human-readable security proof)
 *             right: <CodePanel/> (concept tabs: Native ETH / ERC-20 / Release)
 *                    + <RepoCta/> (GitHub repo wrapper)
 *
 * Light theme only (a scoped dark toggle was removed by request; the --sc-* token
 * layer in styles.css makes it easy to reintroduce). The section fades/rises in
 * once on first scroll into view (see useInView; disabled under reduced-motion).
 */

import { useState } from "react";
import { REPO_URL, SECURITY_TABS, type TabKey } from "./securityData";
import CodePanel from "./CodePanel";
import SecurityProofCards from "./SecurityProofCards";
import RepoCta from "./RepoCta";
import { useInView } from "./useInView";
import TypewriterText from "../workflow/TypewriterText";
import MetalSheen from "../MetalSheen";
import SecurityShieldSpline from "../SecurityShieldSpline";

// Subtitle types in (like the workflow subtitle) once the section scrolls into
// view — a short beat after the title fades up. rAF-driven, so it stays smooth.
const SEC_SUB =
  "DealLock keeps escrow logic transparent. Review how funds are locked, released, and handled across supported assets.";
const SEC_SUB_SPEED = 14;
const SEC_SUB_DELAY = 460;

interface Props {
  /** Public repository URL; defaults to the placeholder in securityData. */
  repoUrl?: string;
}

export default function SecuritySection({ repoUrl = REPO_URL }: Props) {
  const [tab, setTab] = useState<TabKey>("nativeEth");
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.16 });

  return (
    <section
      id="security"
      ref={ref}
      className={`dl-sec${inView ? " is-in" : ""}`}
      aria-labelledby="dl-sec-title"
    >
      <div className="dl-sec__bg" aria-hidden="true" data-parallax="0.04">
        {/* Soft specular sweeps so the security panel sits on lit satin metal too. */}
        <MetalSheen />
      </div>

      <div className="dl-sec__inner">
        <header className="dl-sec__header">
          <div className="dl-sec__intro">
            <SecurityShieldSpline />
            <span className="dl-sec__eyebrow">Security</span>
            <h2 id="dl-sec-title" className="dl-sec__title">
              Readable On-Chain Security
            </h2>
            <p className="dl-sec__sub">
              <TypewriterText
                text={SEC_SUB}
                start={inView}
                speed={SEC_SUB_SPEED}
                startDelay={SEC_SUB_DELAY}
              />
            </p>
          </div>
        </header>

        <div className="dl-sec__body">
          <SecurityProofCards />
          <div className="dl-sec__main">
            <CodePanel tabs={SECURITY_TABS} activeKey={tab} onSelect={setTab} />
            <RepoCta repoUrl={repoUrl} />
          </div>
        </div>
      </div>
    </section>
  );
}
