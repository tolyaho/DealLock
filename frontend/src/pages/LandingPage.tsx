/*
 * Marketing landing route (`/`). This is the existing marketing site, unchanged
 * — extracted verbatim from main.tsx so the router can mount it at `/` while the
 * dashboard mounts under `/app`. Do not redesign the landing here.
 */
import SiteHeader from "../components/landing/SiteHeader";
import Hero from "../components/landing/Hero";
import WorkflowStory from "../components/landing/workflow/WorkflowStory";
import SecuritySection from "../components/landing/security/SecuritySection";
import FAQSection from "../components/landing/faq/FAQSection";
import ParallaxLayers from "../components/landing/ParallaxLayers";

export default function LandingPage() {
  return (
    // One continuous matte-wall surface behind every section — the hero and the
    // workflow are panels on the same wall, not separately-painted blocks. The
    // texture layer (brushed grain) spans the whole page so the material never
    // resets at the section seam.
    <div className="dl-page">
      <div className="dl-page__texture" aria-hidden="true" />
      <SiteHeader />
      <Hero />
      <WorkflowStory />
      <SecuritySection />
      <FAQSection />
      {/* Scroll-linked drift on the background light blooms (depth cue). Renders
          nothing; mounted last so every [data-parallax] layer exists when it wires up. */}
      <ParallaxLayers />
    </div>
  );
}
