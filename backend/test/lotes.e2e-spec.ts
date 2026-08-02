import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Credenciales de prueba sembradas por `npx prisma db seed` (ver prisma/seed.ts).
const CREDENCIALES = {
  COOPERATIVA: { email: 'cooperativa@test.com', password: 'Cooperativa123!' },
  COOPERATIVA2: { email: 'cooperativa2@test.com', password: 'Cooperativa2123!' },
  CERTIFICADORA: { email: 'certificadora@test.com', password: 'Certificadora123!' },
  CERTIFICADORA2: {
    email: 'certificadora2@test.com',
    password: 'Certificadora2123!',
  },
  TRANSPORTISTA: {
    email: 'transportista@test.com',
    password: 'Transportista123!',
  },
  TRANSPORTISTA2: {
    email: 'transportista2@test.com',
    password: 'Transportista2123!',
  },
  EXPORTADOR: { email: 'exportador@test.com', password: 'Exportador123!' },
  EXPORTADOR2: { email: 'exportador2@test.com', password: 'Exportador2123!' },
  ADMIN: { email: 'admin@test.com', password: 'Admin123!' },
} as const;

const PDF_DE_PRUEBA = Buffer.from('%PDF-1.4\n%fake certificado de prueba\n%%EOF');

function cedulaAleatoria(): string {
  return Math.floor(1000000000 + Math.random() * 8999999999).toString();
}

