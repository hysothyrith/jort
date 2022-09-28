/*
  Warnings:

  - Added the required column `name` to the `Gate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `ParkingLot` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('SMALL', 'LARGE');

-- AlterTable
ALTER TABLE "Gate" ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ParkingLot" ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Tenancy" ADD COLUMN     "vechicleType" "VehicleType";
