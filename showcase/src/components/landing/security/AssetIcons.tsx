/*
 * AssetIcons.tsx — small inline SVG marks for the Security section. SVG (not
 * emoji) per the design system; all use currentColor + thin strokes so they sit
 * quietly inside pills/buttons and inherit the active accent colour.
 */

interface IconProps {
  className?: string;
}

export function EthIcon({ className }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 2.5 6 12l6 3.5L18 12 12 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 13.4 12 21l6-7.6-6 3.5-6-3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}

export function UsdcIcon({ className }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v10M14.2 9.1c-.5-.7-1.3-1-2.2-1-1.3 0-2.3.7-2.3 1.8 0 2.6 4.8 1.2 4.8 3.9 0 1.2-1.1 1.9-2.4 1.9-1 0-1.9-.4-2.4-1.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Erc20Icon({ className }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 2.6 20 7.3v9.4L12 21.4 4 16.7V7.3L12 2.6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 7.4 16 9.7v4.6L12 16.6 8 14.3V9.7L12 7.4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" opacity="0.55" />
    </svg>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GithubIcon({ className }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2.2A9.8 9.8 0 0 0 8.9 21.3c.49.09.67-.21.67-.47v-1.8c-2.73.59-3.3-1.16-3.3-1.16-.45-1.13-1.1-1.43-1.1-1.43-.9-.61.07-.6.07-.6 1 .07 1.52 1.02 1.52 1.02.88 1.51 2.32 1.07 2.88.82.09-.64.35-1.07.63-1.32-2.18-.25-4.47-1.09-4.47-4.85 0-1.07.38-1.95 1.02-2.64-.1-.25-.44-1.25.1-2.6 0 0 .83-.27 2.72 1.01a9.4 9.4 0 0 1 4.95 0c1.89-1.28 2.72-1.01 2.72-1.01.54 1.35.2 2.35.1 2.6.64.69 1.02 1.57 1.02 2.64 0 3.77-2.3 4.6-4.49 4.84.36.31.67.91.67 1.84v2.73c0 .26.18.57.68.47A9.8 9.8 0 0 0 12 2.2Z"
      />
    </svg>
  );
}

export function ReleaseIcon({ className }: IconProps) {
  // Open padlock — funds released under contract rules.
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="4" y="11" width="16" height="9" rx="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11V8a4 4 0 0 1 7.5-1.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="15.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="4.5" y="11" width="15" height="9" rx="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function RulesIcon({ className }: IconProps) {
  // Contract document with a check — contract-defined movement.
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-6-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M13 3v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.5 14.5 10 16l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CoinsIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <ellipse cx="9" cy="7" rx="5.5" ry="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 7v4c0 1.66 2.46 3 5.5 3s5.5-1.34 5.5-3V7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 14v3c0 1.66 2.46 3 5.5 3s5.5-1.34 5.5-3v-4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 14c-3.04 0-5.5-1.34-5.5-3" stroke="currentColor" strokeWidth="1.6" />
      <ellipse cx="14.5" cy="10" rx="5.5" ry="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function CodeGlyph({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="m8.5 8.5-4 3.5 4 3.5M15.5 8.5l4 3.5-4 3.5M13.5 6l-3 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ShieldGlyph({ className }: IconProps) {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true" className={className}>
      <path d="M28 5 47 12v13c0 11.6-7.9 21.2-19 25-11.1-3.8-19-13.4-19-25V12L28 5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M28 12 40 16.4v9.1C40 33.4 34.9 40 28 42.4 21.1 40 16 33.4 16 25.5v-9.1L28 12Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" opacity="0.4" />
      <rect x="23" y="25.5" width="10" height="8" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M25 25.5v-2.2a3 3 0 0 1 6 0v2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
