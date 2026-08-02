# Plan de implementación — WP-02 · Backend Base

**Estado:** Propuesto, pendiente de confirmación
**Depende de:** WP-01 (`database/schema.prisma`, `database/er-diagram.md`)
**Precede a:** WP-03 (Frontend base), WP-04 (Autenticación y roles)

---

## 1. Alcance

Configurar el esqueleto de NestJS conectado a PostgreSQL vía Prisma, con Swagger documentando la API y un endpoint `GET /health`. Se deja la estructura de módulos de negocio vacía (se llenan en Sprint 1) y un `AuthModule` de **solo configuración** (JWT/passport registrados, sin guards ni lógica de login — eso es WP-04).

No se toca blockchain, frontend, ni docker de producción (WP-31). Sí se agrega un `docker-compose.yml` mínimo con un servicio de PostgreSQL, exclusivamente para poder validar la conexión de este WP en un entorno reproducible; WP-31 lo ampliará con backend/frontend/Fabric.

## 2. Entorno verificado

- Node v24.11.1, npm 11.6.2, Docker 29.1.5 + Compose v5.0.1, Nest CLI disponibles localmente.
- No hay PostgreSQL corriendo actualmente en la máquina → se levanta vía Docker para pruebas.

## 3. Pasos

1. **Generar el proyecto NestJS** en `backend/` (`nest new backend --package-manager npm --skip-git`, TypeScript, estructura estándar `src/`).
2. **Instalar dependencias:**
   - `@nestjs/config` (carga de `.env`)
   - `prisma`, `@prisma/client`
   - `@nestjs/swagger`, `swagger-ui-express`
   - `class-validator`, `class-transformer`
   - `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt` (solo configuración, sin uso todavía)
3. **Prisma:**
   - Copiar `database/schema.prisma` (ya validado en WP-01) a `backend/prisma/schema.prisma`, ajustando el `datasource` para leer `DATABASE_URL` desde `.env`.
   - Crear `PrismaModule` / `PrismaService` global (patrón estándar Nest: `onModuleInit` → `$connect()`).
   - Ejecutar `prisma generate` y una primera migración (`prisma migrate dev --name init`) contra el Postgres de desarrollo.
4. **Variables de entorno:**
   - `.env.example` versionado con `DATABASE_URL`, `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`.
   - `.env` real en `.gitignore` (regla dura #5 del plan maestro).
5. **PostgreSQL de desarrollo:**
   - `docker-compose.yml` en la raíz con un servicio `postgres` (imagen `postgres:16-alpine`, volumen nombrado, puerto expuesto a `localhost`).
6. **Swagger:**
   - `SwaggerModule.setup('api', ...)` en `main.ts`, con título/versión/descripción del proyecto.
7. **Módulo Health:**
   - `HealthModule` con `GET /health` devolviendo `{ status: 'ok', db: boolean }` (verifica conexión real a Postgres vía `PrismaService`).
8. **Estructura base de módulos de negocio** (carpetas + módulo NestJS vacío, sin controllers/services con lógica todavía, solo para fijar la forma del árbol de `src/` según la sección 3 del plan maestro):
   `auth/`, `productores/`, `cooperativas/`, `certificadoras/`, `transportistas/`, `exportaciones/`, `lotes/`, `fabric-gateway/`.
9. **AuthModule (solo configuración):**
   - Registra `JwtModule.registerAsync` leyendo `JWT_SECRET`/`JWT_EXPIRES_IN` desde `ConfigService`.
   - Sin `AuthController`, sin `AuthService` con lógica, sin guards — placeholder para WP-04.
10. **Verificación end-to-end:**
    - Levantar Postgres (`docker compose up -d postgres`).
    - Levantar Nest (`npm run start:dev`).
    - Confirmar `GET /health` → 200 con `db: true`.
    - Confirmar Swagger UI accesible en `/api`.

## 4. Archivos/carpetas nuevos esperados

```
backend/
├── .env.example
├── .gitignore              (o se añade backend/.env al .gitignore raíz)
├── nest-cli.json
├── package.json
├── tsconfig*.json
├── prisma/
│   └── schema.prisma       (copiado y ajustado desde database/schema.prisma)
└── src/
    ├── main.ts              (Swagger + bootstrap)
    ├── app.module.ts
    ├── prisma/
    │   ├── prisma.module.ts
    │   └── prisma.service.ts
    ├── health/
    │   ├── health.module.ts
    │   └── health.controller.ts
    ├── auth/                (solo config, sin lógica)
    ├── productores/
    ├── cooperativas/
    ├── certificadoras/
    ├── transportistas/
    ├── exportaciones/
    ├── lotes/
    └── fabric-gateway/

docker-compose.yml           (raíz, solo servicio postgres por ahora)
```

## 5. Definition of Done — verificación planeada

| Criterio DoD | Cómo se verifica |
|---|---|
| Backend inicia sin errores | `npm run start:dev` sin excepciones, proceso queda escuchando |
| Conexión a PostgreSQL funciona | `PrismaService.$connect()` exitoso + `/health` reporta `db: true` |
| Prisma configurado y conectado | `prisma migrate dev` aplica el schema de WP-01 sin errores contra el Postgres real |
| Swagger muestra documentación inicial | `GET /api` sirve la UI con al menos el endpoint `/health` listado |
| `GET /health` responde 200 OK | Petición real con curl/HTTP client |

## 6. Fuera de alcance (explícitamente, para no adelantar WP-04)

- Lógica de login/registro, guards por rol, matriz de permisos C7 → WP-04.
- CRUD de cualquier módulo de negocio → Sprint 1 (WP-10 a WP-16).
- Integración con Hyperledger Fabric (`fabric-gateway/` queda como carpeta vacía) → Sprint 2.
- Docker de producción completo (frontend+backend+Fabric) → WP-31.

---

¿Confirmas que proceda con estos pasos?
