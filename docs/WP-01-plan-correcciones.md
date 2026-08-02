# Plan de implementación — Correcciones a WP-01 (Modelo Entidad-Relación)

**Estado:** Propuesto, pendiente de confirmación
**Motivo:** re-auditoría solicitada por el usuario tras migrar de carpeta de trabajo. Se cruzó `database/er-diagram.md` y `database/schema.prisma` línea por línea contra los contratos congelados C1–C7 de `Plan_Maestro_Fase3_Desarrollo.md` §2.

---

## 1. Metodología de la auditoría

Se releyó el `schema.prisma` y `er-diagram.md` actuales campo por campo contra:
- **C2** (esquema on-chain por lote)
- **C3** (esquema off-chain)
- **C4** (firmas fijas del chaincode)
- **C7** (matriz de roles)

y contra la regla dura #2 del plan maestro: *"No modificar los contratos de la sección 2 sin anotar el cambio aquí y revisar su impacto."*

Resultado: **2 errores reales** que rompen la coherencia con los contratos congelados, y **1 mejora opcional** (no bloqueante) que hace el modelo más fiel a C3.

---

## 2. Errores encontrados

### ERROR 1 (alto) — Falta `firmaDigital` (campo de C2)

C2 lista explícitamente `firmaDigital` como campo on-chain del lote: *"Firma criptográfica del actor que registra"*. Ningún modelo del `schema.prisma` actual lo tiene — ni `Lote` ni `Evento`. La matriz de campos de `er-diagram.md` §4.1 tampoco lo menciona: se omitió por completo al diseñar la proyección de lectura.

Además, C4 refuerza que la firma es **por acción**, no un valor fijo del lote: `RegisterCertification(loteId, hashCertificado, firmaCertificadora)` pasa una firma específica de esa transacción. Esto indica que el campo correcto es **por evento** (cada transacción on-chain trae su propia firma), no un único campo estático en `Lote`.

**Corrección propuesta:**
- Agregar `firmaDigital: String` (obligatorio) al modelo `Evento` — espejo de la firma que acompaña cada transacción on-chain (C2/C4).
- No duplicarlo en `Lote`: quien necesite "la firma vigente" la obtiene del evento más reciente de ese lote (ya hay relación `Lote.eventos`).
- Actualizar el diagrama Mermaid, la matriz §4.1 y el texto de `er-diagram.md`.

### ERROR 2 (alto) — `capacidadEstimadaSnapshotKg` asume una firma de `CreateLot` no autorizada

El `schema.prisma` actual dice, en un comentario sobre `Lote.capacidadEstimadaSnapshotKg`:
> "Se envía como parámetro a `CreateLot` (C4) y queda embebido en el registro on-chain..."

Pero la firma **congelada** de C4 es:
```
CreateLot(loteId, productorId, cooperativaId, fechaCosecha)
```
No incluye ningún parámetro de capacidad/peso. Esto significa que el diseño actual de WP-01 **asume tácitamente una modificación a un contrato congelado** sin registrarla ni pedir revisión de impacto — exactamente lo que la regla dura #2 prohíbe hacer sin anotarlo.

**Corrección propuesta:**
- Quitar `capacidadEstimadaSnapshotKg` de `Lote` (no hay base contractual para esa duplicación tal como está descrita hoy).
- Mantener `capacidadProductivaMaximaKg` en `Productor` como fuente de verdad off-chain (eso sí es correcto y no se toca).
- En `er-diagram.md`, reemplazar la justificación por una **nota de diseño abierta** dirigida a WP-21 (Sprint 2, chaincode): cómo exactamente el chaincode validará "peso reportado ≤ capacidad máxima de la finca" sin duplicar el dato on-chain, dejando dos caminos posibles para decidir en ese momento (ampliar formalmente la firma de `CreateLot` con el cambio anotado en el plan maestro, o que el chaincode mantenga su propio registro de capacidad vía una transacción de alta de finca separada). No se decide ahora para no inventar un contrato que el equipo no ha aprobado.

---

## 3. Mejora opcional (no bloqueante)

C3 lista como off-chain: *fotografías, certificados PDF, facturas, resultados de laboratorio, datos de sensores*. Hoy solo `Certificado` tiene un campo explícito de archivo (`archivoPdfUrl` + `hashArchivo`); el resto (fotos, facturas, laboratorio, sensores) dependen del JSON libre `Evento.datosEspecificos`, sin lugar explícito para su hash de integridad.

**Propuesta (opcional):** agregar una entidad `Documento` ligera (`id`, `eventoId` FK, `tipo` enum `FOTO|FACTURA|LABORATORIO|SENSOR|OTRO`, `url`, `hashArchivo`, `createdAt`) — no está en la lista mínima de entidades del WP-01, así que solo se agrega si tú lo confirmas. No es un error, es una mejora de fidelidad al contrato C3.

---

## 4. Impacto en WP-02 (backend ya construido)

`backend/prisma/migrations/20260801194731_init/` se generó contra el schema **con el Error 2** todavía presente. Como el contenedor de Postgres de desarrollo ya fue destruido (no hay datos reales en juego), la corrección es simple:

1. Aplicar los cambios a `database/schema.prisma` y copiarlo a `backend/prisma/schema.prisma` (como en WP-01/WP-02 original).
2. Borrar `backend/prisma/migrations/20260801194731_init/` (migración obsoleta, nunca se desplegó a nada real).
3. Regenerar una migración limpia (`prisma migrate dev --name init`) contra un Postgres de desarrollo fresco.
4. Verificar `prisma validate` + `prisma format` antes de migrar.

No se toca ningún otro archivo de `backend/src/` — el resto de WP-02 no depende de estos dos campos.

## 5. Verificación planeada

- `npx prisma validate` y `npx prisma format` sobre `database/schema.prisma` (ya sin el `&` en la ruta, debería correr con el flujo normal esta vez).
- Relectura de `er-diagram.md` §4 para confirmar que la matriz on-chain/off-chain queda consistente con los cambios.
- Re-generar migración y confirmar `GET /health` sigue en 200 tras la migración limpia.

---

¿Confirmas que proceda con las correcciones 1 y 2? Y dime si quieres que incluya también la mejora opcional de la entidad `Documento`.
