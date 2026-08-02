import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Certificado, CreateCertificadoInput } from './types'

const QUERY_KEY = ['certificados']

export function useCertificados() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<Certificado[]>('/certificados')
      return data
    },
  })
}

export function useEmitirCertificado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateCertificadoInput) => {
      const formData = new FormData()
      formData.append('loteId', input.loteId)
      formData.append('tipoCertificacion', input.tipoCertificacion)
      formData.append('fechaEmision', input.fechaEmision)
      if (input.fechaVencimiento) {
        formData.append('fechaVencimiento', input.fechaVencimiento)
      }
      formData.append('archivo', input.archivo)

      const { data } = await api.post<Certificado>('/certificados', formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
    },
  })
}

// El endpoint exige Authorization, así que un <a href> normal no sirve: se pide
// el archivo con el token y se abre como blob en una pestaña nueva.
//
// La pestaña se abre ANTES del await (síncrono, dentro del gesto de click):
// si se abre después de esperar la respuesta, el navegador ya no reconoce la
// llamada como parte de la interacción del usuario y bloquea el popup.
export async function verPdfCertificado(certificadoId: string) {
  const ventana = window.open('', '_blank', 'noopener,noreferrer')
  try {
    const { data } = await api.get(`/certificados/${certificadoId}/archivo`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(data as Blob)
    if (ventana) {
      ventana.location.href = url
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    ventana?.close()
    throw err
  }
}
