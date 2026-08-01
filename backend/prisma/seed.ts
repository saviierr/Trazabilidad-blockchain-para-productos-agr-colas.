/**
 * DATOS DE PRUEBA — no representan actores reales del sistema (regla dura #1
 * del plan maestro). Un usuario de prueba por cada rol de la matriz C7, con
 * contraseñas conocidas para poder probar login y guards en WP-04.
 *
 *   admin@test.com          Admin123!
 *   productor@test.com      Productor123!
 *   cooperativa@test.com    Cooperativa123!
 *   certificadora@test.com  Certificadora123!
 *   transportista@test.com  Transportista123!
 *   exportador@test.com     Exportador123!
 *   comprador@test.com      Comprador123!
 */
import { PrismaClient, RolNombre, TipoOrganizacion } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ROLES: { nombre: RolNombre; descripcion: string }[] = [
  { nombre: RolNombre.ADMIN, descripcion: 'Administrador del sistema' },
  { nombre: RolNombre.PRODUCTOR, descripcion: 'Productor de cacao' },
  { nombre: RolNombre.COOPERATIVA, descripcion: 'Cooperativa / centro de acopio' },
  { nombre: RolNombre.CERTIFICADORA, descripcion: 'Entidad certificadora' },
  { nombre: RolNombre.TRANSPORTISTA, descripcion: 'Transportista' },
  { nombre: RolNombre.EXPORTADOR, descripcion: 'Exportador' },
  { nombre: RolNombre.COMPRADOR, descripcion: 'Comprador (solo lectura)' },
];

async function hash(password: string) {
  return bcrypt.hash(password, 10);
}

async function main() {
  for (const rol of ROLES) {
    await prisma.rol.upsert({
      where: { nombre: rol.nombre },
      update: {},
      create: rol,
    });
  }

  const cooperativaOrg = await prisma.organizacion.upsert({
    where: { mspId: 'cooperativa-demo-msp' },
    update: {},
    create: {
      nombre: 'Cooperativa Demo',
      tipo: TipoOrganizacion.COOPERATIVA,
      mspId: 'cooperativa-demo-msp',
      esValidadorRed: true,
    },
  });
  await prisma.cooperativa.upsert({
    where: { organizacionId: cooperativaOrg.id },
    update: {},
    create: { organizacionId: cooperativaOrg.id, ubicacion: 'Los Ríos, Ecuador' },
  });

  const certificadoraOrg = await prisma.organizacion.upsert({
    where: { mspId: 'certificadora-demo-msp' },
    update: {},
    create: {
      nombre: 'Certificadora Demo',
      tipo: TipoOrganizacion.CERTIFICADORA,
      mspId: 'certificadora-demo-msp',
      esValidadorRed: true,
    },
  });
  await prisma.certificadora.upsert({
    where: { organizacionId: certificadoraOrg.id },
    update: {},
    create: { organizacionId: certificadoraOrg.id },
  });

  const transportistaOrg = await prisma.organizacion.upsert({
    where: { mspId: 'transportista-demo-msp' },
    update: {},
    create: {
      nombre: 'Transportista Demo',
      tipo: TipoOrganizacion.TRANSPORTISTA,
      mspId: 'transportista-demo-msp',
      esValidadorRed: false,
    },
  });
  await prisma.transportista.upsert({
    where: { organizacionId: transportistaOrg.id },
    update: {},
    create: { organizacionId: transportistaOrg.id },
  });

  const exportadorOrg = await prisma.organizacion.upsert({
    where: { mspId: 'exportador-demo-msp' },
    update: {},
    create: {
      nombre: 'Exportador Demo',
      tipo: TipoOrganizacion.EXPORTADOR,
      mspId: 'exportador-demo-msp',
      esValidadorRed: true,
    },
  });
  await prisma.exportador.upsert({
    where: { organizacionId: exportadorOrg.id },
    update: {},
    create: { organizacionId: exportadorOrg.id },
  });

  const usuarios: {
    email: string;
    password: string;
    nombre: string;
    rol: RolNombre;
    organizacionId?: string;
  }[] = [
    {
      email: 'admin@test.com',
      password: 'Admin123!',
      nombre: 'Admin de prueba',
      rol: RolNombre.ADMIN,
    },
    {
      email: 'productor@test.com',
      password: 'Productor123!',
      nombre: 'Productor de prueba',
      rol: RolNombre.PRODUCTOR,
    },
    {
      email: 'cooperativa@test.com',
      password: 'Cooperativa123!',
      nombre: 'Cooperativa de prueba',
      rol: RolNombre.COOPERATIVA,
      organizacionId: cooperativaOrg.id,
    },
    {
      email: 'certificadora@test.com',
      password: 'Certificadora123!',
      nombre: 'Certificadora de prueba',
      rol: RolNombre.CERTIFICADORA,
      organizacionId: certificadoraOrg.id,
    },
    {
      email: 'transportista@test.com',
      password: 'Transportista123!',
      nombre: 'Transportista de prueba',
      rol: RolNombre.TRANSPORTISTA,
      organizacionId: transportistaOrg.id,
    },
    {
      email: 'exportador@test.com',
      password: 'Exportador123!',
      nombre: 'Exportador de prueba',
      rol: RolNombre.EXPORTADOR,
      organizacionId: exportadorOrg.id,
    },
    {
      email: 'comprador@test.com',
      password: 'Comprador123!',
      nombre: 'Comprador de prueba',
      rol: RolNombre.COMPRADOR,
    },
  ];

  for (const u of usuarios) {
    const rol = await prisma.rol.findUniqueOrThrow({ where: { nombre: u.rol } });
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash: await hash(u.password),
        nombre: u.nombre,
        rolId: rol.id,
        organizacionId: u.organizacionId,
      },
    });
  }

  const productorUsuario = await prisma.usuario.findUniqueOrThrow({
    where: { email: 'productor@test.com' },
  });
  const cooperativa = await prisma.cooperativa.findUniqueOrThrow({
    where: { organizacionId: cooperativaOrg.id },
  });
  await prisma.productor.upsert({
    where: { usuarioId: productorUsuario.id },
    update: {},
    create: {
      usuarioId: productorUsuario.id,
      cooperativaId: cooperativa.id,
      nombre: 'Productor de prueba',
      cedula: '0000000000',
      capacidadProductivaMaximaKg: 500,
    },
  });

  console.log('Seed completado (datos de prueba).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
