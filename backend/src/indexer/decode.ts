import { decodeEventLog, type Abi, type Address, type Hex, type Log } from "viem";
import type { Agreement } from "@prisma/client";
import { eventAbiForVersion } from "./abis.js";
import { notificationRuleForEvent } from "./eventMap.js";

export interface DecodedChainEvent {
  agreementId: string;
  chainId: number;
  contractAddress: string;
  contractVersion: number;
  blockNumber: bigint;
  blockHash: string | null;
  txHash: string;
  logIndex: number;
  eventName: string;
  itemType: string | null;
  itemId: number | null;
  actorAddress: string | null;
  counterpartyAddress: string | null;
  amountWei: string | null;
  amountRaw: string | null;
  paymentTokenAddress: string | null;
  paymentSymbol: string | null;
  paymentDecimals: number | null;
  payloadJson: Record<string, unknown>;
  occurredAt: Date;
}

type NamedArgs = Record<string, unknown>;

function normalizeAddress(value: unknown): string | null {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)
    ? value.toLowerCase()
    : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" && Number.isInteger(value)) return value;
  return null;
}

function amountFrom(args: NamedArgs, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "bigint") return value.toString();
    if (typeof value === "string" && /^\d+$/.test(value)) return value;
  }
  return null;
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        jsonSafe(normalizeAddress(nested) ?? nested),
      ]),
    );
  }
  return normalizeAddress(value) ?? value;
}

function itemTypeForEvent(eventName: string): string | null {
  if (eventName.startsWith("Milestone")) return "milestone";
  if (eventName.startsWith("Adjustment")) return "adjustment";
  if (eventName.startsWith("Agreement")) return "agreement";
  return null;
}

function itemIdForEvent(eventName: string, args: NamedArgs): number | null {
  if (eventName.startsWith("Milestone")) return asNumber(args.milestoneId);
  if (eventName.startsWith("Adjustment")) return asNumber(args.adjustmentId);
  return null;
}

function inferredActor(eventName: string, args: NamedArgs, agreement: Agreement): string | null {
  const provider = normalizeAddress(args.provider);
  if (provider) return provider;
  const client = normalizeAddress(args.client);
  if (client) return client;
  const proposer = normalizeAddress(args.proposer);
  if (proposer) return proposer;

  const rule = notificationRuleForEvent(eventName);
  if (rule?.actorRole === "client") return agreement.clientAddress;
  if (rule?.actorRole === "provider") return agreement.providerAddress;
  return null;
}

function counterpartyFor(actorAddress: string | null, agreement: Agreement): string | null {
  if (actorAddress === agreement.clientAddress) return agreement.providerAddress;
  if (actorAddress === agreement.providerAddress) return agreement.clientAddress;
  return null;
}

function namedArgs(args: unknown): NamedArgs {
  if (!args || Array.isArray(args) || typeof args !== "object") return {};
  return args as NamedArgs;
}

export function decodeAgreementLog(args: {
  agreement: Agreement;
  log: Log<bigint, number, false>;
  occurredAt: Date;
  abi?: Abi;
}): DecodedChainEvent | null {
  if (
    args.log.blockNumber == null ||
    args.log.transactionHash == null ||
    args.log.logIndex == null
  ) {
    return null;
  }

  try {
    const decoded = decodeEventLog({
      abi: args.abi ?? eventAbiForVersion(args.agreement.contractVersion),
      data: args.log.data,
      topics: args.log.topics as [Hex, ...Hex[]],
    });
    if (!decoded.eventName) return null;
    const blockNumber = args.log.blockNumber;
    const txHash = args.log.transactionHash;
    const logIndex = args.log.logIndex;
    if (blockNumber == null || txHash == null || logIndex == null) return null;
    const eventArgs = namedArgs(decoded.args);
    const actorAddress = inferredActor(decoded.eventName, eventArgs, args.agreement);
    const payloadJson = jsonSafe(eventArgs) as Record<string, unknown>;

    return {
      agreementId: args.agreement.id,
      chainId: args.agreement.chainId,
      contractAddress: args.agreement.contractAddress,
      contractVersion: args.agreement.contractVersion,
      blockNumber,
      blockHash: args.log.blockHash ?? null,
      txHash,
      logIndex,
      eventName: decoded.eventName,
      itemType: itemTypeForEvent(decoded.eventName),
      itemId: itemIdForEvent(decoded.eventName, eventArgs),
      actorAddress,
      counterpartyAddress: counterpartyFor(actorAddress, args.agreement),
      amountWei: amountFrom(eventArgs, "amount", "providerAmount", "clientAmount"),
      amountRaw: amountFrom(eventArgs, "amount", "providerAmount", "clientAmount"),
      paymentTokenAddress: args.agreement.paymentTokenAddress,
      paymentSymbol: args.agreement.paymentSymbol,
      paymentDecimals: args.agreement.paymentDecimals,
      payloadJson,
      occurredAt: args.occurredAt,
    };
  } catch {
    return null;
  }
}

export function versionEventAbi(version: number): Abi {
  return eventAbiForVersion(version);
}

export type IndexedAddress = Address;
