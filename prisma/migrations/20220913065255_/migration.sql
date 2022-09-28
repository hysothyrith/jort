/*
  Warnings:

  - You are about to drop the `Todo` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Todo";

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingLot" (
    "id" TEXT NOT NULL,
    "smallVehicleCapacity" INTEGER NOT NULL,
    "largeVehicleCapacity" INTEGER NOT NULL,
    "partnerId" TEXT NOT NULL,

    CONSTRAINT "ParkingLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryGate" (
    "id" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,

    CONSTRAINT "EntryGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExitGate" (
    "id" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,

    CONSTRAINT "ExitGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenancy" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "vehiclePlateNumber" TEXT,
    "entryTime" TIMESTAMP(3) NOT NULL,
    "entryGateId" TEXT NOT NULL,
    "exitTime" TIMESTAMP(3),
    "exitGateId" TEXT,

    CONSTRAINT "Tenancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageCapture" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "captureTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClientToken_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ParkingLot" ADD CONSTRAINT "ParkingLot_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryGate" ADD CONSTRAINT "EntryGate_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitGate" ADD CONSTRAINT "ExitGate_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_entryGateId_fkey" FOREIGN KEY ("entryGateId") REFERENCES "EntryGate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_exitGateId_fkey" FOREIGN KEY ("exitGateId") REFERENCES "ExitGate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageCapture" ADD CONSTRAINT "ImageCapture_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
