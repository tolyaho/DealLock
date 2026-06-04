/*
 * MetalSheen — a reusable, purely-decorative background layer of large soft SPECULAR
 * reflection sweeps that make a section read as satin aluminium catching studio light
 * (rather than a flat tonal panel). Three soft bands: a diagonal chrome highlight, a
 * vertical reflective column near the centre, and a faint lower silver reflection.
 *
 * Background only: aria-hidden, pointer-events:none, no semantics. The bands lighten
 * via `mix-blend-mode: screen`, so they only ADD shine and never darken text. Sizing,
 * blur, opacity, blend and the slow drift live in styles.css under `.dl-sheen`
 * (+ the `.dl-sheen--*` variant). Silver/chrome-white only — no colour, no mirror.
 *
 * Placement: drop it as a background child of a positioned, overflow-clipped host
 * (the workflow sticky scene, or a section's `__bg`). `.dl-sheen` is z-index:-1 so it
 * sits behind the host's content but above the base wall.
 */

interface Props {
  /** Intensity/placement variant, e.g. "dl-sheen--workflow" (the strongest). */
  className?: string;
}

export default function MetalSheen({ className = "" }: Props) {
  return (
    <div className={`dl-sheen ${className}`.trim()} aria-hidden="true">
      {/* Diagonal chrome highlight, top-left → lower-right (the main "lit metal" cue).  */}
      <span className="dl-sheen__band dl-sheen__band--diag" />
      {/* Soft vertical reflective column down the centre, behind the focal card.        */}
      <span className="dl-sheen__band dl-sheen__band--column" />
      {/* Faint lower silver reflection, low in the section behind the orbit lines.      */}
      <span className="dl-sheen__band dl-sheen__band--low" />
    </div>
  );
}
