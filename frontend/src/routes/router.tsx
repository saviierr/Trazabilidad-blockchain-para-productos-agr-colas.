import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProximamentePage } from '@/pages/ProximamentePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { navItems } from '@/lib/nav-items'

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      ...navItems
        .filter((item) => item.url !== '/dashboard')
        .map((item) => ({
          path: item.url,
          element: <ProximamentePage title={item.title} />,
        })),
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
