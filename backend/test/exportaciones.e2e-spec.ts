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
  EXPORTADOR: { email: 'exportador@test.com', password: 'Exportador123!' },
  EXPORTADOR2: { email: 'exportador2@test.com', password: 'Exportador2123!' },
} as const;

const PDF_DE_PRUEBA = Buffer.from('%PDF-1.4\n%fake certificado de prueba\n%%EOF');

function cedulaAleatoria(): string {
  return Math.floor(1000000000 + Math.random() * 8999999999).toString();
}

describe('Exportaciones (e2e)', () => {
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

  async function crearLoteEnTransporte(): Promise<string> {
    const tokenCoop = await login('COOPERATIVA');
    const tokenCert = await login('CERTIFICADORA');
    const tokenTrans = await login('TRANSPORTISTA');

    const productor = await request(app.getHttpServer())
      .post('/productores')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({
        nombre: 'Productor para exportar',
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
    await request(app.getHttpServer())
      .post('/transporte')
      .set('Authorization', `Bearer ${tokenTrans}`)
      .send({
        loteId: recepcion.body.id,
        ruta: 'Ruta de prueba',
        fechaSalida: '2026-08-01',
      });

    return recepcion.body.id as string;
  }

  it('EXPORTADOR registra una exportación (201) y el lote pasa a Exportado', async () => {
    const loteId = await crearLoteEnTransporte();
    const token = await login('EXPORTADOR');

    const res = await request(app.getHttpServer())
      .post('/exportaciones')
      .set('Authorization', `Bearer ${token}`)
      .send({
        loteId,
        empresaCompradora: 'Cacao Trading Co.',
        paisDestino: 'Bélgica',
        puertoSalida: 'Puerto de Guayaquil',
        fechaExportacion: '2026-08-15',
      });

    expect(res.status).toBe(201);
    expect(res.body.puertoSalida).toBe('Puerto de Guayaquil');
    expect(res.body.lote.estado).toBe('EXPORTADO');
  });

  it('rechaza exportación si el lote no está en En Transporte (409)', async () => {
    const tokenCoop = await login('COOPERATIVA');
    const token = await login('EXPORTADOR');
    const productor = await request(app.getHttpServer())
      .post('/productores')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({
        nombre: 'Productor sin transportar',
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
      .post('/exportaciones')
      .set('Authorization', `Bearer ${token}`)
      .send({
        loteId: recepcion.body.id,
        empresaCompradora: 'Cacao Trading Co.',
        paisDestino: 'Bélgica',
        puertoSalida: 'Puerto de Guayaquil',
        fechaExportacion: '2026-08-15',
      });

    expect(res.status).toBe(409);
  });

  it('rechaza datos incompletos (400) — falta puertoSalida', async () => {
    const loteId = await crearLoteEnTransporte();
    const token = await login('EXPORTADOR');

    const res = await request(app.getHttpServer())
      .post('/exportaciones')
      .set('Authorization', `Bearer ${token}`)
      .send({
        loteId,
        empresaCompradora: 'Cacao Trading Co.',
        paisDestino: 'Bélgica',
        fechaExportacion: '2026-08-15',
      });

    expect(res.status).toBe(400);
  });

  it('un rol sin acceso (TRANSPORTISTA) no puede registrar exportación (403)', async () => {
    const token = await login('TRANSPORTISTA');
    const res = await request(app.getHttpServer())
      .post('/exportaciones')
      .set('Authorization', `Bearer ${token}`)
      .send({
        loteId: '00000000-0000-0000-0000-000000000000',
        empresaCompradora: 'Cacao Trading Co.',
        paisDestino: 'Bélgica',
        puertoSalida: 'Puerto de Guayaquil',
        fechaExportacion: '2026-08-15',
      });
    expect(res.status).toBe(403);
  });

  it('GET /exportaciones: un exportador no ve las exportaciones de otro', async () => {
    const loteId = await crearLoteEnTransporte();
    const token1 = await login('EXPORTADOR');
    const token2 = await login('EXPORTADOR2');

    const creada = await request(app.getHttpServer())
      .post('/exportaciones')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        loteId,
        empresaCompradora: 'Cacao Trading Co.',
        paisDestino: 'Bélgica',
        puertoSalida: 'Puerto de Guayaquil',
        fechaExportacion: '2026-08-15',
      });

    const listaExportador2 = await request(app.getHttpServer())
      .get('/exportaciones')
      .set('Authorization', `Bearer ${token2}`);

    expect(
      listaExportador2.body.find((e: { id: string }) => e.id === creada.body.id),
    ).toBeUndefined();
  });
});
