/*
 * Button · IconButton · Spinner — the primary tactile controls.
 *
 * Button variants follow the moodboard's keycap language:
 *   primary   — dark graphite keycap with a top light-catch (one per screen)
 *   secondary — satin-aluminum face
 *   positive  — sage filled (secure / confirm)
 *   ghost     — chromeless
 *   danger    — muted brick, destructive only
 * All states (hover/active/disabled/loading/focus) live in app.css.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Spinner() {
  return <span className="dl-spinner" aria-hidden="true" />;
}

type Variant = "primary" | "secondary" | "positive" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  block?: boolean;
  icon?: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  block,
  icon,
  loading,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const cls = [
    "dl-btn",
    `dl-btn--${variant}`,
    size !== "md" && `dl-btn--${size}`,
    block && "dl-btn--block",
    loading && "is-loading",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner />}
      {icon}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** required — icon-only controls must be labelled for screen readers */
  label: string;
  icon: ReactNode;
  size?: "sm" | "md";
  variant?: "ghost" | "metal";
  selected?: boolean;
  /** small attention dot (e.g. unread notifications) */
  dot?: boolean;
}

export function IconButton({
  label,
  icon,
  size = "md",
  variant = "ghost",
  selected,
  dot,
  className = "",
  ...rest
}: IconButtonProps) {
  const cls = [
    "dl-iconbtn",
    size === "sm" && "dl-iconbtn--sm",
    variant === "metal" && "dl-iconbtn--metal",
    selected && "is-selected",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={cls}
      aria-label={label}
      aria-pressed={selected || undefined}
      title={label}
      {...rest}
    >
      {icon}
      {dot && <span className="dl-iconbtn__dot" aria-hidden="true" />}
    </button>
  );
}
