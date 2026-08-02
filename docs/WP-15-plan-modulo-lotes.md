# Plan de implementación — WP-15 · Módulo Lotes

**Estado:** Propuesto, pendiente de confirmación
**Depende de:** WP-01 (modelo `Lote`/`Evento`, incluido `TipoEvento.CORRECCION` nunca usado hasta ahora), WP-11 a WP-14 (cada uno ya implementó su transición de C1)
**Cierra:** el módulo Lotes; con WP-16 (dashboard) termina Sprint 1

---

## 1. Qué de este WP ya está construido — no se repite

La mayoría del DoD de WP-15 **ya existe**, distribuido en los WPs anteriores, porque cada módulo de negocio implementó su propio tramo de la máquina de estados C1 a medida que se construía:

| Entregable del DoD | Ya implementado en |
|---|---|
| Registro de nuevos lotes | `POST /cooperativas/recepcion` (WP-11) |
| Máquina de estados: `Creado→Fermentando→Certificado→En Transporte→Exportado` | WP-11 (recepción/fermentación), WP-12 (certificación), WP-13 (transporte), WP-14 (exportación) |
| Validación de transiciones (rechazo de saltos, `409`) | Cada servicio de WP-11 a WP-14 ya valida el estado actual antes de transicionar |
| Asociación con productor/cooperativa | `Lote.productorId`/`cooperativaId` desde WP-01 |
| `GET /lotes` (consulta, "solo propio") | WP-11 |

Este WP **no reimplementa nada de lo anterior** — completa lo que quedó explícitamente pendiente y que WP-11 ya anotó como "se deja para WP-15" en su §8.

## 2. Lo que falta de verdad

### 2.1 `GET /lotes/:id/historial` — definido en C5, nunca construido

C5 lo lista explícitamente para el módulo Lotes y WP-11 lo dejó pendiente a propósito. Devuelve los `Evento` del lote en orden cronológico (la proyección de lectura del `historialEventos` on-chain, C2).

### 2.2 `GET /lotes/:id` — extensión aditiva (mismo criterio de WP-12/13/14)

C5 no lo define aparte del historial, pero el DoD pide poder "consultar la información de un lote" y que "quede correctamente relacionado con las demás entidades" — eso exige una vista de detalle con todas las relaciones (productor, cooperativa, certificados, transporte + incidencias, exportación), no solo el listado plano de `GET /lotes`.

### 2.3 `PUT /lotes/:id` — corrección de datos, sin tocar el estado (usa `TipoEvento.CORRECCION` por primera vez)

El DoD pide "actualización de información del lote", pero C1 prohíbe editar el estado retroactivamente ("no se permiten saltos hacia atrás salvo una transacción explícita de corrección auditada — queda como evento nuevo, nunca como edición del anterior", Fase I). WP-01 ya había previsto esto con el enum `TipoEvento.CORRECCION`, nunca usado hasta ahora. Se implementa así:
- Solo permite corregir `fechaCosecha` y `pesoInicialKg` (los datos capturados en la recepción — no los de fermentación/certificación/etc., que son responsabilidad de sus propios módulos).
- **No** modifica `Lote.estado`.
- Crea un `Evento` (`CORRECCION`) con `datosEspecificos` guardando el valor anterior y el nuevo, para que quede auditado.
- Rol: `COOPERATIVA` (solo sus propios lotes) o `ADMIN` — igual criterio que WP-10 (C7 no define esta acción, se aplica el mismo criterio razonable ya usado para Productores).

### 2.4 Se cierra el alcance "solo propio" de `GET /lotes` para Certificadora/Transportista/Exportador

WP-11 dejó anotado como simplificación temporal que estos tres roles "ven todos los lotes por ahora — su relación específica no existe como dato hasta WP-12/13/14". Esos tres WPs ya se construyeron, así que ahora sí se puede filtrar de verdad:
- `CERTIFICADORA` → lotes que ella certificó (`certificados.some(certificadoraId = propio)`).
- `TRANSPORTISTA` → lotes que ella transportó.
- `EXPORTADOR` → lotes que ella exportó.
- `COMPRADOR` sigue viendo **todos** — no es una simplificación temporal, es lo que dice C7 ("Comprador: Público, solo lectura"), adelanto de la consulta pública de WP-23.
- `ADMIN` sigue viendo todos.

## 3. Backend

| Endpoint | Rol | Efecto |
|---|---|---|
| `GET /lotes/:id` | cualquier autenticado | Detalle completo con relaciones, alcance "solo propio" ya cerrado (§2.4) |
| `GET /lotes/:id/historial` | cualquier autenticado | `Evento[]` del lote, mismo alcance |
| `PUT /lotes/:id` | `COOPERATIVA` (propio) / `ADMIN` | Corrige `fechaCosecha`/`pesoInicialKg`, crea `Evento` `CORRECCION`, no toca `estado` |

Sin migración de Prisma — no se necesita ningún campo nuevo.

## 4. Frontend

