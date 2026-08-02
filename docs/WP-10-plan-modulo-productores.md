# Plan de implementación — WP-10 · Módulo Productores

**Estado:** Propuesto, pendiente de confirmación
**Depende de:** WP-01 (modelo `Productor`), WP-02 (backend base), WP-04 (guards de auth/roles)
**Abre:** Sprint 1 — Módulos de negocio sobre PostgreSQL

---

## 1. Alcance

Primer módulo de negocio real de punta a punta: backend (CRUD + Prisma + Swagger) y frontend (la página `/productores`, hoy un placeholder "Próximamente" de WP-03, pasa a ser funcional).

## 2. Tres decisiones de diseño que hay que cerrar antes de programar

### 2.1 Falta un campo para "eliminación lógica"

El modelo `Productor` (WP-01) no tiene ningún campo de estado — el DoD exige "eliminación lógica", no un `DELETE` real de la fila. Se agrega:

```prisma
activo Boolean @default(true)
```

(mismo nombre que ya usa `Usuario.activo`, por consistencia). Esto requiere:
- Editar `database/schema.prisma` (fuente de verdad) y sincronizar a `backend/prisma/schema.prisma`.
- Nueva migración de Prisma (`add_productor_activo`).
- Actualizar `database/er-diagram.md` (diagrama Mermaid + tabla de campos).

### 2.2 C7 no define quién puede hacer CRUD de Productores — se decide aquí y se documenta

La matriz C7 no tiene una fila para "gestionar productores" (solo cubre crear lote, fermentación, certificado, transporte, exportación). Regla propuesta, razonable y mínima:
- **Crear / Actualizar / Eliminar (lógico):** `ADMIN`, `COOPERATIVA` — una cooperativa gestiona a sus propios productores.
- **Consultar (uno o varios):** `ADMIN`, `COOPERATIVA`, `PRODUCTOR`.
- **Alcance "solo propio"** (igual que en C7 para otros actores): `COOPERATIVA` solo ve/edita productores de su propia organización (`cooperativaId` = organización del usuario); `PRODUCTOR` solo ve su propio registro (`usuarioId` = usuario autenticado); `ADMIN` ve todo. Esto se aplica con `@CurrentUser()` en el service, no solo con `@Roles()`.
- No se toca `cooperativaId` ni `cedula` en el `update` (reasignar productor de cooperativa o cambiar identidad es una decisión de negocio más grande, fuera de alcance de este WP).

### 2.3 El frontend necesita login real para poder probar esto

WP-03 dejó el Login como una pantalla que navega a `/dashboard` sin llamar al backend. Para que "el frontend permita gestionar productores correctamente" (DoD) haga falta algo más que la UI: sin un JWT real no hay manera de pasar los guards de WP-04. Este WP agrega lo mínimo indispensable para que el primer módulo funcione de punta a punta:
- Cliente HTTP (`axios`) con interceptor que adjunta el `accessToken`.
- Estado de sesión simple (Context + `localStorage`) — sin librería nueva de estado global, ni renovación automática de refresh token todavía (eso puede madurar en módulos siguientes si hace falta).
- `LoginPage` llama a `POST /auth/login` de verdad y guarda los tokens.
- Rutas dentro de `AppLayout` protegidas: sin sesión, redirigen a `/login`.
- `@tanstack/react-query` (ya está en el stack oficial de `Desarrollo.md`, no se había instalado hasta ahora) para las queries/mutations de Productores.

## 3. Backend

### 3.1 DTOs (`backend/src/productores/dto/`)
- `CreateProductorDto`: `nombre`, `cedula` (10 dígitos numéricos), `telefono?`, `direccion?`, `capacidadProductivaMaximaKg` (positivo), `cooperativaId` (ignorado si el actor es `COOPERATIVA`: se usa su propia organización).
- `UpdateProductorDto`: igual sin `cedula` ni `cooperativaId` (inmutables, ver 2.2).

### 3.2 `ProductoresService`
- `create`, `findAll`, `findOne`, `update`, `softDelete` sobre `PrismaService`.
- Helper de alcance ("solo propio") reutilizado por los cuatro métodos de lectura/escritura.
- `findAll` excluye `activo = false` por defecto; admite `?incluirInactivos=true`.
- `findOne`/`update`/`softDelete` sobre un productor fuera del alcance del actor → `404` (no `403`, para no filtrar existencia de datos de otra cooperativa).

### 3.3 `ProductoresController` (`backend/src/productores/`)
| Endpoint | Roles | Nota |
|---|---|---|
| `POST /productores` | `ADMIN`, `COOPERATIVA` | |
| `GET /productores` | `ADMIN`, `COOPERATIVA`, `PRODUCTOR` | filtrado "solo propio" |
| `GET /productores/:id` | `ADMIN`, `COOPERATIVA`, `PRODUCTOR` | filtrado "solo propio" |
| `PUT /productores/:id` | `ADMIN`, `COOPERATIVA` | filtrado "solo propio" |
| `DELETE /productores/:id` | `ADMIN`, `COOPERATIVA` | eliminación lógica, filtrado "solo propio" |

Todo documentado en Swagger (`@ApiTags`, `@ApiBearerAuth`, `@ApiProperty` en los DTOs, ya establecido en WP-02/04).

## 4. Frontend

- `frontend/src/lib/api.ts`: instancia de `axios` (`baseURL` desde `VITE_API_URL`), interceptor de request con el token.
- `frontend/src/lib/auth-context.tsx`: `AuthProvider` (login/logout, persiste en `localStorage`, expone el usuario decodificado del JWT).
- `LoginPage` (WP-03) pasa a llamar `POST /auth/login` real.
- `AppLayout` exige sesión (si no hay token, redirige a `/login`).
- `frontend/src/features/productores/`: página de listado (tabla con nombre, cédula, cooperativa, capacidad, estado), formulario de creación/edición (`Dialog` de shadcn), confirmación antes de eliminar (lógica, no destructiva pero se confirma igual).
- Reemplaza la ruta `/productores` en `router.tsx` (hoy `ProximamentePage`) por la página real.

## 5. Verificación planeada

- Migración aplicada sin errores contra el Postgres de desarrollo.
- Pruebas e2e (Jest, mismo patrón que WP-04): crear, listar, actualizar, eliminar lógicamente; una `COOPERATIVA` no puede ver/editar productores de otra cooperativa (404); `PRODUCTOR` solo ve su propio registro; rol no autorizado (ej. `TRANSPORTISTA`) → 403.
- Frontend: login real con `cooperativa@test.com` (seed de WP-04) en el navegador, crear un productor, verlo en la lista, editarlo, eliminarlo lógicamente y confirmar que desaparece de la lista por defecto.
- Confirmar en Swagger (`/api`) que los 5 endpoints aparecen documentados con sus roles.

## 6. Fuera de alcance (explícitamente)

- Alta de cuentas de usuario (`Usuario`) para productores vía API — no hay `POST /auth/register` ni un módulo de Usuarios todavía; `usuarioId` en el DTO queda opcional para enlazar una cuenta ya existente, nada más.
- Reasignar un productor a otra cooperativa, o cambiar su cédula.
- Renovación automática de `refreshToken` en el frontend (el usuario tendrá que volver a iniciar sesión cuando expire el access token de 15 min — se puede mejorar en un WP posterior si molesta durante las demos).
- Paginación de la lista de productores (dataset pequeño en el MVP).
- Validación de dígito verificador real de cédula ecuatoriana (solo se valida formato: 10 dígitos numéricos).

---

¿Confirmas que proceda con estos pasos?
