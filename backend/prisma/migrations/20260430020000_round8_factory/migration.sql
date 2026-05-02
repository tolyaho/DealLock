-- Round 8: Factory Contract + On-Chain Agreement Registry

-- Extend Agreement with factory-related fields
ALTER TABLE "Agreement" ADD COLUMN "creationSource" TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE "Agreement" ADD COLUMN "factoryAddress" TEXT;
ALTER TABLE "Agreement" ADD COLUMN "factoryTxHash" TEXT;
ALTER TABLE "Agreement" ADD COLUMN "factoryLogIndex" INTEGER;
ALTER TABLE "Agreement" ADD COLUMN "metadataHash" TEXT;

-- Add FactoryContract model for indexer tracking
CREATE TABLE "FactoryContract" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "contractVersion" INTEGER NOT NULL DEFAULT 4,
    "deploymentBlock" BIGINT,
    "lastIndexedBlock" BIGINT,
    "lastIndexedAt" TIMESTAMP(3),
    "indexerStatus" TEXT NOT NULL DEFAULT 'active',
    "indexerError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactoryContract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FactoryContract_chainId_address_key" ON "FactoryContract"("chainId", "address");
CREATE INDEX "FactoryContract_chainId_indexerStatus_idx" ON "FactoryContract"("chainId", "indexerStatus");
