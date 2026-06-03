import { useEffect, useState } from "react";

// Center nav links. All hrefs are in-page anchors / placeholders — this is the
// marketing landing, not the dApp. "Product" and "Developers" have no dedicated
// section yet, so they point at "#" until those pages exist.
const NAV_LINKS = [
  { label: "Product", href: "#" },
  { label: "Workflow", href: "#workflow" },
  { label: "Security", href: "#security" },
  { label: "Developers", href: "#" },
  { label: "FAQ", href: "#faq" },
] as const;

/**
 * SiteHeader — the one fixed site header: DealLock wordmark (left), a center nav
 * rail, and the Launch App button (right), laid out on the shared page grid
 * (--page-max-width / --page-padding-x) so its edges line up with the hero and
 * every section.
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

        <button className="launch-button" type="button">
          Launch App
        </button>
      </div>
    </header>
  );
}
