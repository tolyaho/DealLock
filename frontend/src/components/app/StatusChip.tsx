/*
 * StatusChip — a small read-only status pill (dot + label).
 *
 * `tone` maps to the semantic accent set (sage = secure/active, champagne =
 * review/pending, brick = danger, lavender = technical, neutral = silver).
 * Status copy is the caller's job, so this stays domain-agnostic and reusable.
 * Tone always pairs with a dot + text label so meaning never relies on colour.
 */
import type { ReactNode } from "react";

export type ChipTone = "secure" | "review" | "danger" | "technical" | "neutral";

export function StatusChip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span className={`dl-chip dl-chip--${tone}`}>
      <span className="dl-chip__dot" aria-hidden="true" />
      {children}
    </span>
  );
}
