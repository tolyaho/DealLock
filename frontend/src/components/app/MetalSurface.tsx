/*
 * MetalSurface — the reusable satin-aluminum material.
 *
 * Renders a brushed-metal plate (diagonal specular sweep + brushed grain + dot
 * texture + soft vignette via `.metal-surface` in app.css) with an optional top
 * specular bloom. Use it anywhere a premium metal backdrop is wanted — hero
 * areas, empty-state stages, future marketing-in-app blocks. The app shell uses
 * the same material directly (see AppShell); this is for everything else.
 */
import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** `wall` = the deep canvas; `panel` = a lit satin plate. */
  variant?: "wall" | "panel";
  /** add faint orbital linework (technical accent) */
  orbits?: boolean;
  /** render the top specular bloom (on by default) */
  shine?: boolean;
  children?: ReactNode;
}

export default function MetalSurface({
  variant = "wall",
  orbits = false,
  shine = true,
  className = "",
  children,
  ...rest
}: Props) {
  const cls = [
    "metal-surface",
    variant === "panel" && "metal-surface--panel",
    orbits && "metal-surface--orbits",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {shine && <div className="metal-surface__shine" aria-hidden="true" />}
      {children}
    </div>
  );
}
