import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { repName, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-[#F5F5F5]">
      {/* Sidebar */}
      <aside className="w-56 bg-[#1D4E35] flex flex-col">
        <div className="px-6 py-5 border-b border-[#2a6347]">
          <span className="text-white text-xl font-bold tracking-tight">Galton AI</span>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <span className="text-base">📊</span>
            Dashboard
          </NavLink>

          <NavLink
            to="/chat"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <span className="text-base">💬</span>
            Chat
          </NavLink>
        </nav>

        <div className="px-4 py-4 border-t border-[#2a6347]">
          <p className="text-white/60 text-xs mb-1">Logado como</p>
          <p className="text-white text-sm font-medium truncate">{repName}</p>
          <button
            onClick={handleLogout}
            className="mt-2 text-white/50 text-xs hover:text-white/80 transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-[#1D4E35] font-semibold text-lg">Galton AI</h1>
          <span className="text-gray-500 text-sm">{repName}</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
