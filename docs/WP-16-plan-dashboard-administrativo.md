# Plan de implementación — WP-16 · Dashboard Administrativo

**Estado:** Propuesto, pendiente de confirmación
**Depende de:** WP-01 (modelo), WP-10 a WP-15 (todos los módulos de negocio ya construidos — el dashboard solo lee, no agrega lógica de negocio nueva)
**Cierra:** Sprint 1 completo (con esto termina el flujo Productor → Cooperativa → Certificadora → Transportista → Exportación sobre PostgreSQL, antes de entrar a Sprint 2 — integración blockchain)

---

## 1. Qué exige el DoD y cómo se cubre

| Entregable | Cómo se cubre |
|---|---|
| Dashboard principal | Reemplaza el placeholder ya existente en `frontend/src/pages/DashboardPage.tsx` (WP-03), que hoy solo muestra tarjetas con `—` |
| Total de lotes registrados | `GET /dashboard/resumen` → `totalLotes` |
| Total de productores | → `totalProductores` |
| Total de cooperativas | → `totalCooperativas` |
| Total de certificaciones emitidas | → `totalCertificados` |
| Total de exportaciones realizadas | → `totalExportaciones` |
| Lotes pendientes por etapa | → `lotesPorEstado` (conteo agrupado por los 5 estados de C1) |
| Gráficos y estadísticas generales | Gráfico de barras de `lotesPorEstado` + gráfico de barras de `exportacionesPorPais` (top países destino) |
| Integración con PostgreSQL vía Prisma | `DashboardService` usa `prisma.count()`/`groupBy()`, mismo patrón que el resto de los módulos |
| Consumo de la API desde el frontend | `useDashboard()` con TanStack Query, mismo patrón que `useLotes()`, `useProductores()`, etc. |
| Actualización dinámica | `refetchInterval` (polling cada 30s) + refetch automático al recuperar el foco de la ventana (comportamiento por defecto de TanStack Query) |

## 2. Alcance por rol (C7 no define esto — se aplica el mismo criterio "solo propio" ya usado en el resto del sistema)

C7 no dice nada sobre el dashboard, pero cada módulo del sistema ya filtra "solo propio" por rol (Productores, Lotes, Certificados, Transportes, Exportaciones — cerrado recién en WP-15). Mantener esa misma regla aquí evita que, por ejemplo, una cooperativa vea en su dashboard un número de lotes mayor al que puede ver en `/lotes`:

- **`totalLotes`, `lotesPorEstado`, `totalCertificados`, `totalExportaciones`, `exportacionesPorPais`**: se filtran reutilizando el mismo alcance que `LotesService` ya calculó en WP-15 (`buildScopeFilter`) — Cooperativa/Productor ven lo suyo, Certificadora/Transportista/Exportador ven los lotes en los que participaron, Admin y Comprador ven todo.
- **`totalProductores`**: Cooperativa ve los productores propios (activos); Productor ve 1; el resto ve el total global de productores activos (mismo criterio que `GET /productores`).
- **`totalCooperativas`**: siempre global. No existe un "propio" natural para este indicador (una cooperativa no tiene sub-cooperativas) y su valor no es sensible — es coherente con el enfoque de transparencia de la cadena de suministro (C7, "Comprador: público, solo lectura").

Para no duplicar la lógica de alcance de `LotesService`, su método `buildScopeFilter` pasa de `private` a público y `DashboardService` lo reutiliza inyectando `LotesService` — sin extraer una abstracción nueva.

## 3. Backend

Nuevo módulo `dashboard` (no existía ningún endpoint de agregación hasta ahora):

| Endpoint | Rol | Efecto |
|---|---|---|
| `GET /dashboard/resumen` | cualquier autenticado | Devuelve todos los indicadores + datos para los gráficos, ya filtrados por el alcance del rol (§2) |

Forma de la respuesta:

```ts
{
  totalLotes: number
  totalProductores: number
  totalCooperativas: number
  totalCertificados: number
  totalExportaciones: number
  lotesPorEstado: { estado: EstadoLote; cantidad: number }[] // los 5 estados de C1, incluidos los que están en 0
  exportacionesPorPais: { paisDestino: string; cantidad: number }[] // ordenado desc, top 5
}
```

Sin migración de Prisma — solo consultas de agregación (`count`, `groupBy`) sobre tablas ya existentes.

## 4. Frontend

- `frontend/src/features/dashboard/types.ts` — tipos de la respuesta.
- `frontend/src/features/dashboard/api.ts` — `useDashboard()`: `useQuery` con `refetchInterval: 30_000` (actualización dinámica) sobre `GET /dashboard/resumen`.
- `frontend/src/features/dashboard/EstadoBarChart.tsx` — gráfico de barras simple para `lotesPorEstado`, reutilizando los mismos íconos/colores del stepper de WP-15 (`Sprout`, `Droplet`, `ShieldCheck`, `Truck`, `Ship`, `bg-primary`).
- `frontend/src/features/dashboard/PaisesBarChart.tsx` — gráfico de barras horizontal simple para `exportacionesPorPais`.
- `frontend/src/pages/DashboardPage.tsx` — se reemplaza el placeholder: 5 tarjetas de indicadores (con `Skeleton` mientras carga, igual que las tablas existentes) + los dos gráficos.

### 4.1 Sin librería de gráficos nueva

El stack de frontend (`package.json`) no tiene ninguna librería de charts — WP-03 no la fijó. En vez de agregar una dependencia nueva (riesgo de incompatibilidad con React 19, y contrario a la disciplina de dependencias mínimas que se ha mantenido hasta ahora), los dos gráficos se construyen con `div`s y `%` de ancho sobre Tailwind (mismo enfoque ya usado en el stepper de WP-15, que tampoco usa una librería de UI de terceros para su barra de progreso). Esto es suficiente para barras simples; no se necesita nada más sofisticado para el alcance del DoD ("gráficos y estadísticas generales").

## 5. Verificación planeada

- e2e (`dashboard.e2e-spec.ts`, nuevo): `totalLotes` coincide con la cantidad de lotes creados en el test; `lotesPorEstado` suma exactamente `totalLotes` y lista los 5 estados aunque alguno esté en 0; una `COOPERATIVA` obtiene un `totalLotes` igual al tamaño de `GET /lotes` con su mismo token (mismo alcance); `ADMIN`/`COMPRADOR` ven el total global; `totalCooperativas` no cambia según el rol.
- Verificación manual: iniciar sesión como distintos roles y comparar los indicadores del dashboard contra lo que cada uno ve en `/lotes`, `/productores`, etc.; dejar la pestaña abierta y confirmar que los números se refrescan solos (polling de 30s) después de registrar un nuevo lote desde otra sesión/rol.

## 6. Fuera de alcance (explícitamente)

- Gráficos de tendencia temporal (series históricas) — el DoD pide "estadísticas generales", no una serie de tiempo, y no hay volumen de datos de prueba distribuido en el tiempo para que tenga sentido mostrarlo.
- Actualización en tiempo real por WebSockets/SSE — "actualización dinámica" se resuelve con polling (§4), no con push; queda anotado como posible mejora futura (WP-44, escalabilidad).
- Exportar el dashboard a PDF/imagen o widgets configurables por el usuario.
- Nueva librería de gráficos de terceros (§4.1).

---

¿Confirmas que proceda con estos pasos?
