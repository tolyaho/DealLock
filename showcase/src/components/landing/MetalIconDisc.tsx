/*
 * MetalIconDisc — a small RAISED brushed-silver coin that holds a quiet line icon.
 * The page's premium "accessory" for card headers (security cards, FAQ lifecycle):
 * it reuses the design-lab metal-disc material through the landing `--dl-disc-*`
 * tokens, so every disc reads as the same machined silver hardware.
 *
 * Style + size live in CSS (`.dl-metal-disc`, sized via the `--disc-size` /
 * `--disc-icon` custom props on a context class), so this stays a thin wrapper:
 * pass the icon as children and a context className for sizing/placement.
 */

import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Context class for sizing/placement (sets --disc-size / margins, etc.). */
  className?: string;
  /** Lift the icon to the restrained violet for security/active emphasis. */
  accent?: boolean;
}

export default function MetalIconDisc({ children, className, accent }: Props) {
  return (
    <span
      className={`dl-metal-disc${accent ? " dl-metal-disc--accent" : ""}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
