# Plan de implementación — WP-23 · Código QR y Consulta Pública

**Estado:** Propuesto, pendiente de confirmación
**Depende de:** WP-22 (Fabric Gateway ya integrado — `FabricGatewayService.evaluate()` para lecturas on-chain), WP-15 (máquina de estados de Lote), C5/C6/C7 (Plan Maestro §2)
**Cierra:** Sprint 2 — Integración blockchain. Con esto quedan resueltos los 5 WP de blockchain (WP-20 a WP-23); el siguiente sprint (WP-30 en adelante) es cierre técnico del MVP, no más integración.

---

## 1. Qué exige el DoD y cómo se cubre

| Entregable | Cómo se cubre |
|---|---|
| Generación automática de un QR por lote | `GET /lotes/:id/qr` (autenticado, "solo propio" — reutiliza el alcance de `LotesService.findOne`) devuelve una imagen PNG generada al vuelo, no almacenada (§2.1) |
| Identificador único del lote en el QR | Payload JSON embebido en el QR, forma fija de C6 (§2.2) |
| Endpoint público de consulta del historial | `GET /public/lotes/:id` — exactamente el endpoint que fija C5, sin autenticación (§2.3) |
| Visualización del historial completo | Página pública nueva en el frontend, reutilizando `EstadoStepper` y una variante pública de `HistorialTimeline` (§2.5) |
| Consulta de datos de blockchain y PostgreSQL | La respuesta pública combina lectura en vivo del ledger (`QueryLote`, igual que WP-22 §2.6) con la proyección de Postgres (nombres de organizaciones, hash por evento) (§2.4) |
| Visualización del hash de verificación | Cada evento del historial público expone el hash de su propia transacción (`Evento.hashTransaccionBlockchain`, ya guardado desde WP-22) (§2.4) |
| Acceso de solo lectura sin autenticación | `@Public()` (decorador ya reservado desde WP-04 con este WP en mente) + sin exponer nunca datos personales (§2.4) |
| Interfaz en el frontend para consulta por QR | Ruta `/public/lotes/:id` fuera de `RequireAuth`, cliente HTTP propio sin JWT (§2.6) |
| Pruebas funcionales de generación y lectura del QR | Prueba que genera el PNG real y lo **decodifica** de vuelta a texto (no solo verifica que la imagen exista) (§5) |

## 2. Decisiones de diseño (C5/C6/C7 no las resuelven del todo — se completan aquí, mismo criterio que WP-20/21/22)

### 2.1 El QR se genera al vuelo, no se guarda como archivo

A diferencia del PDF de un certificado (C3, WP-12), el contenido del QR es 100% derivable de datos que ya existen en Postgres (`loteId`, `FRONTEND_URL`, el hash de la transacción `CreateLot`) — no hace falta persistir un archivo de imagen que luego haya que mantener sincronizado. `GET /lotes/:id/qr` construye el PNG en memoria en cada petición con la librería `qrcode` y lo devuelve con `Content-Type: image/png`. Evita un artefacto off-chain nuevo que gestionar (backups, limpieza, WP-24-style hashing) para algo que es puro derivado.

### 2.2 Payload del QR: exactamente C6, con `hashVerificacion` = hash de la transacción `CreateLot`

C6 fija la forma (Plan Maestro §2, congelada — no se renombra ningún campo):

```json
{
  "loteId": "uuid",
  "url": "https://<dominio>/public/lotes/<loteId>",
  "hashVerificacion": "sha256..."
}
```

- `url` se construye con la variable de entorno `FRONTEND_URL` que WP-02 ya dejó lista (`http://localhost:5173` en desarrollo) — apunta a la página **del frontend**, no al endpoint JSON del backend, porque un QR se escanea con la cámara de un teléfono y debe abrir una página, no una respuesta JSON cruda.
- `hashVerificacion` es el hash de la transacción `CreateLot` de ese lote (`Evento.hashTransaccionBlockchain` del evento `CREACION`, ya guardado desde WP-22) — **no** el hash de la transacción más reciente. Un QR normalmente se genera una vez (p. ej. al recibir el cacao) y queda impreso/pegado físicamente durante toda la vida del lote; si `hashVerificacion` fuera "la última transacción", el QR impreso quedaría obsoleto en cuanto el lote avanzara de estado. Ligarlo a la transacción de creación le da una referencia estable y permanente ("prueba de que este lote específico nació en esta transacción exacta de la blockchain"). El hash de **cada** paso posterior sigue siendo visible — no en el QR, sino en la página pública (§2.4).

