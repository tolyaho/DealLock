export default function DashboardHeroPreview() {
  return (
    <div className="mockup" aria-hidden>
      <div className="mockup-chrome">
        <span className="mockup-dot" />
        <span className="mockup-dot" />
        <span className="mockup-dot" />
        <span className="mockup-url">deallock.xyz/app</span>
      </div>
      <div className="mockup-body">
        <aside className="mockup-sidebar">
          <div className="mockup-sidebar-title">My agreements</div>
          <div className="mockup-row">
            <span className="mockup-row-title">Brand refresh v2</span>
            <span className="mockup-row-sub">0x9f2...ab34</span>
            <div className="mockup-row-meta">
              <span className="mockup-row-role mockup-row-role--provider">Provider</span>
              <span>Accepted</span>
            </div>
          </div>
          <div className="mockup-row mockup-row--active">
            <span className="mockup-row-title">Marketing landing</span>
            <span className="mockup-row-sub">0x4b2...c18d</span>
            <div className="mockup-row-meta">
              <span className="mockup-row-role mockup-row-role--client">Client</span>
              <span>Funded</span>
            </div>
          </div>
          <div className="mockup-row">
            <span className="mockup-row-title">Dashboard UI MVP</span>
            <span className="mockup-row-sub">0x8d0...77a1</span>
            <div className="mockup-row-meta">
              <span className="mockup-row-role mockup-row-role--client">Client</span>
              <span>Released</span>
            </div>
          </div>
        </aside>
        <div className="mockup-main">
          <div className="mockup-header-card">
            <div>
              <div className="mockup-header-eyebrow">Agreement - You are Client</div>
              <div className="mockup-header-title">Marketing landing v2</div>
            </div>
            <span className="mockup-header-badge">Funded</span>
          </div>
          <div className="mockup-chain-row">
            <span>0x4b2...c18d</span>
            <span>Contract state</span>
            <span>USDC</span>
            <span>Confirmed</span>
          </div>
          <div className="mockup-metrics">
            <div className="mockup-metric">
              <div className="mockup-metric-label">Agreement total</div>
              <div className="mockup-metric-value">2.40 ETH</div>
            </div>
            <div className="mockup-metric">
              <div className="mockup-metric-label">Released</div>
              <div className="mockup-metric-value">0.80 ETH</div>
            </div>
            <div className="mockup-metric">
              <div className="mockup-metric-label">In escrow</div>
              <div className="mockup-metric-value">1.60 ETH</div>
            </div>
          </div>
          <div className="mockup-milestones">
            <div className="mockup-milestone mockup-milestone--done">
              <span className="mockup-milestone-dot">OK</span>
              <span className="mockup-milestone-text">Wireframes signed off</span>
              <span className="mockup-milestone-amount">0.8 ETH</span>
            </div>
            <div className="mockup-milestone mockup-milestone--active">
              <span className="mockup-milestone-dot">2</span>
              <span className="mockup-milestone-text">Hi-fi screens submitted</span>
              <span className="mockup-milestone-amount">0.9 ETH</span>
            </div>
            <div className="mockup-milestone">
              <span className="mockup-milestone-dot">3</span>
              <span className="mockup-milestone-text">Production handoff</span>
              <span className="mockup-milestone-amount">0.7 ETH</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mockup-float">
        <span className="mockup-float-label">Next action</span>
        <span className="mockup-float-value">Approve / revise / dispute</span>
        <span className="mockup-float-hash">0x82af...5z1d</span>
      </div>
    </div>
  );
}
