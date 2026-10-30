-- Profile display name: optional first/last name on User. Nullable so existing
-- accounts (which signed in by wallet before names were collected) remain valid.
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
