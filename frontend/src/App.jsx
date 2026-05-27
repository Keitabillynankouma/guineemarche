import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import useAuthStore from './store/authStore'

import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ListingDetailPage from './pages/ListingDetailPage'
import CreateListingPage from './pages/CreateListingPage'
import MyListingsPage from './pages/MyListingsPage'
import MessagesPage from './pages/MessagesPage'
import ProfilePage from './pages/ProfilePage'

const queryClient = new QueryClient()

function PrivateRoute({ children }) {
  const token = localStorage.getItem('access_token')
  return token ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/listings/:id" element={<ListingDetailPage />} />
          <Route path="/create" element={<PrivateRoute><CreateListingPage /></PrivateRoute>} />
          <Route path="/my-listings" element={<PrivateRoute><MyListingsPage /></PrivateRoute>} />
          <Route path="/messages" element={<PrivateRoute><MessagesPage /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}