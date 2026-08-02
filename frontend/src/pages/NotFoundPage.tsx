import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-semibold text-primary">404</p>
      <p className="text-muted-foreground">Página no encontrada.</p>
      <Button render={<Link to="/dashboard" />} nativeButton={false}>
        Volver al Dashboard
      </Button>
    </div>
  )
}