### 2.3 Nuevo módulo `PublicModule`, no un método más de `LotesController`

`GET /public/lotes/:id` usa el prefijo `public/lotes`, distinto de `lotes` — forzarlo dentro de `LotesController` (`@Controller('lotes')`) exigiría rutas completas ad-hoc. Se crea `backend/src/public/` (`public.module.ts`, `public.controller.ts`, `public-lotes.service.ts`) con su propio servicio, que **no reutiliza `LotesService.findOne`** (ese aplica el alcance "solo propio" de C7 con `AuthenticatedUser`, que aquí no existe) sino que construye la proyección pública desde cero.

### 2.4 Qué expone la consulta pública — y qué nunca (Fase II §6 / C3)

La respuesta combina dos fuentes, igual que WP-22 §2.6, pero orientada a un lector externo, no técnico:

| Campo | Fuente | Nota |
|---|---|---|
| `estado`, `hashCertificado`, `paisDestino`, fechas | Postgres | Rápido, siempre disponible; ya son la proyección de lectura del on-chain (C2) |
| `cooperativa` / `certificadora` / `transportista` / `exportador` | Postgres (`Organizacion.nombre`) | Nombres de **institución**, no de blockchain (on-chain solo guarda IDs) — nunca fueron datos restringidos (ya se muestran hoy a usuarios autenticados) |
| `historial[].tipo/timestamp/datos/organizacion` | Postgres (`Evento`) | Reutiliza la misma tabla que ya alimenta `GET /lotes/:id/historial` |
| `historial[].hashTransaccionBlockchain` | Postgres (`Evento.hashTransaccionBlockchain`, WP-22) | El "hash de verificación" por paso que pide el DoD |
| `sincronizado` | Blockchain, en vivo (`FabricGatewayService.evaluate('QueryLote')`) | Mismo mecanismo de WP-22 §2.6, aquí sin exigir sesión — `GetHistory`/`QueryLote` son de lectura pública en C7 |

**Nunca se incluye** (Fase II §6, C3): `Evento.actorUsuario` (nombre de la persona que operó, no de la institución), `Productor.cedula`/`telefono`/`direccion`, cualquier `id` interno de `Usuario`. La identidad on-chain (`actorMspId`/`actorId`) tampoco se muestra tal cual — es un DN x509 técnico de la identidad institucional compartida (WP-22 §2.1), no algo legible para un comprador; se omite del payload público (si se necesita para auditoría técnica, ya está disponible vía `GET /lotes/:id/blockchain`, que sigue exigiendo sesión).

### 2.5 Reutilización de componentes de frontend, con una variante sin datos personales

`EstadoStepper` no cambia (no toca actores). `HistorialTimeline` sí — hoy asume `Evento` completo con `actorUsuario.nombre`. En vez de forzar ese campo a `undefined` en la versión pública, se define un tipo `EventoPublico` (subconjunto de campos, sin `actorUsuario`) y una variante `HistorialTimelinePublico` que muestra `organizacion` en su lugar — mismo patrón visual, sin inventar un segundo sistema de diseño.

### 2.6 Cliente HTTP público, separado del `api` autenticado

El cliente `api` (axios) de `frontend/src/lib/api.ts` redirige a `/login` ante cualquier 401 — comportamiento correcto para el resto de la app, pero incorrecto para una página pública a la que se llega escaneando un QR sin haber iniciado sesión nunca. Se añade `frontend/src/lib/public-api.ts`: una instancia de axios sin interceptores de auth, usada solo por la página pública.

## 3. Estructura de archivos

