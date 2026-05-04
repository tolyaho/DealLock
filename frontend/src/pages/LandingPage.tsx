import { useEffect } from "react";
import { Link } from "react-router-dom";
import ContractVaultCard from "../components/landing/ContractVaultCard.tsx";
import DashboardHeroPreview from "../components/landing/DashboardHeroPreview.tsx";
import FAQAccordion from "../components/landing/FAQAccordion.tsx";

type StateTone = "active" | "submitted" | "revision" | "approved" | "disputed" | "released" | "neutral";

interface StateChipProps {
  label: string;
  tone: StateTone;
}

const PROOF_FACTS = [
  { value: "No custody", label: "Funds lock in the agreement contract" },
  { value: "Wallet authority", label: "Actions require the right party wallet" },
  { value: "Contract state", label: "Blockchain state is the source of truth" },
  { value: "No platform fee", label: "No DealLock fee on the escrow flow" },
];

const TRUST_BENTO = [
  {
    label: "Client control",
    title: "Funds lock before work begins.",
    body: "The client keeps a clear approval step. Money moves only through the agreed release path.",
    tone: "active" as const,
  },
  {
    label: "Provider certainty",
    title: "The balance is visible before delivery.",
    body: "Providers can see that funds are set aside before they begin the next milestone.",
    tone: "submitted" as const,
  },
  {
    label: "Transparent record",
    title: "Every decision is recorded.",
    body: "Submissions, revisions, disputes, approvals, and releases all become clear agreement history.",
    tone: "released" as const,
  },
  {
    label: "Asset support",
    title: "Use ETH or USDC.",
    body: "Pick the payment asset once. DealLock keeps the agreement simple after that.",
    tone: "neutral" as const,
  },
];

const AUTHORITY_RULES = [
  {
    label: "01",
    title: "DealLock does not custody funds.",
    body: "The balance sits in the agreement smart contract until the contract rules move it.",
  },
  {
    label: "02",
    title: "Wallets authorize actions.",
    body: "Approve, revise, dispute, release, and refund actions require the right connected wallet.",
  },
  {
    label: "03",
    title: "Contract state controls the workflow.",
    body: "The dashboard and emails explain what happened. The blockchain state decides what can happen next.",
  },
];

const RELEASE_STATES = [
  {
    id: "01",
    tone: "active" as const,
    title: "Active",
    body: "Roles, amounts, deadlines, and payment asset are set before work starts.",
  },
  {
    id: "02",
    tone: "submitted" as const,
    title: "Submitted",
    body: "The provider submits proof. The milestone moves into review.",
  },
  {
    id: "03",
    tone: "revision" as const,
    title: "Revision or dispute",
    body: "The client can request changes or pause the milestone for settlement.",
  },
  {
    id: "04",
    tone: "released" as const,
    title: "Released",
    body: "Approval releases the milestone amount and records the decision.",
  },
];

const CLIENT_POINTS = [
  "Lock funds before work starts, then release only after review.",
  "Approve, request revision, or dispute from one clear row.",
  "Use the deadline rules already set in the agreement.",
];

const PROVIDER_POINTS = [
  "See the funded balance before accepting the work.",
  "Submit proof against a specific milestone.",
  "Keep a clean record of submitted and released work.",
];

const MILESTONES = [
  {
    id: "MIL-01",
    title: "Scope and wireframes",
    amount: "1,200 USDC",
    state: "released" as const,
    date: "Apr 28",
  },
  {
    id: "MIL-02",
    title: "Hi-fi product screens",
    amount: "1,700 USDC",
    state: "submitted" as const,
    date: "May 03",
  },
  {
    id: "MIL-03",
    title: "Implementation handoff",
    amount: "900 USDC",
    state: "active" as const,
    date: "May 10",
  },
];

const ACTIONS = [
  { label: "Approve", tone: "approved" as const, detail: "Release 1,700 USDC" },
  { label: "Revision", tone: "revision" as const, detail: "Return to provider" },
  { label: "Dispute", tone: "disputed" as const, detail: "Freeze this milestone" },
];

const NEXT_STEPS = [
  { state: "Create", next: "Set roles, milestones, deadlines", owner: "Client" },
  { state: "Fund", next: "Lock ETH or token funds", owner: "Client" },
  { state: "Submit", next: "Attach proof for review", owner: "Provider" },
  { state: "Review", next: "Approve, revise, or dispute", owner: "Client" },
  { state: "Resolve", next: "Release, refund, or settle", owner: "Contract state" },
];

