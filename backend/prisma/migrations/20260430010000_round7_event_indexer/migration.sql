-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN "deploymentTxHash" TEXT;
ALTER TABLE "Agreement" ADD COLUMN "deploymentBlockNumber" BIGINT;
ALTER TABLE "Agreement" ADD COLUMN "indexingStartBlock" BIGINT;
ALTER TABLE "Agreement" ADD COLUMN "lastIndexedBlock" BIGINT;
ALTER TABLE "Agreement" ADD COLUMN "lastIndexedAt" TIMESTAMP(3);
ALTER TABLE "Agreement" ADD COLUMN "indexerStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Agreement" ADD COLUMN "indexerError" TEXT;

-- AlterTable
ALTER TABLE "EmailNotificationLog" ADD COLUMN "chainEventId" TEXT;
ALTER TABLE "EmailNotificationLog" ADD COLUMN "logIndex" INTEGER;
ALTER TABLE "EmailNotificationLog" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'app';

-- CreateTable
CREATE TABLE "ChainEvent" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "contractVersion" INTEGER NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockHash" TEXT,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "eventName" TEXT NOT NULL,
    "itemType" TEXT,
    "itemId" INTEGER,
    "actorAddress" TEXT,
    "counterpartyAddress" TEXT,
    "amountWei" TEXT,
    "payloadJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notificationsProcessedAt" TIMESTAMP(3),

    CONSTRAINT "ChainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "chainId" INTEGER,
    "agreementsSeen" INTEGER NOT NULL DEFAULT 0,
    "eventsFound" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "IndexerRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Agreement_indexerStatus_idx" ON "Agreement"("indexerStatus");

-- CreateIndex
CREATE INDEX "Agreement_lastIndexedBlock_idx" ON "Agreement"("lastIndexedBlock");

-- CreateIndex
CREATE UNIQUE INDEX "ChainEvent_chainId_txHash_logIndex_key" ON "ChainEvent"("chainId", "txHash", "logIndex");

-- CreateIndex
CREATE INDEX "ChainEvent_agreementId_blockNumber_idx" ON "ChainEvent"("agreementId", "blockNumber");

-- CreateIndex
CREATE INDEX "ChainEvent_chainId_contractAddress_blockNumber_idx" ON "ChainEvent"("chainId", "contractAddress", "blockNumber");

-- CreateIndex
CREATE INDEX "ChainEvent_eventName_idx" ON "ChainEvent"("eventName");

-- CreateIndex
CREATE INDEX "ChainEvent_occurredAt_idx" ON "ChainEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "EmailNotificationLog_chainEventId_idx" ON "EmailNotificationLog"("chainEventId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailNotificationLog_chainEventId_recipientEmail_key" ON "EmailNotificationLog"("chainEventId", "recipientEmail");

-- AddForeignKey
ALTER TABLE "ChainEvent" ADD CONSTRAINT "ChainEvent_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailNotificationLog" ADD CONSTRAINT "EmailNotificationLog_chainEventId_fkey" FOREIGN KEY ("chainEventId") REFERENCES "ChainEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
