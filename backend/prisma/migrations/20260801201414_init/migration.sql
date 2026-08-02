-- CreateEnum
CREATE TYPE "RolNombre" AS ENUM ('ADMIN', 'PRODUCTOR', 'COOPERATIVA', 'CERTIFICADORA', 'TRANSPORTISTA', 'EXPORTADOR', 'COMPRADOR');

-- CreateEnum
CREATE TYPE "TipoOrganizacion" AS ENUM ('COOPERATIVA', 'CERTIFICADORA', 'TRANSPORTISTA', 'EXPORTADOR');

-- CreateEnum
CREATE TYPE "EstadoLote" AS ENUM ('CREADO', 'FERMENTANDO', 'CERTIFICADO', 'EN_TRANSPORTE', 'EXPORTADO');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('CREACION', 'FERMENTACION', 'CERTIFICACION', 'TRANSPORTE', 'EXPORTACION', 'CORRECCION');

-- CreateEnum
CREATE TYPE "EstadoCertificado" AS ENUM ('VIGENTE', 'VENCIDO', 'REVOCADO');

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FAILED', 'EXPORT', 'OTHER');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "nombre" "RolNombre" NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "rolId" TEXT NOT NULL,
    "organizacionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizaciones" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoOrganizacion" NOT NULL,
    "mspId" TEXT,
    "esValidadorRed" BOOLEAN NOT NULL DEFAULT false,
    "direccion" TEXT,
    "contacto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooperativas" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "ubicacion" TEXT,

    CONSTRAINT "cooperativas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificadoras" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "entidadAcreditadora" TEXT,
    "numeroAcreditacion" TEXT,
    "vigenciaAcreditacion" TIMESTAMP(3),

    CONSTRAINT "certificadoras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transportistas" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "tipoVehiculo" TEXT,
    "placa" TEXT,

    CONSTRAINT "transportistas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exportadores" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "paisOperacion" TEXT,
    "licenciaExportacion" TEXT,

    CONSTRAINT "exportadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productores" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "cooperativaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "capacidadProductivaMaximaKg" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes" (
    "id" TEXT NOT NULL,
    "productorId" TEXT NOT NULL,
    "cooperativaId" TEXT NOT NULL,
    "estado" "EstadoLote" NOT NULL DEFAULT 'CREADO',
    "fechaCosecha" TIMESTAMP(3) NOT NULL,
    "fechaTransporte" TIMESTAMP(3),
    "fechaExportacion" TIMESTAMP(3),
    "pesoInicialKg" DECIMAL(10,2),
    "hashCertificado" TEXT,
    "ultimaTxHashBlockchain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "actorUsuarioId" TEXT NOT NULL,
    "actorOrganizacionId" TEXT,
    "datosEspecificos" JSONB,
    "hashTransaccionBlockchain" TEXT NOT NULL,
    "firmaDigital" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificados" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "certificadoraId" TEXT NOT NULL,
    "tipoCertificacion" TEXT NOT NULL,
    "archivoPdfUrl" TEXT NOT NULL,
    "hashArchivo" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3),
    "estado" "EstadoCertificado" NOT NULL DEFAULT 'VIGENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exportaciones" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "exportadorId" TEXT NOT NULL,
    "empresaCompradora" TEXT NOT NULL,
    "paisDestino" TEXT NOT NULL,
    "fechaExportacion" TIMESTAMP(3) NOT NULL,
    "numeroDocumentoAduanero" TEXT,
    "hashTransaccionBlockchain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exportaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "entidadAfectada" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "accion" "AccionAuditoria" NOT NULL,
    "usuarioId" TEXT,
    "valoresAnteriores" JSONB,
    "valoresNuevos" JSONB,
    "ip" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizaciones_mspId_key" ON "organizaciones"("mspId");

-- CreateIndex
CREATE UNIQUE INDEX "cooperativas_organizacionId_key" ON "cooperativas"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "certificadoras_organizacionId_key" ON "certificadoras"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "transportistas_organizacionId_key" ON "transportistas"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "exportadores_organizacionId_key" ON "exportadores"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "productores_usuarioId_key" ON "productores"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "productores_cedula_key" ON "productores"("cedula");

-- CreateIndex
CREATE UNIQUE INDEX "exportaciones_loteId_key" ON "exportaciones"("loteId");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooperativas" ADD CONSTRAINT "cooperativas_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificadoras" ADD CONSTRAINT "certificadoras_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportistas" ADD CONSTRAINT "transportistas_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exportadores" ADD CONSTRAINT "exportadores_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productores" ADD CONSTRAINT "productores_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productores" ADD CONSTRAINT "productores_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_productorId_fkey" FOREIGN KEY ("productorId") REFERENCES "productores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_actorUsuarioId_fkey" FOREIGN KEY ("actorUsuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_actorOrganizacionId_fkey" FOREIGN KEY ("actorOrganizacionId") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_certificadoraId_fkey" FOREIGN KEY ("certificadoraId") REFERENCES "certificadoras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exportaciones" ADD CONSTRAINT "exportaciones_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exportaciones" ADD CONSTRAINT "exportaciones_exportadorId_fkey" FOREIGN KEY ("exportadorId") REFERENCES "exportadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
