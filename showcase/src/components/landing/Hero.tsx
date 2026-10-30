import HeroVaultSpline from "./HeroVaultSpline";
import HeroBackground from "./HeroBackground";
import { useMediaQuery } from "./useMediaQuery";

export default function Hero() {
  // Drop the hero vault entirely on phones — it reads poorly when shrunk and the
  // copy stands on its own. Skipping the mount also avoids loading the Spline WebGL
  // canvas on mobile. Tablets (≥640px) keep it below the copy.
  const isPhone = useMediaQuery("(max-width: 639px)");

  return (
    <div className="dl-hero-v2">

      <HeroBackground />

      {/* Fluted pilasters on the hero screen — the page-level pair (LandingPage) is
          hidden behind the hero's own opaque wall here, so mount a matching pair inside
          the hero, behind the stage, so the columns are present from the first screen. */}
      <span className="dl-flute dl-flute--left" aria-hidden="true" />
      <span className="dl-flute dl-flute--right" aria-hidden="true" />

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
            <a href="#demo" className="dl-cta-primary">
              Try interactive demo
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

        {!isPhone && (
          <div className="dl-vault-wrap dl-vault-wrap--spline" aria-hidden="true">
            <HeroVaultSpline />
          </div>
        )}

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
