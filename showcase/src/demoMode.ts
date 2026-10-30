/*
 * demoMode — is this build the public, backend-free product demo?
 *
 * The YC demo deploy (Vercel) ships ONLY the marketing landing + the interactive
 * #demo section. The wallet auth pages (/login, /signup, /verify-email) and the
 * /app dashboard need a backend + database that the demo deliberately does not
 * deploy, so in demo mode those routes are gated off and redirect to the landing
 * — no half-wired login or empty dashboard is ever exposed as a "real" feature.
 *
 * Defaults ON for production builds (so a plain `vite build` → Vercel is demo-safe)
 * and OFF for local `npm run dev` (so the full app stays available while you build
 * it). Override explicitly with VITE_DEMO_ONLY=true | false in either environment.
 */
// A compile-time literal injected by Vite's `define` (see vite.config.ts). Because it
// is a literal after replacement, Rollup inlines `DEMO_MODE` everywhere it is imported,
// so the demo build's `DEMO_MODE ? … : …` branches fully tree-shake the wallet/web3/app
// code (wagmi, viem, AuthProviders, the /app pages) out of the shipped bundle.
export const DEMO_MODE: boolean = __DEMO_BUILD__;
