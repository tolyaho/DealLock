import { Link } from "react-router-dom";
import DashboardHeroPreview from "../components/landing/DashboardHeroPreview.tsx";

const STEPS = [
  {
    n: 1,
    title: "Create agreement",
    body: "Client defines milestones, amounts, deadlines, and the provider address. One agreement = one smart contract.",
  },
  {
    n: 2,
    title: "Provider accepts",
    body: "Provider reviews milestones on-chain and signs Accept before any money moves.",
  },
  {
    n: 3,
    title: "Client funds escrow",
    body: "Client sends the exact total ETH into the contract. No middleman custody — no platform fee on the flow.",
  },
  {
    n: 4,
    title: "Deliver & submit",
    body: "Provider submits a delivery reference per milestone (link, commit, IPFS CID). Timestamp is recorded on-chain.",
  },
  {
    n: 5,
    title: "Approve & release",
    body: "Client approves each milestone to release that tranche. Deadline expired? Client may refund in order.",
  },
];

const FEATURES = [
  {
    icon: "⟠",
    title: "On-chain escrow",
    body: "Funds live in the contract, not a middleman account. Neither party can unilaterally withdraw.",
  },
  {
    icon: "≣",
    title: "Sequential milestones",
    body: "Strict order. Each milestone has its own amount, deadline, and delivery evidence.",
  },
  {
    icon: "◎",
    title: "Transparent state",
    body: "Accepted · Funded · Submitted · Released — every transition is visible on Etherscan.",
  },
  {
    icon: "⚡",
    title: "Sepolia-ready",
    body: "Test freely with Sepolia ETH from a faucet. No real funds, no production risk.",
  },
  {
    icon: "◇",
    title: "Digital-first",
    body: "Purpose-built for websites, UI/UX, branding, and other structured digital deliverables.",
  },
  {
    icon: "⏲",
    title: "Deadline refund",
    body: "If a milestone passes its deadline without submission, the client may refund that tranche in order.",
  },
];

const SERVICES = [
  {
    icon: "◈",
    title: "Website & small site build",
    body: "Landing pages, marketing sites, and small web apps with staged handoffs.",
    milestones: ["Wireframes / IA", "Hi-fi screens", "Production deploy"],
  },
  {
    icon: "◆",
    title: "UI/UX design",
    body: "Discovery, high-fidelity screens, and a clean design-system export.",
    milestones: ["UX flows", "UI screens", "Design system export"],
  },
  {
    icon: "✎",
    title: "Branding package",
    body: "Logo concepts, refinement, and final brand kit with guidelines.",
    milestones: ["Concepts", "Refinement", "Final brand kit"],
  },
  {
    icon: "⚙",
    title: "Custom digital deliverable",
    body: "MVPs, frontends, or any structured digital work — you define the milestones.",
    milestones: ["Phase 1", "Phase 2", "Final handoff"],
  },
];

const ENFORCES = [
  "Provider explicitly accepts before funding",
  "Client funds the exact on-chain total",
  "Milestones unlock in strict sequence",
  "Non-empty delivery reference per milestone",
  "Submission timestamp recorded on-chain",
  "Client approval releases milestone funds",
  "Past-deadline refund available to the client",
];

const MANUAL = [
  "Subjective design quality or “feel” disputes",
  "Hidden bugs discovered after approval",
  "Revision count and scope creep",
  "Informal Slack/DM changes not in milestone text",
  "Post-launch maintenance or support terms",
];

