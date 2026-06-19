/**
 * Full UI screenshot pass — landing sections + every route.
 *
 * Desktop (default): 1440×900 @2x → screenshots/ui-full
 * Mobile:            390×844 @3x  → screenshots/ui-full-mobile
 *
 * Run:
 *   node scripts/capture-ui-screenshots.mjs
 *   UI_SHOT_PROFILE=mobile node scripts/capture-ui-screenshots.mjs
 *
 * Requires: dev server on BASE (default http://localhost:5173), puppeteer-core, Chrome.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const PROFILE = process.env.UI_SHOT_PROFILE ?? "desktop";
const PROFILES = {
  desktop: {
    out: "screenshots/ui-full",
    viewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    userAgent: null,
    isMobile: false,
  },
  mobile: {
    out: "screenshots/ui-full-mobile",
    // iPhone 14/15 class — triggers app mobile breakpoints (≤960px drawer, ≤640px stacks)
    viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    isMobile: true,
  },
};

const cfg = PROFILES[PROFILE] ?? PROFILES.desktop;
const BASE = process.env.UI_SHOT_BASE ?? "http://localhost:5173";
const OUT = process.env.UI_SHOT_DIR ?? path.resolve(cfg.out);
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function waitSpline(page, selector, timeout = 50000) {
  try {
    await page.waitForSelector(`${selector}.is-loaded`, { timeout });
  } catch {
    await new Promise((r) => setTimeout(r, 9000));
  }
  await new Promise((r) => setTimeout(r, 1500));
}

async function shot(page, file, opts = {}) {
  const outPath = path.join(OUT, file);
  await page.screenshot({ path: outPath, ...opts });
  return outPath;
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "no-preference" },
  ]);
}

async function scrollTo(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ block: "start", behavior: "instant" });
  }, selector);
  await new Promise((r) => setTimeout(r, 1200));
}

async function captureLanding(page) {
  await goto(page, `${BASE}/`);
  await waitSpline(page, ".dl-spline-vault");

  await shot(page, "landing/00-hero-viewport.png");
  await shot(page, "landing/01-landing-full.png", { fullPage: true });

  await scrollTo(page, "#workflow");
  await shot(page, "landing/02-workflow-section.png");

  await scrollTo(page, "#security");
  await waitSpline(page, ".dl-emblem");
  await shot(page, "landing/03-security-section.png");

  await scrollTo(page, "#faq");
  await shot(page, "landing/04-faq-section.png");
}

async function captureAuth(page) {
  for (const [name, route] of [
    ["login", "/login"],
    ["signup", "/signup"],
  ]) {
    await goto(page, `${BASE}${route}`);
    if (cfg.isMobile) {
      // Vault wall hidden ≤900px — just let layout settle.
      await new Promise((r) => setTimeout(r, 1200));
    } else {
      await waitSpline(page, ".dl-auth-vault");
    }
    await shot(page, `auth/${name}.png`);
    await shot(page, `auth/${name}-full.png`, { fullPage: true });
  }
}

async function captureDashboard(page) {
  const routes = [
    { file: "dashboard/home-client.png", url: "/app/home?workspace=client" },
    { file: "dashboard/home-provider.png", url: "/app/home?workspace=provider" },
    { file: "dashboard/agreements.png", url: "/app/agreements?workspace=client" },
    { file: "dashboard/agreements-empty-spline.png", url: "/app/agreements?workspace=client&empty=1" },
    { file: "dashboard/create.png", url: "/app/create?workspace=client" },
    { file: "dashboard/activity.png", url: "/app/activity?workspace=client" },
    { file: "dashboard/counterparties.png", url: "/app/counterparties?workspace=client" },
    { file: "dashboard/messages.png", url: "/app/messages?workspace=client" },
    { file: "dashboard/statistics.png", url: "/app/statistics?workspace=client" },
    { file: "dashboard/wallet.png", url: "/app/wallet?workspace=client" },
    { file: "dashboard/settings.png", url: "/app/settings?workspace=client" },
    { file: "dashboard/design-lab.png", url: "/app/design-lab" },
  ];

  const splinePages = new Set([
    "dashboard/agreements-empty-spline.png",
    "dashboard/activity.png",
    "dashboard/counterparties.png",
    "dashboard/messages.png",
    "dashboard/statistics.png",
    "dashboard/wallet.png",
  ]);

  for (const { file, url } of routes) {
    await goto(page, `${BASE}${url}`);
    if (splinePages.has(file)) {
      await waitSpline(page, ".dl-spline-object");
    } else {
      await new Promise((r) => setTimeout(r, 800));
    }
    await shot(page, file);
    // Mobile: full-page pass helps spot overflow / clipped tables.
    if (cfg.isMobile || file === "dashboard/design-lab.png") {
      const fullName = file.replace(/\.png$/, "-full.png");
      await shot(page, fullName, { fullPage: true });
    }
  }
}

async function main() {
  fs.mkdirSync(path.join(OUT, "landing"), { recursive: true });
  fs.mkdirSync(path.join(OUT, "auth"), { recursive: true });
  fs.mkdirSync(path.join(OUT, "dashboard"), { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setViewport(cfg.viewport);
  if (cfg.userAgent) await page.setUserAgent(cfg.userAgent);

  try {
    await captureLanding(page);
    await captureAuth(page);
    await captureDashboard(page);
  } finally {
    await browser.close();
  }

  const files = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".png")) files.push(path.relative(OUT, p));
    }
  }
  walk(OUT);
  files.sort();

  fs.writeFileSync(
    path.join(OUT, "manifest.json"),
    JSON.stringify(
      {
        profile: PROFILE,
        viewport: cfg.viewport,
        base: BASE,
        capturedAt: new Date().toISOString(),
        files,
      },
      null,
      2,
    ),
  );

  console.log(`[${PROFILE}] Captured ${files.length} screenshots → ${OUT}`);
  for (const f of files) console.log(" ", f);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