const AUDIT_ROWS = [
  {
    event: "Milestone submitted",
    actor: "Provider",
    ref: "proof://Qm9f...71c",
    time: "2026-05-03 14:18",
    state: "submitted" as const,
  },
  {
    event: "Revision requested",
    actor: "Client",
    ref: "rev-02",
    time: "2026-05-03 16:42",
    state: "revision" as const,
  },
  {
    event: "Settlement proposal opened",
    actor: "Client",
    ref: "split 70/30",
    time: "2026-05-04 09:12",
    state: "disputed" as const,
  },
  {
    event: "Milestone released",
    actor: "Contract",
    ref: "tx 0x82...19a",
    time: "After approval",
    state: "released" as const,
  },
];

const FAQS = [
  {
    q: "Where are funds held?",
    a: "Funds sit in the agreement contract created for that deal. DealLock does not custody the balance.",
  },
  {
    q: "What is the source of truth?",
    a: "The agreement contract state is the source of truth. The app reads that state and helps each party take the next allowed wallet-authorized action.",
  },
  {
    q: "Can email approve or release funds?",
    a: "No. Email is for notifications only. It does not approve work, release funds, or replace a wallet signature.",
  },
  {
    q: "What can the client do after work is submitted?",
    a: "The client can approve the milestone, request a revision, or open a dispute. Each action changes the visible milestone state.",
  },
  {
    q: "What is the difference between revision and dispute?",
    a: "A revision asks the provider to fix work inside the original scope. A dispute pauses the milestone so both parties can agree to a settlement split.",
  },
  {
    q: "Why do ERC-20 payments need approval first?",
    a: "Tokens such as USDC require a wallet approval before funding. Approval gives permission for the exact funding step; it does not move funds by itself.",
  },
  {
    q: "How does this help providers?",
    a: "Providers can see that funds are locked before work starts. The agreement shows which milestone is active and what proof is expected.",
  },
  {
    q: "What happens in a dispute?",
    a: "The disputed milestone pauses until both parties agree to a settlement split. DealLock does not arbitrate subjective quality disputes.",
  },
  {
    q: "Which assets are supported?",
    a: "The current beta supports native ETH and USDC on Sepolia. The selected asset stays fixed for that agreement.",
  },
  {
    q: "Is DealLock production-ready?",
    a: "No. This is a Sepolia testnet beta for product validation. Use test funds only until contracts are audited and production deployment is announced.",
  },
];

function StateChip({ label, tone }: StateChipProps) {
  return (
    <span className={`dl-state-chip dl-state-chip--${tone}`}>
      <span className="dl-state-chip__dot" aria-hidden />
      {label}
    </span>
  );
}

function MilestoneCard({ milestone }: { milestone: (typeof MILESTONES)[number] }) {
  return (
    <article className={`dl-milestone-card dl-milestone-card--${milestone.state}`}>
      <div className="dl-milestone-card__meta">
        <span>{milestone.id}</span>
        <span>{milestone.date}</span>
      </div>
      <h3>{milestone.title}</h3>
      <div className="dl-milestone-card__footer">
        <StateChip label={milestone.state} tone={milestone.state} />
        <span>{milestone.amount}</span>
      </div>
    </article>
  );
}

