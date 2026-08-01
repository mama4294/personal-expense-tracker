-- AlterTable
ALTER TABLE "NetWorthBalance" ADD COLUMN     "personId" TEXT;

-- CreateIndex
CREATE INDEX "NetWorthBalance_personId_idx" ON "NetWorthBalance"("personId");

-- AddForeignKey
ALTER TABLE "NetWorthBalance" ADD CONSTRAINT "NetWorthBalance_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
