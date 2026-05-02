-- Round 10: multi-asset payment metadata for agreements, events, and factory indexing.

ALTER TABLE "Agreement" ADD COLUMN "paymentAssetKind" TEXT NOT NULL DEFAULT 'native';
ALTER TABLE "Agreement" ADD COLUMN "paymentTokenAddress" TEXT;
ALTER TABLE "Agreement" ADD COLUMN "paymentSymbol" TEXT NOT NULL DEFAULT 'ETH';
ALTER TABLE "Agreement" ADD COLUMN "paymentDecimals" INTEGER NOT NULL DEFAULT 18;
ALTER TABLE "Agreement" ADD COLUMN "factoryVersion" INTEGER;

ALTER TABLE "ChainEvent" ADD COLUMN "amountRaw" TEXT;
ALTER TABLE "ChainEvent" ADD COLUMN "paymentTokenAddress" TEXT;
ALTER TABLE "ChainEvent" ADD COLUMN "paymentSymbol" TEXT;
ALTER TABLE "ChainEvent" ADD COLUMN "paymentDecimals" INTEGER;

ALTER TABLE "FactoryContract" ADD COLUMN "factoryVersion" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "Agreement_paymentAssetKind_idx" ON "Agreement"("paymentAssetKind");
CREATE INDEX "Agreement_paymentTokenAddress_idx" ON "Agreement"("paymentTokenAddress");
