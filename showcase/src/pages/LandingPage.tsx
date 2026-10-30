/*
 * Marketing landing route (`/`). This is the existing marketing site, unchanged
 * — extracted verbatim from main.tsx so the router can mount it at `/` while the
 * dashboard mounts under `/app`. Do not redesign the landing here.
 */
import SiteHeader from "../components/landing/SiteHeader";
import Hero from "../components/landing/Hero";
import InteractiveDemo from "../components/landing/demo/InteractiveDemo";
import WorkflowStory from "../components/landing/workflow/WorkflowStory";
import SafeguardsSection from "../components/landing/safeguards/SafeguardsSection";
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
      {/* Reeded-glass pilasters framing the wall (the auth login wall's signature
          ribbed side-panel, ported here). Behind every section, out in the gutters. */}
      <span className="dl-flute dl-flute--left" aria-hidden="true" />
      <span className="dl-flute dl-flute--right" aria-hidden="true" />
      <SiteHeader />
      <Hero />
      {/* Interactive, backend-free product demo — the escrow workflow a reviewer
          can drive from either side without signing up. Sits right below the hero
          so the hero's "Try interactive demo" CTA (#demo) lands immediately. */}
      <InteractiveDemo />
      <WorkflowStory />
      {/* "What if something goes wrong?" — the contract exit paths (missed deadline,
          client silence, revisions, disputes, refunds) in plain language, before the
          code proof below. */}
      <SafeguardsSection />
      <SecuritySection />
      <FAQSection />
      {/* Scroll-linked drift on the background light blooms (depth cue). Renders
          nothing; mounted last so every [data-parallax] layer exists when it wires up. */}
      <ParallaxLayers />
    </div>
  );
}
