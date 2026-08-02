import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth } from '@/components/layout/RequireAuth'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProximamentePage } from '@/pages/ProximamentePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProductoresPage } from '@/features/productores/ProductoresPage'
import { LotesPage } from '@/features/lotes/LotesPage'
import { CertificadosPage } from '@/features/certificados/CertificadosPage'
import { TransportesPage } from '@/features/transportes/TransportesPage'
import { ExportacionesPage } from '@/features/exportaciones/ExportacionesPage'
import { PublicLotePage } from '@/pages/PublicLotePage'
import { navItems } from '@/lib/nav-items'

const RUTAS_IMPLEMENTADAS = [
  '/dashboard',
  '/productores',
  '/lotes',
  '/certificadoras',
  '/transportistas',
  '/exportaciones',
]

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: <LoginPage /> },
  // WP-23: fuera de RequireAuth — a esta ruta se llega escaneando un QR,
  // nunca habiendo iniciado sesión (C5/C7: consulta pública de solo lectura).
  { path: '/public/lotes/:id', element: <PublicLotePage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/productores', element: <ProductoresPage /> },
          { path: '/lotes', element: <LotesPage /> },
          { path: '/certificadoras', element: <CertificadosPage /> },
          { path: '/transportistas', element: <TransportesPage /> },
          { path: '/exportaciones', element: <ExportacionesPage /> },
          ...navItems
            .filter((item) => !RUTAS_IMPLEMENTADAS.includes(item.url))
            .map((item) => ({
              path: item.url,
              element: <ProximamentePage title={item.title} />,
            })),
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
