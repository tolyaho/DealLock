/*
 * FAQItem — one accessible accordion row. The trigger is a real <button> inside an
 * <h3> (APG disclosure pattern): it owns `aria-expanded` and `aria-controls`, and
 * the answer is a `role="region"` panel labelled back by the button.
 *
 * Open/close is animated by the grid-rows 0fr→1fr trick (see .dl-faq-item__panel in
 * styles.css) — it transitions height without a magic max-height and collapses to
 * exactly the content size. The collapsed panel is marked `inert`, so its text is
 * removed from the tab order and the accessibility tree while still living in the
 * DOM (which is what lets it animate). Under prefers-reduced-motion the transition
 * is dropped in CSS, so it just snaps.
 *
 * The panel deliberately has NO role="region": the APG accordion pattern advises
 * against it once there are more than ~6 panels (10 here) because each region is a
 * landmark, and a screenful of landmarks is noise. The trigger's aria-expanded +
 * aria-controls already wire the relationship.
 */

import type { FaqItem } from "./faqData";

interface Props {
  item: FaqItem;
  open: boolean;
  onToggle: () => void;
}

export default function FAQItem({ item, open, onToggle }: Props) {
  const buttonId = `faq-trigger-${item.id}`;
  const panelId = `faq-panel-${item.id}`;

  return (
    <li className={`dl-faq-item${open ? " is-open" : ""}`}>
      <h3 className="dl-faq-item__heading">
        <button
          type="button"
          id={buttonId}
          className="dl-faq-item__trigger"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className="dl-faq-item__q">{item.question}</span>
          <span className="dl-faq-item__caret" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 5.5 7 9.5l4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </h3>

      <div id={panelId} className="dl-faq-item__panel" inert={!open}>
        <div className="dl-faq-item__panel-inner">
          <p className="dl-faq-item__a">{item.answer}</p>
        </div>
      </div>
    </li>
  );
}
