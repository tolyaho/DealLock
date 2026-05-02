import assert from "node:assert/strict";
import { test } from "node:test";
import type { Agreement } from "@prisma/client";
import {
  decodeEventLog,
  encodeAbiParameters,
  encodeEventTopics,
  parseAbiItem,
  type Log,
} from "viem";
import { DEALLOCK_FACTORY_V2_EVENTS } from "./abis.js";
import { decodeAgreementLog } from "./decode.js";

const agreement = {
  id: "agreement_1",
  contractAddress: "0x0000000000000000000000000000000000000101",
  chainId: 11155111,
  clientAddress: "0x0000000000000000000000000000000000000001",
  providerAddress: "0x0000000000000000000000000000000000000002",
  contractVersion: 4,
} as Agreement;

test("decodes V1-V4 event logs into normalized activity fields", () => {
  const event = parseAbiItem("event MilestoneReleased(uint256 indexed milestoneId, uint256 amount)");
  const log = {
    address: agreement.contractAddress,
    blockHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    blockNumber: 123n,
    data: encodeAbiParameters([{ type: "uint256" }], [500000000000000000n]),
    logIndex: 7,
    removed: false,
    topics: encodeEventTopics({
      abi: [event],
      eventName: "MilestoneReleased",
      args: { milestoneId: 2n },
    }),
    transactionHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    transactionIndex: 1,
  } as Log<bigint, number, false>;

  const decoded = decodeAgreementLog({
    agreement,
    log,
    occurredAt: new Date("2026-04-30T00:00:00.000Z"),
  });

  assert.ok(decoded);
  assert.equal(decoded.eventName, "MilestoneReleased");
  assert.equal(decoded.itemType, "milestone");
  assert.equal(decoded.itemId, 2);
  assert.equal(decoded.actorAddress, agreement.clientAddress);
  assert.equal(decoded.counterpartyAddress, agreement.providerAddress);
  assert.equal(decoded.amountWei, "500000000000000000");
});

test("decodes actual V4 auto-release event names", () => {
  const event = parseAbiItem("event AdjustmentAutoReleased(uint256 indexed adjustmentId, uint256 amount)");
  const log = {
    address: agreement.contractAddress,
    blockHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    blockNumber: 124n,
    data: encodeAbiParameters([{ type: "uint256" }], [100n]),
    logIndex: 8,
    removed: false,
    topics: encodeEventTopics({
      abi: [event],
      eventName: "AdjustmentAutoReleased",
      args: { adjustmentId: 1n },
    }),
    transactionHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    transactionIndex: 1,
  } as Log<bigint, number, false>;

  const decoded = decodeAgreementLog({
    agreement,
    log,
    occurredAt: new Date("2026-04-30T00:00:00.000Z"),
  });

  assert.ok(decoded);
  assert.equal(decoded.eventName, "AdjustmentAutoReleased");
  assert.equal(decoded.itemType, "adjustment");
  assert.equal(decoded.itemId, 1);
  assert.equal(decoded.actorAddress, agreement.providerAddress);
});

test("decodes Factory V2 AgreementCreated payment token field", () => {
  const event = parseAbiItem(
    "event AgreementCreated(address indexed agreement, address indexed client, address indexed provider, uint256 chainId, uint256 contractVersion, address paymentToken, uint256 milestoneCount, uint256 totalAmount, uint256 reviewPeriod, bytes32 metadataHash)",
  );
  const paymentToken = "0x0000000000000000000000000000000000000abc" as `0x${string}`;
  const log = {
    data: encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "bytes32" },
      ],
      [
        11155111n,
        5n,
        paymentToken,
        2n,
        500000000n,
        259200n,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ],
    ),
    topics: encodeEventTopics({
      abi: [event],
      eventName: "AgreementCreated",
      args: {
        agreement: agreement.contractAddress as `0x${string}`,
        client: agreement.clientAddress as `0x${string}`,
        provider: agreement.providerAddress as `0x${string}`,
      },
    }),
  };

  const decoded = decodeEventLog({
    abi: DEALLOCK_FACTORY_V2_EVENTS,
    data: log.data,
    topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
  });
  const args = decoded.args as { contractVersion: bigint; paymentToken: string; totalAmount: bigint };

  assert.equal(decoded.eventName, "AgreementCreated");
  assert.equal(args.contractVersion, 5n);
  assert.equal(args.paymentToken.toLowerCase(), paymentToken);
  assert.equal(args.totalAmount, 500000000n);
});
