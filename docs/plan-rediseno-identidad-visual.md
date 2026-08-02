# Plan de implementación — Rediseño de identidad visual (frontend)

**Estado:** Propuesto, pendiente de confirmación
**No es un Work Package del Plan Maestro** — es un ajuste transversal de UI, solicitado antes de continuar con el próximo WP. No toca backend, rutas, lógica de negocio ni tests (0 riesgo funcional).
**Referencia:** `rediseno_trazabilidad_cacao.html` (mockup estático aportado por el usuario) — se usa como referencia de diseño, **no se copia tal cual**: es HTML/CSS plano sin componentes, y el proyecto real es React + Tailwind v4 + shadcn/base-ui con un sistema de tokens ya establecido (WP-03, C8). El trabajo real es traducir la intención de diseño del mockup a ese sistema de tokens existente, no reemplazarlo por uno paralelo.

---

## 1. Qué cambia y por qué

El sistema de tokens actual (`frontend/src/index.css`) ya es correcto en su arquitectura (Tailwind v4, `@theme inline` + variables en `:root`/`.dark`), pero los valores son genéricos — un marrón/verde sin identidad propia, sin distinguir visualmente "dato operativo" de "dato técnico de blockchain" (hash, ID), y una tipografía única (Inter) para todo. El rediseño ataca exactamente eso, reutilizando la arquitectura ya existente:

| Problema actual | Cómo lo resuelve el rediseño |
|---|---|
| Paleta café genérica, sin relación con el dominio (cacao + blockchain) | Paleta cacao (`#241209`→`#7A4326`) + un color "ledger" (`#4B5A6B`) reservado exclusivamente para hashes/IDs/datos técnicos |
| Los 5 estados del lote (C1) se distinguen solo por variante de Badge genérica (secondary/default/outline) — visualmente casi iguales | 5 colores por matiz, uno por estado, ya definidos en el propio dominio |
| Tipografía única (Inter) para todo, incluidos títulos | Fraunces (serif, con carácter) para títulos — `--font-heading` ya existe como variable separada desde WP-03, hoy solo alias de Inter; se activa de verdad |
| `font-mono` ya se usa (WP-23, hash de verificación) pero cae al monoespaciado genérico del sistema — no hay una fuente mono real cargada | Se carga JetBrains Mono real vía `--font-mono`, y se usa en más lugares (IDs de lote, hashes de transacción) |
| El stepper de estado (`EstadoStepper`) son círculos genéricos — no comunica que esto es una cadena de bloques | Se rediseña como una cadena de bloques literal — el elemento de firma del producto |

## 2. Decisiones de diseño

### 2.1 Todo pasa por la capa de tokens, no por estilos ad-hoc por componente

`index.css` ya expone `--color-primary`, `--color-sidebar`, `--font-heading`, `--font-mono`, etc., consumidos por los componentes shadcn/base-ui (`Card`, `Badge`, `Dialog`, `Sidebar`...) sin que esos componentes sepan nada de la paleta. Cambiar los VALORES de esos tokens (más los pocos que faltan) hace que la mayoría de la app se actualice sola, sin tocar componente por componente. Confirmado al revisar el CSS actual:

- `Card`, `Dialog`, `Badge` ya usan la clase `font-heading` para sus títulos — hoy `--font-heading: var(--font-sans)` (alias de Inter). Cambiarlo a Fraunces actualiza títulos de card/dialog en **toda la app** sin tocar un solo componente.
- `AppSidebar`/`AppNavbar` ya usan `bg-primary`, `bg-sidebar`, `text-sidebar-foreground`, etc. — no colores hardcodeados. Recolorear los tokens `--sidebar*`/`--primary*` los actualiza automáticamente.
- Los headings de página (`<h2 className="text-2xl font-semibold">` en `DashboardPage`, etc.) **no** usan `font-heading` hoy — se agrega una regla base `h1,h2,h3{ @apply font-heading; }` en vez de tocar cada página una por una.

Lo que **sí** exige tocar componentes puntuales: el stepper (rediseño real, no un cambio de color) y el sistema de color por estado (hoy no existen 5 tokens de estado, hay que crearlos y aplicarlos donde corresponde).

### 2.2 Paleta — valores exactos (tal como los definió el usuario), mapeados a los tokens existentes

```css
/* nuevos tokens de marca/dominio */
--cacao-950:#241209; --cacao-800:#432411; --cacao-600:#7A4326; --cacao-500:#8F5530; --cacao-100:#F0E4D6;
--ledger:#4B5A6B; --ledger-bg:#ECEFF2;

/* 5 estados por matiz (C1) */
--estado-creado:#6B7280;      --estado-creado-bg:#EEF0F1;
--estado-fermentando:#B45309; --estado-fermentando-bg:#FDF1DE;
--estado-certificado:#15803D; --estado-certificado-bg:#E5F5EA;
--estado-transporte:#1D4ED8;  --estado-transporte-bg:#E7EDFC;
--estado-exportado:#6D28D9;   --estado-exportado-bg:#F0EAFB;
```

Mapeo sobre los tokens shadcn ya existentes (`:root`, sin gatear por `.dark` — la app no tiene selector de tema hoy, así que se fija un único tema "paper" claro con sidebar oscura fija, igual que el mockup):

