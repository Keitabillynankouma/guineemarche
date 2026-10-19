import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ordersAPI, listingsAPI, shopsAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import SellerLayout from '../layouts/SellerLayout'

function fmt(n) {
  if (!n && n !== 0) return '0 GNF'
  return n.toLocaleString('fr-FR') + ' GNF'
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const ORDER_STATUS = {
  pending:          { label: 'En attente',       color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400' },
  confirmed:        { label: 'Confirmée',         color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-400' },
  en_collecte:      { label: 'En collecte',       color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
  au_point_retrait: { label: 'Au point retrait',  color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-400' },
  pickup_confirmed: { label: 'Collecté',          color: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-400' },
  completed:        { label: 'Terminée',          color: 'bg-green-100 text-green-700',   dot: 'bg-green-400' },
  cancelled:        { label: 'Annulée',           color: 'bg-red-100 text-red-700',       dot: 'bg-red-400' },
  disputed:         { label: 'Litige',            color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
}

function StatCard({ label, value, sub, icon, trend, color = 'orange' }) {
  const colors = {
    orange: { bg: 'bg-orange-50', icon: 'bg-orange-500', text: 'text-orange-600' },
    green:  { bg: 'bg-green-50',  icon: 'bg-green-500',  text: 'text-green-600'  },
    blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-500',   text: 'text-blue-600'   },
    purple: { bg: 'bg-purple-50', icon: 'bg-purple-500', text: 'text-purple-600' },
  }
  const c = colors[color]
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 ${c.icon} rounded-xl flex items-center justify-center text-xl text-white shadow-sm`}>{icon}</div>
        {trend !== undefined && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function SellerDashboard() {
  const { user } = useAuthStore()

  const { data: ordersData } = useQuery({
    queryKey: ['seller-orders'],
    queryFn: () => ordersAPI.getSeller().then(r => r.data),
  })
  const { data: listingsData } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => listingsAPI.myListings().then(r => r.data),
  })
  const { data: shop } = useQuery({
    queryKey: ['my-shop'],
    queryFn: () => shopsAPI.myShop().then(r => r.data),
  })
  const { data: earningsData } = useQuery({
    queryKey: ['seller-earnings-summary'],
    queryFn: () => ordersAPI.getSellerEarnings().then(r => r.data),
  })

  const orders   = Array.isArray(ordersData)   ? ordersData   : (ordersData?.results   ?? [])
  const listings = Array.isArray(listingsData) ? listingsData : (listingsData?.results ?? [])

  const activeListings  = listings.filter(l => l.status === 'active').length
  const pendingOrders   = orders.filter(o => ['pending', 'confirmed'].includes(o.status)).length
  const inTransit       = orders.filter(o => ['en_collecte', 'au_point_retrait', 'pickup_confirmed'].includes(o.status)).length
  const completedOrders = orders.filter(o => o.status === 'completed').length

  const totalEarned    = earningsData?.summary?.total_paid_gnf    ?? 0
  const pendingEarning = earningsData?.summary?.total_pending_gnf ?? 0

  const recentOrders = orders.slice(0, 8)
  const hasPayoutInfo = user?.payout_phone && user?.payout_provider

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <SellerLayout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">{today}</p>
            <h1 className="text-2xl font-black text-gray-900 mt-1">
              Bonjour, {user?.full_name?.split(' ')[0] ?? 'Vendeur'} 👋
            </h1>
          </div>
          <Link to="/seller/listings/new"
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-md shadow-orange-500/20 hover:shadow-lg transition-all active:scale-95">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
            </svg>
            Nouvelle annonce
          </Link>
        </div>

        {/* ── Alertes ──────────────────────────────────────────── */}
        {!hasPayoutInfo && (
          <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">Compte de paiement non configuré</p>
              <p className="text-xs text-amber-700">Ajoutez votre numéro Mobile Money pour recevoir vos gains.</p>
            </div>
            <Link to="/seller/earnings" className="text-xs font-bold bg-amber-500 text-white px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors flex-shrink-0">
              Configurer →
            </Link>
          </div>
        )}
        {shop?.status === 'pending' && (
          <div className="flex items-center gap-4 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
            <span className="text-2xl">🔍</span>
            <div>
              <p className="text-sm font-bold text-blue-800">Boutique en cours de vérification</p>
              <p className="text-xs text-blue-700">Notre équipe valide votre boutique. Délai : 24-48h.</p>
            </div>
          </div>
        )}

        {/* ── KPIs ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="📋" label="Annonces actives"    value={activeListings}  color="orange" />
          <StatCard icon="🕐" label="À traiter"          value={pendingOrders}   color="blue"   />
          <StatCard icon="🚚" label="En livraison"       value={inTransit}       color="purple" />
          <StatCard icon="✅" label="Terminées"          value={completedOrders} color="green"  />
        </div>

        {/* ── Gains ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-gray-900 rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-40 h-40 bg-orange-500/10 rounded-full" />
            <div className="absolute -bottom-12 -left-6 w-48 h-48 bg-orange-500/5 rounded-full" />
            <div className="relative z-10">
              <p className="text-gray-400 text-sm">Gains totaux encaissés</p>
              <p className="text-4xl font-black mt-1">{fmt(totalEarned)}</p>
              <div className="flex items-center gap-4 mt-4">
                <div className="bg-white/10 rounded-xl px-4 py-3">
                  <p className="text-gray-400 text-xs">En attente</p>
                  <p className="text-lg font-bold text-orange-400">{fmt(pendingEarning)}</p>
                </div>
                <Link to="/seller/earnings"
                  className="bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm px-5 py-3 rounded-xl transition-colors">
                  Voir détails →
                </Link>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
            <p className="text-sm font-bold text-gray-700">Actions rapides</p>
            {[
              { to: '/seller/listings', icon: '📋', label: 'Mes annonces',    sub: `${activeListings} actives` },
              { to: '/seller/orders',   icon: '📦', label: 'Commandes',       sub: `${pendingOrders} à traiter` },
              { to: '/seller/shop',     icon: '🏪', label: 'Ma boutique',     sub: shop?.status === 'approved' ? '✅ Active' : '⏳ En vérif.' },
            ].map(a => (
              <Link key={a.to} to={a.to}
                className="flex items-center gap-3 p-2.5 hover:bg-gray-50 rounded-xl transition-colors group">
                <span className="text-lg">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{a.label}</p>
                  <p className="text-xs text-gray-400">{a.sub}</p>
                </div>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Commandes récentes ────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <h2 className="text-base font-black text-gray-900">Commandes récentes</h2>
            <Link to="/seller/orders" className="text-xs text-orange-500 font-semibold hover:underline">
              Voir tout →
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-sm font-semibold text-gray-700">Aucune commande pour l'instant</p>
              <p className="text-xs text-gray-400 mt-1">Publiez des annonces pour commencer à vendre</p>
              <Link to="/seller/listings/new"
                className="inline-block mt-4 bg-orange-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-orange-600 transition-colors">
                Publier une annonce
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentOrders.map(order => {
                const st = ORDER_STATUS[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
                return (
                  <Link key={order.id} to="/seller/orders"
                    className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                      {order.listing?.images?.[0]
                        ? <img src={order.listing.images[0].image} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-lg">📦</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {order.listing?.title ?? 'Article'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {fmtDate(order.created_at)} · {order.buyer?.full_name ?? 'Acheteur'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">{fmt(order.total_amount)}</p>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mt-1 ${st.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </SellerLayout>
  )
}
