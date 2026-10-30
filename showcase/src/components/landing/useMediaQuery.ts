/*
 * useMediaQuery — subscribe to a CSS media query and re-render on match changes.
 * SSR-safe (defaults to false until mounted). Used on the landing to drop the
 * per-character typewriter effect on phones, where a partially-typed line + a
 * blinking caret reads as a glitch while the section scrolls into view.
 */
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
