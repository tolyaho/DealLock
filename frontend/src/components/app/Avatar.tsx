/*
 * Avatar — a monogram medallion. `metal` renders the brushed-aluminum disc
 * (used for the signed-in user / counterparties); otherwise a soft silver tint.
 */
interface Props {
  initials: string;
  size?: "sm" | "md" | "lg";
  metal?: boolean;
}

export function Avatar({ initials, size = "md", metal }: Props) {
  return (
    <span className={`dl-avatar dl-avatar--${size}${metal ? " dl-avatar--metal" : ""}`} aria-hidden="true">
      {initials}
    </span>
  );
}
