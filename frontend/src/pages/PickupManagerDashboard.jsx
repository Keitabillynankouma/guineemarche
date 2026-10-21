/**
 * PickupManagerDashboard — tableau de bord du gestionnaire de point de retrait
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersAPI } from '../services/api'
import useAuthStore from '../store/authStore'

function fmt(n) {
  if (!n && n !== 0) return '—'
  return n.toLocaleString('fr-FR') + ' GNF'
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABELS = {
  pending:          { label: 'En attente livraison', color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400'  },
  confirmed:        { label: 'Confirmée',            color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-400'   },
  en_collecte:      { label: 'En collecte',          color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
  au_point_retrait: { label: 'Au point de retrait',  color: 'bg-green-100 text-green-700',   dot: 'bg-green-400'  },
  pickup_confirmed: { label: 'Remis au client',      color: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-400'   },
  completed:        { label: 'Terminée',             color: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400'   },
  cancelled:        { label: 'Annulée',              color: 'bg-red-100 text-red-700',       dot: 'bg-red-400'    },
}

const TABS = [
  { key: '',                label: 'Toutes'        },
  { key: 'au_point_retrait',label: 'À remettre'   },
  { key: 'pickup_confirmed',label: 'Remises'       },
  { key: 'en_collecte',     label: 'En route'      },
]

export default function PickupManagerDashboard() {
  const { user, logout } = useAuthStore()
  const [tab, setTab]    = useState('')
  const qc               = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['my-pickup-point', tab],
    queryFn:  () => ordersAPI.getMyPickupPoint().then(r => r.data),
    refetchInterval: 30_000,
  })

  const action = useMutation({
    mutationFn: ({ id, act }) => ordersAPI.pickupOrderAction(id, act),
    onSuccess:  () => qc.invalidateQueries(['my-pickup-point']),
  })

  const point  = data?.pickup_point
  const stats  = data?.stats ?? {}
  const allOrders = Array.isArray(data?.orders) ? data.orders : []
  const orders = tab
    ? allOrders.filter(o => o.status === tab)
    : allOrders

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!point) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm text-center space-y-4">
          <p className="text-5xl">📦</p>
          <h2 className="text-lg font-black text-gray-900">Aucun point assigné</h2>
          <p className="text-sm text-gray-500">Votre compte n'est pas encore associé à un point de retrait. Contactez l'administrateur.</p>
          <button onClick={logout} className="text-sm text-red-500 hover:underline">Se déconnecter</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-20"
        style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Point de retrait</p>
            <h1 className="text-lg font-black text-gray-900">{point.name}</h1>
          </div>
          <button onClick={logout}
            className="text-xs text-gray-400 hover:text-red-500 font-medium transition">
            Déconnexion
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">

        {/* Info du point */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">📦</div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-gray-900">{point.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">📍 {point.address}{point.commune ? ` — ${point.commune}` : ''}, {point.city}</p>
              {point.opening_hours && <p className="text-sm text-gray-500 mt-0.5">🕐 {point.opening_hours}</p>}
              {point.phone && <p className="text-sm text-gray-500 mt-0.5">📞 {point.phone}</p>}
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${point.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {point.is_active ? '✅ Actif' : '⛔ Inactif'}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',          value: stats.total      ?? 0, color: 'bg-gray-50  text-gray-700',   icon: '📋' },
            { label: 'À remettre',     value: stats.en_attente ?? 0, color: 'bg-green-50 text-green-700',  icon: '📦' },
            { label: 'Remises',        value: stats.confirmes  ?? 0, color: 'bg-teal-50  text-teal-700',   icon: '✅' },
            { label: 'Terminées',      value: stats.termines   ?? 0, color: 'bg-blue-50  text-blue-700',   icon: '🏁' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl p-4 text-center ${s.color}`}>
              <p className="text-xl mb-1">{s.icon}</p>
              <p className="text-2xl font-black">{s.value}</p>
              <p className="text-xs font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Onglets */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition ${
                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Liste des commandes */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm font-semibold text-gray-700">Aucune commande dans cette catégorie</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => {
              const st = STATUS_LABELS[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
              return (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start gap-3">
                    {/* Image article */}
                    <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                      {order.listing?.images?.[0]
                        ? <img src={order.listing.images[0].image} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-gray-900 text-sm truncate">{order.listing?.title ?? 'Article'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Client : <span className="font-semibold text-gray-600">{order.buyer?.full_name ?? '—'}</span>
                            {order.buyer?.phone_number && ` · ${order.buyer.phone_number}`}
                          </p>
                          <p className="text-xs text-gray-400">Vendeur : {order.seller?.full_name ?? '—'}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${st.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-sm font-black text-gray-900">{fmt(order.total_amount)}</span>
                        <span className="text-xs text-gray-400">{fmtDate(order.created_at)}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        {order.status === 'en_collecte' && (
                          <button
                            onClick={() => action.mutate({ id: order.id, act: 'ready' })}
                            disabled={action.isPending}
                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-xl transition">
                            ✅ Colis arrivé au point
                          </button>
                        )}
                        {order.status === 'au_point_retrait' && (
                          <button
                            onClick={() => action.mutate({ id: order.id, act: 'delivered' })}
                            disabled={action.isPending}
                            className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-xl transition">
                            🤝 Client a récupéré
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