describe('Lotes — máquina de estados, historial y corrección (e2e)', () => {
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

  async function crearLoteCreado(tokenCoop: string): Promise<string> {
    const productor = await request(app.getHttpServer())
      .post('/productores')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({
        nombre: 'Productor para lotes e2e',
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
    return recepcion.body.id as string;
  }

  async function fermentar(tokenCoop: string, loteId: string): Promise<void> {
    const res = await request(app.getHttpServer())
      .post('/cooperativas/fermentacion')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({ loteId, peso: 250, fechaSecado: '2026-07-10' });
    expect(res.status).toBe(201);
  }

  async function certificar(tokenCert: string, loteId: string): Promise<void> {
    const res = await request(app.getHttpServer())
      .post('/certificados')
      .set('Authorization', `Bearer ${tokenCert}`)
      .field('loteId', loteId)
      .field('tipoCertificacion', 'Orgánico')
      .field('fechaEmision', '2026-07-20')
      .attach('archivo', PDF_DE_PRUEBA, {
        filename: 'certificado.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(201);
  }

  async function transportar(tokenTrans: string, loteId: string): Promise<void> {
    const res = await request(app.getHttpServer())
      .post('/transporte')
      .set('Authorization', `Bearer ${tokenTrans}`)
      .send({ loteId, ruta: 'Ruta e2e', fechaSalida: '2026-08-01' });
    expect(res.status).toBe(201);
  }

  async function exportar(tokenExp: string, loteId: string): Promise<void> {
    const res = await request(app.getHttpServer())
      .post('/exportaciones')
      .set('Authorization', `Bearer ${tokenExp}`)
      .send({
        loteId,
        empresaCompradora: 'Cacao Trading Co.',
        paisDestino: 'Bélgica',
        puertoSalida: 'Puerto de Guayaquil',
        fechaExportacion: '2026-08-15',
      });
    expect(res.status).toBe(201);
  }

  async function crearLoteCompleto(): Promise<{
    loteId: string;
    tokenCoop: string;
    tokenCert: string;
    tokenTrans: string;
    tokenExp: string;
  }> {
    const tokenCoop = await login('COOPERATIVA');
    const tokenCert = await login('CERTIFICADORA');
    const tokenTrans = await login('TRANSPORTISTA');
    const tokenExp = await login('EXPORTADOR');

    const loteId = await crearLoteCreado(tokenCoop);
    await fermentar(tokenCoop, loteId);
    await certificar(tokenCert, loteId);
    await transportar(tokenTrans, loteId);
    await exportar(tokenExp, loteId);

    return { loteId, tokenCoop, tokenCert, tokenTrans, tokenExp };
  }

  it('recorre la máquina de estados completa de punta a punta', async () => {
    const { loteId, tokenCoop } = await crearLoteCompleto();

    const detalle = await request(app.getHttpServer())
      .get(`/lotes/${loteId}`)
      .set('Authorization', `Bearer ${tokenCoop}`);

    expect(detalle.status).toBe(200);
    expect(detalle.body.estado).toBe('EXPORTADO');
    expect(detalle.body.certificados.length).toBe(1);
    expect(detalle.body.transporte.estado).toBe('EN_RUTA');
    expect(detalle.body.exportacion).toBeDefined();
  });

  it('rechaza cada salto de estado (409): certificar Creado, transportar Fermentando, exportar Certificado', async () => {
    const tokenCoop = await login('COOPERATIVA');
    const tokenCert = await login('CERTIFICADORA');
    const tokenTrans = await login('TRANSPORTISTA');
    const tokenExp = await login('EXPORTADOR');

    // Lote en Creado: certificar debe rechazarse
    const loteCreado = await crearLoteCreado(tokenCoop);
    const certSobreCreado = await request(app.getHttpServer())
      .post('/certificados')
      .set('Authorization', `Bearer ${tokenCert}`)
      .field('loteId', loteCreado)
      .field('tipoCertificacion', 'Orgánico')
      .field('fechaEmision', '2026-07-20')
      .attach('archivo', PDF_DE_PRUEBA, {
        filename: 'certificado.pdf',
        contentType: 'application/pdf',
      });
    expect(certSobreCreado.status).toBe(409);

    // Lote en Fermentando: transportar debe rechazarse
    const loteFermentando = await crearLoteCreado(tokenCoop);
    await fermentar(tokenCoop, loteFermentando);
    const transSobreFermentando = await request(app.getHttpServer())
      .post('/transporte')
      .set('Authorization', `Bearer ${tokenTrans}`)
      .send({ loteId: loteFermentando, ruta: 'Ruta X', fechaSalida: '2026-08-01' });
    expect(transSobreFermentando.status).toBe(409);

    // Lote en Certificado: exportar debe rechazarse
    const loteCertificado = await crearLoteCreado(tokenCoop);
    await fermentar(tokenCoop, loteCertificado);
    await certificar(tokenCert, loteCertificado);
    const expSobreCertificado = await request(app.getHttpServer())
      .post('/exportaciones')
      .set('Authorization', `Bearer ${tokenExp}`)
      .send({
        loteId: loteCertificado,
        empresaCompradora: 'Cacao Trading Co.',
        paisDestino: 'Bélgica',
        puertoSalida: 'Puerto de Guayaquil',
        fechaExportacion: '2026-08-15',
      });
    expect(expSobreCertificado.status).toBe(409);
  });

  it('GET /lotes/:id/historial devuelve los eventos en orden cronológico con los tipos esperados', async () => {
    const { loteId, tokenCoop } = await crearLoteCompleto();

    const res = await request(app.getHttpServer())
      .get(`/lotes/${loteId}/historial`)
      .set('Authorization', `Bearer ${tokenCoop}`);

    expect(res.status).toBe(200);
    const tipos = (res.body as { tipo: string }[]).map((e) => e.tipo);
    expect(tipos).toEqual([
      'CREACION',
      'FERMENTACION',
      'CERTIFICACION',
      'TRANSPORTE',
      'EXPORTACION',
    ]);

    const timestamps = (res.body as { timestamp: string }[]).map((e) =>
      new Date(e.timestamp).getTime(),
    );
    const ordenados = [...timestamps].sort((a, b) => a - b);
    expect(timestamps).toEqual(ordenados);
  });

  it('PUT /lotes/:id corrige fechaCosecha/pesoInicialKg sin cambiar el estado y crea un evento CORRECCION', async () => {
    const tokenCoop = await login('COOPERATIVA');
    const loteId = await crearLoteCreado(tokenCoop);
    await fermentar(tokenCoop, loteId); // estado != CREADO, para probar que la corrección no lo toca

    const res = await request(app.getHttpServer())
      .put(`/lotes/${loteId}`)
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({ pesoInicialKg: 310 });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('FERMENTANDO');
    expect(res.body.pesoInicialKg).toBe('310');

    const historial = await request(app.getHttpServer())
      .get(`/lotes/${loteId}/historial`)
      .set('Authorization', `Bearer ${tokenCoop}`);

    const evento = (
      historial.body as { tipo: string; datosEspecificos: unknown }[]
    ).find((e) => e.tipo === 'CORRECCION');
    expect(evento).toBeDefined();
    expect(evento?.datosEspecificos).toMatchObject({
      anterior: { pesoInicialKg: 300 },
      nuevo: { pesoInicialKg: 310 },
    });
  });

  it('rechaza corrección sin ningún campo (400)', async () => {
    const tokenCoop = await login('COOPERATIVA');
    const loteId = await crearLoteCreado(tokenCoop);

    const res = await request(app.getHttpServer())
      .put(`/lotes/${loteId}`)
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('una cooperativa no puede corregir el lote de otra (404)', async () => {
    const tokenCoop1 = await login('COOPERATIVA');
    const tokenCoop2 = await login('COOPERATIVA2');
    const loteId = await crearLoteCreado(tokenCoop1);

    const res = await request(app.getHttpServer())
      .put(`/lotes/${loteId}`)
      .set('Authorization', `Bearer ${tokenCoop2}`)
      .send({ pesoInicialKg: 999 });
    expect(res.status).toBe(404);
  });

  it('un rol sin acceso (TRANSPORTISTA) no puede corregir un lote (403)', async () => {
    const token = await login('TRANSPORTISTA');
    const res = await request(app.getHttpServer())
      .put('/lotes/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ pesoInicialKg: 100 });
    expect(res.status).toBe(403);
  });

  it('ADMIN puede corregir el lote de cualquier cooperativa', async () => {
    const tokenCoop = await login('COOPERATIVA');
    const tokenAdmin = await login('ADMIN');
    const loteId = await crearLoteCreado(tokenCoop);

    const res = await request(app.getHttpServer())
      .put(`/lotes/${loteId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ pesoInicialKg: 280 });
    expect(res.status).toBe(200);
    expect(res.body.pesoInicialKg).toBe('280');
  });

  it('alcance cerrado de GET /lotes: certificadora, transportista y exportador ya no ven lotes ajenos', async () => {
    const { loteId } = await crearLoteCompleto();

    const tokenCert2 = await login('CERTIFICADORA2');
    const tokenTrans2 = await login('TRANSPORTISTA2');
    const tokenExp2 = await login('EXPORTADOR2');

    const [listaCert2, listaTrans2, listaExp2] = await Promise.all([
      request(app.getHttpServer())
        .get('/lotes')
        .set('Authorization', `Bearer ${tokenCert2}`),
      request(app.getHttpServer())
        .get('/lotes')
        .set('Authorization', `Bearer ${tokenTrans2}`),
      request(app.getHttpServer())
        .get('/lotes')
        .set('Authorization', `Bearer ${tokenExp2}`),
    ]);

    for (const lista of [listaCert2, listaTrans2, listaExp2]) {
      expect(
        (lista.body as { id: string }[]).find((l) => l.id === loteId),
      ).toBeUndefined();
    }

    const [detalleCert2, detalleTrans2, detalleExp2] = await Promise.all([
      request(app.getHttpServer())
        .get(`/lotes/${loteId}`)
        .set('Authorization', `Bearer ${tokenCert2}`),
      request(app.getHttpServer())
        .get(`/lotes/${loteId}`)
        .set('Authorization', `Bearer ${tokenTrans2}`),
      request(app.getHttpServer())
        .get(`/lotes/${loteId}`)
        .set('Authorization', `Bearer ${tokenExp2}`),
    ]);
    expect(detalleCert2.status).toBe(404);
    expect(detalleTrans2.status).toBe(404);
    expect(detalleExp2.status).toBe(404);
  });

  it('GET /lotes: la certificadora/transportista/exportador que sí participó ve el lote', async () => {
    const { loteId, tokenCert, tokenTrans, tokenExp } =
      await crearLoteCompleto();

    const [listaCert, listaTrans, listaExp] = await Promise.all([
      request(app.getHttpServer())
        .get('/lotes')
        .set('Authorization', `Bearer ${tokenCert}`),
      request(app.getHttpServer())
        .get('/lotes')
        .set('Authorization', `Bearer ${tokenTrans}`),
      request(app.getHttpServer())
        .get('/lotes')
        .set('Authorization', `Bearer ${tokenExp}`),
    ]);

    for (const lista of [listaCert, listaTrans, listaExp]) {
      expect(
        (lista.body as { id: string }[]).find((l) => l.id === loteId),
      ).toBeDefined();
    }
  });

  it('GET /lotes: COMPRADOR ve todos los lotes (público de solo lectura, C7)', async () => {
    const { loteId } = await crearLoteCompleto();
    const tokenComprador = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'comprador@test.com', password: 'Comprador123!' });
    expect(tokenComprador.status).toBe(200);

    const lista = await request(app.getHttpServer())
      .get('/lotes')
      .set('Authorization', `Bearer ${tokenComprador.body.accessToken}`);

    expect(
      (lista.body as { id: string }[]).find((l) => l.id === loteId),
    ).toBeDefined();
  });
});
