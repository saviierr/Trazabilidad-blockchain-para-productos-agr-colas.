import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Credenciales de prueba sembradas por `npx prisma db seed` (ver prisma/seed.ts).
const CREDENCIALES = {
  COOPERATIVA: { email: 'cooperativa@test.com', password: 'Cooperativa123!' },
  CERTIFICADORA: { email: 'certificadora@test.com', password: 'Certificadora123!' },
  TRANSPORTISTA: {
    email: 'transportista@test.com',
    password: 'Transportista123!',
  },
  TRANSPORTISTA2: {
    email: 'transportista2@test.com',
    password: 'Transportista2123!',
  },
  EXPORTADOR: { email: 'exportador@test.com', password: 'Exportador123!' },
} as const;

const PDF_DE_PRUEBA = Buffer.from('%PDF-1.4\n%fake certificado de prueba\n%%EOF');

function cedulaAleatoria(): string {
  return Math.floor(1000000000 + Math.random() * 8999999999).toString();
}

describe('Transportistas (e2e)', () => {
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

  async function crearLoteCertificado(): Promise<string> {
    const tokenCoop = await login('COOPERATIVA');
    const tokenCert = await login('CERTIFICADORA');

    const productor = await request(app.getHttpServer())
      .post('/productores')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({
        nombre: 'Productor para transportar',
        cedula: cedulaAleatoria(),
        capacidadProductivaMaximaKg: 500,
      });
    const recepcion = await request(app.getHttpServer())
      .post('/cooperativas/recepcion')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({
        productorId: productor.body.id,
        fechaCosecha: '2026-07-01',
        pesoInicialKg: 300,
      });
    await request(app.getHttpServer())
      .post('/cooperativas/fermentacion')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({ loteId: recepcion.body.id, peso: 250, fechaSecado: '2026-07-10' });
    await request(app.getHttpServer())
      .post('/certificados')
      .set('Authorization', `Bearer ${tokenCert}`)
      .field('loteId', recepcion.body.id)
      .field('tipoCertificacion', 'Orgánico')
      .field('fechaEmision', '2026-07-20')
      .attach('archivo', PDF_DE_PRUEBA, {
        filename: 'certificado.pdf',
        contentType: 'application/pdf',
      });

    return recepcion.body.id as string;
  }

  it('TRANSPORTISTA registra un transporte (201) y el lote pasa a En Transporte', async () => {
    const loteId = await crearLoteCertificado();
    const token = await login('TRANSPORTISTA');

    const res = await request(app.getHttpServer())
      .post('/transporte')
      .set('Authorization', `Bearer ${token}`)
      .send({
        loteId,
        ruta: 'Vinces — Puerto de Guayaquil',
        fechaSalida: '2026-08-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('EN_RUTA');
    expect(res.body.lote.estado).toBe('EN_TRANSPORTE');
  });

  it('rechaza transporte si el lote no está en Certificado (409)', async () => {
    const tokenCoop = await login('COOPERATIVA');
    const token = await login('TRANSPORTISTA');
    const productor = await request(app.getHttpServer())
      .post('/productores')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({
        nombre: 'Productor sin certificar',
        cedula: cedulaAleatoria(),
        capacidadProductivaMaximaKg: 500,
      });
    const recepcion = await request(app.getHttpServer())
      .post('/cooperativas/recepcion')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({
        productorId: productor.body.id,
        fechaCosecha: '2026-07-01',
        pesoInicialKg: 300,
      }); // sigue en Creado

    const res = await request(app.getHttpServer())
      .post('/transporte')
      .set('Authorization', `Bearer ${token}`)
      .send({
        loteId: recepcion.body.id,
        ruta: 'Ruta X',
        fechaSalida: '2026-08-01',
      });

    expect(res.status).toBe(409);
  });

  it('un rol sin acceso (EXPORTADOR) no puede registrar transporte (403)', async () => {
    const token = await login('EXPORTADOR');
    const res = await request(app.getHttpServer())
      .post('/transporte')
      .set('Authorization', `Bearer ${token}`)
      .send({
        loteId: '00000000-0000-0000-0000-000000000000',
        ruta: 'Ruta X',
        fechaSalida: '2026-08-01',
      });
    expect(res.status).toBe(403);
  });

  it('registra una incidencia sin cambiar el estado, luego marca entregado', async () => {
    const loteId = await crearLoteCertificado();
    const token = await login('TRANSPORTISTA');
    const transporte = await request(app.getHttpServer())
      .post('/transporte')
      .set('Authorization', `Bearer ${token}`)
      .send({ loteId, ruta: 'Ruta Y', fechaSalida: '2026-08-01' });
    const transporteId = transporte.body.id;

    const incidencia = await request(app.getHttpServer())
      .post(`/transporte/${transporteId}/incidencias`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descripcion: 'Retraso por lluvia' });

    expect(incidencia.status).toBe(201);
    expect(incidencia.body.estado).toBe('EN_RUTA');
    expect(incidencia.body.incidencias.length).toBe(1);

    const entregado = await request(app.getHttpServer())
      .put(`/transporte/${transporteId}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'ENTREGADO' });

    expect(entregado.status).toBe(200);
    expect(entregado.body.estado).toBe('ENTREGADO');
    expect(entregado.body.fechaLlegadaReal).toBeDefined();
  });

  it('rechaza marcar entregado dos veces (409)', async () => {
    const loteId = await crearLoteCertificado();
    const token = await login('TRANSPORTISTA');
    const transporte = await request(app.getHttpServer())
      .post('/transporte')
      .set('Authorization', `Bearer ${token}`)
      .send({ loteId, ruta: 'Ruta Z', fechaSalida: '2026-08-01' });
    const transporteId = transporte.body.id;

    const primera = await request(app.getHttpServer())
      .put(`/transporte/${transporteId}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'ENTREGADO' });
    expect(primera.status).toBe(200);

    const segunda = await request(app.getHttpServer())
      .put(`/transporte/${transporteId}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'ENTREGADO' });
    expect(segunda.status).toBe(409);
  });

  it('un transportista no puede actualizar/agregar incidencia al transporte de otro (404)', async () => {
    const loteId = await crearLoteCertificado();
    const token = await login('TRANSPORTISTA');
    const transporte = await request(app.getHttpServer())
      .post('/transporte')
      .set('Authorization', `Bearer ${token}`)
      .send({ loteId, ruta: 'Ruta W', fechaSalida: '2026-08-01' });

    const tokenOtraTransportista = await login('TRANSPORTISTA2');

    const estadoAjeno = await request(app.getHttpServer())
      .put(`/transporte/${transporte.body.id}/estado`)
      .set('Authorization', `Bearer ${tokenOtraTransportista}`)
      .send({ estado: 'ENTREGADO' });
    expect(estadoAjeno.status).toBe(404);

    const incidenciaAjena = await request(app.getHttpServer())
      .post(`/transporte/${transporte.body.id}/incidencias`)
      .set('Authorization', `Bearer ${tokenOtraTransportista}`)
      .send({ descripcion: 'No debería poder registrar esto' });
    expect(incidenciaAjena.status).toBe(404);
  });

  it('GET /transporte: cualquier rol autenticado accede', async () => {
    const token = await login('COOPERATIVA');
    const res = await request(app.getHttpServer())
      .get('/transporte')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
