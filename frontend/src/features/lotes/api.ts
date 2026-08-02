import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  CorregirLoteInput,
  Evento,
  FermentacionLoteInput,
  Lote,
  LoteDetalle,
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

export function useLote(id: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: async () => {
      const { data } = await api.get<LoteDetalle>(`/lotes/${id}`)
      return data
    },
    enabled: id !== undefined,
  })
}

export function useHistorialLote(id: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEY, id, 'historial'],
    queryFn: async () => {
      const { data } = await api.get<Evento[]>(`/lotes/${id}/historial`)
      return data
    },
    enabled: id !== undefined,
  })
}

export function useCorregirLote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: CorregirLoteInput
    }) => {
      const { data } = await api.put<Lote>(`/lotes/${id}`, input)
      return data
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, id] })
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEY, id, 'historial'],
      })
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
