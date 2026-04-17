import { type ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  variant?: "default" | "compact";
}

export default function EmptyState({
  icon,
  title,
  description,
  children,
  variant = "default",
}: EmptyStateProps) {
  return (
    <div className={`empty-state empty-state--${variant}`}>
      {icon != null && <div className="empty-state-icon">{icon}</div>}
      <div className="empty-state-title">{title}</div>
      {description && <p className="empty-state-text">{description}</p>}
      {children}
    </div>
  );
}
