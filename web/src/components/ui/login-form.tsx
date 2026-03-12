import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface UserSession {
  name: string
  email: string
  role: 'representative' | 'admin'
}

interface LoginFormProps {
  onLogin: (user: UserSession) => void
  apiUrl?: string
  className?: string
}

export default function LoginForm({ onLogin, apiUrl = '', className = '' }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Credenciais inválidas. Verifique e-mail e senha.')
        return
      }
      onLogin({ name: data.name, email: data.email, role: data.role })
    } catch {
      setError('Erro ao conectar. Verifique se a API está rodando.')
    } finally {
      setLoading(false)
      setTimeout(() => emailRef.current?.focus(), 50)
    }
  }

  return (
    <section className={`bg-[var(--muted)] min-h-screen ${className}`}>
      <div className="flex h-full min-h-screen items-center justify-center">
        <div className="border border-[var(--input)] bg-[var(--background)] flex w-full max-w-sm flex-col items-center gap-y-8 rounded-md px-6 py-12 shadow-md">
          <div className="flex flex-col items-center gap-y-2">
            <div className="flex items-center gap-1 lg:justify-start">
              <a href="/">
                <img
                  src="/galderma-logo.jpg"
                  alt="Galderma"
                  title="Galderma"
                  className="h-12 w-auto"
                />
              </a>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Input
                  ref={emailRef}
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  required
                  autoComplete="email"
                  aria-invalid={!!error}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Input
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  required
                  autoComplete="current-password"
                  aria-invalid={!!error}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-[var(--destructive)]">
                  {error}
                </p>
              )}
              <div className="flex flex-col gap-4">
                <Button type="submit" className="mt-2 w-full bg-black text-white hover:bg-black/90" disabled={loading}>
                  {loading ? 'Entrando…' : 'Entrar'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
