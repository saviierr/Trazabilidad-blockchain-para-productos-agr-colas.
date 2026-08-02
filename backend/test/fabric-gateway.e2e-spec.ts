import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// WP-22 §5: integración Backend ↔ Hyperledger Fabric contra la red real
// (requiere `blockchain/network/network.sh up` + `deployChaincode` primero,
// ver docs/WP-22-plan-fabric-gateway.md §5). Credenciales sembradas por
// `npx prisma db seed` (prisma/seed.ts) — mismas que usa lotes.e2e-spec.ts.
const CREDENCIALES = {
  COOPERATIVA: { email: 'cooperativa@test.com', password: 'Cooperativa123!' },
  CERTIFICADORA: { email: 'certificadora@test.com', password: 'Certificadora123!' },
  TRANSPORTISTA: { email: 'transportista@test.com', password: 'Transportista123!' },
  EXPORTADOR: { email: 'exportador@test.com', password: 'Exportador123!' },
} as const;

const PDF_DE_PRUEBA = Buffer.from('%PDF-1.4\n%fake certificado WP-22 e2e\n%%EOF');

function cedulaAleatoria(): string {
  return Math.floor(1000000000 + Math.random() * 8999999999).toString();
}

describe('Fabric Gateway — integración Backend ↔ Hyperledger Fabric (WP-22, e2e)', () => {
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

  async function crearProductor(
    tokenCoop: string,
    capacidadProductivaMaximaKg: number,
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/productores')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({
        nombre: 'Productor WP-22 e2e',
        cedula: cedulaAleatoria(),
        capacidadProductivaMaximaKg,
      });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  it('recorrido completo: cada transición confirma una transacción real y guarda su hash en Postgres', async () => {
    const tokenCoop = await login('COOPERATIVA');
    const tokenCert = await login('CERTIFICADORA');
    const tokenTrans = await login('TRANSPORTISTA');
    const tokenExp = await login('EXPORTADOR');

    const productorId = await crearProductor(tokenCoop, 500);

    const recepcion = await request(app.getHttpServer())
      .post('/cooperativas/recepcion')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({ productorId, fechaCosecha: '2026-08-01', pesoInicialKg: 300 });
    expect(recepcion.status).toBe(201);
    expect(recepcion.body.ultimaTxHashBlockchain).toEqual(expect.any(String));
    expect(recepcion.body.ultimaTxHashBlockchain.length).toBeGreaterThan(0);
    const loteId = recepcion.body.id as string;
    const txCreacion = recepcion.body.ultimaTxHashBlockchain as string;

    const fermentacion = await request(app.getHttpServer())
      .post('/cooperativas/fermentacion')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({ loteId, peso: 250, fechaSecado: '2026-08-05' });
    expect(fermentacion.status).toBe(201);
    expect(fermentacion.body.ultimaTxHashBlockchain).toBeTruthy();
    expect(fermentacion.body.ultimaTxHashBlockchain).not.toBe(txCreacion);

    const certificado = await request(app.getHttpServer())
      .post('/certificados')
      .set('Authorization', `Bearer ${tokenCert}`)
      .field('loteId', loteId)
      .field('tipoCertificacion', 'Orgánico')
      .field('fechaEmision', '2026-08-08')
      .attach('archivo', PDF_DE_PRUEBA, {
        filename: 'certificado.pdf',
        contentType: 'application/pdf',
      });
    expect(certificado.status).toBe(201);
    expect(certificado.body.hashArchivo).toBeTruthy();

    const transporte = await request(app.getHttpServer())
      .post('/transporte')
      .set('Authorization', `Bearer ${tokenTrans}`)
      .send({ loteId, ruta: 'Ruta WP-22 e2e', fechaSalida: '2026-08-10' });
    expect(transporte.status).toBe(201);

    const exportacion = await request(app.getHttpServer())
      .post('/exportaciones')
      .set('Authorization', `Bearer ${tokenExp}`)
      .send({
        loteId,
        empresaCompradora: 'Cacao Trading Co.',
        paisDestino: 'Bélgica',
        puertoSalida: 'Puerto de Guayaquil',
        fechaExportacion: '2026-08-20',
      });
    expect(exportacion.status).toBe(201);
    expect(exportacion.body.hashTransaccionBlockchain).toBeTruthy();

    // WP-22 §2.6: lectura en vivo del ledger, comparada contra Postgres.
    const blockchain = await request(app.getHttpServer())
      .get(`/lotes/${loteId}/blockchain`)
      .set('Authorization', `Bearer ${tokenCoop}`);
    expect(blockchain.status).toBe(200);
    expect(blockchain.body.sincronizado).toBe(true);
    expect(blockchain.body.diferencias).toEqual([]);
    expect(blockchain.body.onChain.estado).toBe('EXPORTADO');
    expect(blockchain.body.onChain.historialEventos).toHaveLength(5);
    expect(
      (blockchain.body.onChain.historialEventos as { tipo: string }[]).map(
        (e) => e.tipo,
      ),
    ).toEqual(['CREACION', 'FERMENTACION', 'CERTIFICACION', 'TRANSPORTE', 'EXPORTACION']);
  });

  it('el peso que excede la capacidad máxima es rechazado y el lote no avanza on-chain', async () => {
    const tokenCoop = await login('COOPERATIVA');
    const productorId = await crearProductor(tokenCoop, 100);

    const recepcion = await request(app.getHttpServer())
      .post('/cooperativas/recepcion')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({ productorId, fechaCosecha: '2026-08-01', pesoInicialKg: 50 });
    expect(recepcion.status).toBe(201);
    const loteId = recepcion.body.id as string;

    const fermentacion = await request(app.getHttpServer())
      .post('/cooperativas/fermentacion')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({ loteId, peso: 999, fechaSecado: '2026-08-05' });
    expect(fermentacion.status).toBe(400);

    const blockchain = await request(app.getHttpServer())
      .get(`/lotes/${loteId}/blockchain`)
      .set('Authorization', `Bearer ${tokenCoop}`);
    expect(blockchain.status).toBe(200);
    expect(blockchain.body.onChain.estado).toBe('CREADO');
    expect(blockchain.body.sincronizado).toBe(true);
  });

  it('bajo una carrera de dos fermentaciones concurrentes, el chaincode admite solo una (fuente de verdad, §2.4)', async () => {
    const tokenCoop = await login('COOPERATIVA');
    const productorId = await crearProductor(tokenCoop, 500);

    const recepcion = await request(app.getHttpServer())
      .post('/cooperativas/recepcion')
      .set('Authorization', `Bearer ${tokenCoop}`)
      .send({ productorId, fechaCosecha: '2026-08-01', pesoInicialKg: 300 });
    expect(recepcion.status).toBe(201);
    const loteId = recepcion.body.id as string;

    const [primera, segunda] = await Promise.all([
      request(app.getHttpServer())
        .post('/cooperativas/fermentacion')
        .set('Authorization', `Bearer ${tokenCoop}`)
        .send({ loteId, peso: 200, fechaSecado: '2026-08-05' }),
      request(app.getHttpServer())
        .post('/cooperativas/fermentacion')
        .set('Authorization', `Bearer ${tokenCoop}`)
        .send({ loteId, peso: 210, fechaSecado: '2026-08-06' }),
    ]);

    const estados = [primera.status, segunda.status].sort();
    expect(estados[0]).toBe(201);
    expect(estados[1]).toBeGreaterThanOrEqual(400);
    expect(estados[1]).toBeLessThan(500);

    const blockchain = await request(app.getHttpServer())
      .get(`/lotes/${loteId}/blockchain`)
      .set('Authorization', `Bearer ${tokenCoop}`);
    const eventosFermentacion = (
      blockchain.body.onChain.historialEventos as { tipo: string }[]
    ).filter((e) => e.tipo === 'FERMENTACION');
    expect(eventosFermentacion).toHaveLength(1);
    expect(blockchain.body.sincronizado).toBe(true);
  });
});
