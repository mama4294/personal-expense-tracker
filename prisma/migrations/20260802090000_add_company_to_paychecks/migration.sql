-- DropIndex
DROP INDEX "MonthlyIncome_month_personId_key";

-- AlterTable
ALTER TABLE "MonthlyIncome" ADD COLUMN     "companyId" TEXT;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Company_personId_idx" ON "Company"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_personId_name_key" ON "Company"("personId", "name");

-- CreateIndex
CREATE INDEX "MonthlyIncome_companyId_idx" ON "MonthlyIncome"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyIncome_month_personId_companyId_key" ON "MonthlyIncome"("month", "personId", "companyId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyIncome" ADD CONSTRAINT "MonthlyIncome_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

