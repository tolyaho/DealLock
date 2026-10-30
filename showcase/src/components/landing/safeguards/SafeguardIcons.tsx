/*
 * SafeguardIcons — line glyphs for the Safeguards section, matching the AssetIcons
 * house style (24×24 viewBox, 1.6 stroke, currentColor) so they inherit the metal
 * disc's colour and the section's accent on hover.
 */
interface IconProps {
  className?: string;
}

/** Clock — a milestone deadline. */
export function ClockIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Hourglass — the review window running out. */
export function HourglassIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M7 4h10M7 20h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7.5 4c0 4 4.5 5.2 4.5 8s-4.5 4-4.5 8M16.5 4c0 4-4.5 5.2-4.5 8s4.5 4 4.5 8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** Circular arrows — a revision / resubmission. */
export function ReviseIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M19 5.5v4h-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18.5v-4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.4 9.3A7 7 0 0 0 6.1 7.8M5.6 14.7a7 7 0 0 0 12.3 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Two diverging arrows — a settlement split agreed by both sides. */
export function SplitIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 4v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 9c0 2-1.5 3-4 3.5S4 14 4 16.5M12 9c0 2 1.5 3 4 3.5s4 1.5 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M2 16.5h4M2 20h4M18 16.5h4M18 20h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
