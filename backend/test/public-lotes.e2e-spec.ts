import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { AppModule } from './../src/app.module';

// WP-23 §5: integración contra la red real (requiere `blockchain/network/
// network.sh up` + `deployChaincode` primero, igual que WP-22). Credenciales
// sembradas por `npx prisma db seed`.
const CREDENCIALES = {
  COOPERATIVA: { email: 'cooperativa@test.com', password: 'Cooperativa123!' },
  COOPERATIVA2: { email: 'cooperativa2@test.com', password: 'Cooperativa2123!' },
  CERTIFICADORA: { email: 'certificadora@test.com', password: 'Certificadora123!' },
  TRANSPORTISTA: { email: 'transportista@test.com', password: 'Transportista123!' },
  EXPORTADOR: { email: 'exportador@test.com', password: 'Exportador123!' },
} as const;

const PDF_DE_PRUEBA = Buffer.from('%PDF-1.4\n%fake certificado WP-23 e2e\n%%EOF');

function cedulaAleatoria(): string {
  return Math.floor(1000000000 + Math.random() * 8999999999).toString();
}

// Decodifica un PNG de QR real (no solo verifica que la imagen exista) —
// exactamente lo que pide el DoD: "pruebas de generación y LECTURA".
function decodificarQr(png: Buffer): string {
  const imagen = PNG.sync.read(png);
  const resultado = jsQR(
    new Uint8ClampedArray(imagen.data),
    imagen.width,
    imagen.height,
  );
  if (!resultado) {
    throw new Error('No se pudo decodificar el QR (jsQR no encontró un código válido)');
  }
  return resultado.data;
}

describe('QR y consulta pública de lotes (WP-23, e2e)', () => {
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

  async function crearLoteCompleto(): Promise<{ loteId: string; tokenCoop: string }> {
    const tokenCoop = await login('COOPERATIVA');
    const tokenCert = await login('CERTIFICADORA');
    const tokenTrans = await login('TRANSPORTISTA');
    const tokenExp = await login('EXPORTADOR');

    const productor = await request(app.getHttpServer())
      .post('/productores')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({
        nombre: 'Productor WP-23 e2e',
        cedula: cedulaAleatoria(),
        capacidadProductivaMaximaKg: 500,
      });
    expect(productor.status).toBe(201);

    const recepcion = await request(app.getHttpServer())
      .post('/cooperativas/recepcion')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({
        productorId: productor.body.id,
        fechaCosecha: '2026-08-01',
        pesoInicialKg: 300,
      });
    expect(recepcion.status).toBe(201);
    const loteId = recepcion.body.id as string;

    expect(
      (
        await request(app.getHttpServer())
          .post('/cooperativas/fermentacion')
          .set('Authorization', `Bearer ${tokenCoop}`)
          .send({ loteId, peso: 250, fechaSecado: '2026-08-05' })
      ).status,
    ).toBe(201);

    expect(
      (
        await request(app.getHttpServer())
          .post('/certificados')
          .set('Authorization', `Bearer ${tokenCert}`)
          .field('loteId', loteId)
          .field('tipoCertificacion', 'Orgánico')
          .field('fechaEmision', '2026-08-08')
          .attach('archivo', PDF_DE_PRUEBA, {
            filename: 'certificado.pdf',
            contentType: 'application/pdf',
          })
      ).status,
    ).toBe(201);

    expect(
      (
        await request(app.getHttpServer())
          .post('/transporte')
          .set('Authorization', `Bearer ${tokenTrans}`)
          .send({ loteId, ruta: 'Ruta WP-23 e2e', fechaSalida: '2026-08-10' })
      ).status,
    ).toBe(201);

    expect(
      (
        await request(app.getHttpServer())
          .post('/exportaciones')
          .set('Authorization', `Bearer ${tokenExp}`)
          .send({
            loteId,
            empresaCompradora: 'Cacao Trading Co.',
            paisDestino: 'Bélgica',
            puertoSalida: 'Puerto de Guayaquil',
            fechaExportacion: '2026-08-20',
          })
      ).status,
    ).toBe(201);

    return { loteId, tokenCoop };
  }

  it('GET /public/lotes/:id responde sin Authorization, con el historial completo y sin datos personales', async () => {
    const { loteId } = await crearLoteCompleto();

    const res = await request(app.getHttpServer()).get(`/public/lotes/${loteId}`);

    expect(res.status).toBe(200);
    expect(res.body.loteId).toBe(loteId);
    expect(res.body.estado).toBe('EXPORTADO');
    expect(res.body.cooperativa).toBe('Cooperativa Demo');
    expect(res.body.certificadora).toBe('Certificadora Demo');
    expect(res.body.transportista).toBe('Transportista Demo');
    expect(res.body.exportador).toBe('Exportador Demo');
    expect(res.body.paisDestino).toBe('Bélgica');
    expect(res.body.hashVerificacion).toEqual(expect.any(String));
    expect(res.body.sincronizado).toBe(true);
    expect(res.body.historial).toHaveLength(5);
    expect(
      (res.body.historial as { tipo: string }[]).map((e) => e.tipo),
    ).toEqual(['CREACION', 'FERMENTACION', 'CERTIFICACION', 'TRANSPORTE', 'EXPORTACION']);

    const crudo = JSON.stringify(res.body);
    expect(crudo).not.toMatch(/actorUsuario|cedula/i);
  });

  it('GET /public/lotes/:id de un lote inexistente devuelve 404', async () => {
    const res = await request(app.getHttpServer()).get(
      '/public/lotes/00000000-0000-0000-0000-000000000000',
    );
    expect(res.status).toBe(404);
  });

  it('GET /lotes/:id/qr exige autenticación (no es el endpoint público)', async () => {
    const { loteId } = await crearLoteCompleto();
    const res = await request(app.getHttpServer()).get(`/lotes/${loteId}/qr`);
    expect(res.status).toBe(401);
  });

  it('GET /lotes/:id/qr genera un PNG cuyo contenido decodificado coincide con el lote real (generación + lectura)', async () => {
    const { loteId, tokenCoop } = await crearLoteCompleto();

    const res = await request(app.getHttpServer())
      .get(`/lotes/${loteId}/qr`)
      .set('Authorization', `Bearer ${tokenCoop}`)
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');

    const png = Buffer.from(res.body as Buffer);
    const contenido = decodificarQr(png);
    const payload = JSON.parse(contenido) as {
      loteId: string;
      url: string;
      hashVerificacion: string;
    };

    expect(payload.loteId).toBe(loteId);
    expect(payload.url).toBe(`http://localhost:5173/public/lotes/${loteId}`);
    expect(payload.hashVerificacion).toEqual(expect.any(String));

    // El hash del QR es el de creación (§2.2 del plan) — coincide con el
    // primer evento del historial público, no con la última transacción.
    const publico = await request(app.getHttpServer()).get(
      `/public/lotes/${loteId}`,
    );
    expect(payload.hashVerificacion).toBe(publico.body.hashVerificacion);
    expect(payload.hashVerificacion).toBe(
      (publico.body.historial as { tipo: string; hashTransaccionBlockchain: string }[])[0]
        .hashTransaccionBlockchain,
    );
  });

  it('GET /lotes/:id/qr de un lote ajeno devuelve 404 (mismo alcance que GET /lotes/:id)', async () => {
    const { loteId } = await crearLoteCompleto();
    const tokenCoop2 = await login('COOPERATIVA2');

    const res = await request(app.getHttpServer())
      .get(`/lotes/${loteId}/qr`)
      .set('Authorization', `Bearer ${tokenCoop2}`);

    expect(res.status).toBe(404);
  });
});
