import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Credenciales de prueba sembradas por `npx prisma db seed` (ver prisma/seed.ts).
const CREDENCIALES = {
  ADMIN: { email: 'admin@test.com', password: 'Admin123!' },
  COOPERATIVA: { email: 'cooperativa@test.com', password: 'Cooperativa123!' },
  COMPRADOR: { email: 'comprador@test.com', password: 'Comprador123!' },
} as const;

function cedulaAleatoria(): string {
  return Math.floor(1000000000 + Math.random() * 8999999999).toString();
}

describe('Dashboard — indicadores (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(rol: keyof typeof CREDENCIALES): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send(CREDENCIALES[rol]);
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  }

  it('lotesPorEstado lista los 5 estados de C1 y suma exactamente totalLotes', async () => {
    const token = await login('ADMIN');
    const res = await request(app.getHttpServer())
      .get('/dashboard/resumen')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const estados = (
      res.body.lotesPorEstado as { estado: string; cantidad: number }[]
    ).map((e) => e.estado);
    expect(estados).toEqual([
      'CREADO',
      'FERMENTANDO',
      'CERTIFICADO',
      'EN_TRANSPORTE',
      'EXPORTADO',
    ]);

    const suma = (
      res.body.lotesPorEstado as { cantidad: number }[]
    ).reduce((acc, e) => acc + e.cantidad, 0);
    expect(suma).toBe(res.body.totalLotes);
  });

  it('el totalLotes de una COOPERATIVA coincide con la cantidad que ve en GET /lotes (mismo alcance)', async () => {
    const token = await login('COOPERATIVA');
    const [resumen, lotes] = await Promise.all([
      request(app.getHttpServer())
        .get('/dashboard/resumen')
        .set('Authorization', `Bearer ${token}`),
      request(app.getHttpServer())
        .get('/lotes')
        .set('Authorization', `Bearer ${token}`),
    ]);
    expect(resumen.body.totalLotes).toBe(lotes.body.length);
  });

  it('totalCooperativas es global — no cambia según el rol autenticado', async () => {
    const tokenAdmin = await login('ADMIN');
    const tokenCoop = await login('COOPERATIVA');
    const [resumenAdmin, resumenCoop] = await Promise.all([
      request(app.getHttpServer())
        .get('/dashboard/resumen')
        .set('Authorization', `Bearer ${tokenAdmin}`),
      request(app.getHttpServer())
        .get('/dashboard/resumen')
        .set('Authorization', `Bearer ${tokenCoop}`),
    ]);
    expect(resumenAdmin.body.totalCooperativas).toBe(
      resumenCoop.body.totalCooperativas,
    );
    expect(resumenAdmin.body.totalCooperativas).toBeGreaterThan(0);
  });

  it('ADMIN y COMPRADOR ven el mismo total global de lotes (ambos sin filtro, C7)', async () => {
    const tokenAdmin = await login('ADMIN');
    const tokenComprador = await login('COMPRADOR');
    const [resumenAdmin, resumenComprador] = await Promise.all([
      request(app.getHttpServer())
        .get('/dashboard/resumen')
        .set('Authorization', `Bearer ${tokenAdmin}`),
      request(app.getHttpServer())
        .get('/dashboard/resumen')
        .set('Authorization', `Bearer ${tokenComprador}`),
    ]);
    expect(resumenAdmin.body.totalLotes).toBe(resumenComprador.body.totalLotes);
  });

  // Usa >= en vez de igualdad exacta: los specs e2e comparten la misma base
  // de datos y corren en paralelo (Jest, un worker por archivo), así que otro
  // archivo puede registrar lotes con la misma cooperativa de prueba entre el
  // "antes" y el "después" — lo que importa es que el indicador no quede
  // congelado, no un delta exacto de +1.
  it('registrar un nuevo lote incrementa el totalLotes y el totalProductores de la cooperativa', async () => {
    const token = await login('COOPERATIVA');
    const antes = await request(app.getHttpServer())
      .get('/dashboard/resumen')
      .set('Authorization', `Bearer ${token}`);

    const productor = await request(app.getHttpServer())
      .post('/productores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Productor para dashboard',
        cedula: cedulaAleatoria(),
        capacidadProductivaMaximaKg: 500,
      });
    await request(app.getHttpServer())
      .post('/cooperativas/recepcion')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productorId: productor.body.id,
        fechaCosecha: '2026-07-01',
        pesoInicialKg: 300,
      });

    const despues = await request(app.getHttpServer())
      .get('/dashboard/resumen')
      .set('Authorization', `Bearer ${token}`);

    expect(despues.body.totalLotes).toBeGreaterThanOrEqual(
      antes.body.totalLotes + 1,
    );
    expect(despues.body.totalProductores).toBeGreaterThanOrEqual(
      antes.body.totalProductores + 1,
    );
  });

  it('sin token no se puede acceder al dashboard (401)', async () => {
    const res = await request(app.getHttpServer()).get('/dashboard/resumen');
    expect(res.status).toBe(401);
  });
});
