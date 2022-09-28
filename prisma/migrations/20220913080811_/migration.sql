/*
  Warnings:

  - You are about to drop the `EntryGate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExitGate` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EntryGate" DROP CONSTRAINT "EntryGate_parkingLotId_fkey";

-- DropForeignKey
ALTER TABLE "ExitGate" DROP CONSTRAINT "ExitGate_parkingLotId_fkey";

-- DropForeignKey
ALTER TABLE "Tenancy" DROP CONSTRAINT "Tenancy_entryGateId_fkey";

-- DropForeignKey
ALTER TABLE "Tenancy" DROP CONSTRAINT "Tenancy_exitGateId_fkey";

-- DropTable
DROP TABLE "EntryGate";

-- DropTable
DROP TABLE "ExitGate";

-- CreateTable
CREATE TABLE "Gate" (
    "id" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,

    CONSTRAINT "Gate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Gate" ADD CONSTRAINT "Gate_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_entryGateId_fkey" FOREIGN KEY ("entryGateId") REFERENCES "Gate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_exitGateId_fkey" FOREIGN KEY ("exitGateId") REFERENCES "Gate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
