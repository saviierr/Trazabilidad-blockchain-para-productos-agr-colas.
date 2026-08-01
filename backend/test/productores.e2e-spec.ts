import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Credenciales de prueba sembradas por `npx prisma db seed` (ver prisma/seed.ts).
const CREDENCIALES = {
  ADMIN: { email: 'admin@test.com', password: 'Admin123!' },
  PRODUCTOR: { email: 'productor@test.com', password: 'Productor123!' },
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

describe('Productores (e2e)', () => {
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

  it('COOPERATIVA registra un productor propio (201) y queda en Postgres', async () => {
    const token = await login('COOPERATIVA');
    const res = await request(app.getHttpServer())
      .post('/productores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Productor E2E',
        cedula: cedulaAleatoria(),
        capacidadProductivaMaximaKg: 300,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.activo).toBe(true);
    expect(res.body.cooperativa.organizacion.nombre).toBe('Cooperativa Demo');
  });

  it('rechaza datos inválidos con 400 (cédula mal formada)', async () => {
    const token = await login('COOPERATIVA');
    const res = await request(app.getHttpServer())
      .post('/productores')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'X', cedula: '123', capacidadProductivaMaximaKg: 10 });
    expect(res.status).toBe(400);
  });

  it('un rol sin acceso (TRANSPORTISTA) no puede crear productores (403)', async () => {
    const token = await login('TRANSPORTISTA');
    const res = await request(app.getHttpServer())
      .post('/productores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'No debería crearse',
        cedula: cedulaAleatoria(),
        capacidadProductivaMaximaKg: 100,
      });
    expect(res.status).toBe(403);
  });

  it('ADMIN puede listar y ve productores de todas las cooperativas', async () => {
    const token = await login('ADMIN');
    const res = await request(app.getHttpServer())
      .get('/productores')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('COOPERATIVA solo ve/edita/elimina sus propios productores (aislamiento)', async () => {
    const tokenCoop1 = await login('COOPERATIVA');
    const tokenCoop2 = await login('COOPERATIVA2');

    const creado = await request(app.getHttpServer())
      .post('/productores')
      .set('Authorization', `Bearer ${tokenCoop1}`)
      .send({
        nombre: 'Productor de Cooperativa 1',
        cedula: cedulaAleatoria(),
        capacidadProductivaMaximaKg: 200,
      });
    expect(creado.status).toBe(201);
    const id = creado.body.id;

    const listaCoop2 = await request(app.getHttpServer())
      .get('/productores')
      .set('Authorization', `Bearer ${tokenCoop2}`);
    expect(listaCoop2.body.find((p: { id: string }) => p.id === id)).toBeUndefined();

    const verDesdeCoop2 = await request(app.getHttpServer())
      .get(`/productores/${id}`)
      .set('Authorization', `Bearer ${tokenCoop2}`);
    expect(verDesdeCoop2.status).toBe(404);

    const editarDesdeCoop2 = await request(app.getHttpServer())
      .put(`/productores/${id}`)
      .set('Authorization', `Bearer ${tokenCoop2}`)
      .send({ nombre: 'Intento de edición ajena' });
    expect(editarDesdeCoop2.status).toBe(404);

    const eliminarDesdeCoop2 = await request(app.getHttpServer())
      .delete(`/productores/${id}`)
      .set('Authorization', `Bearer ${tokenCoop2}`);
    expect(eliminarDesdeCoop2.status).toBe(404);
  });

  it('PRODUCTOR solo ve su propio registro', async () => {
    const token = await login('PRODUCTOR');
    const res = await request(app.getHttpServer())
      .get('/productores')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.every((p: { usuarioId: string | null }) => p.usuarioId)).toBeDefined();
  });

  it('actualiza un productor propio y luego lo elimina lógicamente', async () => {
    const token = await login('COOPERATIVA');
    const creado = await request(app.getHttpServer())
      .post('/productores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Productor a editar',
        cedula: cedulaAleatoria(),
        capacidadProductivaMaximaKg: 150,
      });
    const id = creado.body.id;

    const actualizado = await request(app.getHttpServer())
      .put(`/productores/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Productor editado', capacidadProductivaMaximaKg: 175 });
    expect(actualizado.status).toBe(200);
    expect(actualizado.body.nombre).toBe('Productor editado');

    const eliminado = await request(app.getHttpServer())
      .delete(`/productores/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(eliminado.status).toBe(200);
    expect(eliminado.body.activo).toBe(false);

    const listaPorDefecto = await request(app.getHttpServer())
      .get('/productores')
      .set('Authorization', `Bearer ${token}`);
    expect(
      listaPorDefecto.body.find((p: { id: string }) => p.id === id),
    ).toBeUndefined();

    const listaConInactivos = await request(app.getHttpServer())
      .get('/productores?incluirInactivos=true')
      .set('Authorization', `Bearer ${token}`);
    expect(
      listaConInactivos.body.find((p: { id: string }) => p.id === id),
    ).toBeDefined();
  });
});