```
backend/src/public/                     # nuevo
├── public.module.ts
├── public.controller.ts                # GET /public/lotes/:id (@Public())
├── public-lotes.service.ts             # proyección pública (§2.3/§2.4)
└── public-lotes.service.spec.ts        # unitarias, Prisma + FabricGatewayService mockeados

backend/src/lotes/
├── lotes.service.ts                    # + generarQr(id, user)
└── lotes.controller.ts                 # + GET /lotes/:id/qr (PNG)

backend/test/
└── public-lotes.e2e-spec.ts            # integración contra la red real (§5)

frontend/src/lib/
└── public-api.ts                       # cliente axios sin JWT (§2.6)

frontend/src/features/lotes/
├── HistorialTimelinePublico.tsx        # variante sin actorUsuario (§2.5)
├── public-api.ts                       # useLotePublico() (React Query)
└── QrCodeButton.tsx                    # botón/imagen QR dentro de LoteDetalleSheet

frontend/src/pages/
└── PublicLotePage.tsx                  # página de /public/lotes/:id

frontend/src/routes/router.tsx          # + ruta pública, fuera de RequireAuth
```

## 4. Endpoints nuevos

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/lotes/:id/qr` | JWT, "solo propio" (igual que `GET /lotes/:id`) | `image/png` |
| `GET` | `/public/lotes/:id` | Ninguna (`@Public()`) | JSON — proyección pública (§2.4) |

Nuevas dependencias: `qrcode` (+ `@types/qrcode`, dev) en `backend/package.json`. Para las pruebas de "lectura" del QR (§5): `jsqr` + `pngjs` (dev), solo usadas en tests.

## 5. Verificación planeada

- **Unitarias** (`public-lotes.service.spec.ts`, Prisma y `FabricGatewayService` mockeados): construye la proyección correctamente; `sincronizado` refleja divergencias; ningún campo prohibido (`actorUsuario`, `cedula`) aparece en la salida serializada.
- **Integración/e2e** (`public-lotes.e2e-spec.ts`, contra la red real ya desplegada — igual que WP-22):
  - Recorrido completo de un lote (recepción → exportación) y luego `GET /public/lotes/:id` **sin** cabecera `Authorization` → 200, `sincronizado: true`, historial con 5 pasos y su hash cada uno.
  - `GET /lotes/:id/qr` sin token → 401 (sigue protegido, no es el endpoint público). Con token → 200, `Content-Type: image/png`.
  - **Prueba de generación y lectura real**: se pide el PNG, se decodifica con `jsqr`, se hace `JSON.parse` del contenido decodificado y se verifica que `loteId`/`url`/`hashVerificacion` coincidan con los datos reales del lote — no basta con que la imagen "exista".
  - Una cooperativa que intenta pedir el QR de un lote ajeno → 404 (mismo alcance que `GET /lotes/:id`).
- **Manual en navegador** (regla de la sesión para cambios de frontend): escanear o pegar la URL pública en una pestaña sin sesión iniciada, confirmar que carga sin redirigir a `/login` y que el hash mostrado coincide con el que ya devuelve `GET /lotes/:id/blockchain` en la vista autenticada del mismo lote.

## 6. Fuera de alcance (explícitamente)

- Firmar/cifrar el contenido del QR — el DoD solo pide "incluir el identificador único"; C6 ya lo resuelve con un JSON plano más el hash de verificación, sin necesidad de una capa criptográfica adicional sobre el QR en sí (la integridad ya la da la blockchain, no el QR).
- Generar el QR como archivo descargable en PDF/impresión física — la UI ofrece ver/descargar el PNG, no maquetar una etiqueta imprimible.
- Cachear o invalidar la respuesta pública (p. ej. con un CDN) — fuera de alcance del MVP local.
- Panel de analítica de escaneos (cuántas veces se consultó un lote) — no lo pide el DoD.
- Traducciones / i18n de la página pública — el resto del frontend ya está en español únicamente, se mantiene igual.

---

¿Confirmas que proceda con estos pasos?
