import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ordersAPI } from '../services/api'
import SellerLayout from '../layouts/SellerLayout'

function fmt(n) {
  if (!n && n !== 0) return '—'
  return n.toLocaleString('fr-FR') + ' GNF'
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const ORDER_STATUS = {
  pending:          { label: 'En attente',      color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400',  tab: 'actives' },
  confirmed:        { label: 'Confirmée',        color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-400',   tab: 'actives' },
  en_collecte:      { label: 'En collecte',      color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400', tab: 'actives' },
  au_point_retrait: { label: 'Au point retrait', color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-400', tab: 'actives' },
  pickup_confirmed: { label: 'Collecté',         color: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-400',   tab: 'actives' },
  completed:        { label: 'Terminée',         color: 'bg-green-100 text-green-700',   dot: 'bg-green-400',  tab: 'terminees' },
  cancelled:        { label: 'Annulée',          color: 'bg-red-100 text-red-700',       dot: 'bg-red-400',    tab: 'annulees' },
  disputed:         { label: 'Litige',           color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400', tab: 'litiges' },
}

const TABS = [
  { key: 'all',      label: 'Toutes'   },
  { key: 'actives',  label: 'En cours' },
  { key: 'terminees',label: 'Terminées'},
  { key: 'annulees', label: 'Annulées' },
  { key: 'litiges',  label: 'Litiges'  },
]

export default function SellerOrdersPage() {
  const [activeTab, setActiveTab] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['seller-orders'],
    queryFn: () => ordersAPI.listSeller().then(r => r.data),
  })

  const all = Array.isArray(data) ? data : (data?.results ?? [])

  const filtered = activeTab === 'all'
    ? all
    : all.filter(o => (ORDER_STATUS[o.status]?.tab ?? 'all') === activeTab)

  const counts = {
    all:       all.length,
    actives:   all.filter(o => ORDER_STATUS[o.status]?.tab === 'actives').length,
    terminees: all.filter(o => o.status === 'completed').length,
    annulees:  all.filter(o => o.status === 'cancelled').length,
    litiges:   all.filter(o => o.status === 'disputed').length,
  }

  return (
    <SellerLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Commandes</h1>
          <p className="text-sm text-gray-500">{all.length} commande{all.length !== 1 ? 's' : ''} au total</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
              {counts[t.key] > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === t.key ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-500'
                }`}>{counts[t.key]}</span>
              )}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-gray-100" />)}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm font-semibold text-gray-700">Aucune commande dans cette catégorie</p>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {filtered.map(order => {
              const st = ORDER_STATUS[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
              return (
                <div key={order.id} className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                      {order.listing?.images?.[0]
                        ? <img src={order.listing.images[0].image} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-gray-900 truncate">{order.listing?.title ?? 'Article'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Acheteur : <span className="font-medium text-gray-600">{order.buyer?.full_name ?? '—'}</span>
                            {order.buyer?.phone_number && ` · ${order.buyer.phone_number}`}
                          </p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${st.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm font-black text-gray-900">{fmt(order.total_amount)}</span>
                        <span className="text-xs text-gray-400">{fmtDate(order.created_at)}</span>
                        {order.delivery_mode && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                            {order.delivery_mode === 'collecte' ? '🚚 Collecte' : '📍 Point retrait'}
                          </span>
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
    </SellerLayout>
  )
}
