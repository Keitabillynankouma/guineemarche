/**
 * NotificationBell — cloche avec badge du nombre de non-lus.
 * Usage : <NotificationBell /> dans la navbar d'une page.
 * Redirige vers /notifications au clic.
 */
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { notificationsAPI } from '../services/api'
import useAuthStore from '../store/authStore'

export default function NotificationBell() {
  const { isAuthenticated } = useAuthStore()

  const { data } = useQuery({
    queryKey:      ['notifications'],
    queryFn:       () => notificationsAPI.getAll().then(r => r.data),
    refetchInterval: 30_000,
    enabled:       isAuthenticated,
  })

  const items  = data?.results ?? data ?? []
  const unread = items.filter(n => !n.is_read).length

  if (!isAuthenticated) return null

  return (
    <Link to="/notifications" className="relative flex items-center justify-center w-9 h-9 rounded-xl hover:bg-gray-100 transition">
      {/* Cloche SVG */}
      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {/* Badge */}
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
