/*
 * SplineObjectSlot — a premium metal "object stage" that holds a hand-built
 * silver sculpture today and is ready to mount a real Spline scene later.
 *
 * It is intentionally NOT a flat icon: a soft radial glow sits behind a brushed
 * aluminum tile (machined rim + top light-catch + lower shade + faint concentric
 * pattern), and a per-concept silver object floats on it. Swap the inner <svg>
 * for a <Spline .../> mount when scenes land — the framing stays.
 *
 * One conceptual object per section so the empty pages don't read as the same
 * template with swapped text (activity = pulse ring, messages = chat orb, …).
 */
import { useId } from "react";

export type SplineSlotType =
  | "activity"
  | "messages"
  | "counterparties"
  | "statistics"
  | "wallet"
  | "settings"
  | "designlab";

interface Props {
  type: SplineSlotType;
  /** `lg` is the marquee size for a hero stage; `md` (default) for tighter panels. */
  size?: "md" | "lg";
}

/** The graphite stroke + silver fills every object shares (cold silver only). */
const STROKE = "#6c716a";

function ObjectArt({ type, uid }: { type: SplineSlotType; uid: string }) {
  const face = `url(#${uid}-face)`;
  const node = `url(#${uid}-node)`;
  const defs = (
    <defs>
      <linearGradient id={`${uid}-face`} x1="40" y1="10" x2="40" y2="70" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#fdfdfc" />
        <stop offset="0.5" stopColor="#e9eae4" />
        <stop offset="1" stopColor="#cfd1c8" />
      </linearGradient>
      <radialGradient id={`${uid}-node`} cx="0.4" cy="0.35" r="0.75">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.55" stopColor="#dfe1da" />
        <stop offset="1" stopColor="#b7b9b0" />
      </radialGradient>
    </defs>
  );

  let art: React.ReactNode = null;
  switch (type) {
    case "activity": // event pulse / timeline ring
      art = (
        <>
          <circle cx="40" cy="40" r="30" stroke={STROKE} strokeOpacity="0.32" strokeWidth="2" />
          <circle cx="40" cy="40" r="20" stroke={STROKE} strokeOpacity="0.6" strokeWidth="2" />
          <circle cx="40" cy="40" r="9" fill={node} stroke={STROKE} strokeWidth="1.5" />
          <circle cx="61" cy="26" r="4.5" fill={node} stroke={STROKE} strokeWidth="1.5" />
        </>
      );
      break;
    case "messages": // secure chat orb / metallic bubble
      art = (
        <>
          <path
            d="M16 23h42a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H31l-9 8v-8h-6a6 6 0 0 1-6-6V29a6 6 0 0 1 6-6Z"
            fill={face}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M24 35h30M24 43h20" stroke={STROKE} strokeOpacity="0.5" strokeWidth="2" />
          <circle cx="60" cy="20" r="5.5" fill={node} stroke={STROKE} strokeWidth="1.5" />
        </>
      );
      break;
    case "counterparties": // linked identity nodes
      art = (
        <>
          <line x1="27" y1="46" x2="53" y2="46" stroke={STROKE} strokeWidth="2" />
          <path d="M34 31 30 39M46 31 50 39" stroke={STROKE} strokeOpacity="0.5" strokeWidth="2" />
          <circle cx="26" cy="46" r="12" fill={face} stroke={STROKE} strokeWidth="2" />
          <circle cx="54" cy="46" r="12" fill={face} stroke={STROKE} strokeWidth="2" />
          <circle cx="40" cy="24" r="9" fill={node} stroke={STROKE} strokeWidth="2" />
        </>
      );
      break;
    case "statistics": // metallic analytics ring + bars
      art = (
        <>
          <circle cx="40" cy="40" r="28" stroke={STROKE} strokeOpacity="0.32" strokeWidth="2" />
          <rect x="30" y="40" width="6" height="14" rx="2" fill={face} stroke={STROKE} strokeWidth="1.5" />
          <rect x="37.5" y="31" width="6" height="23" rx="2" fill={node} stroke={STROKE} strokeWidth="1.5" />
          <rect x="45" y="36" width="6" height="18" rx="2" fill={face} stroke={STROKE} strokeWidth="1.5" />
        </>
      );
      break;
    case "wallet": // wallet vault / lock medallion
      art = (
        <>
          <circle cx="40" cy="40" r="28" fill={face} stroke={STROKE} strokeWidth="2" />
          <circle cx="40" cy="40" r="19" stroke={STROKE} strokeOpacity="0.38" strokeWidth="1.5" />
          <circle cx="40" cy="37" r="5" fill={node} stroke={STROKE} strokeWidth="1.5" />
          <path d="M40 41v8" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
        </>
      );
      break;
    case "settings": // control module / gear
      art = (
        <>
          {Array.from({ length: 8 }).map((_, i) => (
            <rect
              key={i}
              x="37"
              y="9"
              width="6"
              height="10"
              rx="2"
              fill={face}
              stroke={STROKE}
              strokeWidth="1.2"
              transform={`rotate(${i * 45} 40 40)`}
            />
          ))}
          <circle cx="40" cy="40" r="20" fill={face} stroke={STROKE} strokeWidth="2" />
          <circle cx="40" cy="40" r="8" fill={node} stroke={STROKE} strokeWidth="1.5" />
        </>
      );
      break;
    case "designlab": // material cube / faceted diamond
      art = (
        <>
          <path d="M22 32 40 14l18 18-18 32Z" fill={face} stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
          <path
            d="M22 32h36M40 14 31 32l9 32M40 14l9 18-9 32"
            stroke={STROKE}
            strokeOpacity="0.5"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </>
      );
      break;
  }

  return (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
      {defs}
      {art}
    </svg>
  );
}

export function SplineObjectSlot({ type, size = "md" }: Props) {
  const uid = useId().replace(/[:]/g, "");
  return (
    <div className={`dl-slot${size === "lg" ? " dl-slot--lg" : ""}`} aria-hidden="true">
      <span className="dl-slot__glow" />
      <span className="dl-slot__tile">
        <span className="dl-slot__obj">
          <ObjectArt type={type} uid={`${uid}-${type}`} />
        </span>
      </span>
      {import.meta.env.DEV && <span className="dl-slot__dev">Spline object slot</span>}
    </div>
  );
}
