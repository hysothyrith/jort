-- DropForeignKey
ALTER TABLE "Tenancy" DROP CONSTRAINT "Tenancy_entryGateId_fkey";

-- AlterTable
ALTER TABLE "Tenancy" ALTER COLUMN "entryTime" DROP NOT NULL,
ALTER COLUMN "entryGateId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_entryGateId_fkey" FOREIGN KEY ("entryGateId") REFERENCES "Gate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
