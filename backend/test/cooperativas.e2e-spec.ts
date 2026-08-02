import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Credenciales de prueba sembradas por `npx prisma db seed` (ver prisma/seed.ts).
const CREDENCIALES = {
  COOPERATIVA: { email: 'cooperativa@test.com', password: 'Cooperativa123!' },
  COOPERATIVA2: { email: 'cooperativa2@test.com', password: 'Cooperativa2123!' },
  TRANSPORTISTA: {
    email: 'transportista@test.com',
    password: 'Transportista123!',
  },
} as const;

function cedulaAleatoria(): string {
  return Math.floor(1000000000 + Math.random() * 8999999999).toString();
}

describe('Cooperativas — recepción y fermentación (e2e)', () => {
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

  async function crearProductorPropio(
    token: string,
    capacidadProductivaMaximaKg: number,
  ) {
    const res = await request(app.getHttpServer())
      .post('/productores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Productor para recepción',
        cedula: cedulaAleatoria(),
        capacidadProductivaMaximaKg,
      });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  it('COOPERATIVA registra una recepción (201) y el lote queda en Postgres con estado Creado', async () => {
    const token = await login('COOPERATIVA');
    const productorId = await crearProductorPropio(token, 500);

    const res = await request(app.getHttpServer())
      .post('/cooperativas/recepcion')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productorId,
        fechaCosecha: '2026-07-01',
        pesoInicialKg: 300,
      });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('CREADO');
    expect(res.body.productorId).toBe(productorId);
  });

  it('rechaza recepción sobre un productor de otra cooperativa (404)', async () => {
    const tokenCoop1 = await login('COOPERATIVA');
    const tokenCoop2 = await login('COOPERATIVA2');
    const productorDeCoop2 = await crearProductorPropio(tokenCoop2, 400);

    const res = await request(app.getHttpServer())
      .post('/cooperativas/recepcion')
      .set('Authorization', `Bearer ${tokenCoop1}`)
      .send({
        productorId: productorDeCoop2,
        fechaCosecha: '2026-07-01',
        pesoInicialKg: 100,
      });
    expect(res.status).toBe(404);
  });

  it('un rol sin acceso (TRANSPORTISTA) no puede registrar recepción (403)', async () => {
    const token = await login('TRANSPORTISTA');
    const res = await request(app.getHttpServer())
      .post('/cooperativas/recepcion')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productorId: '00000000-0000-0000-0000-000000000000',
        fechaCosecha: '2026-07-01',
        pesoInicialKg: 100,
      });
    expect(res.status).toBe(403);
  });

  it('registra fermentación válida y transiciona el lote a Fermentando', async () => {
    const token = await login('COOPERATIVA');
    const productorId = await crearProductorPropio(token, 500);
    const recepcion = await request(app.getHttpServer())
      .post('/cooperativas/recepcion')
      .set('Authorization', `Bearer ${token}`)
      .send({ productorId, fechaCosecha: '2026-07-01', pesoInicialKg: 300 });
    const loteId = recepcion.body.id;

    const res = await request(app.getHttpServer())
      .post('/cooperativas/fermentacion')
      .set('Authorization', `Bearer ${token}`)
      .send({ loteId, peso: 250, fechaSecado: '2026-07-10' });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('FERMENTANDO');
    expect(res.body.pesoFermentadoKg).toBe('250');
  });

  it('rechaza fermentación con peso mayor a la capacidad del productor (400)', async () => {
    const token = await login('COOPERATIVA');
    const productorId = await crearProductorPropio(token, 100); // capacidad baja
    const recepcion = await request(app.getHttpServer())
      .post('/cooperativas/recepcion')
      .set('Authorization', `Bearer ${token}`)
      .send({ productorId, fechaCosecha: '2026-07-01', pesoInicialKg: 90 });
    const loteId = recepcion.body.id;

    const res = await request(app.getHttpServer())
      .post('/cooperativas/fermentacion')
      .set('Authorization', `Bearer ${token}`)
      .send({ loteId, peso: 150, fechaSecado: '2026-07-10' }); // > capacidad (100)

    expect(res.status).toBe(400);
  });

  it('rechaza fermentar dos veces el mismo lote (409, la segunda vez ya no está en Creado)', async () => {
    const token = await login('COOPERATIVA');
    const productorId = await crearProductorPropio(token, 500);
    const recepcion = await request(app.getHttpServer())
      .post('/cooperativas/recepcion')
      .set('Authorization', `Bearer ${token}`)
      .send({ productorId, fechaCosecha: '2026-07-01', pesoInicialKg: 300 });
    const loteId = recepcion.body.id;

    const primera = await request(app.getHttpServer())
      .post('/cooperativas/fermentacion')
      .set('Authorization', `Bearer ${token}`)
      .send({ loteId, peso: 250, fechaSecado: '2026-07-10' });
    expect(primera.status).toBe(201);

    const segunda = await request(app.getHttpServer())
      .post('/cooperativas/fermentacion')
      .set('Authorization', `Bearer ${token}`)
      .send({ loteId, peso: 240, fechaSecado: '2026-07-11' });
    expect(segunda.status).toBe(409);
  });

  it('un rol sin acceso (TRANSPORTISTA) no puede registrar fermentación (403)', async () => {
    const token = await login('TRANSPORTISTA');
    const res = await request(app.getHttpServer())
      .post('/cooperativas/fermentacion')
      .set('Authorization', `Bearer ${token}`)
      .send({
        loteId: '00000000-0000-0000-0000-000000000000',
        peso: 100,
        fechaSecado: '2026-07-10',
      });
    expect(res.status).toBe(403);
  });

  it('GET /lotes: COOPERATIVA solo ve sus propios lotes', async () => {
    const tokenCoop1 = await login('COOPERATIVA');
    const tokenCoop2 = await login('COOPERATIVA2');

    const productorCoop2 = await crearProductorPropio(tokenCoop2, 500);
    const loteCoop2 = await request(app.getHttpServer())
      .post('/cooperativas/recepcion')
      .set('Authorization', `Bearer ${tokenCoop2}`)
      .send({
        productorId: productorCoop2,
        fechaCosecha: '2026-07-01',
        pesoInicialKg: 300,
      });

    const listaCoop1 = await request(app.getHttpServer())
      .get('/lotes')
      .set('Authorization', `Bearer ${tokenCoop1}`);

    expect(
      listaCoop1.body.find((l: { id: string }) => l.id === loteCoop2.body.id),
    ).toBeUndefined();
  });
});
