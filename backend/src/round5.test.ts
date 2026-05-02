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

class TestClient {
  private cookie = "";

  async request(path: string, init?: RequestInit): Promise<{ status: number; body: Record<string, any> }> {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");
    if (this.cookie) headers.set("Cookie", this.cookie);

    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0] ?? "";
    const body = (await res.json().catch(() => ({}))) as Record<string, any>;
    return { status: res.status, body };
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
  assert.equal(nonce.status, 200);
  const signature = await account.signMessage({ message: String(nonce.body.message) });
  const verified = await client.request("/auth/verify", {
    method: "POST",
    body: JSON.stringify({
      address: account.address,
      nonceId: nonce.body.nonceId,
      signature,
    }),
  });
  assert.equal(verified.status, 200);
  return {
    client,
    address: account.address.toLowerCase(),
    userId: String((verified.body.user as { id: string }).id),
  };
}

async function captureVerificationToken(client: TestClient, email: string): Promise<string> {
  const lines: string[] = [];
  const originalInfo = console.info;
  console.info = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };

  try {
    const started = await client.request("/email/start-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    assert.equal(started.status, 200);
  } finally {
    console.info = originalInfo;
  }

  const match = lines.join("\n").match(/verifyEmail=([^\s]+)/);
  assert.ok(match, "console email should include a verification token");
  return decodeURIComponent(match[1]!);
}

async function withMutedConsoleEmail<T>(fn: () => Promise<T>): Promise<T> {
  const originalInfo = console.info;
  console.info = () => {};
  try {
    return await fn();
  } finally {
    console.info = originalInfo;
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
            if (err) reject(err);
            else resolve();
          })
          .catch(reject);
      });
    }),
);

test("email verification stores only hashes, rejects expired tokens, and prevents duplicate verified emails", async () => {
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

test("notification preferences and agreement contacts are editable only by involved accounts", async () => {
  const clientUser = await signIn(PRIVATE_KEYS[0]);
  const providerUser = await signIn(PRIVATE_KEYS[1]);
  const outsider = await signIn(PRIVATE_KEYS[2]);
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

test("contract action notifications skip, send, respect preferences, and dedupe", async () => {
  const clientUser = await signIn(PRIVATE_KEYS[0]);
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

test("activity API is private to involved accounts and returns newest indexed events first", async () => {
  const clientUser = await signIn(PRIVATE_KEYS[0]);
  const providerUser = await signIn(PRIVATE_KEYS[1]);
  const outsider = await signIn(PRIVATE_KEYS[2]);
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