export default function LandingPage() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".dl-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 },
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="landing landing-r20">
      <nav className="landing-nav" aria-label="Primary">
        <div className="landing-nav-inner">
          <Link to="/" className="landing-logo" aria-label="DealLock home">
            <span className="landing-logo-icon" aria-hidden />
            DealLock
          </Link>
          <div className="landing-nav-links">
            <a href="#how" className="landing-nav-link">How it works</a>
            <a href="#sides" className="landing-nav-link">Client/provider</a>
            <a href="#product" className="landing-nav-link">Product</a>
            <a href="#faq" className="landing-nav-link">FAQ</a>
            <Link to="/app" className="dl-nav-cta">Create agreement</Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="dl-hero" aria-labelledby="dl-hero-title">
          <div className="dl-hero__copy dl-reveal is-visible">
            <span className="dl-kicker">Private milestone escrow</span>
            <h1 id="dl-hero-title">Make deals without a middleman.</h1>
            <p>
              Funds lock in the agreement smart contract. Wallets authorize actions.
              Every milestone shows the next allowed step.
            </p>
            <div className="dl-hero__actions">
              <Link to="/app" className="dl-button dl-button--primary">Create agreement</Link>
              <a href="#product" className="dl-button dl-button--secondary">See the workspace</a>
            </div>
            <div className="dl-hero__trust-stack" aria-label="Trust model">
              <span>Funds locked</span>
              <i aria-hidden />
              <span>Wallet authorized</span>
              <i aria-hidden />
              <span>Transparent release</span>
            </div>
            <div className="dl-hero__proof" aria-label="Beta status">
              <span>Sepolia beta</span>
              <span>No platform custody</span>
              <span>ETH and USDC</span>
              <span>No platform fees</span>
            </div>
          </div>
          <div className="dl-hero__visual dl-reveal is-visible">
            <ContractVaultCard />
          </div>
        </section>

        <section className="dl-proof-strip" aria-label="DealLock trust proof">
          {PROOF_FACTS.map((fact) => (
            <div className="dl-proof-strip__item" key={fact.value}>
              <strong>{fact.value}</strong>
              <span>{fact.label}</span>
            </div>
          ))}
        </section>

        <section className="dl-trust-bento" aria-label="DealLock trust model">
          {TRUST_BENTO.map((item, index) => (
            <article
              className={`dl-trust-card dl-trust-card--${item.tone} dl-reveal dl-reveal--d${index + 1}`}
              key={item.label}
            >
              <StateChip label={item.label} tone={item.tone} />
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </article>
          ))}
        </section>

        <section className="dl-authority-panel dl-reveal" aria-label="DealLock authority model">
          <div className="dl-authority-panel__copy">
            <span className="dl-kicker">Authority model</span>
            <h2>Know exactly what controls the deal.</h2>
            <p>
              DealLock is the workspace for reading and acting on an agreement.
              It does not replace contract state, wallet authority, or party consent.
            </p>
          </div>
          <div className="dl-authority-grid">
            {AUTHORITY_RULES.map((rule) => (
              <article className="dl-authority-rule" key={rule.label}>
                <span>{rule.label}</span>
                <h3>{rule.title}</h3>
                <p>{rule.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dl-section" id="how" aria-labelledby="how-title">
          <div className="dl-section__header dl-reveal">
            <span className="dl-kicker">Controlled release</span>
            <h2 id="how-title">Every milestone has a visible path.</h2>
            <p>
              The interface keeps every milestone in a clear state. Each step
              shows what both sides can do next.
            </p>
          </div>
          <div className="dl-release-rail dl-reveal dl-reveal--d1">
            {RELEASE_STATES.map((state) => (
              <article className={`dl-release-step dl-release-step--${state.tone}`} key={state.id}>
                <div className="dl-release-step__top">
                  <span>{state.id}</span>
                  <StateChip label={state.title} tone={state.tone} />
                </div>
                <h3>{state.title}</h3>
                <p>{state.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dl-section dl-section--split" id="sides" aria-labelledby="sides-title">
          <div className="dl-section__header dl-reveal">
            <span className="dl-kicker">Two-sided certainty</span>
            <h2 id="sides-title">The client keeps control. The provider sees certainty.</h2>
          </div>
          <div className="dl-sides-grid">
            <article className="dl-side-panel dl-side-panel--client dl-reveal dl-reveal--d1">
              <div>
                <StateChip label="Client control" tone="active" />
                <h3>Money does not move until the review state says it can.</h3>
              </div>
              <ul>
                {CLIENT_POINTS.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <div className="dl-side-panel__module" aria-hidden>
                <span>Review window</span>
                <strong>2d 14h</strong>
                <small>Approve / Revise / Dispute</small>
              </div>
            </article>

            <article className="dl-side-panel dl-side-panel--provider dl-reveal dl-reveal--d2">
              <div>
                <StateChip label="Provider certainty" tone="submitted" />
                <h3>Work starts after the balance is already sealed.</h3>
              </div>
              <ul>
                {PROVIDER_POINTS.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <div className="dl-side-panel__rail" aria-hidden>
                <span />
                <span />
                <span />
              </div>
            </article>
          </div>
        </section>

        <section className="dl-section" id="product" aria-labelledby="product-title">
          <div className="dl-section__header dl-reveal">
            <span className="dl-kicker">Agreement workspace</span>
            <h2 id="product-title">A calm dashboard for every deal.</h2>
            <p>
              See role, balance, milestone status, next action, and history in
              one place.
            </p>
          </div>

          <div className="dl-dashboard-preview dl-reveal dl-reveal--d1">
            <div className="dl-dashboard-preview__mock">
              <DashboardHeroPreview />
            </div>
            <div className="dl-dashboard-preview__copy">
              <StateChip label="Live agreement" tone="active" />
              <h3>Balance, proof, decisions, and history in one view.</h3>
              <p>
                The client sees the review choices. The provider sees the funded
                milestone. Both sides see the same agreement history.
              </p>
              <div className="dl-preview-stats" aria-label="Dashboard preview highlights">
                <span><strong>3</strong> milestones</span>
                <span><strong>USDC</strong> payment asset</span>
                <span><strong>0</strong> custodians</span>
              </div>
            </div>
          </div>

          <div className="dl-product-showcase dl-reveal dl-reveal--d1">
            <div className="dl-balance-module">
              <div className="dl-balance-module__head">
                <span>Escrow balance</span>
                <StateChip label="locked" tone="active" />
              </div>
              <strong>3,800.00 USDC</strong>
              <div className="dl-balance-module__bar" aria-hidden>
                <span style={{ width: "32%" }} />
                <span style={{ width: "45%" }} />
                <span style={{ width: "23%" }} />
              </div>
              <dl>
                <div>
                  <dt>Released</dt>
                  <dd>1,200</dd>
                </div>
                <div>
                  <dt>In review</dt>
                  <dd>1,700</dd>
                </div>
                <div>
                  <dt>Locked</dt>
                  <dd>900</dd>
                </div>
              </dl>
            </div>

            <div className="dl-milestone-stack">
              {MILESTONES.map((milestone) => (
                <MilestoneCard milestone={milestone} key={milestone.id} />
              ))}
            </div>

            <div className="dl-action-module">
              <span className="dl-action-module__eyebrow">MIL-02 submitted</span>
              <h3>Choose the next state</h3>
              <div className="dl-action-list">
                {ACTIONS.map((action) => (
                  <div className={`dl-action-row dl-action-row--${action.tone}`} key={action.label}>
                    <span>{action.label}</span>
                    <small>{action.detail}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="dl-next-steps dl-reveal dl-reveal--d2" aria-label="What happens next by state">
            <div className="dl-next-steps__head">
              <span className="dl-kicker">What happens next</span>
              <h3>The first deal path is always visible.</h3>
            </div>
            <div className="dl-next-steps__grid">
              {NEXT_STEPS.map((step) => (
                <article className="dl-next-step" key={step.state}>
                  <span>{step.state}</span>
                  <strong>{step.next}</strong>
                  <small>{step.owner}</small>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="dl-section dl-section--audit" aria-labelledby="audit-title">
          <div className="dl-audit-layout">
            <div className="dl-section__header dl-reveal">
              <span className="dl-kicker">Audit trail and disputes</span>
              <h2 id="audit-title">When trust gets tense, the state gets stricter.</h2>
              <p>
                Revisions and disputes do not hide inside messages. They become
                recorded rows with actor, time, reference, and next allowed action.
              </p>
            </div>
            <div className="dl-audit-table dl-reveal dl-reveal--d1">
              {AUDIT_ROWS.map((row) => (
                <div className={`dl-audit-row dl-audit-row--${row.state}`} key={`${row.event}-${row.time}`}>
                  <StateChip label={row.state} tone={row.state} />
                  <div>
                    <strong>{row.event}</strong>
                    <span>{row.actor}</span>
                  </div>
                  <code>{row.ref}</code>
                  <time>{row.time}</time>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="dl-section dl-section--faq" id="faq" aria-labelledby="faq-title">
          <div className="dl-section__header dl-reveal">
            <span className="dl-kicker">FAQ</span>
            <h2 id="faq-title">Clear answers for controlled release.</h2>
          </div>
          <div className="dl-reveal dl-reveal--d1">
            <FAQAccordion items={FAQS} />
          </div>
        </section>

        <section className="dl-final-cta" aria-labelledby="final-cta-title">
          <div className="dl-final-cta__inner dl-reveal">
            <span className="dl-kicker">Create the next agreement</span>
            <h2 id="final-cta-title">Set the terms before work begins.</h2>
            <p>
              Define milestones, lock the funds, and give both sides a clear path
              from active work to released payment.
            </p>
            <div className="dl-final-cta__actions">
              <Link to="/app" className="dl-button dl-button--primary">Create agreement</Link>
              <a href="#how" className="dl-button dl-button--secondary">Review the flow</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="landing-logo-icon" aria-hidden />
            DealLock
          </div>
          <div className="landing-footer-links">
            <Link to="/app">Create agreement</Link>
            <a href="#how">How it works</a>
            <a href="#sides">Client/provider</a>
            <a href="#product">Product</a>
            <a href="#faq">FAQ</a>
          </div>
          <p className="landing-footer-note">
            Sepolia testnet beta. Use test funds only. Contracts are not audited for production use.
          </p>
        </div>
      </footer>
    </div>
  );
}
