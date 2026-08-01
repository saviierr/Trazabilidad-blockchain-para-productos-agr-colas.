import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth } from '@/components/layout/RequireAuth'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProximamentePage } from '@/pages/ProximamentePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProductoresPage } from '@/features/productores/ProductoresPage'
import { navItems } from '@/lib/nav-items'

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
          ...navItems
            .filter(
              (item) => item.url !== '/dashboard' && item.url !== '/productores',
            )
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
