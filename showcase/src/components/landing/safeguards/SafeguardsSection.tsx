/*
 * SafeguardsSection — "What if something goes wrong?" The panel between the workflow
 * (the happy path) and the Security code proof. A grid of plain-language cards, each
 * one a REAL contract exit path (see safeguardsData.ts), on the same lit satin-metal
 * wall as every other section. Fades/rises in on first scroll into view (useInView,
 * disabled under reduced-motion by the scoped CSS guard).
 */
import type { ReactNode } from "react";
import { useInView } from "../security/useInView";
import MetalSheen from "../MetalSheen";
import MetalIconDisc from "../MetalIconDisc";
import { LockIcon, CoinsIcon } from "../security/AssetIcons";
import { ClockIcon, HourglassIcon, ReviseIcon, SplitIcon } from "./SafeguardIcons";
import {
  SAFEGUARDS,
  SAFEGUARDS_EYEBROW,
  SAFEGUARDS_SUB,
  SAFEGUARDS_TITLE,
  type SafeguardIconKey,
} from "./safeguardsData";

const ICONS: Record<SafeguardIconKey, (p: { className?: string }) => ReactNode> = {
  deadline: ClockIcon,
  silence: HourglassIcon,
  revise: ReviseIcon,
  dispute: SplitIcon,
  lock: LockIcon,
  fee: CoinsIcon,
};

export default function SafeguardsSection() {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.12 });

  return (
    <section
      id="safeguards"
      ref={ref}
      className={`dl-safe${inView ? " is-in" : ""}`}
      aria-labelledby="dl-safe-title"
    >
      <div className="dl-safe__bg" aria-hidden="true" data-parallax="0.04">
        <MetalSheen />
      </div>

      <div className="dl-safe__inner">
        <header className="dl-safe__header">
          <span className="dl-safe__eyebrow">{SAFEGUARDS_EYEBROW}</span>
          <h2 id="dl-safe-title" className="dl-safe__title">
            {SAFEGUARDS_TITLE}
          </h2>
          <p className="dl-safe__sub">{SAFEGUARDS_SUB}</p>
        </header>

        <ul className="dl-safe__grid" role="list">
          {SAFEGUARDS.map((s) => {
            const Icon = ICONS[s.icon];
            return (
              <li className="dl-safe-card" key={s.title}>
                <MetalIconDisc className="dl-safe-card__icon">
                  <Icon />
                </MetalIconDisc>
                <div className="dl-safe-card__body">
                  <span className="dl-safe-card__title">{s.title}</span>
                  <span className="dl-safe-card__copy">{s.copy}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
