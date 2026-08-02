# Plan de implementación — WP-13 · Módulo Transportistas

**Estado:** Propuesto, pendiente de confirmación
**Depende de:** WP-01 (modelo `Transportista`, sin entidad de transporte todavía), WP-11/12 (patrón de transición de estado C1, `OrganizacionContextService`)

---

## 1. Alcance

Registro de transporte de un lote (transportista, ruta, fechas), actualización de su estado, registro de incidencias durante el traslado, y la transición C1 `Certificado → En Transporte`.

## 2. Corrección encontrada: falta una entidad `Transporte`

WP-01 no incluyó una entidad de transporte — asumió que `fechaTransporte` en `Lote` alcanzaba. Pero C5 define **dos** endpoints (`POST /transporte`, `PUT /transporte/:id/estado`), y el DoD de este WP pide explícitamente "actualización del estado del transporte" y "registro de incidencias" — eso exige un recurso con su propio id, estado actualizable e historial de incidencias, no solo una fecha suelta en `Lote`. Se agregan dos entidades nuevas (WP-01 dijo "como mínimo" esas 13 entidades, no que fueran las únicas posibles):

```prisma
enum EstadoTransporte {
  EN_RUTA
  ENTREGADO
}

model Transporte {
  id                    String @id @default(uuid())
  loteId                String @unique   // un transporte activo por lote (MVP)
  lote                  Lote   @relation(...)
  transportistaId       String
  transportista         Transportista @relation(...)
  ruta                  String
  fechaSalida           DateTime
  fechaLlegadaEstimada  DateTime?
  fechaLlegadaReal      DateTime?        // se llena al marcar ENTREGADO
  estado                EstadoTransporte @default(EN_RUTA)
  incidencias           Incidencia[]
  createdAt / updatedAt
}

model Incidencia {
  id            String @id @default(uuid())
  transporteId  String
  transporte    Transporte @relation(...)
  descripcion   String
  fecha         DateTime @default(now())
  createdAt     DateTime @default(now())
}
```

Esto implica: editar `database/schema.prisma`, sincronizar a `backend/prisma/schema.prisma`, nueva migración, actualizar `database/er-diagram.md` (diagrama, tabla de entidades, relaciones).

## 3. Otras dos extensiones aditivas (mismo criterio que WP-12 §2.6)

- `GET /transporte` (listado, "solo propio") — C5 no la define, pero el frontend la necesita para mostrar la tabla de transportes (igual que `GET /certificados` en WP-12).
- `POST /transporte/:id/incidencias` — C5 no define un endpoint separado para incidencias; como "actualizar estado" y "registrar incidencia" son acciones distintas en el DoD (una incidencia no necesariamente cambia el estado — ej. "retraso por lluvia" sin dejar de estar `EN_RUTA`), se separan en vez de forzarlas dentro de `PUT /transporte/:id/estado`.

Ninguna de las dos contradice C5, solo lo completan.

## 4. Roles y alcance (C7 + patrón WP-12)

- **Crear transporte:** solo `TRANSPORTISTA`, sin restricción sobre qué lote (igual que Certificadora en WP-12 — no hay relación de pertenencia previa entre un transportista y una cooperativa/lote).
- **Actualizar estado / registrar incidencia:** solo `TRANSPORTISTA`, y solo sobre **sus propios** transportes (el que creó el registro) — 404 si pertenece a otro transportista, mismo patrón "solo propio" ya usado.
- `OrganizacionContextService` (WP-12) se extiende con `resolveTransportistaId`.
- `GET /transporte`: `TRANSPORTISTA` ve los suyos; `COOPERATIVA`/`PRODUCTOR` ven los de sus propios lotes (join); `ADMIN` ve todos; el resto ve todos por ahora (mismo criterio temporal de WP-11/12).

## 5. Transición de estado C1

`POST /transporte` exige que el lote esté en `Certificado` (si no, `409`) y lo mueve a `En Transporte` — igual patrón que WP-11/12. Marcar `ENTREGADO` (`PUT /transporte/:id/estado`) **no** vuelve a mover el lote — se queda en `En Transporte` hasta que WP-14 (Exportación) lo mueva a `Exportado`. Se crea un `Evento` (`TRANSPORTE`) solo en la creación, igual criterio que WP-11/12 (las actualizaciones de estado/incidencias son detalle de `Transporte`, no hitos de `Lote`).

## 6. Backend

| Endpoint | Rol | Efecto |
|---|---|---|
| `POST /transporte` | `TRANSPORTISTA` | Valida lote en `Certificado`, crea `Transporte` (`EN_RUTA`), actualiza `Lote` (`En Transporte`, `fechaTransporte`) + `Evento` (`TRANSPORTE`) |
| `PUT /transporte/:id/estado` | `TRANSPORTISTA` (propio) | Actualiza `estado` (solo `EN_RUTA → ENTREGADO`, `409` si ya está `ENTREGADO`); si es `ENTREGADO`, guarda `fechaLlegadaReal` |
| `POST /transporte/:id/incidencias` | `TRANSPORTISTA` (propio) | Crea una `Incidencia` — no cambia `estado` |
| `GET /transporte` | cualquier autenticado | Lista "solo propio" (§4) |

DTOs: `CreateTransporteDto` (`loteId`, `ruta`, `fechaSalida`, `fechaLlegadaEstimada?`), `ActualizarEstadoTransporteDto` (`estado`), `CreateIncidenciaDto` (`descripcion`).

## 7. Frontend

Reemplaza la página "Próximamente" de `/transportistas` (WP-03):
- Tabla de transportes (lote/productor, ruta, fecha salida, estado, incidencias).
- **Nuevo transporte**: selector de lote (`useLotes`, filtrado a `Certificado`), ruta, fecha de salida, llegada estimada opcional.
- Por fila: botón **Marcar entregado** (solo si `EN_RUTA`) y botón **Registrar incidencia** (descripción corta) — con confirmación de errores igual que WP-10/11/12.

## 8. Verificación planeada

- e2e: creación exitosa transiciona el lote a `En Transporte`; rechazo si el lote no está en `Certificado` (409); un transportista no puede actualizar/agregar incidencia a un transporte de otro transportista (404); marcar `ENTREGADO` dos veces rechaza la segunda (409); registrar incidencia no cambia el estado; rol incorrecto rechazado (403); `GET /transporte` respeta "solo propio".
- Verificación manual en el navegador: login como `transportista@test.com`, crear transporte sobre un lote certificado (de WP-12), registrar una incidencia, marcar entregado, confirmar que el lote sigue en "En Transporte".

## 9. Fuera de alcance (explícitamente)

- Múltiples legs de transporte por lote (reenvíos, transbordos) → `Transporte` es 1:1 con `Lote` en este MVP.
- Geolocalización / tracking en tiempo real.
- Notificaciones automáticas por incidencia.

---

¿Confirmas que proceda con estos pasos?
