import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  FermentacionLoteInput,
  Lote,
  RecepcionLoteInput,
} from './types'

const QUERY_KEY = ['lotes']

export function useLotes() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<Lote[]>('/lotes')
      return data
    },
  })
}

export function useRegistrarRecepcion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: RecepcionLoteInput) => {
      const { data } = await api.post<Lote>('/cooperativas/recepcion', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useRegistrarFermentacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: FermentacionLoteInput) => {
      const { data } = await api.post<Lote>(
        '/cooperativas/fermentacion',
        input,
      )
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
