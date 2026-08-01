# Plan de implementación — WP-11 · Módulo Cooperativas

**Estado:** Propuesto, pendiente de confirmación
**Depende de:** WP-01 (modelos `Lote`/`Evento`), WP-04 (guards, endpoints placeholder de `Lotes`/`Cooperativas`), WP-10 (patrón de "solo propio", `useProductores`)

---

## 1. Alcance

Recepción de lotes (con peso), fermentación/secado, y la transición de estado `Creado → Fermentando` (C1), de punta a punta (backend + frontend). Aprovecha y reemplaza los endpoints placeholder que WP-04 dejó para poder probar los guards de rol.

## 2. Correcciones encontradas antes de programar

### 2.1 `POST /lotes` (WP-04) no es el endpoint correcto — C5 dice `POST /cooperativas/recepcion`

C5 (contrato congelado) define el módulo `Lotes` con **solo** `GET /lotes` y `GET /lotes/:id/historial`; "crear lote" vive en el módulo `Cooperativas`: `POST /cooperativas/recepcion`. WP-04 creó `POST /lotes` como demo genérica para poder probar el guard de rol antes de que existiera el módulo real — ahora que se construye el módulo real, se corrige para seguir el contrato exacto:
- Se elimina el handler `POST` de `LotesController` (queda solo `GET /lotes`, real).
- Se agrega `POST /cooperativas/recepcion` en `CooperativasController` como el "crear lote" real.
- Se actualiza `backend/test/auth.e2e-spec.ts` (el caso de la matriz C7 que probaba `POST /lotes` pasa a probar `POST /cooperativas/recepcion`).

### 2.2 `Evento.hashTransaccionBlockchain` y `firmaDigital` no pueden ser obligatorios todavía

Estos dos campos (agregados como espejo de C2 en la corrección de WP-01) asumen que cada evento nace de una transacción confirmada en Hyperledger Fabric. Pero el propio `Desarrollo.md` fija que Sprint 1 es explícitamente **"Todavía no se utilizará blockchain"** — la integración real es WP-22 (Sprint 2). Este WP es el primero que efectivamente escribe filas en `Evento` (recepción y fermentación), y hoy no hay ninguna transacción on-chain de la cual sacar esos valores.

**Corrección:** ambos campos pasan a **nullables** (`String?`). Los eventos de Sprint 1 se registran con esos campos en `null`; WP-22 los completará retroactivamente cuando cada acción efectivamente se someta a Fabric. Se documenta esto en `database/er-diagram.md` §4 para que quede registrado por qué existe ese hueco temporal.

### 2.3 Falta dónde guardar el peso y la fecha de secado registrados en la fermentación

C4 congela `RegisterFermentation(loteId, peso, fechaSecado)`. Ese `peso` es el peso **post-fermentación/secado** (el cacao pierde peso al secarse) — es un dato distinto de `pesoInicialKg` (peso en recepción), y hoy `Lote` no tiene dónde guardarlo. Se agrega, siguiendo el mismo patrón que `fechaTransporte`/`fechaExportacion` (columnas directas en `Lote` para hitos del ciclo de vida):
```prisma
pesoFermentadoKg Decimal?  @db.Decimal(10, 2)
fechaSecado      DateTime?
```

Estas tres correcciones (2.1–2.3) requieren: editar `database/schema.prisma`, sincronizar a `backend/prisma/schema.prisma`, una migración nueva, y actualizar `database/er-diagram.md`.

## 3. La regla de negocio del peso máximo por fin se implementa

La mitigación de Fase I ("`RegisterFermentation` rechaza si el peso reportado excede la capacidad productiva máxima registrada para esa finca") se implementa ahora en la capa de API — **no** hace falta esperar al chaincode (WP-21): Postgres ya tiene `Productor.capacidadProductivaMaximaKg` disponible directamente vía Prisma, sin duplicación on-chain de por medio. `POST /cooperativas/fermentacion` consulta el productor del lote y rechaza (`400`) si `peso > capacidadProductivaMaximaKg`. La nota abierta de WP-01 sobre cómo el *chaincode* (on-chain) hará esta misma validación sin duplicar el dato sigue intacta para WP-21 — esto no la resuelve, solo adelanta la validación de negocio en la capa que sí puede resolverse ahora.

## 4. Roles — C7 aplica literal, sin ampliar a ADMIN

A diferencia de Productores (donde C7 no decía nada y yo propuse incluir a `ADMIN`), aquí C7 **sí** tiene filas explícitas:
- "Crear lote" → `COOPERATIVA` únicamente.
- "Registrar fermentación/secado" → `COOPERATIVA` únicamente.