- En la tabla de `/lotes` (WP-11), cada fila agrega un botón **Ver detalle** que abre un panel con: datos del lote, **stepper de estado** (los 5 pasos de C1, indicando visualmente en cuál está el lote), **línea de tiempo del historial** (`GET /lotes/:id/historial`), certificado(s), transporte + incidencias, exportación — la vista de trazabilidad completa de ese lote.
- Botón **Editar** (solo `COOPERATIVA` sobre sus propios lotes): corrige fecha de cosecha / peso inicial vía `PUT /lotes/:id`.

### 4.1 Patrones visuales adoptados (dentro de la paleta ya fijada en WP-03, C8)

A partir del mockup que compartiste (Stitch/Material Design 3), se adoptan dos patrones de UX — **no** la paleta de colores ni la tipografía, que quedaron fijadas en WP-03 y no se vuelven a discutir (regla C8):
- **Stepper horizontal de 5 pasos** para el estado del lote (`Creado → Fermentando → Certificado → En Transporte → Exportado`): pasos completados en `bg-primary` (marrón cacao) con ícono de check, paso actual resaltado con anillo, pasos futuros en `bg-muted`. Iconos de `lucide-react` ya usados en el sidebar (Sprout, Droplet, ShieldCheck, Truck, Ship), no Material Symbols.
- **Línea de tiempo vertical** para el historial de eventos: un nodo por evento (`CREACION`, `FERMENTACION`, `CERTIFICACION`, `TRANSPORTE`, `EXPORTACION`, `CORRECCION`), con actor, fecha y detalle — mismos colores semánticos que ya usan las páginas existentes (`primary`, `secondary`, `destructive` para incidencias/errores).

### 4.2 Control de acceso por rol en el frontend (corrige el vacío que señalaste)

Hoy el backend rechaza correctamente cada acción no autorizada (`403`, ya probado en cada WP), pero el frontend muestra los mismos botones de "crear/editar" a cualquier usuario sin importar su rol — quien no puede hacer la acción solo se entera cuando el backend la rechaza. Se corrige ocultando esos botones cuando el rol autenticado no coincide con el permitido, usando el mismo `user.rol` que ya expone `useAuth()` (WP-10):

| Acción en el frontend | Rol requerido (igual que el backend) |
|---|---|
| Nuevo/editar/eliminar productor | `ADMIN`, `COOPERATIVA` |
| Nueva recepción / Fermentación-secado / Editar lote | `COOPERATIVA` |
| Nuevo certificado | `CERTIFICADORA` |
| Nuevo transporte / Marcar entregado / Incidencia | `TRANSPORTISTA` |
| Nueva exportación | `EXPORTADOR` |

Las páginas de **consulta** (listados) siguen visibles para cualquier rol autenticado — eso es intencional (transparencia de la cadena de suministro), no un descuido; el backend tampoco restringe los `GET`. Solo se ocultan los botones de **acción** que el backend rechazaría igualmente.

## 5. Verificación planeada

- e2e (`lotes.e2e-spec.ts`, nuevo): recorre la máquina de estados completa de punta a punta y confirma cada rechazo de salto (intentar certificar un lote `Creado`, transportar uno `Fermentando`, exportar uno `Certificado`, etc. → `409` en cada caso); `GET /lotes/:id/historial` devuelve los eventos en el orden correcto con los tipos esperados (`CREACION`, `FERMENTACION`, `CERTIFICACION`, `TRANSPORTE`, `EXPORTACION`); corrección vía `PUT /lotes/:id` no cambia `estado` y sí crea un evento `CORRECCION`; una cooperativa no puede corregir el lote de otra (404); alcance cerrado de `GET /lotes` para certificadora/transportista/exportador (ya no ven lotes ajenos).
- Verificación manual en el navegador: abrir el detalle de un lote ya exportado (de WP-14) y confirmar que se ve todo el recorrido (stepper en el último paso, línea de tiempo con los 4-5 eventos en orden). Además, iniciar sesión con distintos roles (`productor@test.com`, `transportista@test.com`, etc.) y confirmar que cada uno ya no ve los botones de acción que no le corresponden.

## 6. Fuera de alcance (explícitamente)

- Cambiar el estado manualmente fuera de las transiciones normales del proceso (eso rompería C1).
- Eliminar lotes (no tiene sentido en un sistema de trazabilidad inmutable).
- Editar campos que pertenecen a otros módulos (`pesoFermentadoKg`, `hashCertificado`, etc.) — cada uno se corrige, si hiciera falta, dentro de su propio módulo en un WP futuro, no aquí.
- Reabrir/"despublicar" un lote ya `Exportado`.
- Rediseño de paleta/tipografía/iconografía del resto de la aplicación (regla C8) — solo se adoptan los dos patrones de UX descritos en §4.1, dentro del sistema de diseño ya fijado.
- Ocultar páginas de solo-consulta por rol (§4.2 ya explica por qué eso no aplica aquí).

---

¿Confirmas que proceda con estos pasos?
