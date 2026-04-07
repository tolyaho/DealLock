import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <Link to="/" className="landing-logo">
            <span className="landing-logo-icon">D</span>
            DealLock
          </Link>
          <div className="landing-nav-links">
            <a href="#how-it-works" className="landing-nav-link">
              How it works
            </a>
            <a href="#features" className="landing-nav-link">
              Features
            </a>
            <Link to="/app" className="btn btn-primary btn-sm">
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      <div className="landing-divider" />

      <section className="hero">
        <div className="hero-eyebrow">⬡ Milestone-based smart contract escrow</div>
        <h1 className="hero-title">
          Secure escrow for <span className="text-gradient">digital freelance</span> deliverables
        </h1>
        <p className="hero-subtitle">
          DealLock locks funds in an on-chain smart contract and releases them milestone by
          milestone. Both client and provider stay protected throughout the project.
        </p>
        <div className="hero-cta">
          <Link to="/app" className="btn btn-primary btn-lg">
            Launch App →
          </Link>
          <a href="#how-it-works" className="btn btn-secondary btn-lg">
            Learn more
          </a>
        </div>
      </section>

      <div className="landing-divider" />

      <section id="how-it-works" className="landing-section">
        <div className="landing-section-header">
          <span className="section-label">Process</span>
          <h2>How it works</h2>
          <p>
            From agreement creation to final payout, every step is enforced by the contract on
            Sepolia.
          </p>
        </div>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Create Agreement</h3>
            <p>
              Client defines milestones, amounts, deadlines, and the provider address. One smart
              contract per agreement.
            </p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3>Provider Accepts</h3>
            <p>Provider reviews and explicitly accepts the agreement terms on-chain.</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Client Funds</h3>
            <p>Client sends the exact total ETH amount into the escrow contract.</p>
          </div>
          <div className="step-card">
            <div className="step-number">4</div>
            <h3>Deliver &amp; Review</h3>
            <p>
              Provider submits delivery evidence per milestone. Client reviews the work.
            </p>
          </div>
          <div className="step-card">
            <div className="step-number">5</div>
            <h3>Approve &amp; Release</h3>
            <p>Client approves each milestone to release funds to the provider.</p>
          </div>
        </div>
      </section>

      <div className="landing-divider" />

      <section id="features" className="landing-section">
        <div className="landing-section-header">
          <span className="section-label">Why DealLock</span>
          <h2>Built for trust without a middleman</h2>
          <p>
            Escrow rules live in code—transparent, sequential, and aligned with how digital
            projects actually ship.
          </p>
        </div>
        <div className="feature-grid">
          <div className="feature-card">
            <span className="feature-icon" aria-hidden>
              🔒
            </span>
            <h3>On-chain Escrow</h3>
            <p>
              Funds held in a smart contract, not a middleman account. Neither party can
              unilaterally withdraw.
            </p>
          </div>
          <div className="feature-card">
            <span className="feature-icon" aria-hidden>
              📋
            </span>
            <h3>Milestone Sequence</h3>
            <p>
              Deliverables unlock in strict order. Each milestone has its own amount, deadline,
              and evidence.
            </p>
          </div>
          <div className="feature-card">
            <span className="feature-icon" aria-hidden>
              👁
            </span>
            <h3>Transparent State</h3>
            <p>
              All agreement states are visible on-chain. Both parties can verify at any time.
            </p>
          </div>
          <div className="feature-card">
            <span className="feature-icon" aria-hidden>
              ⚡
            </span>
            <h3>Sepolia-ready Demo</h3>
            <p>Deploy and test with Sepolia testnet ETH. No real funds needed.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon" aria-hidden>
              🎨
            </span>
            <h3>Digital-first</h3>
            <p>
              Purpose-built for websites, UI/UX, branding, and other digital freelance
              deliverables.
            </p>
          </div>
          <div className="feature-card">
            <span className="feature-icon" aria-hidden>
              ⏱
            </span>
            <h3>Deadline Protection</h3>
            <p>
              If a milestone passes its deadline without submission, the client can reclaim that
              tranche.
            </p>
          </div>
        </div>
      </section>

      <div className="landing-divider" />

      <section className="landing-section">
        <div className="landing-section-header">
          <span className="section-label">Templates</span>
          <h2>Service templates</h2>
          <p>Start from patterns that map cleanly to milestone-based delivery.</p>
        </div>
        <div className="service-grid">
          <div className="service-card">
            <h3>🌐 Website Development</h3>
            <p>Landing pages, marketing sites, small web apps with staged handoffs.</p>
          </div>
          <div className="service-card">
            <h3>🎨 UI/UX Design</h3>
            <p>Wireframes, high-fidelity screens, and design system exports.</p>
          </div>
          <div className="service-card">
            <h3>✏️ Branding Package</h3>
            <p>Logo concepts, refinement, and final brand kit delivery.</p>
          </div>
          <div className="service-card">
            <h3>⚙️ Custom Deliverable</h3>
            <p>MVPs, frontends, design systems, or any structured digital work.</p>
          </div>
        </div>
      </section>

      <div className="landing-divider" />

      <section className="landing-section">
        <div className="landing-section-header">
          <span className="section-label">Scope</span>
          <h2>What the contract covers</h2>
          <p>Clear separation between on-chain guarantees and what still needs human judgment.</p>
        </div>
        <div className="compare-grid">
          <div className="compare-card">
            <h3>✓ Smart contract enforces</h3>
            <ul className="compare-list">
              <li>
                <span className="compare-check" aria-hidden>
                  ✓
                </span>
                Provider explicitly accepts before funding
              </li>
              <li>
                <span className="compare-check" aria-hidden>
                  ✓
                </span>
                Client funds exact on-chain total
              </li>
              <li>
                <span className="compare-check" aria-hidden>
                  ✓
                </span>
                Milestones unlock in strict sequence
              </li>
              <li>
                <span className="compare-check" aria-hidden>
                  ✓
                </span>
                Non-empty delivery reference required per milestone
              </li>
              <li>
                <span className="compare-check" aria-hidden>
                  ✓
                </span>
                Submission time recorded on-chain
              </li>
              <li>
                <span className="compare-check" aria-hidden>
                  ✓
                </span>
                Client approval releases milestone funds
              </li>
              <li>
                <span className="compare-check" aria-hidden>
                  ✓
                </span>
                Past-deadline refund available to client
              </li>
            </ul>
          </div>
          <div className="compare-card">
            <h3>✦ Requires manual agreement</h3>
            <ul className="compare-list">
              <li>
                <span className="compare-x" aria-hidden>
                  ✦
                </span>
                Subjective design quality or &quot;feel&quot; disputes
              </li>
              <li>
                <span className="compare-x" aria-hidden>
                  ✦
                </span>
                Code quality or hidden bugs after approval
              </li>
              <li>
                <span className="compare-x" aria-hidden>
                  ✦
                </span>
                Revision count and scope creep
              </li>
              <li>
                <span className="compare-x" aria-hidden>
                  ✦
                </span>
                Informal changes not in milestone text
              </li>
              <li>
                <span className="compare-x" aria-hidden>
                  ✦
                </span>
                Post-launch maintenance or support
              </li>
            </ul>
          </div>
        </div>
      </section>

      <div className="landing-divider" />

      <section className="landing-section text-center">
        <h2>Ready to secure your next project?</h2>
        <p>Deploy a DealLock agreement on Sepolia in minutes.</p>
        <div className="hero-cta">
          <Link to="/app" className="btn btn-primary btn-lg">
            Launch App →
          </Link>
          <a href="#how-it-works" className="btn btn-secondary btn-lg">
            Learn more
          </a>
        </div>
      </section>

      <div className="landing-divider" />

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">DealLock</div>
          <div className="landing-footer-links">
            <Link to="/app">Launch App</Link>
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
          </div>
          <p className="landing-footer-note">
            Course project — milestone escrow on Sepolia testnet. Not for production use with real
            funds.
          </p>
        </div>
      </footer>
    </div>
  );
}
