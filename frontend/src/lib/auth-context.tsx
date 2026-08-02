import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { jwtDecode } from 'jwt-decode'
import { api } from './api'
import { authStorage } from './auth-storage'

export type RolNombre =
  | 'ADMIN'
  | 'PRODUCTOR'
  | 'COOPERATIVA'
  | 'CERTIFICADORA'
  | 'TRANSPORTISTA'
  | 'EXPORTADOR'
  | 'COMPRADOR'

interface AccessTokenPayload {
  sub: string
  email: string
  rol: RolNombre
  organizacionId: string | null
  exp: number
}

export interface AuthUser {
  id: string
  email: string
  rol: RolNombre
  organizacionId: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function decodeUser(accessToken: string): AuthUser | null {
  try {
    const payload = jwtDecode<AccessTokenPayload>(accessToken)
    if (payload.exp * 1000 < Date.now()) {
      return null
    }
    return {
      id: payload.sub,
      email: payload.email,
      rol: payload.rol,
      organizacionId: payload.organizacionId,
    }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = authStorage.getAccessToken()
    return token ? decodeUser(token) : null
  })

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      async login(email: string, password: string) {
        const { data } = await api.post<{
          accessToken: string
          refreshToken: string
        }>('/auth/login', { email, password })
        authStorage.setTokens(data.accessToken, data.refreshToken)
        setUser(decodeUser(data.accessToken))
      },
      logout() {
        authStorage.clear()
        setUser(null)
      },
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return ctx
}
