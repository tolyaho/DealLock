interface ExplainerCardProps {
  icon?: string;
  title: string;
  body: string;
  variant?: "info" | "client" | "provider" | "warning";
  className?: string;
}

export default function ExplainerCard({
  icon,
  title,
  body,
  variant = "info",
  className = "",
}: ExplainerCardProps) {
  return (
    <div className={`explainer-card explainer-card--${variant} ${className}`}>
      {icon && (
        <div className="explainer-card-icon" aria-hidden>
          {icon}
        </div>
      )}
      <div className="explainer-card-content">
        <p className="explainer-card-title">{title}</p>
        <p className="explainer-card-body">{body}</p>
      </div>
    </div>
  );
}
