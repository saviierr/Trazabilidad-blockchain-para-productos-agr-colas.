import { useNavigate, useLocation } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { navItems } from '@/lib/nav-items'
import { useAuth } from '@/lib/auth-context'

export function AppNavbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const currentTitle =
    navItems.find((item) => location.pathname.startsWith(item.url))?.title ??
    'Trazabilidad Cacao'

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <h1 className="text-sm font-medium">{currentTitle}</h1>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <User className="size-4" />
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Texto estático, no un grupo interactivo — se evita
                DropdownMenuLabel/Group (Menu.GroupLabel de base-ui) a
                propósito, ver hallazgo en la sesión de WP-23. */}
            <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
              {user?.email ?? 'Mi cuenta'}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
