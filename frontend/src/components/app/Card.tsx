/*
 * Card · MetricCard — the surface primitives.
 *
 * Card is the base container (white plate on the satin shell, with a faint
 * brushed specular catch). Variants: base / raised / glass, plus `flush`
 * (no padding) and an interactive (keyboard-activatable) mode with a hover lift.
 *
 * MetricCard is the scannable headline-number tile (mono label · big tabular
 * value · meta/trend line), optionally a drill-down button.
 */
import type { KeyboardEvent, ReactNode } from "react";
import { IconArrowRight } from "./icons";

interface CardProps {
  label?: string;
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  /** base = lifted white plate · raised = elevated hero · glass = frosted ·
   *  inset = recessed secondary panel */
  variant?: "base" | "raised" | "glass" | "inset";
  flush?: boolean;
  className?: string;
  id?: string;
  /** makes the whole card a button (hover lift + Enter/Space activatable) */
  onActivate?: () => void;
  ariaLabel?: string;
}

export function Card({
  label,
  title,
  action,
  children,
  variant = "base",
  flush,
  className = "",
  id,
  onActivate,
  ariaLabel,
}: CardProps) {
  const cls = [
    "dl-card",
    variant === "raised" && "dl-card--raised",
    variant === "glass" && "dl-card--glass",
    variant === "inset" && "dl-card--inset",
    flush && "dl-card--flush",
    onActivate && "dl-card--interactive",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const interactive = onActivate
    ? {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": ariaLabel,
        onClick: onActivate,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onActivate();
          }
        },
      }
    : {};

  return (
    <section className={cls} id={id} {...interactive}>
      {(label || title || action) && (
        <div className="dl-card__head">
          <div>
            {label && <div className="dl-label">{label}</div>}
            {title && <div className="dl-card__title">{title}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

interface MetricCardProps {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  /** tints the meta line and (for non-interactive) implies direction */
  trend?: "up" | "down";
  /** a faint identity glyph (top-right medallion). Helps the KPI strip scan. */
  icon?: ReactNode;
  /** tints the icon medallion to the semantic accent */
  tone?: "secure" | "review" | "technical" | "neutral";
  onClick?: () => void;
}

export function MetricCard({ label, value, meta, trend, icon, tone = "neutral", onClick }: MetricCardProps) {
  const metaCls = [
    "dl-metric__meta",
    trend === "up" && "dl-metric__meta--up",
    trend === "down" && "dl-metric__meta--down",
  ]
    .filter(Boolean)
    .join(" ");
  const medallion =
    icon != null ? (
      <span className={`dl-metric__icon${tone !== "neutral" ? ` dl-metric__icon--${tone}` : ""}`} aria-hidden="true">
        {icon}
      </span>
    ) : null;
  const body = (
    <>
      <div className="dl-metric__label">{label}</div>
      <div className="dl-metric__value">{value}</div>
      {meta != null && <div className={metaCls}>{meta}</div>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="dl-metric dl-metric--interactive" onClick={onClick}>
        {medallion}
        <span className="dl-metric__go" aria-hidden="true">
          <IconArrowRight />
        </span>
        {body}
      </button>
    );
  }
  return (
    <div className="dl-metric">
      {medallion}
      {body}
    </div>
  );
}
