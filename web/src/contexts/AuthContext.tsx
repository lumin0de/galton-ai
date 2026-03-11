import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface AuthContextType {
  isAuthenticated: boolean
  repName: string
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

// TODO: substituir por SSO Microsoft/Okta em produção
const DEMO_EMAIL = 'carlos@galton.ai'
const DEMO_PASSWORD = 'demo123'
const DEMO_REP_NAME = 'Carlos Junior'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem('galton_auth') === 'true'
  )
  const [repName, setRepName] = useState(
    () => localStorage.getItem('galton_rep_name') || ''
  )

  async function login(email: string, password: string): Promise<boolean> {
    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      setIsAuthenticated(true)
      setRepName(DEMO_REP_NAME)
      localStorage.setItem('galton_auth', 'true')
      localStorage.setItem('galton_rep_name', DEMO_REP_NAME)
      return true
    }
    return false
  }

  function logout() {
    setIsAuthenticated(false)
    setRepName('')
    localStorage.removeItem('galton_auth')
    localStorage.removeItem('galton_rep_name')
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, repName, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
