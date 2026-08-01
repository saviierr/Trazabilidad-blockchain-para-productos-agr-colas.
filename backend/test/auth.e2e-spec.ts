import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Credenciales de prueba sembradas por `npx prisma db seed` (ver prisma/seed.ts).
// No representan actores reales — regla dura #1 del plan maestro.
const CREDENCIALES = {
  ADMIN: { email: 'admin@test.com', password: 'Admin123!' },
  PRODUCTOR: { email: 'productor@test.com', password: 'Productor123!' },
  COOPERATIVA: { email: 'cooperativa@test.com', password: 'Cooperativa123!' },
  CERTIFICADORA: {
    email: 'certificadora@test.com',
    password: 'Certificadora123!',
  },
  TRANSPORTISTA: {
    email: 'transportista@test.com',
    password: 'Transportista123!',
  },
  EXPORTADOR: { email: 'exportador@test.com', password: 'Exportador123!' },
  COMPRADOR: { email: 'comprador@test.com', password: 'Comprador123!' },
} as const;

describe('Auth y roles (e2e)', () => {
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
    expect(res.body.accessToken).toBeDefined();
    return res.body.accessToken as string;
  }

  describe('POST /auth/login', () => {
    it('genera un JWT válido con credenciales correctas (uno por rol)', async () => {
      for (const rol of Object.keys(CREDENCIALES) as (keyof typeof CREDENCIALES)[]) {
        const token = await login(rol);
        expect(typeof token).toBe('string');
        expect(token.split('.').length).toBe(3);
      }
    });

    it('rechaza credenciales inválidas con 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'productor@test.com', password: 'incorrecta' });
      expect(res.status).toBe(401);
    });

    it('rechaza un email inexistente con 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'no-existe@test.com', password: 'cualquiera1' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('devuelve un nuevo access token con un refresh token válido', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(CREDENCIALES.PRODUCTOR);
      const { refreshToken } = loginRes.body;

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.accessToken).toBeDefined();
    });

    it('rechaza un refresh token inválido con 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'token-invalido' });
      expect(res.status).toBe(401);
    });
  });

  describe('Endpoints protegidos requieren autenticación', () => {
    it('GET /health es público (sin token)', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.status).toBe(200);
    });

    it('POST /lotes sin token devuelve 401', async () => {
      const res = await request(app.getHttpServer()).post('/lotes');
      expect(res.status).toBe(401);
    });
  });

  describe('Matriz de permisos C7 — un solo rol por acción', () => {
    const casos: {
      metodo: 'post';
      ruta: string;
      rolPermitido: keyof typeof CREDENCIALES;
      accion: string;
    }[] = [
      { metodo: 'post', ruta: '/lotes', rolPermitido: 'COOPERATIVA', accion: 'crear-lote' },
      {
        metodo: 'post',
        ruta: '/cooperativas/fermentacion',
        rolPermitido: 'COOPERATIVA',
        accion: 'registrar-fermentacion',
      },
      {
        metodo: 'post',
        ruta: '/certificados',
        rolPermitido: 'CERTIFICADORA',
        accion: 'emitir-certificado',
      },
      {
        metodo: 'post',
        ruta: '/transporte',
        rolPermitido: 'TRANSPORTISTA',
        accion: 'registrar-transporte',
      },
      {
        metodo: 'post',
        ruta: '/exportaciones',
        rolPermitido: 'EXPORTADOR',
        accion: 'registrar-exportacion',
      },
    ];

    for (const caso of casos) {
      it(`${caso.ruta}: el rol permitido (${caso.rolPermitido}) accede`, async () => {
        const token = await login(caso.rolPermitido);
        const res = await request(app.getHttpServer())
          [caso.metodo](caso.ruta)
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(201);
        expect(res.body.accion).toBe(caso.accion);
      });

      it(`${caso.ruta}: un rol distinto (${
        caso.rolPermitido === 'COOPERATIVA' ? 'TRANSPORTISTA' : 'COOPERATIVA'
      }) es rechazado con 403`, async () => {
        const rolIncorrecto =
          caso.rolPermitido === 'COOPERATIVA' ? 'TRANSPORTISTA' : 'COOPERATIVA';
        const token = await login(rolIncorrecto);
        const res = await request(app.getHttpServer())
          [caso.metodo](caso.ruta)
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
      });
    }

    it('GET /lotes: cualquier rol autenticado accede (sin @Roles)', async () => {
      const token = await login('COMPRADOR');
      const res = await request(app.getHttpServer())
        .get('/lotes')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });
});
