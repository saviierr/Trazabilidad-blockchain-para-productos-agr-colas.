import {
  Droplet,
  Ship,
  ShieldCheck,
  Sprout,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import type { EstadoLote } from '@/features/lotes/types'

// C1: máquina de estados del lote — un solo origen para label/ícono/color de
// estado, reutilizado en Lotes, Dashboard y la consulta pública (WP-15/16/23).
// Antes duplicado en 4 archivos distintos; ver
// docs/plan-rediseno-identidad-visual.md §2.5.
export const ESTADO_LABEL: Record<EstadoLote, string> = {
  CREADO: 'Creado',
  FERMENTANDO: 'Fermentando',
  CERTIFICADO: 'Certificado',
  EN_TRANSPORTE: 'En transporte',
  EXPORTADO: 'Exportado',
}

export const ESTADO_ICON: Record<EstadoLote, LucideIcon> = {
  CREADO: Sprout,
  FERMENTANDO: Droplet,
  CERTIFICADO: ShieldCheck,
  EN_TRANSPORTE: Truck,
  EXPORTADO: Ship,
}

export type EstadoBadgeVariant =
  | 'estado-creado'
  | 'estado-fermentando'
  | 'estado-certificado'
  | 'estado-transporte'
  | 'estado-exportado'

export const ESTADO_BADGE_VARIANT: Record<EstadoLote, EstadoBadgeVariant> = {
  CREADO: 'estado-creado',
  FERMENTANDO: 'estado-fermentando',
  CERTIFICADO: 'estado-certificado',
  EN_TRANSPORTE: 'estado-transporte',
  EXPORTADO: 'estado-exportado',
}

// Matiz "sólido" de cada estado (no el fondo suave del badge) — para las
// barras de "Lotes por etapa" del dashboard, donde cada fila necesita su
// propio color (a diferencia del stepper de cadena de bloques, que usa
// siempre el color de marca — ver EstadoStepper.tsx).
export const ESTADO_COLOR_CLASS: Record<EstadoLote, string> = {
  CREADO: 'bg-status-creado',
  FERMENTANDO: 'bg-status-fermentando',
  CERTIFICADO: 'bg-status-certificado',
  EN_TRANSPORTE: 'bg-status-transporte',
  EXPORTADO: 'bg-status-exportado',
}

export const ESTADO_ORDEN: EstadoLote[] = [
  'CREADO',
  'FERMENTANDO',
  'CERTIFICADO',
  'EN_TRANSPORTE',
  'EXPORTADO',
]
