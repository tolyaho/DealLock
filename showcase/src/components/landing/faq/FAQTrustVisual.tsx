/*
 * FAQTrustVisual — the left-column anchor for the FAQ. It shows the actual escrow
 * LIFECYCLE (funds locked → work submitted → review → released or disputed) as a
 * compact stepper, so the visual is DealLock-specific (not a generic padlock) and
 * directly mirrors what the questions are about — then one safe-wording trust line.
 *
 * Each step is marked by a small raised metal-disc icon (the shared MetalIconDisc),
 * so the stepper reads as machined silver hardware and is faster to parse. CSS/SVG
 * only (this package ships just react + a font); the rail is decorative.
 */

import type { ReactNode } from "react";
import MetalIconDisc from "../MetalIconDisc";

interface IconProps {
  className?: string;
}

// Lifecycle marks — thin line glyphs (stroke 1.6, 24 grid) matching the security set.
function LockClosedIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="4.5" y="11" width="15" height="9" rx="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon({ className }: IconProps) {
  // Work submitted — proof uploaded into the agreement.
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 15V4m0 0L8 8m4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ReviewIcon({ className }: IconProps) {
  // Review period — inspection before release.
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m16 16 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="m8.5 11 1.8 1.8L14 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReleaseOpenIcon({ className }: IconProps) {
  // Released (or disputed) — the lock opens under the contract's rules.
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="4.5" y="11" width="15" height="9" rx="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11V8a4 4 0 0 1 7.5-1.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const LIFECYCLE: { label: string; Icon: (p: IconProps) => ReactNode }[] = [
  { label: "Funds locked", Icon: LockClosedIcon },
  { label: "Work submitted", Icon: UploadIcon },
  { label: "Review period", Icon: ReviewIcon },
  { label: "Released or disputed", Icon: ReleaseOpenIcon },
];

export default function FAQTrustVisual() {
  return (
    <div className="dl-faq-trust">
      <span className="dl-faq-trust__eyebrow">Escrow lifecycle</span>

      <ol className="dl-faq-lifecycle" role="list">
        {LIFECYCLE.map(({ label, Icon }, i) => (
          <li
            key={label}
            className={`dl-faq-lifecycle__step${i === LIFECYCLE.length - 1 ? " is-end" : ""}`}
          >
            <MetalIconDisc className="dl-faq-lifecycle__disc">
              <Icon />
            </MetalIconDisc>
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
