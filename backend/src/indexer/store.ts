import { Prisma } from "@prisma/client";
import { db } from "../db.js";
import type { DecodedChainEvent } from "./decode.js";

export async function storeChainEvent(event: DecodedChainEvent): Promise<{
  id: string;
  inserted: boolean;
}> {
  try {
    const created = await db.chainEvent.create({
      data: {
        agreementId: event.agreementId,
        chainId: event.chainId,
        contractAddress: event.contractAddress,
        contractVersion: event.contractVersion,
        blockNumber: event.blockNumber,
        blockHash: event.blockHash,
        txHash: event.txHash,
        logIndex: event.logIndex,
        eventName: event.eventName,
        itemType: event.itemType,
        itemId: event.itemId,
        actorAddress: event.actorAddress,
        counterpartyAddress: event.counterpartyAddress,
        amountWei: event.amountWei,
        amountRaw: event.amountRaw,
        paymentTokenAddress: event.paymentTokenAddress,
        paymentSymbol: event.paymentSymbol,
        paymentDecimals: event.paymentDecimals,
        payloadJson: event.payloadJson as Prisma.InputJsonValue,
        occurredAt: event.occurredAt,
      },
    });
    return { id: created.id, inserted: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await db.chainEvent.findUnique({
        where: {
          chainId_txHash_logIndex: {
            chainId: event.chainId,
            txHash: event.txHash,
            logIndex: event.logIndex,
          },
        },
        select: { id: true },
      });
      if (existing) return { id: existing.id, inserted: false };
    }
    throw err;
  }
}

export async function markNotificationsProcessed(chainEventId: string): Promise<void> {
  await db.chainEvent.update({
    where: { id: chainEventId },
    data: { notificationsProcessedAt: new Date() },
  });
}
