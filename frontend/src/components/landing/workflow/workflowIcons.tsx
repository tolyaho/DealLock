/*
 * Monochrome line icons for the workflow action cards — one per step. Stroke-only
 * (currentColor, 1.6px), 22×22 on a 24 viewbox, matching the restrained graphite
 * UI language of the rest of the landing page (no emoji, no filled glyphs). The
 * icon tile sets the colour via currentColor, so these inherit active/idle state.
 */

import type { ReactElement } from "react";
import type { WorkflowIconKey } from "./workflowSteps";

const COMMON = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const ICONS: Record<WorkflowIconKey, ReactElement> = {
  // Client drafts the agreement — document with a pen.
  create: (
    <svg {...COMMON}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9" />
      <path d="M8.5 9h5M8.5 12.5h5M8.5 16h3" />
      <path d="M17.6 3.4a1.4 1.4 0 0 1 2 2L16 9l-2.6.6.6-2.6 3.6-3.6Z" />
    </svg>
  ),
  // Provider accepts — document with a check.
  accept: (
    <svg {...COMMON}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M9 14.5l2 2 3.5-3.8" />
    </svg>
  ),
  // Client locks funds — padlock.
  lock: (
    <svg {...COMMON}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14v2.5" />
    </svg>
  ),
  // Provider submits — upload tray.
  submit: (
    <svg {...COMMON}>
      <path d="M12 15V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  ),
  // Client approves — badge check.
  approve: (
    <svg {...COMMON}>
      <path d="M12 3.2l2.2 1.6 2.7-.2 1 2.5 2.3 1.4-.7 2.6.7 2.6-2.3 1.4-1 2.5-2.7-.2L12 20.8l-2.2-1.6-2.7.2-1-2.5L3.8 15.5l.7-2.6-.7-2.6 2.3-1.4 1-2.5 2.7.2L12 3.2Z" />
      <path d="M9 12l2 2 4-4.2" />
    </svg>
  ),
  // System releases funds — paper plane.
  release: (
    <svg {...COMMON}>
      <path d="M20.5 3.5 11 13" />
      <path d="M20.5 3.5 14.5 20.5l-3.5-7.5-7.5-3.5 17-6Z" />
    </svg>
  ),
};

export function WorkflowIcon({ name }: { name: WorkflowIconKey }) {
  return ICONS[name];
}
