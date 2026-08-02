import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CreateExportacionInput, Exportacion } from './types'

const QUERY_KEY = ['exportaciones']

export function useExportaciones() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<Exportacion[]>('/exportaciones')
      return data
    },
  })
}

export function useRegistrarExportacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateExportacionInput) => {
      const { data } = await api.post<Exportacion>('/exportaciones', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
    },
  })
}