| Token existente | Nuevo valor |
|---|---|
| `--background` | `--paper` (`#F5F3EC`) |
| `--foreground` | `--cacao-950` |
| `--card` / `--popover` | `#FFFFFF` (paper-raised) |
| `--primary` | `--cacao-600` |
| `--primary-foreground` | `#FBF7EE` |
| `--secondary` | `--cacao-100` |
| `--muted` | `--paper` |
| `--muted-foreground` | `#7A7261` (ink-soft) |
| `--success` / `--success-foreground` | `--estado-certificado` / blanco |
| `--border` / `--input` | `--line` (`#E1DCCC`) |
| `--sidebar` | `--cacao-950` (fija, no depende de `.dark`) |
| `--sidebar-foreground` | `#D8CDB9` |
| `--sidebar-primary` / `-foreground` | `--cacao-600` / `#FBF7EE` |
| `--sidebar-accent` | blanco al 6% de opacidad (hover) |

`--destructive` (rojo de error) **no cambia** — es un color de estado de sistema, no de dominio; el mockup no lo toca tampoco.

### 2.3 Tipografía

- `--font-heading`: Fraunces Variable (nuevo paquete `@fontsource-variable/fraunces`).
- `--font-sans`: Inter Variable (sin cambios, ya instalado).
- `--font-mono` (no existe hoy como token — Tailwind cae a su stack mono de sistema): JetBrains Mono (nuevo paquete `@fontsource/jetbrains-mono`, pesos 500/600 solamente — no hace falta la familia variable completa para el uso que se le da).
- Regla base nueva: `h1, h2, h3 { @apply font-heading; }`.

### 2.4 El stepper como cadena de bloques (elemento de firma)

`EstadoStepper.tsx` se reescribe: en vez de círculos con ícono + línea, nodos cuadrados redondeados ("bloques") conectados por barras — bloque completado = relleno cacao-600 con check; bloque actual = borde cacao-600 con halo; bloque pendiente = borde neutro vacío. Mismo componente, misma prop `estado: EstadoLote` — no cambia su interfaz pública, así que `LotesPage`, `LoteDetalleSheet` y `PublicLotePage` (los 3 lugares que ya lo usan) no requieren cambios de lógica, solo heredan el nuevo look.

### 2.5 Sistema de color por estado — un solo origen, reutilizado

Hoy `ESTADO_LABEL`/`ESTADO_VARIANT` están **duplicados** en `LotesPage.tsx`, `LoteDetalleSheet.tsx` y `PublicLotePage.tsx` (cada uno con su propio mapa). Se centraliza en `frontend/src/features/lotes/estado.ts`:

```ts
export const ESTADO_LABEL: Record<EstadoLote, string> = { ... }
export const ESTADO_BADGE_VARIANT: Record<EstadoLote, BadgeVariant> = { ... } // 5 variantes nuevas
```

`components/ui/badge.tsx` gana 5 variantes nuevas en su `cva` (`estado-creado`, `estado-fermentando`, `estado-certificado`, `estado-transporte`, `estado-exportado`), coloreadas desde los tokens de §2.2 — mismo patrón que las variantes `secondary`/`destructive` que ya existen ahí, no una API nueva.

### 2.6 Hashes e IDs — `font-mono` + color `ledger` donde ya se muestran

No se inventan datos nuevos que mostrar — se le da tratamiento visual distinto (monoespaciado, color ledger) a los que **ya** se muestran: ID del lote, hash de certificado, hash de verificación (WP-23). Aplica en `LoteDetalleSheet` y donde `PublicLotePage`/`HistorialTimelinePublico` ya usan `font-mono` (WP-23) — ahora con una fuente mono real detrás en vez del monoespaciado de sistema.

### 2.7 Qué NO se inventa

El mockup incluye una píldora "Red blockchain activa" en la topbar. **No se implementa así** — sería un indicador decorativo sin datos reales detrás (el backend no expone un endpoint de "estado de red" para el frontend; `GET /health` de WP-02 verifica Postgres, no Fabric). Queda fuera de este rediseño; si se quiere un indicador real, es un WP aparte que primero necesita el endpoint correspondiente. Mismo criterio que ya sigue el proyecto (Plan Maestro: no presentar datos falsos como reales).

## 3. Archivos afectados

```
frontend/package.json                              # + @fontsource-variable/fraunces, @fontsource/jetbrains-mono
frontend/src/index.css                              # tokens de paleta, fuentes, regla base h1-h3
frontend/src/components/ui/badge.tsx                # + 5 variantes de estado
frontend/src/features/lotes/estado.ts               # nuevo — ESTADO_LABEL/ESTADO_BADGE_VARIANT compartidos
frontend/src/features/lotes/EstadoStepper.tsx        # reescritura — cadena de bloques
frontend/src/features/lotes/LotesPage.tsx            # usa estado.ts compartido; estilo hash/ID
frontend/src/features/lotes/LoteDetalleSheet.tsx     # usa estado.ts compartido; estilo hash/ID
frontend/src/pages/PublicLotePage.tsx                 # usa estado.ts compartido
frontend/src/pages/DashboardPage.tsx                  # font-heading en valores de stat cards
```

Heredan los cambios automáticamente (sin tocarlos): `AppSidebar`, `AppNavbar`, `AppLayout`, `ProductoresPage`, `CertificadosPage`, `TransportesPage`, `ExportacionesPage`, y todos los diálogos/sheets — porque ya consumen los tokens compartidos en vez de colores propios.

## 4. Verificación planeada

- `npx tsc -b` limpio (frontend).
- Navegador real (regla de la sesión para cambios de UI): Dashboard, Lotes (grid + detalle), y la página pública de un lote — confirmar que el stepper de cadena de bloques se ve y se comporta igual en los 3 lugares donde aparece, que los 5 estados se distinguen a simple vista, y que los hashes se ven en JetBrains Mono real.
- Responsive: sidebar en viewport angosto (ya colapsa a íconos, sin cambios de comportamiento, solo color).
- No se tocan tests (no existen tests de frontend hoy) ni el backend — cero riesgo de regresión funcional.

---

¿Confirmas que proceda con estos pasos?
