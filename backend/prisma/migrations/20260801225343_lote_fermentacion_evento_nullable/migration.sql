-- AlterTable
ALTER TABLE "eventos" ALTER COLUMN "hashTransaccionBlockchain" DROP NOT NULL,
ALTER COLUMN "firmaDigital" DROP NOT NULL;

-- AlterTable
ALTER TABLE "lotes" ADD COLUMN     "fechaSecado" TIMESTAMP(3),
ADD COLUMN     "pesoFermentadoKg" DECIMAL(10,2);
