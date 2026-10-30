import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DEMO_MODE } from "../../demoMode";

// Center nav links — all in-page anchors. "Demo" jumps to the interactive
// product demo that now anchors the page.
const NAV_LINKS = [
  { label: "Demo", href: "#demo" },
  { label: "Workflow", href: "#workflow" },
  { label: "Safeguards", href: "#safeguards" },
  { label: "Security", href: "#security" },
  { label: "FAQ", href: "#faq" },
] as const;

/**
 * SiteHeader — the one fixed site header: DealLock wordmark (left), a center nav
 * rail, and the auth actions (right) — a ghost-metal "Log in" + a brushed-metal
 * "Sign up" — laid out on the shared page grid (--page-max-width /
 * --page-padding-x) so its edges line up with the hero and every section.
 *
 * Two visual states:
 *   top      — almost backgroundless; logo, links and button float on the matte wall.
 *   scrolled — once scrollY > 32px we add `nav-scrolled`; the center rail fades into
 *              an Apple-like liquid-glass pill (all the styling lives in styles.css).
 *
 * Scroll reads are rAF-throttled and state only flips on the 32px boundary, so the
 * listener stays cheap. Overlap with content is handled by the hero/section
 * padding-top reserving --header-height — never by stacking tricks.
 */
export default function SiteHeader() {
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
    <header className={`site-header${isScrolled ? " nav-scrolled" : ""}`}>
      <div className="site-header-inner">
        <a href="/" className="deallock-wordmark" aria-label="DealLock home">
          DealLock
        </a>

        <nav className="nav-rail" aria-label="Main navigation">
          <ul className="nav-links" role="list">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={label}>
                <a href={href} className="nav-link">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="nav-auth">
          {DEMO_MODE ? (
            // Public demo build: no backend, so the wallet-auth pages are gated off.
            // The one header action takes you straight to the interactive demo.
            <a className="nav-auth-signup" href="#demo">
              Try demo
            </a>
          ) : (
            <>
              <Link className="nav-auth-login" to="/login">
                Log in
              </Link>
              <Link className="nav-auth-signup" to="/signup">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
