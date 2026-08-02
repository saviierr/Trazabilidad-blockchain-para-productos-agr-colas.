import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createHash } from 'node:crypto';
import { AppModule } from './../src/app.module';

// Credenciales de prueba sembradas por `npx prisma db seed` (ver prisma/seed.ts).
const CREDENCIALES = {
  COOPERATIVA: { email: 'cooperativa@test.com', password: 'Cooperativa123!' },
  CERTIFICADORA: { email: 'certificadora@test.com', password: 'Certificadora123!' },
  CERTIFICADORA2: {
    email: 'certificadora2@test.com',
    password: 'Certificadora2123!',
  },
  TRANSPORTISTA: {
    email: 'transportista@test.com',
    password: 'Transportista123!',
  },
} as const;

const PDF_DE_PRUEBA = Buffer.from('%PDF-1.4\n%fake certificado de prueba\n%%EOF');

function cedulaAleatoria(): string {
  return Math.floor(1000000000 + Math.random() * 8999999999).toString();
}

describe('Certificadoras (e2e)', () => {
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

  async function crearLoteFermentando(tokenCoop: string): Promise<string> {
    const productor = await request(app.getHttpServer())
      .post('/productores')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({
        nombre: 'Productor para certificar',
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
    return recepcion.body.id as string;
  }

  it('CERTIFICADORA emite un certificado (201), el lote pasa a Certificado y guarda el hash', async () => {
    const tokenCoop = await login('COOPERATIVA');
    const tokenCert = await login('CERTIFICADORA');
    const loteId = await crearLoteFermentando(tokenCoop);

    const res = await request(app.getHttpServer())
      .post('/certificados')
      .set('Authorization', `Bearer ${tokenCert}`)
      .field('loteId', loteId)
      .field('tipoCertificacion', 'Orgánico')
      .field('fechaEmision', '2026-08-01')
      .attach('archivo', PDF_DE_PRUEBA, {
        filename: 'certificado.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(201);
    const hashEsperado = createHash('sha256').update(PDF_DE_PRUEBA).digest('hex');
    expect(res.body.hashArchivo).toBe(hashEsperado);
    expect(res.body.lote.estado).toBe('CERTIFICADO');
  });

  it('una certificadora puede certificar un lote de cualquier cooperativa (sin restricción de pertenencia)', async () => {
    const tokenCoop = await login('COOPERATIVA');
    const tokenCert = await login('CERTIFICADORA2');
    const loteId = await crearLoteFermentando(tokenCoop);

    const res = await request(app.getHttpServer())
      .post('/certificados')
      .set('Authorization', `Bearer ${tokenCert}`)
      .field('loteId', loteId)
      .field('tipoCertificacion', 'Orgánico')
      .field('fechaEmision', '2026-08-01')
      .attach('archivo', PDF_DE_PRUEBA, {
        filename: 'certificado.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(201);
  });

  it('rechaza si el lote no está en Fermentando (409)', async () => {
    const tokenCoop = await login('COOPERATIVA');
    const tokenCert = await login('CERTIFICADORA');
    const productor = await request(app.getHttpServer())
      .post('/productores')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({
        nombre: 'Productor sin fermentar',
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
      }); // sigue en estado Creado, nunca se fermentó

    const res = await request(app.getHttpServer())
      .post('/certificados')
      .set('Authorization', `Bearer ${tokenCert}`)
      .field('loteId', recepcion.body.id)
      .field('tipoCertificacion', 'Orgánico')
      .field('fechaEmision', '2026-08-01')
      .attach('archivo', PDF_DE_PRUEBA, {
        filename: 'certificado.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(409);
  });

  it('rechaza un archivo que no sea PDF (400)', async () => {
    const tokenCoop = await login('COOPERATIVA');
    const tokenCert = await login('CERTIFICADORA');
    const loteId = await crearLoteFermentando(tokenCoop);

    const res = await request(app.getHttpServer())
      .post('/certificados')
      .set('Authorization', `Bearer ${tokenCert}`)
      .field('loteId', loteId)
      .field('tipoCertificacion', 'Orgánico')
      .field('fechaEmision', '2026-08-01')
      .attach('archivo', Buffer.from('no soy un pdf'), {
        filename: 'certificado.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
  });

  it('un rol sin acceso (TRANSPORTISTA) no puede emitir certificados (403)', async () => {
    const token = await login('TRANSPORTISTA');
    const res = await request(app.getHttpServer())
      .post('/certificados')
      .set('Authorization', `Bearer ${token}`)
      .field('loteId', '00000000-0000-0000-0000-000000000000')
      .field('tipoCertificacion', 'Orgánico')
      .field('fechaEmision', '2026-08-01')
      .attach('archivo', PDF_DE_PRUEBA, {
        filename: 'certificado.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(403);
  });

  it('GET /certificados: una certificadora no ve los certificados emitidos por otra', async () => {
    const tokenCoop = await login('COOPERATIVA');
    const tokenCert1 = await login('CERTIFICADORA');
    const tokenCert2 = await login('CERTIFICADORA2');
    const loteId = await crearLoteFermentando(tokenCoop);

    const emitido = await request(app.getHttpServer())
      .post('/certificados')
      .set('Authorization', `Bearer ${tokenCert1}`)
      .field('loteId', loteId)
      .field('tipoCertificacion', 'Orgánico')
      .field('fechaEmision', '2026-08-01')
      .attach('archivo', PDF_DE_PRUEBA, {
        filename: 'certificado.pdf',
        contentType: 'application/pdf',
      });

    const listaCert2 = await request(app.getHttpServer())
      .get('/certificados')
      .set('Authorization', `Bearer ${tokenCert2}`);

    expect(
      listaCert2.body.find((c: { id: string }) => c.id === emitido.body.id),
    ).toBeUndefined();
  });

  it('descarga el PDF y el contenido coincide con el hash almacenado', async () => {
    const tokenCoop = await login('COOPERATIVA');
    const tokenCert = await login('CERTIFICADORA');
    const loteId = await crearLoteFermentando(tokenCoop);

    const emitido = await request(app.getHttpServer())
      .post('/certificados')
      .set('Authorization', `Bearer ${tokenCert}`)
      .field('loteId', loteId)
      .field('tipoCertificacion', 'Orgánico')
      .field('fechaEmision', '2026-08-01')
      .attach('archivo', PDF_DE_PRUEBA, {
        filename: 'certificado.pdf',
        contentType: 'application/pdf',
      });

    const descarga = await request(app.getHttpServer())
      .get(`/certificados/${emitido.body.id}/archivo`)
      .set('Authorization', `Bearer ${tokenCert}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(descarga.status).toBe(200);
    const hashDescargado = createHash('sha256')
      .update(descarga.body as Buffer)
      .digest('hex');
    expect(hashDescargado).toBe(emitido.body.hashArchivo);
  });
});
