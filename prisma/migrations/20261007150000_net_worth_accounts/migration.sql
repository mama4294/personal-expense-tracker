CREATE TABLE "NetWorthAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" "AssetType",
    "liabilityType" "LiabilityType",
    "personId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NetWorthAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NetWorthAccount_name_key" ON "NetWorthAccount"("name");
CREATE INDEX "NetWorthAccount_personId_idx" ON "NetWorthAccount"("personId");

ALTER TABLE "NetWorthBalance" ADD COLUMN "accountId" TEXT;

-- Preserve the existing monthly rows while creating reusable account records.
INSERT INTO "NetWorthAccount" ("id", "name", "assetType", "liabilityType", "personId")
SELECT
  'nwa_' || md5("accountName" || '|' || COALESCE("assetType"::text, '') || '|' || COALESCE("liabilityType"::text, '') || '|' || COALESCE("personId", 'joint')),
  CASE
    WHEN (SELECT COUNT(DISTINCT COALESCE(other."personId", 'joint')) FROM "NetWorthBalance" other WHERE other."accountName" = b."accountName") > 1
      AND "personId" IS NOT NULL
      THEN "accountName" || ' (' || p."name" || ')'
    ELSE "accountName"
  END,
  "assetType",
  "liabilityType",
  "personId"
FROM "NetWorthBalance" b
LEFT JOIN "Person" p ON p."id" = b."personId"
GROUP BY "accountName", "assetType", "liabilityType", "personId", p."name";

UPDATE "NetWorthBalance" b
SET "accountId" = a."id"
FROM "NetWorthAccount" a
WHERE a."assetType" IS NOT DISTINCT FROM b."assetType"
  AND a."liabilityType" IS NOT DISTINCT FROM b."liabilityType"
  AND a."personId" IS NOT DISTINCT FROM b."personId"
  AND a."name" = CASE
    WHEN b."personId" IS NOT NULL AND EXISTS (
      SELECT 1 FROM "NetWorthBalance" other
      WHERE other."accountName" = b."accountName"
        AND other."personId" IS DISTINCT FROM b."personId"
    ) THEN b."accountName" || ' (' || (SELECT p."name" FROM "Person" p WHERE p."id" = b."personId") || ')'
    ELSE b."accountName"
  END;

ALTER TABLE "NetWorthBalance"
ADD CONSTRAINT "NetWorthBalance_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "NetWorthAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "NetWorthBalance_accountId_idx" ON "NetWorthBalance"("accountId");
