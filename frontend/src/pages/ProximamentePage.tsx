import { Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface ProximamentePageProps {
  title: string
}

export function ProximamentePage({ title }: ProximamentePageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">
          Este módulo se implementa en el Sprint 1.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Construction className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Próximamente — {title} todavía no está disponible.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
