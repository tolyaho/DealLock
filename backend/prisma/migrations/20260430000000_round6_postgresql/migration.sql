-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthNonce" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthNonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "clientAddress" TEXT NOT NULL,
    "providerAddress" TEXT NOT NULL,
    "clientEmail" TEXT,
    "providerEmail" TEXT,
    "projectTitle" TEXT NOT NULL DEFAULT '',
    "serviceTemplate" TEXT NOT NULL DEFAULT 'custom',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "contractVersion" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastAccessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agreementCreated" BOOLEAN NOT NULL DEFAULT true,
    "agreementAccepted" BOOLEAN NOT NULL DEFAULT true,
    "agreementFunded" BOOLEAN NOT NULL DEFAULT true,
    "milestoneSubmitted" BOOLEAN NOT NULL DEFAULT true,
    "milestoneReleased" BOOLEAN NOT NULL DEFAULT true,
    "milestoneRefunded" BOOLEAN NOT NULL DEFAULT true,
    "adjustmentRequested" BOOLEAN NOT NULL DEFAULT true,
    "adjustmentAccepted" BOOLEAN NOT NULL DEFAULT true,
    "adjustmentFunded" BOOLEAN NOT NULL DEFAULT true,
    "adjustmentSubmitted" BOOLEAN NOT NULL DEFAULT true,
    "adjustmentReleased" BOOLEAN NOT NULL DEFAULT true,
    "adjustmentRefunded" BOOLEAN NOT NULL DEFAULT true,
    "disputeOpened" BOOLEAN NOT NULL DEFAULT true,
    "settlementProposed" BOOLEAN NOT NULL DEFAULT true,
    "settlementAccepted" BOOLEAN NOT NULL DEFAULT true,
    "reviewClaimed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailNotificationLog" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT,
    "recipientUserId" TEXT,
    "contractAddress" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "txHash" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_address_idx" ON "Wallet"("address");

-- CreateIndex
CREATE INDEX "AuthNonce_address_purpose_idx" ON "AuthNonce"("address", "purpose");

-- CreateIndex
CREATE INDEX "AuthNonce_expiresAt_idx" ON "AuthNonce"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthNonce_usedAt_idx" ON "AuthNonce"("usedAt");

-- CreateIndex
CREATE INDEX "Agreement_chainId_clientAddress_idx" ON "Agreement"("chainId", "clientAddress");

-- CreateIndex
CREATE INDEX "Agreement_chainId_providerAddress_idx" ON "Agreement"("chainId", "providerAddress");

-- CreateIndex
CREATE INDEX "Agreement_createdByUserId_idx" ON "Agreement"("createdByUserId");

-- CreateIndex
CREATE INDEX "Agreement_lastAccessedAt_idx" ON "Agreement"("lastAccessedAt");

-- CreateIndex
CREATE INDEX "Agreement_contractVersion_idx" ON "Agreement"("contractVersion");

-- CreateIndex
CREATE UNIQUE INDEX "Agreement_chainId_contractAddress_key" ON "Agreement"("chainId", "contractAddress");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_email_idx" ON "EmailVerificationToken"("email");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "EmailNotificationLog_contractAddress_chainId_idx" ON "EmailNotificationLog"("contractAddress", "chainId");

-- CreateIndex
CREATE INDEX "EmailNotificationLog_txHash_idx" ON "EmailNotificationLog"("txHash");

-- CreateIndex
CREATE INDEX "EmailNotificationLog_agreementId_idx" ON "EmailNotificationLog"("agreementId");

-- CreateIndex
CREATE INDEX "EmailNotificationLog_recipientUserId_idx" ON "EmailNotificationLog"("recipientUserId");

-- CreateIndex
CREATE INDEX "EmailNotificationLog_status_idx" ON "EmailNotificationLog"("status");

-- CreateIndex
CREATE INDEX "EmailNotificationLog_createdAt_idx" ON "EmailNotificationLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailNotificationLog_eventType_txHash_recipientEmail_key" ON "EmailNotificationLog"("eventType", "txHash", "recipientEmail");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailNotificationLog" ADD CONSTRAINT "EmailNotificationLog_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailNotificationLog" ADD CONSTRAINT "EmailNotificationLog_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PostgreSQL-backed express-session store used by connect-pg-simple.
CREATE TABLE "session" (
    "sid" VARCHAR NOT NULL COLLATE "default",
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
