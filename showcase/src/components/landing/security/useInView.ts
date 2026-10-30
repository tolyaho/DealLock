import { useEffect, useRef, useState } from "react";

/*
 * useInView — one-shot reveal latch. Returns a ref + boolean that flips true the
 * first time the element scrolls into view, then disconnects (no re-trigger on
 * scroll-back). Used for the section's soft fade-in. Falls back to "visible" when
 * IntersectionObserver is unavailable so content is never stuck hidden.
 */
export function useInView<T extends HTMLElement>(
  options: IntersectionObserverInit = { threshold: 0.18 },
) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setInView(true);
        io.disconnect();
      }
    }, options);
    io.observe(el);
    return () => io.disconnect();
    // options is a stable literal at the call sites; intentionally run-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, inView };
}
