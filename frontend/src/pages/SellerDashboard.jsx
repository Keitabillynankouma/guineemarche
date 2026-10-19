import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ordersAPI, listingsAPI, shopsAPI } from '../services/api'
import useAuthStore from '../store/authStore'

function fmt(n) {
  if (!n && n !== 0) return '0 GNF'
  return n.toLocaleString('fr-FR') + ' GNF'
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const ORDER_STATUS = {
  pending:          { label: 'En attente',      color: 'bg-amber-100 text-amber-700',   icon: '⏳' },
  confirmed:        { label: 'Confirmée',        color: 'bg-blue-100 text-blue-700',     icon: '✅' },
  en_collecte:      { label: 'En collecte',      color: 'bg-purple-100 text-purple-700', icon: '🚚' },
  au_point_retrait: { label: 'Au point retrait', color: 'bg-indigo-100 text-indigo-700', icon: '📦' },
  pickup_confirmed: { label: 'Collecté',         color: 'bg-teal-100 text-teal-700',     icon: '📦' },
  completed:        { label: 'Terminée',         color: 'bg-green-100 text-green-700',   icon: '🎉' },
  cancelled:        { label: 'Annulée',          color: 'bg-red-100 text-red-700',       icon: '❌' },
  disputed:         { label: 'Litige',           color: 'bg-orange-100 text-orange-700', icon: '⚠️' },
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ icon, label, value, sub, color = 'green', to }) {
  const colors = {
    green:  'from-green-500 to-emerald-400',
    orange: 'from-orange-500 to-amber-400',
    blue:   'from-blue-500 to-sky-400',
    purple: 'from-purple-500 to-violet-400',
  }
  const content = (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-xl shadow-sm`}>
          {icon}
        </div>
        {to && <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>}
      </div>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
  if (to) return <Link to={to}>{content}</Link>
  return content
}

// ── Quick Action ──────────────────────────────────────────────────────────────
function QuickAction({ to, icon, label, desc, color = 'orange' }) {
  const hoverColors = { orange: 'hover:border-orange-400 hover:bg-orange-50', green: 'hover:border-green-400 hover:bg-green-50', blue: 'hover:border-blue-400 hover:bg-blue-50' }
  const iconColors  = { orange: 'bg-orange-100 text-orange-600', green: 'bg-green-100 text-green-600', blue: 'bg-blue-100 text-blue-600' }
  return (
    <Link to={to} className={`flex items-center gap-4 p-4 border-2 border-gray-200 rounded-2xl transition-all group ${hoverColors[color]}`}>
      <div className={`w-11 h-11 rounded-xl ${iconColors[color]} flex items-center justify-center text-xl flex-shrink-0`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
      <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
      </svg>
    </Link>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function SellerDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const { data: ordersData } = useQuery({
    queryKey: ['seller-orders'],
    queryFn: () => ordersAPI.listSeller().then(r => r.data),
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
    queryFn: () => ordersAPI.sellerEarnings({ page: 1, page_size: 5 }).then(r => r.data),
  })

  const orders   = Array.isArray(ordersData) ? ordersData : (ordersData?.results ?? [])
  const listings = Array.isArray(listingsData) ? listingsData : (listingsData?.results ?? [])

  const activeListings  = listings.filter(l => l.status === 'active').length
  const pendingOrders   = orders.filter(o => ['pending', 'confirmed'].includes(o.status)).length
  const activeOrders    = orders.filter(o => ['en_collecte', 'au_point_retrait', 'pickup_confirmed'].includes(o.status)).length
  const completedOrders = orders.filter(o => o.status === 'completed').length

  const totalEarned    = earningsData?.summary?.total_paid_gnf     ?? 0
  const pendingEarning = earningsData?.summary?.total_pending_gnf  ?? 0

  const recentOrders = orders.slice(0, 5)

  const hasPayoutInfo = user?.payout_phone && user?.payout_provider
  const shopStatus    = shop?.status

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barre de navigation vendeur */}
      <nav className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white font-black text-sm">G</span>
            </div>
            <span className="font-black text-gray-900 text-lg">Guimatrix</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/" className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              Marketplace
            </Link>
            <Link to="/profile" className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-sm">
              {user?.full_name?.[0]?.toUpperCase() ?? 'V'}
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">
              Bonjour, {user?.full_name?.split(' ')[0] ?? 'Vendeur'} 👋
            </h1>
            <p className="text-sm text-gray-500 mt-1">Voici l'état de votre boutique aujourd'hui</p>
          </div>
          <Link to="/create"
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
            Publier
          </Link>
        </div>

        {/* ── Alertes ─────────────────────────────────────────────────── */}
        {!hasPayoutInfo && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Complétez vos infos de paiement</p>
              <p className="text-xs text-amber-700 mt-0.5">Configurez votre compte Mobile Money pour recevoir vos gains.</p>
            </div>
            <Link to="/earnings" className="flex-shrink-0 text-xs font-bold text-amber-700 bg-amber-200 hover:bg-amber-300 px-3 py-1.5 rounded-lg transition-colors">
              Configurer
            </Link>
          </div>
        )}

        {shopStatus === 'pending' && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <span className="text-xl">🔍</span>
            <div>
              <p className="text-sm font-semibold text-blue-800">Boutique en cours de vérification</p>
              <p className="text-xs text-blue-700 mt-0.5">Notre équipe examine votre boutique. Validation sous 24-48h.</p>
            </div>
          </div>
        )}

        {shopStatus === 'rejected' && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
            <span className="text-xl">❌</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">Boutique non approuvée</p>
              <p className="text-xs text-red-700 mt-0.5">Modifiez les informations de votre boutique et soumettez à nouveau.</p>
            </div>
            <Link to="/my-shop" className="flex-shrink-0 text-xs font-bold text-red-700 bg-red-200 hover:bg-red-300 px-3 py-1.5 rounded-lg transition-colors">
              Corriger
            </Link>
          </div>
        )}

        {/* ── KPIs ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPICard icon="📋" label="Annonces actives"   value={activeListings}  color="orange" to="/my-listings" />
          <KPICard icon="🕐" label="Commandes à traiter" value={pendingOrders}   color="blue"   to="/orders" />
          <KPICard icon="🚚" label="En cours de livraison" value={activeOrders}  color="purple" to="/orders" />
          <KPICard icon="✅" label="Commandes terminées" value={completedOrders} color="green"  to="/orders" />
        </div>

        {/* ── Gains ────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-400 rounded-3xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/80 text-sm">Gains totaux</p>
              <p className="text-3xl font-black">{fmt(totalEarned)}</p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">💰</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="bg-white/15 rounded-xl px-4 py-2">
              <p className="text-white/70 text-xs">En attente</p>
              <p className="text-lg font-bold">{fmt(pendingEarning)}</p>
            </div>
            <Link to="/earnings"
              className="bg-white text-orange-600 font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-orange-50 transition-colors">
              Voir les gains →
            </Link>
          </div>
        </div>

        {/* ── Actions rapides ──────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-black text-gray-900 mb-3">Actions rapides</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickAction to="/create"      icon="➕" label="Publier une annonce"  desc="Mettez un article en vente"     color="orange" />
            <QuickAction to="/my-listings" icon="📋" label="Mes annonces"        desc="Gérer vos articles publiés"     color="orange" />
            <QuickAction to="/orders"      icon="📦" label="Mes commandes"       desc="Confirmer et suivre vos ventes" color="blue"   />
            <QuickAction to="/my-shop"     icon="🏪" label="Ma boutique"         desc="Modifier les infos de votre boutique" color="green" />
            <QuickAction to="/earnings"    icon="💳" label="Gains & paiements"   desc="Historique et infos de virement"      color="green" />
            <QuickAction to="/profile"     icon="👤" label="Mon profil"          desc="Photo, téléphone, adresse"      color="blue"   />
          </div>
        </div>

        {/* ── Commandes récentes ───────────────────────────────────────── */}
        {recentOrders.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-black text-gray-900">Commandes récentes</h2>
              <Link to="/orders" className="text-xs text-orange-600 font-semibold hover:underline">Voir tout →</Link>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm divide-y divide-gray-50">
              {recentOrders.map(order => {
                const st = ORDER_STATUS[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-600', icon: '•' }
                return (
                  <Link key={order.id} to="/orders" className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                      {order.listing?.images?.[0] ? (
                        <img src={order.listing.images[0].image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">📦</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{order.listing?.title ?? 'Article'}</p>
                      <p className="text-xs text-gray-400">{fmtDate(order.created_at)} · {fmt(order.total_amount)}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${st.color}`}>
                      {st.icon} {st.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Empty state si aucune commande ─────────────────────────── */}
        {recentOrders.length === 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 p-10 text-center shadow-sm">
            <div className="text-5xl mb-4">🏪</div>
            <h3 className="text-lg font-black text-gray-900 mb-1">Votre boutique est prête !</h3>
            <p className="text-sm text-gray-500 mb-5">Publiez votre première annonce pour commencer à vendre.</p>
            <Link to="/create"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-bold px-6 py-3 rounded-xl shadow hover:shadow-md transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
              Publier ma première annonce
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
