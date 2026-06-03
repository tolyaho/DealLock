import { useEffect, useState } from "react";
import HeroVaultSpline from "./HeroVaultSpline";
import HeroBackground from "./HeroBackground";

export default function Hero() {
  // Navbar has two visual states. At the hero top it is minimal/transparent —
  // just the logo, links, and CTA floating on the matte wall. Once the user
  // scrolls past 32px the frosted-glass pill (.dl-nav-rail glass + CTA shadow)
  // fades in via the .dl-hero-header--scrolled class. Scroll reads are rAF-
  // throttled and state only flips on the boundary, so it stays cheap.
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setIsScrolled((prev) => {
        const next = window.scrollY > 32;
        return prev === next ? prev : next;
      });
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    update(); // sync initial state (covers a reload while already scrolled)
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="dl-hero-v2">

      <HeroBackground />

      <header className={`dl-hero-header${isScrolled ? " dl-hero-header--scrolled" : ""}`}>
        <a href="/" className="deal-logo" aria-label="DealLock home">DealLock</a>

        <nav className="dl-nav-rail" aria-label="Main navigation">
          <ul className="dl-nav-links" role="list">
            {[
              { label: "Product", href: "#" },
              { label: "Workflow", href: "#workflow" },
              { label: "Security", href: "#security" },
              { label: "FAQ", href: "#faq" },
            ].map(({ label, href }) => (
              <li key={label}>
                <a href={href} className="dl-nav-link">{label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <button className="dl-nav-cta">Request Access</button>
      </header>

      <main className="dl-hero-v2__stage" aria-label="DealLock — milestone escrow protocol">

        <div className="dl-hero-copy">
          <span className="dl-hero-brand">Milestone Escrow</span>
          <h1 className="dl-hero-h1">
            Lock the Money.<br />
            Ship the Work.
          </h1>
          <p className="dl-hero-sub">
            Escrow for client-provider work. Funds stay locked until the job is delivered and approved.
          </p>
          <div className="dl-hero-cta-row">
            <a href="#" className="dl-cta-primary">
              Request Access
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a href="#workflow" className="dl-cta-secondary">
              See how it works
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
          <ul className="dl-hero-chips" aria-label="Protocol features">
            {["Client protection", "Provider proof", "On-chain release"].map((chip) => (
              <li key={chip} className="dl-hero-chip">{chip}</li>
            ))}
          </ul>
        </div>

        <div className="dl-vault-wrap dl-vault-wrap--spline" aria-hidden="true">
          <HeroVaultSpline />
        </div>

        {/* Progressive blur fading in toward the hero's bottom edge. Six stacked   */}
        {/* layers, each with a stronger backdrop blur and a mask that fades in      */}
        {/* lower than the last, so the blur ramps up smoothly (no visible banding)  */}
        {/* into the section below. A faint silver veil eases the colour falloff.    */}
        {/* Sits before the scroll cue so the cue stays crisp and clickable on top.  */}
        <div className="dl-hero-blur" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className={`dl-hero-blur__layer dl-hero-blur__layer--${n}`} />
          ))}
          <div className="dl-hero-blur__veil" />
        </div>

        <button className="dl-scroll-cue" aria-label="Scroll to next section">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M7 2v10M3 8l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

      </main>
    </div>
  );
}
