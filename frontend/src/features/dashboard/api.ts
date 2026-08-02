import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ResumenDashboard } from './types'

// Polling cada 30s — "actualización dinámica" (WP-16 DoD) sin necesidad de
// WebSockets/SSE (ver docs/WP-16-plan-dashboard-administrativo.md §6).
const INTERVALO_ACTUALIZACION_MS = 30_000

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'resumen'],
    queryFn: async () => {
      const { data } = await api.get<ResumenDashboard>('/dashboard/resumen')
      return data
    },
    refetchInterval: INTERVALO_ACTUALIZACION_MS,
  })
}
