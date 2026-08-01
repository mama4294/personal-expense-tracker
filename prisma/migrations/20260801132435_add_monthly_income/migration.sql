-- CreateTable
CREATE TABLE "MonthlyIncome" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "personId" TEXT NOT NULL,
    "annualSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossIncome" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "medical" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dentalVision" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "retirement401k" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hsa" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxes" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyIncome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthlyIncome_month_idx" ON "MonthlyIncome"("month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyIncome_month_personId_key" ON "MonthlyIncome"("month", "personId");

-- AddForeignKey
ALTER TABLE "MonthlyIncome" ADD CONSTRAINT "MonthlyIncome_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
