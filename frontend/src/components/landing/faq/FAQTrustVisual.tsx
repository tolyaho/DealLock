/*
 * FAQTrustVisual — the left-column anchor for the FAQ. It shows the actual escrow
 * LIFECYCLE (funds locked → work submitted → review → released or disputed) as a
 * compact stepper, so the visual is DealLock-specific (not a generic padlock) and
 * directly mirrors what the questions are about — then one safe-wording trust line.
 *
 * CSS/SVG only (this package ships just react + a font). The stepper labels are real
 * readable text; only the dots/rail are decorative.
 */

const LIFECYCLE = [
  "Funds locked",
  "Work submitted",
  "Review period",
  "Released or disputed",
];

export default function FAQTrustVisual() {
  return (
    <div className="dl-faq-trust">
      <span className="dl-faq-trust__eyebrow">Escrow lifecycle</span>

      <ol className="dl-faq-lifecycle" role="list">
        {LIFECYCLE.map((label, i) => (
          <li
            key={label}
            className={`dl-faq-lifecycle__step${i === LIFECYCLE.length - 1 ? " is-end" : ""}`}
          >
            <span className="dl-faq-lifecycle__dot" aria-hidden="true" />
            <span className="dl-faq-lifecycle__label">{label}</span>
          </li>
        ))}
      </ol>

      <p className="dl-faq-trust__note-copy">
        Non-custodial by design — funds stay locked in the agreement contract and move
        only by its rules.
      </p>
    </div>
  );
}
