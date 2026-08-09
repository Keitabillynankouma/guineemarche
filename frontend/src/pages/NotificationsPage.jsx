import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { notificationsAPI } from '../services/api'

const TYPE_ICON = {
  new_message:  '💬',
  order_update: '📦',
  new_review:   '⭐',
  listing_sold: '🎉',
  otp:          '🔐',
  system:       '🔔',
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return "À l'instant"
  if (m < 60) return `Il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Il y a ${h}h`
  const d = Math.floor(h / 24)
  return `Il y a ${d}j`
}

export default function NotificationsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => notificationsAPI.getAll().then(r => r.data),
    refetchInterval: 30_000,
  })

  const markRead = useMutation({
    mutationFn: (id) => notificationsAPI.markRead(id),
    onSuccess:  () => qc.invalidateQueries(['notifications']),
  })

  const notifications = data?.results ?? data ?? []
  const unread = notifications.filter(n => !n.is_read).length

  function handleMarkRead(notif) {
    if (!notif.is_read) markRead.mutate(notif.id)
    // Navigation selon le contenu de la notification
    const d = notif.data || {}
    if (d.conversation_id) {
      navigate('/messages', { state: { conversationId: d.conversation_id } })
    } else if (d.order_id) {
      navigate('/orders')
    }
  }

  function markAllRead() {
    notifications.filter(n => !n.is_read).forEach(n => markRead.mutate(n.id))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20"
        style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link to="/" className="text-gray-400 hover:text-gray-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="h-5 w-px bg-gray-200" />
            <h1 className="text-sm font-semibold text-gray-700">
              Notifications
              {unread > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {unread}
                </span>
              )}
            </h1>
          </div>
          {unread > 0 && (
            <button onClick={markAllRead}
              className="text-xs text-green-700 font-semibold hover:text-green-800 transition">
              Tout marquer lu
            </button>
          )}
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-4 border-green-700 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && notifications.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">🔔</p>
            <p className="font-semibold text-gray-500">Aucune notification</p>
            <p className="text-sm mt-1">Vous serez notifié ici des activités importantes.</p>
          </div>
        )}

        {notifications.map(notif => (
          <button
            key={notif.id}
            onClick={() => handleMarkRead(notif)}
            className={`w-full text-left flex items-start gap-3 p-4 rounded-2xl border transition
              ${notif.is_read
                ? 'bg-white border-gray-100'
                : 'bg-green-50 border-green-200 shadow-sm'
              }`}
          >
            {/* Icône */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0
              ${notif.is_read ? 'bg-gray-100' : 'bg-white shadow-sm'}`}>
              {TYPE_ICON[notif.type] || '🔔'}
            </div>

            {/* Contenu */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm font-semibold leading-snug ${notif.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                  {notif.title}
                </p>
                <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                  {timeAgo(notif.created_at)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">
                {notif.body}
              </p>
            </div>

            {/* Point non-lu */}
            {!notif.is_read && (
              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
