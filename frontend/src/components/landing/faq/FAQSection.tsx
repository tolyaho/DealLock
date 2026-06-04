/*
 * FAQSection — the final trust layer below the Security section. Answers the
 * practical questions a client or provider has before they lock funds.
 *
 * Composition (reference board: left intro, right accordion):
 *   left  — eyebrow / title / subtext / <FAQTrustVisual/> (soft object + trust note)
 *   right — <FAQAccordion/> (single-open, first item open)
 * On ≤920px the grid collapses to one column (intro on top, accordion below).
 *
 * Matte off-white / frosted-glass / restrained lilac, scoped via the --fq-* token
 * layer in styles.css (mirrors the Security section's --sc-*). Fades/rises in once
 * on first scroll into view (useInView; disabled under reduced-motion).
 */

import { FAQ_SUBTEXT, FAQ_TITLE } from "./faqData";
import FAQAccordion from "./FAQAccordion";
import FAQTrustVisual from "./FAQTrustVisual";
import { useInView } from "../security/useInView";
import MetalOrbitLines from "../MetalOrbitLines";
import MetalSheen from "../MetalSheen";

export default function FAQSection() {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.12 });

  return (
    <section
      id="faq"
      ref={ref}
      className={`dl-faq${inView ? " is-in" : ""}`}
      aria-labelledby="dl-faq-title"
    >
      <div className="dl-faq__bg" aria-hidden="true" data-parallax="0.04">
        {/* Soft specular sweeps + the orbital guide low in the final section — keeps   */}
        {/* the closing panel on the same lit satin-metal surface as the rest.          */}
        <MetalSheen />
        <MetalOrbitLines className="dl-orbit--faq" />
      </div>

      <div className="dl-faq__inner">
        <div className="dl-faq__layout">
          <div className="dl-faq__intro">
            <span className="dl-faq__eyebrow">FAQ</span>
            <h2 id="dl-faq-title" className="dl-faq__title">
              {FAQ_TITLE}
            </h2>
            <p className="dl-faq__sub">{FAQ_SUBTEXT}</p>
            <FAQTrustVisual />
          </div>

          <div className="dl-faq__panel">
            <FAQAccordion />
          </div>
        </div>
      </div>
    </section>
  );
}
