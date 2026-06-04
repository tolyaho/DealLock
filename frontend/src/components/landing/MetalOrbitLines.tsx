/*
 * MetalOrbitLines — a reusable, purely-decorative background layer: a few faint
 * concentric elliptical arcs ("orbital guides") with a couple of tiny glowing
 * anchor dots, drawn low in a section so it reads as a spatial/technical guide
 * behind the content rather than an infographic.
 *
 * It is a BACKGROUND element only: aria-hidden, pointer-events:none (in CSS), no
 * text, no semantics. Sizing/placement/opacity live in styles.css under `.dl-orbit`
 * + the per-placement modifier passed via `className` (e.g. "dl-orbit--workflow").
 *
 * Strokes fade at their left/right extremes via a horizontal objectBoundingBox
 * gradient; the wrapper additionally masks the top so the arcs dissolve into the
 * wall instead of hard-clipping. Gradient/dot ids are namespaced with useId() so
 * multiple instances on one page never collide. Silver/graphite only, with a
 * single restrained lavender accent — the sanctioned DealLock palette.
 */

import { useId } from "react";

interface Props {
  /** Per-section placement class (position + size), e.g. "dl-orbit--workflow". */
  className?: string;
  /** Render the single faint lavender accent ellipse + its anchor dot (default true). */
  accent?: boolean;
}

export default function MetalOrbitLines({ className = "", accent = true }: Props) {
  // Strip the colons React's useId() emits so the value is safe inside url(#…).
  const uid = useId().replace(/:/g, "");
  const stroke = `dlorbit-stroke-${uid}`;
  const dot = `dlorbit-dot-${uid}`;
  const dotV = `dlorbit-dotv-${uid}`;

  return (
    <div className={`dl-orbit ${className}`.trim()} aria-hidden="true">
      <svg
        className="dl-orbit__svg"
        viewBox="0 0 1000 460"
        fill="none"
        preserveAspectRatio="xMidYMax meet"
      >
        <defs>
          {/* Horizontal fade so each grey arc dissolves toward its left/right ends. */}
          <linearGradient id={stroke} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(120,122,116,0)" />
            <stop offset="34%" stopColor="rgba(120,122,116,0.2)" />
            <stop offset="66%" stopColor="rgba(120,122,116,0.15)" />
            <stop offset="100%" stopColor="rgba(120,122,116,0)" />
          </linearGradient>
          {/* Tiny soft glow for the anchor dots (silver). */}
          <radialGradient id={dot}>
            <stop offset="0%" stopColor="rgba(125,128,121,0.55)" />
            <stop offset="55%" stopColor="rgba(125,128,121,0.18)" />
            <stop offset="100%" stopColor="rgba(125,128,121,0)" />
          </radialGradient>
          {/* Lavender variant for the accent arc's anchor dot. */}
          <radialGradient id={dotV}>
            <stop offset="0%" stopColor="rgba(110,96,190,0.5)" />
            <stop offset="55%" stopColor="rgba(110,96,190,0.16)" />
            <stop offset="100%" stopColor="rgba(110,96,190,0)" />
          </radialGradient>
        </defs>

        {/* One group so the whole orbital cluster drifts together (see .dl-orbit__group). */}
        <g className="dl-orbit__group">
          <ellipse cx="500" cy="300" rx="524" ry="160" stroke="rgba(120,122,116,0.09)" strokeWidth="1" />
          <ellipse cx="500" cy="296" rx="420" ry="122" stroke={`url(#${stroke})`} strokeWidth="1" />
          {accent && (
            <ellipse cx="500" cy="288" rx="322" ry="90" stroke="rgba(110,96,190,0.16)" strokeWidth="1" />
          )}
          <ellipse cx="500" cy="282" rx="220" ry="60" stroke="rgba(120,122,116,0.12)" strokeWidth="1" />

          {/* Anchor dots at the crown of two arcs — glowing connection points, not nodes. */}
          <circle cx="500" cy="174" r="7" fill={`url(#${dot})`} />
          <circle cx="500" cy="174" r="1.6" fill="rgba(125,128,121,0.6)" />
          {accent && (
            <>
              <circle cx="500" cy="198" r="6.5" fill={`url(#${dotV})`} />
              <circle cx="500" cy="198" r="1.5" fill="rgba(110,96,190,0.55)" />
            </>
          )}
        </g>
      </svg>
    </div>
  );
}
