/*
  Warnings:

  - Added the required column `puertoSalida` to the `exportaciones` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "exportaciones" ADD COLUMN     "puertoSalida" TEXT NOT NULL;
