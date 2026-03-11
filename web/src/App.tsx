import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ChatPage from './pages/ChatPage'

type Page = 'dashboard' | 'chat'

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

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => localStorage.getItem('galton_logged_in') === '1')

  function handleLogin() {
    localStorage.setItem('galton_logged_in', '1')
    setLoggedIn(true)
  }

  function handleLogout() {
    localStorage.removeItem('galton_logged_in')
    setLoggedIn(false)
  }
  const [page, setPage] = useState<Page>('dashboard')
  const repName = 'Carlos Junior'

  if (!loggedIn) return <LoginPage onLogin={handleLogin} />

  const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <IconChart /> },
    { id: 'chat', label: 'Chat IA', icon: <IconChat /> },
  ]

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
          {/* Coluna esquerda: Galton AI + nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 28 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: 'var(--color-accent-dim)',
                border: '1px solid var(--color-accent-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" aria-hidden="true">
                  <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
                </svg>
              </div>
              <span style={{ fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: 16, color: 'var(--color-text-primary)', letterSpacing: '0.2px', whiteSpace: 'nowrap' }}>
                Galton AI
              </span>
            </div>

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

          {/* Coluna direita: user + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
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
          <h1 style={{
            margin: 0,
            padding: '20px 28px 0',
            flexShrink: 0,
            fontFamily: 'var(--font-title)', fontWeight: 700,
            fontSize: 22, color: 'var(--color-text-primary)',
            letterSpacing: '0.1px',
          }}>
            {page === 'dashboard' ? 'Dashboard' : 'Chat IA'}
          </h1>

          <div style={{
            flex: 1, minHeight: 0,
            overflow: page === 'dashboard' ? 'auto' : 'hidden',
            padding: page === 'dashboard' ? '16px 28px 28px' : '0',
          }}>
            {page === 'dashboard' ? <DashboardPage /> : <ChatPage repName={repName} />}
          </div>
        </main>
      </div>
    </>
  )
}
