-- DropIndex
DROP INDEX "MonthlyIncome_month_personId_companyId_key";

-- DropIndex
DROP INDEX "MonthlyIncome_month_idx";

-- AlterTable
ALTER TABLE "MonthlyIncome" RENAME COLUMN "month" TO "date";

-- CreateIndex
CREATE INDEX "MonthlyIncome_date_idx" ON "MonthlyIncome"("date");
