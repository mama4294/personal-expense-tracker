ALTER TABLE "NetWorthBalance"
ADD COLUMN "accountName" TEXT NOT NULL DEFAULT '';

UPDATE "NetWorthBalance"
SET "accountName" = CASE
  WHEN "assetType" = 'CHECKING' THEN 'Checking'
  WHEN "assetType" = 'SAVINGS' THEN 'Savings'
  WHEN "assetType" = 'BROKERAGE' THEN 'Brokerage'
  WHEN "assetType" = 'RSU' THEN 'RSU'
  WHEN "assetType" = 'FOUR_O_ONE_K' THEN '401k'
  WHEN "assetType" = 'ROTH_IRA' THEN 'Roth IRA'
  WHEN "assetType" = 'HSA' THEN 'HSA'
  WHEN "assetType" = 'CRYPTO' THEN 'Crypto'
  WHEN "assetType" = 'HOME_VALUE' THEN 'Home Value'
  WHEN "liabilityType" = 'MORTGAGE' THEN 'Mortgage'
  WHEN "liabilityType" = 'CAR_LOAN' THEN 'Car Loan'
  WHEN "liabilityType" = 'CREDIT_CARD' THEN 'Credit Card'
  ELSE 'Other'
END;
