-- Manual expenses were previously stored as positive values. Keep bank-imported
-- amounts as supplied (expenses negative, refunds/credits positive), and align
-- existing manual expense entries with that convention.
UPDATE "Transaction"
SET "amount" = -ABS("amount")
WHERE "isManual" = TRUE AND "amount" > 0;
