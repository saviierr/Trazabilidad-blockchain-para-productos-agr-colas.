# Plan de implementación — WP-14 · Módulo Exportación

**Estado:** Propuesto, pendiente de confirmación
**Depende de:** WP-01 (modelo `Exportacion`), WP-11/12/13 (patrón de transición C1, `OrganizacionContextService`)
**Cierra:** Sprint 1 — Módulos de negocio sobre PostgreSQL (WP-10 a WP-16 quedarían completos salvo WP-15/16)

---

## 1. Alcance

Registrar la exportación de un lote (exportador, país destino, fecha, puerto de salida) y aplicar la transición final de C1: `En Transporte → Exportado`.

## 2. Corrección encontrada: falta el campo "puerto o punto de salida"

El modelo `Exportacion` (WP-01) tiene `empresaCompradora`, `paisDestino`, `fechaExportacion`, `numeroDocumentoAduanero` — pero el DoD de este WP pide explícitamente "Registro del puerto o punto de salida", y C4 (`RegisterExport(loteId, exportadorId, paisDestino, fechaExportacion)`) tampoco lo menciona porque C4 es la firma mínima on-chain, no el detalle documental completo (igual que `numeroDocumentoAduanero`, que ya existe off-chain sin estar en C4). Se agrega:

```prisma
puertoSalida String
```

Requiere: editar `database/schema.prisma`, sincronizar a `backend/prisma/schema.prisma`, nueva migración, actualizar `database/er-diagram.md`.

Nota: "empresa exportadora" (otro punto del DoD) **no** es un campo nuevo — ya está cubierto por la relación `exportadorId → Exportador → Organizacion.nombre` (mismo criterio que WP-12/13: quién ejecuta la acción se identifica por la organización del actor autenticado, no por un campo de texto libre duplicado).

## 3. Extensión aditiva: `GET /exportaciones`

C5 solo define `POST /exportaciones` (ni siquiera un `GET /exportaciones/:id`, a diferencia de Certificadoras/Transportistas). Se agrega `GET /exportaciones` (listado, "solo propio") por el mismo motivo que en WP-12/13: el frontend necesita una tabla para gestionar exportaciones. No contradice C5, solo lo completa.

## 4. Roles y alcance (C7 + patrón WP-12/13)

- **Registrar exportación:** solo `EXPORTADOR`, sin restricción sobre qué lote (igual que Certificadora/Transportista — no hay relación de pertenencia previa).
- **`GET /exportaciones`:** `EXPORTADOR` ve las suyas; `COOPERATIVA`/`PRODUCTOR` ven las de sus propios lotes (join); `ADMIN` ve todas; el resto ve todas por ahora (mismo criterio temporal de WP-11/12/13, ya no quedará ningún actor pendiente de "propio" después de este WP salvo Comprador, que en C7 es explícitamente público/solo lectura y se resuelve en WP-23).
- `OrganizacionContextService` se extiende con `resolveExportadorId` (mismo patrón que Cooperativa/Certificadora/Transportista).

## 5. Transición de estado C1 (la última)

`POST /exportaciones` exige que el lote esté en `En Transporte` (si no, `409`) y lo mueve a `Exportado` — el estado final de C1. Se crea un `Evento` (`EXPORTACION`), mismo patrón que WP-11/12/13 (`hashTransaccionBlockchain`/`firmaDigital` en `null` hasta WP-22).

## 6. Backend

| Endpoint | Rol | Efecto |
|---|---|---|
| `POST /exportaciones` | `EXPORTADOR` | Valida lote en `En Transporte`, crea `Exportacion`, actualiza `Lote` (`Exportado`, `fechaExportacion`) + `Evento` (`EXPORTACION`) |
| `GET /exportaciones` | cualquier autenticado | Lista "solo propio" (§4) |

DTO `CreateExportacionDto`: `loteId` (UUID), `empresaCompradora`, `paisDestino`, `puertoSalida`, `fechaExportacion`, `numeroDocumentoAduanero?`.

## 7. Frontend

Reemplaza la página "Próximamente" de `/exportaciones` (WP-03):
- Tabla de exportaciones (lote/productor, empresa compradora, país destino, puerto de salida, fecha).
- **Nueva exportación**: selector de lote (`useLotes`, filtrado a `En Transporte`), empresa compradora, país destino, puerto de salida, fecha de exportación, número de documento aduanero opcional.
- Una vez exportado, el lote deja de aparecer como accionable en Lotes/Transportistas (ya no hay más transiciones posibles en este MVP).

## 8. Verificación planeada

- e2e: creación exitosa transiciona el lote a `Exportado`; rechazo si el lote no está en `En Transporte` (409); rol incorrecto rechazado (403); `GET /exportaciones` respeta "solo propio" (un exportador no ve las de otro — se agrega `exportador2@test.com` al seed, mismo patrón de las otras entidades organizacionales); validación de campos requeridos (400).
- Verificación manual en el navegador: login como `exportador@test.com`, exportar un lote en transporte (de WP-13), confirmar que pasa a "Exportado" en `/lotes` y que ya no tiene acciones disponibles.

## 9. Fuera de alcance (explícitamente)

- Documentos aduaneros reales / carga de PDF de exportación (no lo pide el DoD; distinto de los certificados de WP-12, que sí lo piden).
- Tracking marítimo/logístico real del envío.
- Código QR y consulta pública del historial completo → WP-23 (Sprint 2), aunque este WP deja el lote en el estado final que WP-23 necesitará mostrar.

---

¿Confirmas que proceda con estos pasos?
