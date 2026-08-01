import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  CreateProductorInput,
  Productor,
  UpdateProductorInput,
} from './types'

const QUERY_KEY = ['productores']

export function useProductores() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<Productor[]>('/productores')
      return data
    },
  })
}

export function useCreateProductor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateProductorInput) => {
      const { data } = await api.post<Productor>('/productores', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateProductor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: UpdateProductorInput
    }) => {
      const { data } = await api.put<Productor>(`/productores/${id}`, input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteProductor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete<Productor>(`/productores/${id}`)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
