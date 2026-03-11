import { useState, useRef } from 'react'
import type { FormEvent } from 'react'

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
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
    await new Promise(r => setTimeout(r, 350))
    if (email === 'carlos@galton.ai' && password === 'demo123') {
      onLogin()
    } else {
      setError('Credenciais inválidas. Verifique e-mail e senha.')
      setLoading(false)
      setTimeout(() => emailRef.current?.focus(), 50)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'var(--font-body)' }}>

      {/* ── Painel esquerdo — brand ───────────────────────── */}
      <div style={{
        width: '40%',
        background: '#1E2A45',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '48px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Dot pattern */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(191,205,240,0.12) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(191,205,240,0.15)',
              border: '1px solid rgba(191,205,240,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BFCDF0" strokeWidth="2.5" aria-hidden="true">
                <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: 24, color: 'white' }}>
              Galton AI
            </span>
          </div>

          <h2 style={{
            fontFamily: 'var(--font-title)',
            color: 'white', fontSize: 28, fontWeight: 700,
            margin: '0 0 14px', lineHeight: 1.35,
          }}>
            Inteligência de vendas para sua carteira
          </h2>

          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: '0 0 40px', lineHeight: 1.7 }}>
            Análise de dropouts, cross-sell e planejamento de visitas com dados em tempo real.
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Alertas de dropout por trimestre',
              'Oportunidades de cross-sell identificadas',
              'Médicos planejados sem compra em destaque',
            ].map((text, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: '#BFCDF0', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Painel direito — formulário ────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--color-bg)',
      }}>
        <div style={{ width: '100%', maxWidth: 360, padding: '0 24px', animation: 'fadeUp 0.35s ease' }}>
          <h1 style={{
            fontFamily: 'var(--font-title)', fontWeight: 700,
            fontSize: 26, margin: '0 0 6px',
            color: 'var(--color-text-primary)',
          }}>
            Entrar
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: '0 0 28px' }}>
            Use suas credenciais de acesso
          </p>

          <form
            onSubmit={handleSubmit}
            noValidate
            aria-label="Formulário de login"
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                style={{
                  display: 'block', fontSize: 12, fontWeight: 600,
                  color: 'var(--color-text-primary)', marginBottom: 6,
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}
              >
                E-mail
              </label>
              <input
                ref={emailRef}
                id="login-email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                aria-required="true"
                aria-describedby={error ? 'login-error' : undefined}
                aria-invalid={!!error}
                style={{
                  width: '100%', padding: '10px 14px',
                  border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
                  borderRadius: 8, fontSize: 14, outline: 'none',
                  background: 'white', color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-body)',
                  transition: 'border-color 150ms ease, box-shadow 150ms ease',
                  boxSizing: 'border-box',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--color-accent)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(59,91,219,0.12)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = error ? 'var(--color-danger)' : 'var(--color-border)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Senha */}
            <div>
              <label
                htmlFor="login-password"
                style={{
                  display: 'block', fontSize: 12, fontWeight: 600,
                  color: 'var(--color-text-primary)', marginBottom: 6,
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}
              >
                Senha
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                aria-required="true"
                aria-describedby={error ? 'login-error' : undefined}
                aria-invalid={!!error}
                style={{
                  width: '100%', padding: '10px 14px',
                  border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
                  borderRadius: 8, fontSize: 14, outline: 'none',
                  background: 'white', color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-body)',
                  transition: 'border-color 150ms ease, box-shadow 150ms ease',
                  boxSizing: 'border-box',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--color-accent)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(59,91,219,0.12)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = error ? 'var(--color-danger)' : 'var(--color-border)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Erro */}
            {error && (
              <p
                id="login-error"
                role="alert"
                aria-live="assertive"
                style={{
                  margin: 0, fontSize: 13, color: 'var(--color-danger)',
                  background: '#FEF2F2', padding: '8px 12px',
                  borderRadius: 6, border: '1px solid #FECACA',
                  animation: 'fadeUp 0.2s ease',
                }}
              >
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              style={{
                width: '100%', padding: '11px',
                background: loading ? 'rgba(59,91,219,0.5)' : 'var(--color-accent)',
                color: 'white', border: 'none', borderRadius: 8,
                fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 150ms ease',
                marginTop: 4,
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--color-accent-hover)' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--color-accent)' }}
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
