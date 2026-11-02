-- One Account table for spending and net worth, with logos moved to the
-- company (Institution) an account is held at.

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Institution_name_key" ON "Institution"("name");

-- AlterTable
ALTER TABLE "Account" ADD COLUMN "companyId" TEXT,
ADD COLUMN "assetType" "AssetType",
ADD COLUMN "liabilityType" "LiabilityType";

CREATE INDEX "Account_companyId_idx" ON "Account"("companyId");

ALTER TABLE "Account" ADD CONSTRAINT "Account_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A spending account and a net worth account with the same name become one:
-- the spending account takes the net worth category.
UPDATE "Account" a
SET "assetType" = n."assetType",
    "liabilityType" = n."liabilityType"
FROM "NetWorthAccount" n
WHERE n."name" = a."name";

-- Its owner carries over only where the spending account had no split of its
-- own; an existing spending split wins.
INSERT INTO "AccountSplit" ("accountId", "personId", "percent")
SELECT a."id", n."personId", 100
FROM "NetWorthAccount" n
JOIN "Account" a ON a."name" = n."name"
WHERE n."personId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "AccountSplit" s WHERE s."accountId" = a."id");

-- Every other net worth account becomes an account of its own, keeping its id
-- so its balances still point at it.
INSERT INTO "Account" ("id", "name", "assetType", "liabilityType", "createdAt", "updatedAt")
SELECT n."id", n."name", n."assetType", n."liabilityType", n."createdAt", n."updatedAt"
FROM "NetWorthAccount" n
WHERE NOT EXISTS (SELECT 1 FROM "Account" a WHERE a."name" = n."name");

-- An owner becomes a 100% split; jointly held (null) stays without one.
INSERT INTO "AccountSplit" ("accountId", "personId", "percent")
SELECT n."id", n."personId", 100
FROM "NetWorthAccount" n
JOIN "Account" a ON a."id" = n."id"
WHERE n."personId" IS NOT NULL;

-- Balances follow their account to its new home.
ALTER TABLE "NetWorthBalance" DROP CONSTRAINT "NetWorthBalance_accountId_fkey";

UPDATE "NetWorthBalance" b
SET "accountId" = a."id"
FROM "NetWorthAccount" n
JOIN "Account" a ON a."name" = n."name"
WHERE b."accountId" = n."id";

ALTER TABLE "NetWorthBalance" ADD CONSTRAINT "NetWorthBalance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Account logos can't be moved: nothing says which company they belong to.
-- Upload them again on each company.
DROP TABLE "NetWorthAccount";
