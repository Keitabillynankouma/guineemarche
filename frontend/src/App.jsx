import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSettings } from './hooks/useSettings'

import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ListingDetailPage from './pages/ListingDetailPage'
import CreateListingPage from './pages/CreateListingPage'
import MyListingsPage from './pages/MyListingsPage'
import MessagesPage from './pages/MessagesPage'
import ProfilePage from './pages/ProfilePage'
import OrdersPage from './pages/OrdersPage'
import UpgradePage from './pages/UpgradePage'
import FavoritesPage from './pages/FavoritesPage'
import ShopPage from './pages/ShopPage'
import MyShopPage from './pages/MyShopPage'
import AdminPage from './pages/AdminPage'

const queryClient = new QueryClient()

function PrivateRoute({ children }) {
  const token = localStorage.getItem('access_token')
  return token ? children : <Navigate to="/login" />
}

// Bannière maintenance — affichée si l'admin l'active
function MaintenanceBanner() {
  const { settings } = useSettings()
  if (!settings.maintenance_mode) return null
  return (
    <div className="bg-amber-400 text-amber-900 text-sm font-medium text-center py-2 px-4 sticky top-0 z-50">
      🚧 {settings.maintenance_message || 'Site en maintenance — de retour très bientôt.'}
    </div>
  )
}

// Bouton support flottant — WhatsApp + Email, configurable depuis l'admin
function SupportButton() {
  const { settings } = useSettings()
  const [open, setOpen] = useState(false)

  if (!settings.whatsapp_contact && !settings.support_email) return null

  const waUrl = settings.whatsapp_contact
    ? `https://wa.me/${settings.whatsapp_contact.replace(/\D/g, '')}?text=${encodeURIComponent('Bonjour, j\'ai besoin d\'aide sur GuinéeMarché.')}`
    : null

  return (
    <div className="fixed bottom-6 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-64 mb-1 animate-fade-in">
          <p className="text-sm font-semibold text-gray-700 mb-3">💬 Contacter le support</p>
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 rounded-xl mb-2 transition">
              <span className="text-2xl">📱</span>
              <div>
                <p className="text-sm font-semibold text-green-700">WhatsApp</p>
                <p className="text-xs text-gray-500">Réponse rapide</p>
              </div>
            </a>
          )}
          {settings.support_email && (
            <a href={`mailto:${settings.support_email}?subject=Support GuinéeMarché`}
              className="flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-xl transition">
              <span className="text-2xl">✉️</span>
              <div>
                <p className="text-sm font-semibold text-blue-700">Email</p>
                <p className="text-xs text-gray-500 truncate">{settings.support_email}</p>
              </div>
            </a>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition active:scale-95"
        aria-label="Support">
        {open ? '✕' : '💬'}
      </button>
    </div>
  )
}

// Routes séparées pour pouvoir utiliser useSettings (doit être dans QueryClientProvider)
function AppRoutes() {
  const { settings } = useSettings()

  return (
    <>
      <MaintenanceBanner />
      <SupportButton />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/listings/:id" element={<ListingDetailPage />} />
        <Route path="/create" element={<PrivateRoute><CreateListingPage /></PrivateRoute>} />
        <Route path="/my-listings" element={<PrivateRoute><MyListingsPage /></PrivateRoute>} />
        <Route path="/messages" element={<PrivateRoute><MessagesPage /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        <Route path="/orders" element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
        {/* Page Tarifs masquée si abonnements désactivés */}
        <Route path="/upgrade" element={
          settings.subscriptions_enabled
            ? <PrivateRoute><UpgradePage /></PrivateRoute>
            : <Navigate to="/" />
        } />
        <Route path="/favorites" element={<PrivateRoute><FavoritesPage /></PrivateRoute>} />
        <Route path="/my-shop"   element={<PrivateRoute><MyShopPage /></PrivateRoute>} />
        <Route path="/shops/:id" element={<ShopPage />} />
        <Route path="/admin"     element={<PrivateRoute><AdminPage /></PrivateRoute>} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
