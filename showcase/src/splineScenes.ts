/*
 * Spline scene registry — the ONE place that maps each embedded 3D object to its
 * scene URL. Import from here everywhere instead of pasting raw URLs.
 *
 * Note: Spline re-publishes edits at the SAME URL, so updating a scene in the editor
 * does NOT change anything here — this file only changes when an object is swapped for
 * a different scene. Keyed by where the object appears.
 */
export const SPLINE_SCENES = {
  /** Landing hero — the metallic vault sculpture (HeroVaultSpline). */
  heroVault: "https://prod.spline.design/AGe6U1U5GtmgortZ/scene.splinecode",

  /** Auth (/login, /signup) — the metallic vault-door safe object (AuthVaultSpline). */
  authVault: "https://prod.spline.design/6KyIzrlSu23OcuRj/scene.splinecode",

  /** Landing › Security section emblem — shield object. */
  securityShield: "https://prod.spline.design/0j3KAYUN-S5VN299/scene.splinecode",

  /** App › Agreements empty state — agreements object. */
  agreements: "https://prod.spline.design/kU4vYYR2InQzunLA/scene.splinecode",

  /** App › Activity empty state — feed-card object. */
  activity: "https://prod.spline.design/fyNa-9Clg0MPhIdY/scene.splinecode",

  /** App › Messages empty state — chat-bubble object. */
  messages: "https://prod.spline.design/khJMw5X7m8uO2sZY/scene.splinecode",

  /** App › Counterparties empty state. */
  counterparties: "https://prod.spline.design/3D8kTeKjbrE0-q3X/scene.splinecode",

  /** App › Wallet empty state — wallet object. */
  wallet: "https://prod.spline.design/HSYXtcuu9dGxujA8/scene.splinecode",

  /** App › Statistics empty state — coin / medallion object. */
  statistics: "https://prod.spline.design/I2TlY5dzVGdvp0vh/scene.splinecode",
} as const;

export type SplineSceneKey = keyof typeof SPLINE_SCENES;
