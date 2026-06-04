/*
 * Shared dashboard primitives — built once, reused on every screen so the
 * product reads as one design system. Visual language lives in dashboard.css;
 * these components only compose tokens/classes and add semantics + a11y.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type {
  AgreementStatus,
  MilestoneStatus,
  Money,
} from "../../fixtures/types";
import { STATUS_LABEL, MILESTONE_STATUS_LABEL } from "../../fixtures/agreements";
import { formatMoney } from "../../fixtures/format";
import { IconArrowRight, IconCheck, IconShield } from "./icons";

/* ---- Buttons ------------------------------------------------------------- */
type ButtonVariant = "primary" | "positive" | "secondary" | "ghost";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  small?: boolean;
  block?: boolean;
  icon?: ReactNode;
  /** When a chain/on-chain write isn't wired, show disabled + a reason tooltip. */
  comingSoon?: boolean;
}

export function Button({
  variant = "secondary",
  small,
  block,
  icon,
  comingSoon,
  children,
  className = "",
  disabled,
  title,
  ...rest
}: BtnProps) {
  const cls = [
    "dl-btn",
    `dl-btn--${variant}`,
    small && "dl-btn--sm",
    block && "dl-btn--block",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={cls}
      disabled={disabled || comingSoon}
      aria-disabled={disabled || comingSoon || undefined}
      title={comingSoon ? "Coming soon — on-chain actions are not wired yet" : title}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/* ---- Status pill --------------------------------------------------------- */
export function StatusPill({ status }: { status: AgreementStatus }) {
  return (
    <span className={`dl-pill dl-pill--${status}`}>
      <span className="dl-pill__dot" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function MilestonePill({ status }: { status: MilestoneStatus }) {
  // Map milestone statuses onto the shared pill palette.
  const variant =
    status === "in_progress"
      ? "active"
      : status === "in_review"
        ? "review"
        : status === "pending"
          ? "neutral"
          : status; // approved | released | completed | revision_requested
  return (
    <span className={`dl-pill dl-pill--${variant}`}>
      <span className="dl-pill__dot" />
      {MILESTONE_STATUS_LABEL[status]}
    </span>
  );
}

/* ---- Avatar -------------------------------------------------------------- */
export function Avatar({
  initials,
  size = "md",
  metal,
}: {
  initials: string;
  size?: "sm" | "md" | "lg";
  metal?: boolean;
}) {
  return (
    <span
      className={`dl-avatar dl-avatar--${size}${metal ? " dl-avatar--metal" : ""}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/* ---- Section card -------------------------------------------------------- */
export function SectionCard({
  label,
  title,
  action,
  children,
  className = "",
  flush,
  inset,
  id,
}: {
  label?: string;
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
  inset?: boolean;
  id?: string;
}) {
  const cls = ["dl-card", flush && "dl-card--flush", inset && "dl-card--inset", className]
    .filter(Boolean)
    .join(" ");
  return (
    <section className={cls} id={id}>
      {/* scroll-margin keeps anchored sections clear of the top edge */}
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

/* ---- "View all" link ----------------------------------------------------- */
export function ViewAll({
  children = "View all",
  onClick,
  href,
}: {
  children?: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  if (href) {
    return (
      <a className="dl-viewall" href={href}>
        {children} <IconArrowRight />
      </a>
    );
  }
  return (
    <button type="button" className="dl-viewall" onClick={onClick}>
      {children} <IconArrowRight />
    </button>
  );
}

/* ---- Switch (settings) --------------------------------------------------- */
export function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`dl-switch${on ? " is-on" : ""}`}
      onClick={() => onChange(!on)}
    >
      <span className="dl-switch__knob" />
    </button>
  );
}

/* ---- Segmented control --------------------------------------------------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="dl-seg" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`dl-seg__btn${value === o.value ? " is-active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---- Empty state --------------------------------------------------------- */
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="dl-empty">
      <div className="dl-empty__icon">{icon}</div>
      <div className="dl-empty__title">{title}</div>
      <div className="dl-empty__text">{text}</div>
      {action}
    </div>
  );
}

/* ---- Assurance footnote -------------------------------------------------- */
export function Assurance({ children }: { children: ReactNode }) {
  return (
    <p className="dl-assurance">
      <IconShield /> {children}
    </p>
  );
}

/* ---- Checklist row ------------------------------------------------------- */
export function ChecklistItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="dl-row" style={{ padding: "10px 0" }}>
      <span
        className="dl-step__node"
        style={{
          width: 22,
          height: 22,
          background: done ? "var(--dash-positive)" : "var(--dash-surface)",
          borderColor: done ? "var(--dash-positive)" : "var(--dash-line-strong)",
          color: done ? "#f6faf6" : "var(--dash-faint)",
        }}
      >
        {done && <IconCheck />}
      </span>
      <span className="dl-row__title" style={{ fontWeight: 400, color: done ? "var(--dash-ink)" : "var(--dash-muted)" }}>
        {label}
      </span>
    </div>
  );
}

/* ---- formatted money (tiny convenience wrapper) -------------------------- */
export function MoneyText({ value, className }: { value: Money; className?: string }) {
  return <span className={className}>{formatMoney(value)}</span>;
}
