import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Settings } from 'lucide-react'
import LoginForm, { type UserSession } from './components/ui/login-form'
import DashboardPage from './pages/DashboardPage'
import ChatPage from './pages/ChatPage'
import MetricsPage from './pages/MetricsPage'
import SettingsPage from './pages/SettingsPage'
import RepresentativesPage from './pages/RepresentativesPage'

type Page = 'dashboard' | 'chat' | 'metrics' | 'representatives' | 'settings'

const STORAGE_KEY = 'galton_user'

function IconChart() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}

function IconChat() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function IconLogout() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

function IconMetrics() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="14" x2="4" y2="10"/><line x1="10" y1="14" x2="10" y2="6"/><line x1="16" y1="14" x2="16" y2="2"/><line x1="22" y1="14" x2="22" y2="8"/>
    </svg>
  )
}

function IconSettings() {
  return <Settings size={15} strokeWidth={2} aria-hidden />
}

function IconReps() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function EmbedLayout() {
  const [user, setUser] = useState<UserSession | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const API_URL = import.meta.env.VITE_API_URL || ''
  const repName = user?.name ?? 'Usuário'

  if (!user) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <LoginForm onLogin={u => { localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); setUser(u) }} apiUrl={API_URL} />
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg)' }}>
      <ChatPage repName={repName} />
    </div>
  )
}

function MainApp() {
  const [user, setUser] = useState<UserSession | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  function handleLogin(u: UserSession) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    setUser(u)
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  const [page, setPage] = useState<Page>('dashboard')
  const [selectedRep, setSelectedRep] = useState<string | null>(null)
  const [repsList, setRepsList] = useState<Array<{ id: string; name: string }>>([])

  const repName = (user?.role === 'admin' && selectedRep) ? selectedRep : (user?.name ?? 'Usuário')

  useEffect(() => {
    if (user?.role !== 'admin') return
    const API_URL = import.meta.env.VITE_API_URL || ''
    fetch(`${API_URL}/api/representatives`)
      .then(r => r.json())
      .then((data: Array<{ id: string; name: string }>) => setRepsList(data))
      .catch(() => setRepsList([]))
  }, [user?.role])

  const API_URL = import.meta.env.VITE_API_URL || ''

  if (!user) return <LoginForm onLogin={handleLogin} apiUrl={API_URL} />

  const allNavItems: { id: Page; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <IconChart /> },
    { id: 'chat', label: 'Chat IA', icon: <IconChat /> },
    { id: 'metrics', label: 'Métricas', icon: <IconMetrics />, adminOnly: true },
    { id: 'representatives', label: 'Representantes', icon: <IconReps />, adminOnly: true },
    { id: 'settings', label: 'Configurações', icon: <IconSettings />, adminOnly: true },
  ]
  const navItems = allNavItems.filter(item => !item.adminOnly || user.role === 'admin')

  return (
    <>
      <a href="#main-content" className="skip-link">Ir para o conteúdo principal</a>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg)' }}>

        {/* ── Navbar horizontal (grid 3 colunas para logo centrado) ── */}
        <header
          role="banner"
          style={{
            background: 'var(--color-navbar)',
            borderBottom: '1px solid var(--color-navbar-border)',
            height: 56,
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            padding: '0 28px',
            flexShrink: 0,
            boxShadow: '0 1px 3px rgba(15,26,46,0.06)',
          }}
        >
          {/* Coluna esquerda: nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <nav role="navigation" aria-label="Navegação principal" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {navItems.map(item => {
                const active = page === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPage(item.id)}
                    aria-current={active ? 'page' : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '6px 12px',
                      borderRadius: 7, border: 'none', cursor: 'pointer',
                      background: active ? 'var(--color-accent-dim)' : 'transparent',
                      color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 13, fontWeight: active ? 600 : 500,
                      transition: 'all 150ms ease',
                      outline: 'none', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.background = 'var(--color-bg)'
                        e.currentTarget.style.color = 'var(--color-text-primary)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--color-text-secondary)'
                      }
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Coluna central: logo Galderma — genuinamente centrado */}
          <img
            src="/galderma-logo.jpg"
            alt="Galderma"
            style={{ height: 30, width: 'auto', display: 'block' }}
          />

          {/* Coluna direita: rep selector (admin) + user + role badge + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
            {user.role === 'admin' && (
              <>
                <select
                  value={selectedRep ?? ''}
                  onChange={e => setSelectedRep(e.target.value || null)}
                  aria-label="Ver como representante"
                  style={{
                    fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 10px',
                    borderRadius: 6, border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)', color: 'var(--color-text-primary)',
                    cursor: 'pointer', minWidth: 140,
                  }}
                >
                  <option value="">Visão geral</option>
                  {repsList.map(r => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
                <span
                  style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
                    background: 'var(--color-warning)', color: 'white',
                    padding: '3px 8px', borderRadius: 6,
                    textTransform: 'uppercase',
                  }}
                >
                  Admin
                </span>
              </>
            )}
            <div
              aria-hidden="true"
              style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--color-accent-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-body)', fontWeight: 700,
                fontSize: 12, color: 'var(--color-accent)',
                flexShrink: 0,
              }}
            >
              {repName[0]}
            </div>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {repName}
            </span>
            <div style={{ width: 1, height: 20, background: 'var(--color-border)', flexShrink: 0 }} aria-hidden="true" />
            <button
              type="button"
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-muted)', fontSize: 12,
                fontFamily: 'var(--font-body)',
                padding: '4px 8px', borderRadius: 6,
                transition: 'all 150ms ease', outline: 'none',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--color-danger)'
                e.currentTarget.style.background = '#FEF2F2'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--color-text-muted)'
                e.currentTarget.style.background = 'none'
              }}
            >
              <IconLogout /> Sair
            </button>
          </div>
        </header>

        {/* ── Conteúdo principal ────────────────────────────── */}
        {/*
          Layout de altura:
          - main é flex column com overflow:hidden — não scroll aqui
          - h1 (flexShrink:0) ocupa altura fixa
          - wrapper cresce com flex:1 + minHeight:0
          - dashboard: overflow:auto (scroll normal)
          - chat: overflow:hidden (o ChatPage gerencia internamente)
        */}
        <main
          id="main-content"
          tabIndex={-1}
          style={{
            flex: 1, minHeight: 0,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            outline: 'none',
          }}
        >
          <div style={{
            flex: 1, minHeight: 0,
            overflow: page === 'dashboard' || page === 'metrics' || page === 'representatives' || page === 'settings' ? 'auto' : 'hidden',
            padding: page === 'dashboard' || page === 'metrics' || page === 'representatives' || page === 'settings' ? '16px 28px 28px' : '0',
          }}>
            {page === 'dashboard' && <DashboardPage repName={user.role === 'admin' && selectedRep ? selectedRep : undefined} />}
            {page === 'chat' && <ChatPage repName={repName} />}
            {page === 'metrics' && <MetricsPage />}
            {page === 'representatives' && <RepresentativesPage />}
            {page === 'settings' && <SettingsPage />}
          </div>
        </main>
      </div>
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/embed" element={<EmbedLayout />} />
      <Route path="/*" element={<MainApp />} />
    </Routes>
  )
}
