/*
 * MetalCTA — the premium DealLock action control: a restrained frosted-glass
 * pill with a leading satin-aluminum disc (the Design Lab "metal-disc") that
 * carries the icon. Used for the signature page action ("New agreement"). The
 * disc is the identity; the pill stays calm so it reads as deliberate, not
 * shouty. Hover lifts + brightens the disc's specular; press settles it in.
 *
 * It's a normal <button> (full a11y, keyboard, type="button") — reuse anywhere
 * a single signature action is wanted (page headers, empty states).
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** the disc glyph (a thin-line icon, e.g. <IconPlus/>) */
  icon: ReactNode;
  children: ReactNode;
}

export function MetalCTA({ icon, children, className = "", ...rest }: Props) {
  return (
    <button type="button" className={`dl-metal-cta${className ? ` ${className}` : ""}`} {...rest}>
      <span className="dl-metal-cta__disc" aria-hidden="true">
        {icon}
      </span>
      <span className="dl-metal-cta__label">{children}</span>
    </button>
  );
}
