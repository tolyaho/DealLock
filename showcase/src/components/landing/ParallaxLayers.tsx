import { useEffect } from "react";

/*
 * ParallaxLayers — gives the background focal lights a slow, scroll-linked drift so
 * the wall reads as a lit space with depth rather than a flat painting (the Apple /
 * visionOS parallax cue). Purely decorative: it only translates elements tagged with
 * `data-parallax` (the soft light blooms), never content, and only via the compositor
 * (transform: translate3d). Fully disabled under prefers-reduced-motion.
 *
 * Each layer drifts by (scroll distance from its anchor) × its speed, clamped so the
 * glow never wanders far. `data-parallax-anchor="top"` (the hero, at the document top)
 * zeroes the drift at page load; the default "center" anchor zeroes it when the layer
 * is mid-viewport, so lower sections only drift gently as they pass through.
 *
 * Returns null — it just wires the scroll listener. Mounted last in the page so every
 * tagged layer exists in the DOM when the effect runs.
 */

interface Layer {
  el: HTMLElement;
  speed: number;
  anchorScroll: number; // scrollY at which this layer's drift is zero
}

const MAX_DRIFT = 130; // px — keep the glow from wandering far on long scrolls

export default function ParallaxLayers() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const nodes = [...document.querySelectorAll<HTMLElement>("[data-parallax]")];
    if (nodes.length === 0) return;

    let layers: Layer[] = [];
    const measure = () => {
      const vh = window.innerHeight;
      layers = nodes.map((el) => {
        const speed = parseFloat(el.dataset.parallax || "0");
        const docTop = el.getBoundingClientRect().top + window.scrollY;
        const anchorScroll =
          el.dataset.parallaxAnchor === "top" ? 0 : docTop - vh / 2;
        return { el, speed, anchorScroll };
      });
    };

    let frame = 0;
    const apply = () => {
      frame = 0;
      const y = window.scrollY;
      for (const { el, speed, anchorScroll } of layers) {
        let ty = (y - anchorScroll) * speed;
        if (ty > MAX_DRIFT) ty = MAX_DRIFT;
        else if (ty < -MAX_DRIFT) ty = -MAX_DRIFT;
        el.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0)`;
      }
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    const onResize = () => {
      measure();
      apply();
    };

    nodes.forEach((el) => {
      el.style.willChange = "transform";
    });
    measure();
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (frame) window.cancelAnimationFrame(frame);
      nodes.forEach((el) => {
        el.style.transform = "";
        el.style.willChange = "";
      });
    };
  }, []);

  return null;
}
