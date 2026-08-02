-- CreateEnum
CREATE TYPE "EstadoTransporte" AS ENUM ('EN_RUTA', 'ENTREGADO');

-- CreateTable
CREATE TABLE "transportes" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "transportistaId" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "fechaSalida" TIMESTAMP(3) NOT NULL,
    "fechaLlegadaEstimada" TIMESTAMP(3),
    "fechaLlegadaReal" TIMESTAMP(3),
    "estado" "EstadoTransporte" NOT NULL DEFAULT 'EN_RUTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transportes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidencias" (
    "id" TEXT NOT NULL,
    "transporteId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transportes_loteId_key" ON "transportes"("loteId");

-- AddForeignKey
ALTER TABLE "transportes" ADD CONSTRAINT "transportes_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportes" ADD CONSTRAINT "transportes_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "transportistas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_transporteId_fkey" FOREIGN KEY ("transporteId") REFERENCES "transportes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
