/*
 * ActionTile — a tactile quick action: a brushed-metal keycap medallion + label
 * + sub-label, with a hover lift and press. Used in quick-action grids beneath a
 * page header (moodboard: Mercury quick-action row).
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  icon: ReactNode;
  label: string;
  sub?: string;
}

export function ActionTile({ icon, label, sub, className = "", disabled, ...rest }: Props) {
  return (
    <button
      type="button"
      className={`dl-action${className ? ` ${className}` : ""}`}
      disabled={disabled}
      {...rest}
    >
      <span className="dl-action__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="dl-action__body">
        <span className="dl-action__label">{label}</span>
        {sub && <span className="dl-action__sub">{sub}</span>}
      </span>
    </button>
  );
}
