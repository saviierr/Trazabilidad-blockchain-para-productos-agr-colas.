# Plan de implementación — WP-04 · Autenticación y Roles

**Estado:** Propuesto, pendiente de confirmación
**Depende de:** WP-02 (backend base, `AuthModule` solo-configuración, modelos `Usuario`/`Rol`/`Organizacion` de WP-01)
**Cierra:** Sprint 0 — Fundación

---

## 1. Alcance

Convertir el `AuthModule` "solo configuración" de WP-02 en autenticación y autorización reales: login con JWT, guards globales, y la matriz de roles C7 aplicada a endpoints protegidos de verdad — no solo documentada.

Los módulos de negocio (Productores, Cooperativas, Certificadoras, Transportistas, Exportaciones, Lotes) siguen vacíos de lógica real (eso es Sprint 1). Para poder **probar** que un rol equivocado es rechazado — tal como exige el DoD de este WP en el plan maestro ("un usuario Transportista no puede llamar a POST /certificados aunque tenga el token — probado, no asumido") — se agrega un endpoint mínimo de demostración por cada acción de un-solo-rol de la matriz C7 (cuerpo placeholder, sin lógica de negocio ni Prisma todavía). La lógica real de cada uno se construye en Sprint 1 sin tocar el guard que ya queda funcionando.

## 2. Endpoints protegidos que se implementan (según C5 + C7)

| Endpoint | Acción C7 | Rol permitido |
|---|---|---|
| `POST /auth/login` | — | Público |
| `POST /auth/refresh` | — | Público (requiere refresh token válido) |
| `POST /lotes` | Crear lote | `COOPERATIVA` |
| `POST /cooperativas/fermentacion` | Registrar fermentación/secado | `COOPERATIVA` |
| `POST /certificados` | Emitir certificado | `CERTIFICADORA` |
| `POST /transporte` | Registrar transporte | `TRANSPORTISTA` |
| `POST /exportaciones` | Registrar exportación | `EXPORTADOR` |
| `GET /lotes` | Consultar historial | Cualquier rol autenticado (filtrado "solo propio" por usuario queda para Sprint 1, cuando exista el dato real) |

No se toca `GET /public/lotes/:id` (QR público) — no existe todavía (Sprint 2, WP-23). El mecanismo `@Public()` que se construye aquí es el que se usará ahí.

No se agregan endpoints de `Productores` porque C7 no define una restricción de rol explícita para ese CRUD — inventar una regla no está en el alcance de este WP.

## 3. Piezas a construir

### 3.1 Passwords y usuarios de prueba
- `bcryptjs` (hash puro en JS, evita compilación nativa en Windows) para `Usuario.passwordHash`.
- `backend/prisma/seed.ts`: crea los 7 `Rol` (C7), 4 `Organizacion` (Cooperativa/Certificadora/Transportista/Exportador) y un `Usuario` de prueba por rol con contraseña conocida — **marcados explícitamente como datos de prueba** (regla dura #1 del plan maestro), documentados en el propio plan, no en el código de producción.
- Se conecta a `package.json` (`prisma.seed`) para correr con `npx prisma db seed`.

### 3.2 JWT
- `POST /auth/login`: valida `email` + `password` (bcrypt.compare) contra `Usuario`, devuelve `{ accessToken, refreshToken }`. El payload del access token incluye `sub` (id), `email`, `rol` (nombre), `organizacionId`.
- `POST /auth/refresh`: valida el refresh token (secreto y expiración propios — `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` en `.env`) y devuelve un nuevo `accessToken`.
- `JwtStrategy` (passport-jwt): valida la firma y expiración, y confirma en Prisma que el usuario sigue existiendo y `activo = true` (para que una cuenta desactivada pierda acceso aunque el token siga siendo válido).

### 3.3 Guards y decoradores (`backend/src/auth/`)
- `guards/jwt-auth.guard.ts` — extiende `AuthGuard('jwt')`, respeta `@Public()`.
- `guards/roles.guard.ts` — lee `@Roles(...)` y compara contra `request.user.rol`; si no hay `@Roles()` en la ruta, solo exige estar autenticado.
- `decorators/public.decorator.ts` — `@Public()`.
- `decorators/roles.decorator.ts` — `@Roles(RolNombre.COOPERATIVA, ...)`.
- `decorators/current-user.decorator.ts` — `@CurrentUser()` para inyectar el usuario del token en los controllers.
- Ambos guards se registran **globalmente** vía `APP_GUARD` en `AuthModule` — por defecto todo endpoint nuevo queda protegido salvo que se marque `@Public()` explícitamente (evita que alguien olvide proteger una ruta nueva en Sprint 1).

### 3.4 Controllers de demostración
Un controller mínimo por módulo de la tabla de la sección 2, con el guard de rol correspondiente y un handler placeholder (`return { ok: true, accion: '...', actor: user }`), comentado como "lógica real en Sprint 1".

## 4. Verificación planeada (incluye pruebas automatizadas, exigidas por el DoD)

- **Pruebas e2e** (`backend/test/auth.e2e-spec.ts`, con el runner de Jest ya scaffolded en WP-02) contra un Postgres real (el mismo contenedor de desarrollo):
  - Login con credenciales válidas de cada rol de prueba → 200 + JWT con el `rol` correcto en el payload.
  - Login con contraseña incorrecta → 401.
  - Llamar cada endpoint de la sección 2 con el rol correcto → 200/201.
  - Llamar cada endpoint con un rol distinto al permitido → 403.
  - Llamar cualquier endpoint protegido sin token → 401.
  - `POST /auth/refresh` con un refresh token válido → nuevo `accessToken` válido.
- Verificación manual con `curl`/Swagger UI (`/api`) como confirmación adicional, igual que en WP-02.

## 5. Impacto en archivos existentes

- `backend/src/auth/auth.module.ts` (WP-02) se reescribe para pasar de "solo config" a real (agrega `AuthController`, `AuthService`, `JwtStrategy`, guards globales).
- `backend/src/app.module.ts`: sin cambios de imports (los guards se registran dentro de `AuthModule` vía `APP_GUARD`).
- `backend/.env` / `.env.example`: se agregan `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`.
- Los módulos vacíos de WP-02 (`LotesModule`, `CooperativasModule`, `CertificadorasModule`, `TransportistasModule`, `ExportacionesModule`) pasan a tener un controller mínimo cada uno (sin service/Prisma todavía).

## 6. Fuera de alcance (explícitamente)

- CRUD real de cada módulo (queries a Prisma, DTOs de negocio, validaciones de dominio) → Sprint 1 (WP-10 a WP-15).
- Filtrado "solo propio" real en `GET /lotes` (requiere que existan lotes con dueño) → Sprint 1.
- Endpoint público de QR (`GET /public/lotes/:id`) → WP-23 (Sprint 2), aunque el mecanismo `@Public()` que se construye aquí es el que se reutiliza ahí.
- Revocación de refresh tokens / listas negras → posible mejora futura, se documenta como limitación conocida en WP-41 si aplica, no se implementa ahora (mantener el MVP simple).
- Registro de nuevos usuarios vía API (C5 no define `POST /auth/register`; los usuarios se crean por seed/admin) → no se agrega un endpoint que el propio contrato no pide.

---

¿Confirmas que proceda con estos pasos?
