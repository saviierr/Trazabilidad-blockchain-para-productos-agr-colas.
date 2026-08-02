import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CreateTransporteInput, Transporte } from './types'

const QUERY_KEY = ['transporte']

export function useTransportes() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<Transporte[]>('/transporte')
      return data
    },
  })
}

export function useRegistrarTransporte() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateTransporteInput) => {
      const { data } = await api.post<Transporte>('/transporte', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
    },
  })
}

export function useMarcarEntregado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (transporteId: string) => {
      const { data } = await api.put<Transporte>(
        `/transporte/${transporteId}/estado`,
        { estado: 'ENTREGADO' },
      )
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useRegistrarIncidencia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      transporteId,
      descripcion,
    }: {
      transporteId: string
      descripcion: string
    }) => {
      const { data } = await api.post<Transporte>(
        `/transporte/${transporteId}/incidencias`,
        { descripcion },
      )
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
