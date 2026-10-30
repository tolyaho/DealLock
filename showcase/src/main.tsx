import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import "./styles.css";
import LandingPage from "./pages/LandingPage";

/*
 * Demo-only entry. This sanitized release ships ONLY the marketing landing + the
 * interactive #demo section, so the router mounts just `/` and redirects everything
 * else back to it. There is deliberately NO wallet-auth / dashboard code reachable
 * from here: the entire wagmi / viem / @reown / React Query stack is never imported,
 * so it is absent from the bundle (and its vulnerable transitive deps never ship).
 * The full wallet/backend app lives only in the separate development checkout.
 */

/*
 * HashScroll — makes in-page `#section` anchors work on a FRESH page load / shared
 * deep link. The browser processes the URL hash before React mounts the target
 * section, so a direct hit to `/#demo` (or #workflow/#security/#faq) would otherwise
 * stay at the top. On every location change with a hash we retry across a few frames
 * until the element exists, then scroll it into view (CSS scroll-margin-top handles
 * the fixed-header offset). Same-page anchor clicks already work natively; this is
 * idempotent for those.
 */
function HashScroll() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    let tries = 0;
    let raf = 0;
    let cancelled = false;

    const scrollToTarget = () => {
      if (cancelled) return;
      let el: Element | null = null;
      try {
        el = document.querySelector(hash);
      } catch {
        return; // malformed hash selector — ignore
      }
      if (!el) return;
      // Offset by the fixed header height (+ a small gap) so the target lands clear
      // of the sticky nav rather than tucked beneath it.
      const navVar = getComputedStyle(document.documentElement).getPropertyValue("--dl-nav-height").trim();
      const navH = parseInt(navVar, 10) || 72;
      const top = el.getBoundingClientRect().top + window.scrollY - navH - 16;
      window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    };

    // Wait until the target exists, THEN until webfonts have settled, before
    // scrolling — a late font reflow would otherwise leave the target under the nav.
    const whenReady = () => {
      if (cancelled) return;
      let el: Element | null = null;
      try {
        el = document.querySelector(hash);
      } catch {
        return;
      }
      if (el) {
        const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
        fontsReady.then(() => requestAnimationFrame(() => requestAnimationFrame(scrollToTarget)));
        return;
      }
      if (tries++ < 40) raf = requestAnimationFrame(whenReady);
    };
    raf = requestAnimationFrame(whenReady);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [hash]);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <HashScroll />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
