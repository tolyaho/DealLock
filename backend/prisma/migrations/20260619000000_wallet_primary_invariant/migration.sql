-- Enforce the database side of the primary-wallet invariant:
-- a user may have many wallets, but no more than one primary wallet.
CREATE UNIQUE INDEX "Wallet_one_primary_per_user"
ON "Wallet"("userId")
WHERE "isPrimary" = true;