export default function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <Link to="/" className="landing-logo">
            <span className="landing-logo-icon" aria-hidden />
            DealLock
          </Link>
          <div className="landing-nav-links">
            <a href="#how-it-works" className="landing-nav-link">
              How it works
            </a>
            <a href="#features" className="landing-nav-link">
              Features
            </a>
            <a href="#templates" className="landing-nav-link">
              Templates
            </a>
            <a href="#scope" className="landing-nav-link">
              Scope
            </a>
            <Link to="/app" className="btn btn-primary btn-sm">
              Launch app
            </Link>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">Milestone escrow · Digital freelance</div>
          <h1 className="hero-title">
            Ship staged work.{" "}
            <span className="text-gradient">Release money on approval.</span>
          </h1>
          <p className="hero-subtitle">
            DealLock holds ETH in a transparent smart contract and releases it milestone by
            milestone, as delivery evidence is submitted and approved on-chain. Built for
            structured digital freelance — websites, UI/UX, branding.
          </p>
          <div className="hero-cta">
            <Link to="/app" className="btn btn-primary btn-lg">
              Launch app
            </Link>
            <a href="#how-it-works" className="btn btn-secondary btn-lg">
              See how it works
            </a>
          </div>
          <p className="hero-trust">
            Sepolia-first · Client-only demo · Your keys stay in your wallet, no backend servers
            touch funds.
          </p>
        </div>
        <div className="hero-visual">
          <DashboardHeroPreview />
        </div>
      </section>

      <section className="trust-strip" aria-label="Trust indicators">
        <div className="trust-strip-inner">
          <span className="trust-strip-eyebrow">No custody · No platform fees · No backend</span>
          <span className="chip">
            <span className="chip-dot" aria-hidden /> Smart-contract escrow
          </span>
          <span className="chip">
            <span className="chip-dot" aria-hidden /> Sepolia testnet
          </span>
          <span className="chip">
            <span className="chip-dot" aria-hidden /> Client-side only
          </span>
          <span className="chip">
            <span className="chip-dot" aria-hidden /> Open on Etherscan
          </span>
        </div>
      </section>

      <section id="how-it-works" className="landing-section">
        <div className="landing-section-header">
          <span className="section-label">Process</span>
          <h2>From agreement to payout, in five clear steps</h2>
          <p>
            Every step is enforced by the contract. No hidden side-channels, no admin that can rug
            the escrow.
          </p>
        </div>
        <div className="steps-grid">
          {STEPS.map((s) => (
            <div key={s.n} className="step-card">
              <div className="step-number">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="landing-section">
        <div className="landing-section-header">
          <span className="section-label">Why DealLock</span>
          <h2>Trust without a middleman</h2>
          <p>
            Escrow rules live in Solidity — transparent, sequential, and aligned with how digital
            projects actually ship.
          </p>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-card">
              <span className="feature-icon" aria-hidden>
                {f.icon}
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="templates" className="landing-section">
        <div className="landing-section-header">
          <span className="section-label">Service templates</span>
          <h2>Starting points mapped to milestone delivery</h2>
          <p>
            Prefilled structures for the four services DealLock is tuned for. Edit freely before
            deploy.
          </p>
        </div>
        <div className="service-grid">
          {SERVICES.map((s) => (
            <div key={s.title} className="service-card">
              <span className="service-card-icon" aria-hidden>
                {s.icon}
              </span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <ul className="service-card-milestones">
                {s.milestones.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="scope" className="landing-section">
        <div className="landing-section-header">
          <span className="section-label">Scope</span>
          <h2>What the contract covers — and what it doesn’t</h2>
          <p>
            Clear separation between on-chain enforcement and the human judgment that still belongs
            off-chain.
          </p>
        </div>
        <div className="compare-grid">
          <div className="compare-card compare-card--enforce">
            <h3>Smart contract enforces</h3>
            <ul className="compare-list">
              {ENFORCES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="compare-card compare-card--manual">
            <h3>Needs manual agreement</h3>
            <ul className="compare-list">
              {MANUAL.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="cta-strip">
        <div className="cta-strip-inner">
          <span className="cta-strip-eyebrow">Ready when you are</span>
          <h2 className="cta-strip-title">Deploy your first agreement in minutes</h2>
          <p className="cta-strip-sub">
            Connect a Sepolia wallet, pick a template, edit milestones, deploy. The app is
            client-only — your keys never leave the wallet.
          </p>
          <div className="cta-strip-actions">
            <Link to="/app" className="btn btn-primary btn-lg">
              Launch app →
            </Link>
            <a href="#how-it-works" className="btn btn-ghost btn-lg">
              Revisit the flow
            </a>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="landing-logo-icon" aria-hidden />
            DealLock
          </div>
          <div className="landing-footer-links">
            <Link to="/app">Launch app</Link>
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <a href="#templates">Templates</a>
            <a href="#scope">Scope</a>
          </div>
          <p className="landing-footer-note">
            Course project — milestone escrow on Sepolia testnet. Not audited; not for production
            use with real funds.
          </p>
        </div>
      </footer>
    </div>
  );
}
