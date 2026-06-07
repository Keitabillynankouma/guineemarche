import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import api from '../services/api'

const adminAPI = {
  getStats:    () => api.get('/orders/admin/stats/'),
  getDisputes: () => api.get('/orders/admin/disputes/'),
  resolve:     (id, action) => api.post(`/orders/admin/disputes/${id}/resolve/`, { action }),
}

function fmt(n) {
  return new Intl.NumberFormat('fr-GN').format(n) + ' GNF'
}

function StatCard({ label, value, icon, color = 'green' }) {
  const colors = {
    green:  'bg-green-50 text-green-700 border-green-100',
    red:    'bg-red-50 text-red-700 border-red-100',
    blue:   'bg-blue-50 text-blue-700 border-blue-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  }
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <p className="text-2xl mb-1">{icon}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm font-medium opacity-80">{label}</p>
    </div>
  )
}

export default function AdminPage() {
  const user = useAuthStore(s => s.user)
  const qc   = useQueryClient()

  if (!user || user.role !== 'admin') return <Navigate to="/" />

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminAPI.getStats().then(r => r.data),
  })

  const { data: disputesData, isLoading } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: () => adminAPI.getDisputes().then(r => r.data),
  })

  const disputes = Array.isArray(disputesData) ? disputesData : (disputesData?.results ?? [])

  const resolveMutation = useMutation({
    mutationFn: ({ id, action }) => adminAPI.resolve(id, action),
    onSuccess: () => {
      qc.invalidateQueries(['admin-disputes'])
      qc.invalidateQueries(['admin-stats'])
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-green-700 font-bold text-lg">GuinéeMarché</Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600 font-medium">Administration</span>
          </div>
          <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">Admin</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Stats */}
        {stats && (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Vue d'ensemble</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="Utilisateurs"       value={stats.users}             icon="👥" color="blue" />
              <StatCard label="Annonces actives"   value={stats.active_listings}   icon="📦" color="green" />
              <StatCard label="Commandes totales"  value={stats.orders_total}      icon="🛍️" color="blue" />
              <StatCard label="Commandes terminées" value={stats.orders_completed} icon="✅" color="green" />
              <StatCard label="Litiges en cours"   value={stats.orders_disputed}   icon="⚠️" color="red" />
              <StatCard label="Revenus plateforme (5%)" value={Math.round(stats.revenue_gnf * 0.05).toLocaleString('fr-GN') + ' GNF'} icon="💰" color="yellow" />
            </div>
          </div>
        )}

        {/* Litiges */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            ⚠️ Litiges en attente
            {disputes.length > 0 && (
              <span className="ml-2 text-sm bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                {disputes.length}
              </span>
            )}
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl h-32 animate-pulse" />)}
            </div>
          ) : disputes.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-12 text-center text-gray-400">
              <p className="text-5xl mb-3">✅</p>
              <p className="font-medium">Aucun litige en cours</p>
              <p className="text-sm mt-1">Tous les litiges ont été résolus.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {disputes.map(order => (
                <div key={order.id} className="bg-white rounded-2xl shadow p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-800">{order.listing_title}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Acheteur : <span className="font-medium text-gray-700">{order.buyer_name}</span>
                        {' · '}
                        Vendeur : <span className="font-medium text-gray-700">{order.seller_name}</span>
                      </p>
                    </div>
                    <span className="text-sm font-bold text-green-600">{fmt(order.amount_gnf)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>🔒 Escrow : {order.escrow_status}</span>
                    <span>·</span>
                    <span>{new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                    <strong>Comment trancher ?</strong> Contacte les deux parties, vérifie les preuves (photos, messages), puis décide.
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        if (confirm(`Libérer ${fmt(order.amount_gnf)} au vendeur ${order.seller_name} ?`))
                          resolveMutation.mutate({ id: order.id, action: 'release' })
                      }}
                      disabled={resolveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-50"
                    >
                      ✅ Libérer au vendeur
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Rembourser l'acheteur ${order.buyer_name} ?`))
                          resolveMutation.mutate({ id: order.id, action: 'refund' })
                      }}
                      disabled={resolveMutation.isPending}
                      className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-50"
                    >
                      🔄 Rembourser l'acheteur
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
