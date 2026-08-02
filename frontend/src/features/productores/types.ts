export interface Productor {
  id: string
  nombre: string
  cedula: string
  telefono: string | null
  direccion: string | null
  capacidadProductivaMaximaKg: string
  activo: boolean
  usuarioId: string | null
  cooperativaId: string
  cooperativa: {
    id: string
    organizacion: { id: string; nombre: string }
  }
  createdAt: string
}

export interface CreateProductorInput {
  nombre: string
  cedula: string
  telefono?: string
  direccion?: string
  capacidadProductivaMaximaKg: number
}

export type UpdateProductorInput = Partial<
  Omit<CreateProductorInput, 'cedula'>
>
