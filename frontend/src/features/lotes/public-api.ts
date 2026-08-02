import { useQuery } from '@tanstack/react-query'
import { publicApi } from '@/lib/public-api'
import type { LotePublico } from './types'

// WP-23: consulta pública, sin JWT — ver frontend/src/lib/public-api.ts.
export function useLotePublico(id: string | undefined) {
  return useQuery({
    queryKey: ['public', 'lotes', id],
    queryFn: async () => {
      const { data } = await publicApi.get<LotePublico>(`/public/lotes/${id}`)
      return data
    },
    enabled: id !== undefined,
    retry: false,
  })
}
