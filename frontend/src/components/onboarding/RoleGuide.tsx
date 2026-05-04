const CLIENT_STEPS = [
  { icon: "1", label: "Create the deal", detail: "Set who is paid, what each milestone means, and when delivery is due." },
  { icon: "2", label: "Lock funds", detail: "After the provider accepts, fund the agreement contract. DealLock does not hold the balance." },
  { icon: "3", label: "Review work", detail: "When proof is submitted, approve, request fixes, or dispute before the review window ends." },
  { icon: "4", label: "Release or resolve", detail: "Approved work releases payment. Expired, disputed, or settled work follows contract state." },
];

const PROVIDER_STEPS = [
  { icon: "1", label: "Accept terms", detail: "Review milestones, deadlines, and payment asset before signing acceptance." },
  { icon: "2", label: "Wait for funding", detail: "Start work once the client has locked funds in the agreement contract." },
  { icon: "3", label: "Submit proof", detail: "Attach a stable delivery reference, such as a URL, commit, or CID, for the active milestone." },
  { icon: "4", label: "Respond if needed", detail: "Approval releases funds. Revision requests, disputes, and settlements show the next step." },
];

interface Props {
  role?: "client" | "provider" | "both";
}

export default function RoleGuide({ role = "both" }: Props) {
  return (
    <div className="role-guide">
      {(role === "client" || role === "both") && (
        <div className="role-guide-column role-guide-column--client">
          <div className="role-guide-header">
            <span className="role-guide-badge role-guide-badge--client">Client</span>
            <p className="role-guide-subtitle">Funds the escrow, approves deliveries</p>
          </div>
          <ol className="role-guide-steps">
            {CLIENT_STEPS.map((s) => (
              <li key={s.label} className="role-guide-step">
                <span className="role-guide-step-num role-guide-step-num--client" aria-hidden>{s.icon}</span>
                <div>
                  <strong className="role-guide-step-label">{s.label}</strong>
                  <p className="role-guide-step-detail">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {(role === "provider" || role === "both") && (
        <div className="role-guide-column role-guide-column--provider">
          <div className="role-guide-header">
            <span className="role-guide-badge role-guide-badge--provider">Provider</span>
            <p className="role-guide-subtitle">Accepts the work, submits deliveries</p>
          </div>
          <ol className="role-guide-steps">
            {PROVIDER_STEPS.map((s) => (
              <li key={s.label} className="role-guide-step">
                <span className="role-guide-step-num role-guide-step-num--provider" aria-hidden>{s.icon}</span>
                <div>
                  <strong className="role-guide-step-label">{s.label}</strong>
                  <p className="role-guide-step-detail">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
