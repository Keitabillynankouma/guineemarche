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

// Routes séparées pour pouvoir utiliser useSettings (doit être dans QueryClientProvider)
function AppRoutes() {
  const { settings } = useSettings()

  return (
    <>
      <MaintenanceBanner />
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
