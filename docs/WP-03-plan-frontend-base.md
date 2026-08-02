# Plan de implementación — WP-03 · Frontend Base

**Estado:** Propuesto, pendiente de confirmación
**Depende de:** WP-00 (estructura de repo), WP-02 (backend, sin integración real todavía)
**Precede a:** WP-04 (Autenticación y roles — es quien conecta el Login con lógica real)

---

## 1. Alcance

Construir el esqueleto de navegación de la SPA: layout con Sidebar + Navbar, página de Login (solo UI, sin lógica de autenticación real — eso es WP-04), Dashboard inicial (con tarjetas de indicadores en placeholder — los datos reales llegan en WP-16), y rutas para los módulos de negocio como páginas "próximamente" para que la navegación completa sea demostrable ya desde este WP, tal como pide el objetivo ("preparando la navegación para los módulos del proyecto").

No se conecta a la API del backend en este WP (no hay `fetch`/`axios` a `localhost:3000`): eso empieza en Sprint 1 cuando cada módulo tenga endpoints reales que consumir.

## 2. Corrección de nombre de carpeta

`fronted/` (con typo) existe vacía desde WP-00. La sección 3 del plan maestro fija el nombre `frontend/`. Se borra `fronted/` y se genera el proyecto directamente en `frontend/` para no arrastrar el error.

## 3. Decisiones de C8 (se fijan aquí y no se vuelven a discutir)

- **Tipografía:** Inter (Google Fonts, vía `@fontsource/inter`) para toda la UI — un solo tipo de letra, variando peso para jerarquía (evita mezclar fuentes sin necesidad).
- **Paleta:** tema shadcn/ui vía variables CSS, con acento cacao/orgánico en vez de la paleta genérica azul/violeta de plantillas de IA:
  - Primario: marrón cacao cálido (base `oklch` equivalente a `#6F4518`) — botones principales, enlaces activos, sidebar activo.
  - Acento secundario: verde orgánico (`#3F6B45`) — estados de éxito/certificado/vigente.
  - Neutros: piedra cálida (`stone`) para fondos y bordes, en vez de gris frío puro.
  - Modo oscuro incluido desde el inicio (shadcn lo trae por defecto vía variables `.dark`).
- Estas variables quedan en `frontend/src/index.css` (tema shadcn) y documentadas brevemente en un comentario ahí — no se crea un documento aparte para no duplicar.

## 4. Stack y pasos

1. **Scaffold:** `npm create vite@latest frontend -- --template react-ts`.
2. **Tailwind CSS v4** vía plugin oficial de Vite (`@tailwindcss/vite`), integrado en `vite.config.ts`.
3. **shadcn/ui:** `npx shadcn@latest init` (estilo "new-york", base color neutral, se sobreescribe con la paleta del punto 3 después). Componentes a instalar según necesidad: `button`, `input`, `label`, `card`, `avatar`, `dropdown-menu`, `separator`, `sheet`, `sidebar`, `skeleton`.
4. **React Router:** `react-router-dom` (rutas declaradas con `createBrowserRouter`).
5. **Estructura de carpetas** (`frontend/src/`):
   ```
   components/
     layout/
       AppLayout.tsx       (shell: Sidebar + Navbar + <Outlet/>)
       AppSidebar.tsx
       AppNavbar.tsx
     ui/                    (generados por shadcn)
   pages/
     LoginPage.tsx
     DashboardPage.tsx
     ProximamentePage.tsx   (placeholder reutilizable para módulos aún no construidos)
   routes/
     router.tsx
   lib/
     utils.ts               (helper `cn` de shadcn)
   ```
6. **Rutas:**
   - `/login` → `LoginPage` (sin layout de sidebar/navbar — pantalla completa).
   - `/` → redirige a `/dashboard`.
   - `/dashboard` → `AppLayout` + `DashboardPage`.
   - `/productores`, `/cooperativas`, `/certificadoras`, `/transportistas`, `/exportaciones`, `/lotes` → `AppLayout` + `ProximamentePage` (cada una con su título, para que el Sidebar navegue a algo real y no a un 404).
   - `*` → página 404 simple.
7. **Sidebar:** lista los módulos anteriores con iconos (`lucide-react`, ya viene con shadcn), resaltando la ruta activa.
8. **Navbar:** título de la página actual + menú de usuario (avatar + dropdown con "Cerrar sesión" como placeholder, sin lógica real todavía).
9. **Login:** formulario centrado (email + password) con validación básica de campos requeridos (sin llamada a API — placeholder `onSubmit` que solo navega a `/dashboard`, dejando claro en un comentario que la autenticación real es WP-04).
10. **Dashboard:** tarjetas de los indicadores de Desarrollo.md Etapa 2 (Total de lotes, Productores, Certificados, Exportados, Pendientes) con valores placeholder — se conectan a datos reales en WP-16.
11. **Build de producción:** `npm run build` sin errores ni warnings de TypeScript.

## 5. Definition of Done — verificación planeada

| Criterio DoD | Cómo se verifica |
|---|---|
| Frontend compila sin errores | `npm run build` limpio |
| Layout principal implementado | `AppLayout` renderiza Sidebar + Navbar + contenido en todas las rutas protegidas |
| Sidebar y Navbar funcionan | Clicks en Sidebar cambian de ruta; Navbar refleja el título de la página activa |
| Login accesible | Navegar a `/login` en el navegador (Playwright/preview), formulario visible y usable |
| Dashboard operativo | `/dashboard` renderiza las tarjetas de indicadores sin errores en consola |
| Navegación entre páginas base funciona | Se prueba en el navegador: login → dashboard → cada módulo del sidebar → vuelta a dashboard |

Se levanta el servidor de desarrollo (`npm run dev`) y se navega con el navegador embebido para confirmar visualmente antes de marcar el WP como completo (regla del proyecto para cambios de frontend).

## 6. Fuera de alcance (explícitamente)

- Conexión real a la API del backend (fetch/axios, manejo de tokens JWT) → Sprint 1 en adelante, según cada módulo.
- Lógica de autenticación, guards de ruta por rol → WP-04.
- Datos reales en el Dashboard → WP-16.
- Formularios CRUD de cada módulo → Sprint 1 (WP-10 a WP-15).

---

¿Confirmas que proceda con estos pasos?
