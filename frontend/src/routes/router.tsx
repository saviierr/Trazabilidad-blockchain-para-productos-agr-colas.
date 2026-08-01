import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth } from '@/components/layout/RequireAuth'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProximamentePage } from '@/pages/ProximamentePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProductoresPage } from '@/features/productores/ProductoresPage'
import { LotesPage } from '@/features/lotes/LotesPage'
import { navItems } from '@/lib/nav-items'

const RUTAS_IMPLEMENTADAS = ['/dashboard', '/productores', '/lotes']

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/productores', element: <ProductoresPage /> },
          { path: '/lotes', element: <LotesPage /> },
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
