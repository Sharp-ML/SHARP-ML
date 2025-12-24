-- DropIndex
DROP INDEX IF EXISTS "User_stripeCustomerId_key";

-- DropIndex
DROP INDEX IF EXISTS "User_stripeSubscriptionId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "stripeCustomerId",
DROP COLUMN IF EXISTS "stripePriceId",
DROP COLUMN IF EXISTS "stripeSubscriptionId";
