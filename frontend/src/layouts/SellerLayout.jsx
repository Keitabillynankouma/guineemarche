import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

const NAV = [
  { to: '/seller/dashboard',  icon: '📊', label: 'Tableau de bord' },
  { to: '/seller/listings',   icon: '📋', label: 'Mes annonces'    },
  { to: '/seller/orders',     icon: '📦', label: 'Commandes'       },
  { to: '/seller/shop',       icon: '🏪', label: 'Ma boutique'     },
  { to: '/seller/earnings',   icon: '💰', label: 'Gains'           },
  { to: '/seller/profile',    icon: '👤', label: 'Mon profil'      },
]

export default function SellerLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const active = (to) => location.pathname === to

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* ── Overlay mobile ─────────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-gray-900 flex flex-col z-40 transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}>

        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
              <span className="text-white font-black text-base">G</span>
            </div>
            <div>
              <p className="text-white font-black text-base leading-tight">Guimatrix</p>
              <p className="text-orange-400 text-[10px] font-semibold uppercase tracking-wider">Espace Vendeur</p>
            </div>
          </div>
        </div>

        {/* Profil vendeur */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user?.full_name?.[0]?.toUpperCase() ?? 'V'}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{user?.full_name ?? 'Vendeur'}</p>
              <p className="text-gray-400 text-xs truncate">{user?.phone_number ?? user?.email ?? ''}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(item => (
            <Link key={item.to} to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group
                ${active(item.to)
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                  : 'text-gray-400 hover:bg-white/8 hover:text-white'
                }`}>
              <span className="text-base">{item.icon}</span>
              {item.label}
              {active(item.to) && (
                <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />
              )}
            </Link>
          ))}
        </nav>

        {/* Bas sidebar */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <a href="/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-white/8 hover:text-white transition-all">
            <span>🛒</span> Voir la marketplace
          </a>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-red-500/15 hover:text-red-400 transition-all">
            <span>🚪</span> Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Contenu principal ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar mobile */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <p className="font-black text-gray-900">
            {NAV.find(n => n.to === location.pathname)?.label ?? 'Espace Vendeur'}
          </p>
          <div className="ml-auto w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {user?.full_name?.[0]?.toUpperCase() ?? 'V'}
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