No se agrega `ADMIN` a estos dos endpoints — el contrato ya lo define y no hay motivo para ampliarlo. Ambos, además, con alcance "solo propio": una cooperativa solo puede recibir lotes de sus propios productores y solo puede fermentar lotes de su propia cooperativa (mismo patrón 404-no-403 de WP-10; se extrae el helper `resolveCooperativaId` a un servicio compartido para no duplicarlo entre `ProductoresService` y el nuevo `CooperativasService`).

`GET /lotes` (ya real desde este WP, dejó de ser placeholder): `COOPERATIVA` ve solo sus lotes, `PRODUCTOR` ve solo los suyos, `ADMIN` ve todos. Certificadora/Transportista/Exportador/Comprador ven todos los lotes sin filtro todavía (su relación real con un lote específico no existe como dato hasta WP-12/13/14) — se documenta como simplificación temporal a refinar en esos WPs.

## 5. Backend

### 5.1 Máquina de estados (validación de transición)
`POST /cooperativas/fermentacion` exige que el lote esté en `estado = CREADO` (si no, `409 Conflict`) y lo mueve a `FERMENTANDO` — aplicando C1 ("orden estricto, sin saltos hacia atrás") por primera vez con datos reales.

### 5.2 Endpoints
| Endpoint | Rol | Efecto |
|---|---|---|
| `POST /cooperativas/recepcion` | `COOPERATIVA` | Crea `Lote` (estado `CREADO`) para un productor propio + `Evento` (`CREACION`) |
| `POST /cooperativas/fermentacion` | `COOPERATIVA` | Valida peso máximo, valida estado `CREADO`, actualiza `Lote` (`FERMENTANDO`, `pesoFermentadoKg`, `fechaSecado`) + `Evento` (`FERMENTACION`) |
| `GET /lotes` | cualquier autenticado | Lista con alcance "solo propio" (COOPERATIVA/PRODUCTOR) |

DTOs con `class-validator` (`RecepcionLoteDto`: `productorId`, `fechaCosecha`, `pesoInicialKg`; `FermentacionLoteDto`: `loteId`, `peso`, `fechaSecado`), documentados en Swagger igual que WP-10.

## 6. Frontend

Reemplaza la página "Próximamente" de `/lotes` (WP-03) por una página real:
- Tabla de lotes de la cooperativa (productor, fecha cosecha, peso inicial, peso fermentado, estado con badge).
- Botón **Nueva recepción**: formulario con selector de productor (reutiliza `useProductores` de WP-10, ya filtra "solo propio" y activos), fecha de cosecha, peso inicial.
- Acción **Registrar fermentación/secado** por fila, visible solo cuando el lote está en estado `Creado`: formulario con peso y fecha de secado; si el backend rechaza por exceso de peso, se muestra el mensaje de error (mismo patrón que WP-10).
- Se agrega el componente `select` de shadcn/ui (no estaba instalado).

## 7. Verificación planeada

- Migración nueva aplicada sin errores.
- e2e (Jest): recepción exitosa por `COOPERATIVA` propia; rechazo (404) si el productor pertenece a otra cooperativa; fermentación exitosa con peso válido; rechazo (400) con peso mayor a la capacidad del productor; rechazo (409) al intentar fermentar un lote que ya no está en `Creado`; un rol no autorizado (ej. `TRANSPORTISTA`) recibe 403 en ambos endpoints; `GET /lotes` respeta "solo propio" para `COOPERATIVA`/`PRODUCTOR`.
- Se actualiza el caso de WP-04 que probaba `POST /lotes` para que pruebe `POST /cooperativas/recepcion`.
- Verificación manual en el navegador: login como `cooperativa@test.com`, crear una recepción, registrar su fermentación, confirmar que el estado cambia en la tabla y que un segundo intento de fermentar el mismo lote es rechazado.

## 8. Fuera de alcance (explícitamente)

- `GET /lotes/:id/historial` (listar los `Evento` de un lote) → se deja para WP-15, junto con el resto del módulo Lotes.
- Filtrado "solo propio" para Certificadora/Transportista/Exportador/Comprador en `GET /lotes` → WP-12/13/14 (cuando exista el dato real de esa relación).
- Corrección de un lote ya fermentado (evento `CORRECCION`) → no lo pide el DoD de este WP.
- Completar `hashTransaccionBlockchain`/`firmaDigital` con valores reales → WP-22 (Fabric Gateway).

---

¿Confirmas que proceda con estos pasos?
