import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, test } from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { createApp } from "./index.js";
import { db } from "./db.js";
import { closeConfiguredSessionStores } from "./sessionStore.js";

const CHAIN_ID = 11155111;
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000101";
const PRIVATE_KEYS = [
  "0x1000000000000000000000000000000000000000000000000000000000000001",
  "0x2000000000000000000000000000000000000000000000000000000000000002",
  "0x3000000000000000000000000000000000000000000000000000000000000003",
] as const;

let server: Server;
let baseUrl = "";
const previousDisableRateLimits = process.env.DISABLE_RATE_LIMITS;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

class TestClient {
  private cookie = "";
  private csrfToken = "";

  private storeCookie(res: Response) {
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0] ?? "";
  }

  private async ensureCsrfToken() {
    if (this.csrfToken) return;
    const headers = new Headers();
    if (this.cookie) headers.set("Cookie", this.cookie);

    const res = await fetch(`${baseUrl}/auth/csrf`, { headers });
    this.storeCookie(res);
    const body = (await res.json().catch(() => ({}))) as { csrfToken?: unknown };
    if (typeof body.csrfToken === "string") this.csrfToken = body.csrfToken;
  }

  async request(
    path: string,
    init?: RequestInit,
    options: { csrf?: boolean } = {},
  ): Promise<{ status: number; body: Record<string, any> }> {
    const method = (init?.method ?? "GET").toUpperCase();
    const needsCsrf = options.csrf !== false && !SAFE_METHODS.has(method);

    const send = async () => {
      const headers = new Headers(init?.headers);
      headers.set("Content-Type", "application/json");
      if (this.cookie) headers.set("Cookie", this.cookie);
      if (this.csrfToken) headers.set("x-csrf-token", this.csrfToken);

      const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
      this.storeCookie(res);
      const body = (await res.json().catch(() => ({}))) as Record<string, any>;
      return { status: res.status, body };
    };

    if (needsCsrf) {
      await this.ensureCsrfToken();
    }

    const first = await send();
    if (needsCsrf && first.status === 403 && first.body.error === "Invalid or missing CSRF token") {
      this.csrfToken = "";
      await this.ensureCsrfToken();
      return send();
    }
    return first;
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function txHash(n: number): string {
  return `0x${n.toString(16).padStart(64, "0")}`;
}

async function signIn(privateKey: (typeof PRIVATE_KEYS)[number]) {
  const account = privateKeyToAccount(privateKey);
  const client = new TestClient();
  const nonce = await client.request("/auth/nonce", {
    method: "POST",
    body: JSON.stringify({ address: account.address, chainId: CHAIN_ID }),
  });
  assert.equal(nonce.status, 200, JSON.stringify(nonce.body));
  const signature = await account.signMessage({ message: String(nonce.body.message) });
  const verified = await client.request("/auth/verify", {
    method: "POST",
    body: JSON.stringify({
      address: account.address,
      nonceId: nonce.body.nonceId,
      signature,
    }),
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  return {
    client,
    address: account.address.toLowerCase(),
    userId: String((verified.body.user as { id: string }).id),
  };
}

async function captureVerificationToken(client: TestClient, email: string): Promise<string> {
  const lines: string[] = [];
  const originalInfo = console.info;
  const originalWrite = process.stdout.write;
  console.info = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  process.stdout.write = ((chunk: unknown) => {
    lines.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    const started = await client.request("/email/start-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    assert.equal(started.status, 200);
  } finally {
    console.info = originalInfo;
    process.stdout.write = originalWrite;
  }

  const match = lines.join("\n").match(/verifyEmail=([^\s]+)/);
  assert.ok(match, "console email should include a verification token");
  return decodeURIComponent(match[1]!);
}

// A fully onboarded account: wallet sign-in + verified email. Use this for any
// flow that touches a requireVerified route (agreements / notifications / prefs).
async function signInVerified(
  privateKey: (typeof PRIVATE_KEYS)[number],
  email: string,
) {
  const session = await signIn(privateKey);
  const token = await captureVerificationToken(session.client, email);
  const confirmed = await session.client.request("/email/confirm", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  return session;
}

async function withMutedConsoleEmail<T>(fn: () => Promise<T>): Promise<T> {
  const originalInfo = console.info;
  const originalWrite = process.stdout.write;
  console.info = () => {};
  process.stdout.write = (() => true) as typeof process.stdout.write;
  try {
    return await fn();
  } finally {
    console.info = originalInfo;
    process.stdout.write = originalWrite;
  }
}

async function createAgreement(clientAddress: string, providerAddress: string) {
  return db.agreement.create({
    data: {
      contractAddress: CONTRACT_ADDRESS,
      chainId: CHAIN_ID,
      clientAddress,
      providerAddress,
      projectTitle: "Round 5 Test Agreement",
      serviceTemplate: "custom",
      metadataJson: "{}",
      contractVersion: 4,
    },
  });
}

before(
  async () => {
    process.env.DISABLE_RATE_LIMITS = "true";
    await new Promise<void>((resolve) => {
      server = createApp().listen(0, () => {
        const address = server.address();
        assert.equal(typeof address, "object");
        assert.ok(address);
        baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
        resolve();
      });
    });
  },
);

beforeEach(async () => {
  await db.$executeRawUnsafe('DELETE FROM "session"');
  await db.emailNotificationLog.deleteMany();
  await db.chainEvent.deleteMany();
  await db.emailVerificationToken.deleteMany();
  await db.notificationPreference.deleteMany();
  await db.agreement.deleteMany();
  await db.wallet.deleteMany();
  await db.authNonce.deleteMany();
  await db.user.deleteMany();
});

after(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => {
        closeConfiguredSessionStores()
          .then(() => db.$disconnect())
          .then(() => {
            if (previousDisableRateLimits === undefined) delete process.env.DISABLE_RATE_LIMITS;
            else process.env.DISABLE_RATE_LIMITS = previousDisableRateLimits;
            if (err) reject(err);
            else resolve();
          })
          .catch(reject);
      });
    }),
);

test("CSRF protection rejects missing tokens and accepts session-bound tokens", { concurrency: false }, async () => {
  const account = privateKeyToAccount(PRIVATE_KEYS[0]);
  const missing = await new TestClient().request(
    "/auth/nonce",
    {
      method: "POST",
      body: JSON.stringify({ address: account.address, chainId: CHAIN_ID }),
    },
    { csrf: false },
  );
  assert.equal(missing.status, 403);

  const valid = await new TestClient().request("/auth/nonce", {
    method: "POST",
    body: JSON.stringify({ address: account.address, chainId: CHAIN_ID }),
  });
  assert.equal(valid.status, 200);
  assert.equal(typeof valid.body.nonceId, "string");
});

test("sign-in nonce can only be verified once", { concurrency: false }, async () => {
  const account = privateKeyToAccount(PRIVATE_KEYS[0]);
  const client = new TestClient();
  const nonce = await client.request("/auth/nonce", {
    method: "POST",
    body: JSON.stringify({ address: account.address, chainId: CHAIN_ID }),
  });
  assert.equal(nonce.status, 200, JSON.stringify(nonce.body));

  const signature = await account.signMessage({ message: String(nonce.body.message) });
  const payload = {
    address: account.address,
    nonceId: nonce.body.nonceId,
    signature,
  };

  const first = await client.request("/auth/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  assert.equal(first.status, 200, JSON.stringify(first.body));

  const replay = await client.request("/auth/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  assert.equal(replay.status, 400, JSON.stringify(replay.body));
  assert.equal(replay.body.error, "Nonce already used");
});

test("primary wallet cannot be unset without choosing another primary", { concurrency: false }, async () => {
  const user = await signIn(PRIVATE_KEYS[0]);

  const demoteOnlyPrimary = await user.client.request(`/wallets/${user.address}`, {
    method: "PATCH",
    body: JSON.stringify({ isPrimary: false }),
  });
  assert.equal(demoteOnlyPrimary.status, 400, JSON.stringify(demoteOnlyPrimary.body));

  const wallets = await db.wallet.findMany({ where: { userId: user.userId } });
  assert.equal(wallets.length, 1);
  assert.equal(wallets[0]?.isPrimary, true);
});

test("email verification stores only hashes, rejects expired tokens, and prevents duplicate verified emails", { concurrency: false }, async () => {
  const userA = await signIn(PRIVATE_KEYS[0]);
  const token = await captureVerificationToken(userA.client, "USER@example.com");

  const storedToken = await db.emailVerificationToken.findFirst({
    where: { userId: userA.userId, email: "user@example.com" },
  });
  assert.ok(storedToken);
  assert.notEqual(storedToken.tokenHash, token);
  assert.equal(storedToken.tokenHash, sha256(token));

  const confirmed = await userA.client.request("/email/confirm", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.email, "user@example.com");
  assert.equal(confirmed.body.emailVerified, true);

  const expiredRaw = "expired-token-that-is-long-enough";
  await db.emailVerificationToken.create({
    data: {
      userId: userA.userId,
      email: "other@example.com",
      tokenHash: sha256(expiredRaw),
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  const expired = await userA.client.request("/email/confirm", {
    method: "POST",
    body: JSON.stringify({ token: expiredRaw }),
  });
  assert.equal(expired.status, 400);

  const userB = await signIn(PRIVATE_KEYS[1]);
  const duplicateRaw = "duplicate-token-that-is-long-enough";
  await db.emailVerificationToken.create({
    data: {
      userId: userB.userId,
      email: "user@example.com",
      tokenHash: sha256(duplicateRaw),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  const duplicate = await userB.client.request("/email/confirm", {
    method: "POST",
    body: JSON.stringify({ token: duplicateRaw }),
  });
  assert.equal(duplicate.status, 409);
});

test("product data routes require a verified email, not just a wallet session", { concurrency: false }, async () => {
  const user = await signIn(PRIVATE_KEYS[0]); // wallet session, email not yet verified

  // A wallet-only session is blocked from product data with a distinguishable code.
  const blocked = await user.client.request("/agreements");
  assert.equal(blocked.status, 403, JSON.stringify(blocked.body));
  assert.equal(blocked.body.code, "EMAIL_VERIFICATION_REQUIRED");

  const prefsBlocked = await user.client.request("/notification-preferences");
  assert.equal(prefsBlocked.status, 403, JSON.stringify(prefsBlocked.body));

  // The onboarding routes stay reachable — that's how the user gets verified.
  const me = await user.client.request("/me");
  assert.equal(me.status, 200, JSON.stringify(me.body));
  const emailState = await user.client.request("/email");
  assert.equal(emailState.status, 200, JSON.stringify(emailState.body));

  // Complete the email step.
  const token = await captureVerificationToken(user.client, "owner@example.com");
  const confirmed = await user.client.request("/email/confirm", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));

  // Now the same session reaches product data.
  const ok = await user.client.request("/agreements");
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.ok(Array.isArray(ok.body.agreements));
});

test("direct agreement registration cannot forge factory provenance fields", { concurrency: false }, async () => {
  const clientUser = await signInVerified(PRIVATE_KEYS[0], "owner-a@example.com");
  const providerUser = await signIn(PRIVATE_KEYS[1]);

  const created = await clientUser.client.request("/agreements", {
    method: "POST",
    body: JSON.stringify({
      contractAddress: CONTRACT_ADDRESS,
      chainId: CHAIN_ID,
      clientAddress: clientUser.address,
      providerAddress: providerUser.address,
      contractVersion: 6,
      creationSource: "factory",
      factoryVersion: 3,
      factoryAddress: "0x0000000000000000000000000000000000000999",
      factoryTxHash: txHash(99),
      factoryLogIndex: 12,
      metadataHash: txHash(98),
    }),
  });

  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.agreement.creationSource, "direct");
  assert.equal(created.body.agreement.factoryVersion, null);
  assert.equal(created.body.agreement.factoryAddress, null);
  assert.equal(created.body.agreement.factoryTxHash, null);
  assert.equal(created.body.agreement.factoryLogIndex, null);
  assert.equal(created.body.agreement.metadataHash, null);
});

test("notification preferences and agreement contacts are editable only by involved accounts", { concurrency: false }, async () => {
  // clientUser + outsider both call requireVerified routes, so both need a verified email.
  const clientUser = await signInVerified(PRIVATE_KEYS[0], "owner-a@example.com");
  const providerUser = await signIn(PRIVATE_KEYS[1]); // only used for the agreement address
  const outsider = await signInVerified(PRIVATE_KEYS[2], "owner-c@example.com");
  await createAgreement(clientUser.address, providerUser.address);

  const prefs = await clientUser.client.request("/notification-preferences", {
    method: "PATCH",
    body: JSON.stringify({ milestoneSubmitted: false }),
  });
  assert.equal(prefs.status, 200);
  assert.equal((prefs.body.preferences as { milestoneSubmitted: boolean }).milestoneSubmitted, false);

  const contacts = await clientUser.client.request(`/agreements/${CONTRACT_ADDRESS}/contacts`, {
    method: "PATCH",
    body: JSON.stringify({
      chainId: CHAIN_ID,
      clientEmail: "CLIENT@Example.com",
      providerEmail: "provider@example.com",
    }),
  });
  assert.equal(contacts.status, 200);
  assert.equal(contacts.body.agreement.clientEmail, "client@example.com");
  assert.equal(contacts.body.agreement.providerEmail, "provider@example.com");

  const rejected = await outsider.client.request(`/agreements/${CONTRACT_ADDRESS}/contacts`, {
    method: "PATCH",
    body: JSON.stringify({ chainId: CHAIN_ID, providerEmail: "bad@example.com" }),
  });
  assert.equal(rejected.status, 404);
});

test("contract action notifications skip, send, respect preferences, and dedupe", { concurrency: false }, async () => {
  // clientUser posts the actions (requireVerified). providerUser is the recipient and
  // must start with no email — its email is set mid-test to exercise the send path.
  const clientUser = await signInVerified(PRIVATE_KEYS[0], "client-actor@example.com");
  const providerUser = await signIn(PRIVATE_KEYS[1]);
  await createAgreement(clientUser.address, providerUser.address);

  const basePayload = {
    contractAddress: CONTRACT_ADDRESS,
    chainId: CHAIN_ID,
    actorAddress: clientUser.address,
    actionType: "milestone_submitted",
    itemType: "milestone",
    itemId: 0,
  };

  const noRecipient = await clientUser.client.request("/notifications/contract-action", {
    method: "POST",
    body: JSON.stringify({ ...basePayload, txHash: txHash(1) }),
  });
  assert.equal(noRecipient.status, 200);
  assert.equal(noRecipient.body.status, "skipped");
  assert.equal(noRecipient.body.reason, "no_recipient_email");

  await db.user.update({
    where: { id: providerUser.userId },
    data: { email: "provider@example.com", emailVerifiedAt: new Date() },
  });

  const sent = await withMutedConsoleEmail(() =>
    clientUser.client.request("/notifications/contract-action", {
      method: "POST",
      body: JSON.stringify({ ...basePayload, txHash: txHash(2) }),
    }),
  );
  assert.equal(sent.status, 200);
  assert.equal(sent.body.status, "sent");

  const duplicate = await clientUser.client.request("/notifications/contract-action", {
    method: "POST",
    body: JSON.stringify({ ...basePayload, txHash: txHash(2) }),
  });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.status, "skipped");
  assert.equal(duplicate.body.reason, "duplicate");

  await db.notificationPreference.update({
    where: { userId: providerUser.userId },
    data: { milestoneSubmitted: false },
  });
  const disabled = await clientUser.client.request("/notifications/contract-action", {
    method: "POST",
    body: JSON.stringify({ ...basePayload, txHash: txHash(3) }),
  });
  assert.equal(disabled.status, 200);
  assert.equal(disabled.body.status, "skipped");
  assert.equal(disabled.body.reason, "preference_disabled");

  const logs = await db.emailNotificationLog.findMany({
    where: { contractAddress: CONTRACT_ADDRESS, chainId: CHAIN_ID },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(logs.some((log) => log.status === "sent"), true);
  assert.equal(logs.some((log) => log.status === "skipped"), true);
});

test("activity API is private to involved accounts and returns newest indexed events first", { concurrency: false }, async () => {
  // all three query the activity route (requireVerified), so all need a verified email.
  const clientUser = await signInVerified(PRIVATE_KEYS[0], "owner-a@example.com");
  const providerUser = await signInVerified(PRIVATE_KEYS[1], "owner-b@example.com");
  const outsider = await signInVerified(PRIVATE_KEYS[2], "owner-c@example.com");
  const agreement = await createAgreement(clientUser.address, providerUser.address);

  await db.chainEvent.createMany({
    data: [
      {
        agreementId: agreement.id,
        chainId: CHAIN_ID,
        contractAddress: CONTRACT_ADDRESS,
        contractVersion: 4,
        blockNumber: 10n,
        txHash: txHash(10),
        logIndex: 0,
        eventName: "AgreementAccepted",
        itemType: "agreement",
        actorAddress: providerUser.address,
        counterpartyAddress: clientUser.address,
        payloadJson: { provider: providerUser.address },
        occurredAt: new Date("2026-04-30T00:00:00.000Z"),
      },
      {
        agreementId: agreement.id,
        chainId: CHAIN_ID,
        contractAddress: CONTRACT_ADDRESS,
        contractVersion: 4,
        blockNumber: 11n,
        txHash: txHash(11),
        logIndex: 0,
        eventName: "AgreementFunded",
        itemType: "agreement",
        actorAddress: clientUser.address,
        counterpartyAddress: providerUser.address,
        amountWei: "1000000000000000000",
        payloadJson: { amount: "1000000000000000000" },
        occurredAt: new Date("2026-04-30T00:01:00.000Z"),
      },
    ],
  });

  const activity = await clientUser.client.request(
    `/agreements/${CONTRACT_ADDRESS}/activity?chainId=${CHAIN_ID}`,
  );
  assert.equal(activity.status, 200);
  const events = activity.body.events as Array<{ eventName: string; blockNumber: string }>;
  assert.equal(events.length, 2);
  assert.equal(events[0]?.eventName, "AgreementFunded");
  assert.equal(events[0]?.blockNumber, "11");

  const providerActivity = await providerUser.client.request(
    `/agreements/${CONTRACT_ADDRESS}/activity?chainId=${CHAIN_ID}&limit=1`,
  );
  assert.equal(providerActivity.status, 200);
  assert.equal((providerActivity.body.events as unknown[]).length, 1);
  assert.equal(typeof providerActivity.body.nextCursor, "string");

  const rejected = await outsider.client.request(
    `/agreements/${CONTRACT_ADDRESS}/activity?chainId=${CHAIN_ID}`,
  );
  assert.equal(rejected.status, 404);
});
