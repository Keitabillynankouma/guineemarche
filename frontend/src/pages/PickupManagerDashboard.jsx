/**
 * PickupManagerDashboard — tableau de bord du gestionnaire de point de retrait
 * Inclut le flux essai : timer 15min, Gardé / Retourné + motif + photo
 */
import { useState, useEffect, useRef } from 'react'
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
  pending:          { label: 'En attente',        color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400'  },
  confirmed:        { label: 'Confirmée',          color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-400'   },
  en_collecte:      { label: 'En route',           color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
  au_point_retrait: { label: 'Prête à remettre',   color: 'bg-green-100 text-green-700',   dot: 'bg-green-400'  },
  en_essai:         { label: 'En cours d\'essai',  color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
  pickup_confirmed: { label: 'Remis au client',    color: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-400'   },
  completed:        { label: 'Terminée',           color: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400'   },
  retourne:         { label: 'Retourné',           color: 'bg-red-100 text-red-700',       dot: 'bg-red-400'    },
  cancelled:        { label: 'Annulée',            color: 'bg-red-100 text-red-700',       dot: 'bg-red-400'    },
}

const RETURN_REASONS = [
  { value: 'taille_incorrecte',  label: 'Taille différente de l\'annonce',  fault: 'vendeur' },
  { value: 'couleur_differente', label: 'Couleur différente des photos',     fault: 'vendeur' },
  { value: 'article_abime',      label: 'Article abîmé / défectueux',        fault: 'vendeur' },
  { value: 'changement_avis',    label: 'Changement d\'avis de l\'acheteur', fault: 'acheteur' },
  { value: 'autre',              label: 'Autre raison',                      fault: 'acheteur' },
]

const TABS = [
  { key: '',                 label: 'Toutes'       },
  { key: 'au_point_retrait', label: '📦 À remettre' },
  { key: 'en_essai',         label: '👗 En essai'   },
  { key: 'en_collecte',      label: '🚚 En route'   },
  { key: 'completed',        label: '✅ Terminées'  },
]

// ── Timer 15 minutes ─────────────────────────────────────────────────────────
function EssaiTimer({ startedAt }) {
  const DURATION = 15 * 60 // 15 min en secondes
  const [remaining, setRemaining] = useState(() => {
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    return Math.max(0, DURATION - elapsed)
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const pct  = (remaining / DURATION) * 100
  const isUrgent = remaining < 120 // moins de 2 min

  return (
    <div className={`rounded-xl p-3 text-center ${isUrgent ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
      <p className={`text-xs font-semibold mb-1 ${isUrgent ? 'text-red-600' : 'text-orange-600'}`}>
        {remaining === 0 ? '⏰ Temps écoulé !' : `⏱ Temps d'essai`}
      </p>
      <p className={`text-2xl font-black tabular-nums ${isUrgent ? 'text-red-700' : 'text-orange-700'}`}>
        {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
      </p>
      <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${isUrgent ? 'bg-red-500' : 'bg-orange-400'}`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Modal retour après essai ─────────────────────────────────────────────────
function RetourModal({ order, onConfirm, onCancel, isPending }) {
  const [reason, setReason] = useState('changement_avis')
  const [photo,  setPhoto]  = useState(null)
  const fileRef = useRef()

  const selectedReason = RETURN_REASONS.find(r => r.value === reason)
  const vendorFault    = selectedReason?.fault === 'vendeur'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-black text-gray-900 text-base">↩️ Enregistrer un retour</h3>
          <p className="text-xs text-gray-500 mt-0.5">{order.listing?.title}</p>
        </div>

        <div className="p-5 space-y-4">
          {/* Motif */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              Motif du retour
            </label>
            <div className="space-y-2">
              {RETURN_REASONS.map(r => (
                <button key={r.value} type="button" onClick={() => setReason(r.value)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition ${
                    reason === r.value
                      ? r.fault === 'vendeur' ? 'border-blue-500 bg-blue-50' : 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <span className="text-base">{r.fault === 'vendeur' ? '🏪' : '👤'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{r.label}</p>
                    <p className={`text-xs ${r.fault === 'vendeur' ? 'text-blue-600' : 'text-orange-600'}`}>
                      Faute : {r.fault}
                    </p>
                  </div>
                  {reason === r.value && <span className="text-green-500 font-bold">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Photo obligatoire */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              Photo de l'article (obligatoire)
            </label>
            <button type="button" onClick={() => fileRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-xl p-4 text-center transition ${
                photo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400'
              }`}>
              {photo ? (
                <div>
                  <p className="text-2xl mb-1">✅</p>
                  <p className="text-xs text-green-700 font-semibold">{photo.name}</p>
                  <p className="text-xs text-green-600">Appuyer pour changer</p>
                </div>
              ) : (
                <div>
                  <p className="text-2xl mb-1">📷</p>
                  <p className="text-xs text-gray-500">Prendre une photo de l'article</p>
                </div>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment"
              className="hidden" onChange={e => setPhoto(e.target.files[0])} />
          </div>

          {/* Résumé faute */}
          <div className={`rounded-xl p-3 text-sm ${vendorFault ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
            {vendorFault
              ? <p className="text-orange-700">⚠️ <strong>Faute vendeur</strong> — prix article jamais débité. <strong>10 000 GNF déduits</strong> du prochain paiement vendeur.</p>
              : <p className="text-green-700">✅ <strong>Changement d'avis</strong> — prix article jamais débité. Aucune pénalité vendeur.</p>
            }
          </div>
        </div>

        <div className="p-5 pt-0 flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition">
            Annuler
          </button>
          <button type="button" onClick={() => onConfirm({ reason, photo })}
            disabled={!photo || isPending}
            className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold transition">
            {isPending ? 'Enregistrement…' : '↩️ Confirmer le retour'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function PickupManagerDashboard() {
  const { user, logout } = useAuthStore()
  const [tab,              setTab]             = useState('')
  const [retourFor,        setRetourFor]       = useState(null) // order en cours de retour
  const [articlePayment,   setArticlePayment]  = useState(null) // { order, payment_url, amount_gnf }
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['my-pickup-point', tab],
    queryFn:  () => ordersAPI.getMyPickupPoint().then(r => r.data),
    refetchInterval: 15_000,
  })

  const action = useMutation({
    mutationFn: ({ id, act, body }) => ordersAPI.pickupOrderAction(id, act, body),
    onSuccess:  (res, variables) => {
      // Paiement en deux étapes : le backend retourne awaiting_article_payment
      if (res?.data?.status === 'awaiting_article_payment') {
        setArticlePayment({
          orderId:     variables.id,
          payment_url: res.data.payment_url,
          amount_gnf:  res.data.amount_gnf,
          message:     res.data.message,
        })
      } else {
        qc.invalidateQueries(['my-pickup-point'])
      }
    },
  })

  const doRetour = ({ reason, photo }) => {
    const fd = new FormData()
    fd.append('action', 'return_essai')
    fd.append('reason', reason)
    if (photo) fd.append('photo', photo)
    action.mutate(
      { id: retourFor.id, act: 'return_essai', body: fd },
      { onSuccess: () => setRetourFor(null) }
    )
  }

  const point    = data?.pickup_point
  const stats    = data?.stats ?? {}
  const allOrders = Array.isArray(data?.orders) ? data.orders : []
  const orders   = tab ? allOrders.filter(o => o.status === tab) : allOrders

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!point) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm text-center space-y-4">
        <p className="text-5xl">📦</p>
        <h2 className="text-lg font-black text-gray-900">Aucun point assigné</h2>
        <p className="text-sm text-gray-500">Votre compte n'est pas encore associé à un point de retrait.</p>
        <button onClick={logout} className="text-sm text-red-500 hover:underline">Se déconnecter</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modal retour */}
      {retourFor && (
        <RetourModal
          order={retourFor}
          onConfirm={doRetour}
          onCancel={() => setRetourFor(null)}
          isPending={action.isPending}
        />
      )}

      {/* Modal paiement article (étape 2) */}
      {articlePayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="text-center mb-4">
              <span className="text-4xl">📱</span>
              <h2 className="text-lg font-black text-gray-900 mt-2">Paiement article requis</h2>
              <p className="text-sm text-gray-500 mt-1">{articlePayment.message}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center mb-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Montant à payer</p>
              <p className="text-2xl font-black text-green-700">
                {new Intl.NumberFormat('fr-GN').format(articlePayment.amount_gnf)} GNF
              </p>
            </div>
            <p className="text-sm text-gray-600 mb-4 text-center">
              Présentez ce lien à l'acheteur sur votre écran ou envoyez-le sur son téléphone.
            </p>
            <div className="space-y-2">
              <a
                href={articlePayment.payment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition">
                💳 Ouvrir la page de paiement
              </a>
              <button
                onClick={() => { setArticlePayment(null); qc.invalidateQueries(['my-pickup-point']) }}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2">
                En attente de confirmation…
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-20"
        style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Point de retrait</p>
            <h1 className="text-lg font-black text-gray-900">{point.name}</h1>
          </div>
          <button onClick={logout} className="text-xs text-gray-400 hover:text-red-500 font-medium transition">
            Déconnexion
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',      value: stats.total      ?? 0, color: 'bg-gray-50  text-gray-700',  icon: '📋' },
            { label: 'À remettre', value: stats.en_attente ?? 0, color: 'bg-green-50 text-green-700', icon: '📦' },
            { label: 'En essai',   value: allOrders.filter(o => o.status === 'en_essai').length, color: 'bg-orange-50 text-orange-700', icon: '👗' },
            { label: 'Terminées',  value: stats.termines   ?? 0, color: 'bg-blue-50  text-blue-700',  icon: '✅' },
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
              className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
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
            <p className="text-sm font-semibold text-gray-700">Aucune commande ici</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => {
              const st = STATUS_LABELS[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
              const isEssai = order.status === 'en_essai'
              return (
                <div key={order.id}
                  className={`bg-white rounded-2xl border shadow-sm p-4 transition ${
                    isEssai ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-100'
                  }`}>
                  <div className="flex items-start gap-3">
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
                        <span className="text-sm font-black text-gray-900">{fmt(order.amount_gnf)}</span>
                        <span className="text-xs text-gray-400">{fmtDate(order.created_at)}</span>
                      </div>

                      {/* Timer essai */}
                      {isEssai && order.essai_started_at && (
                        <div className="mt-3">
                          <EssaiTimer startedAt={order.essai_started_at} />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 mt-3 flex-wrap">

                        {/* Colis arrivé en route → marquer au PDR */}
                        {order.status === 'en_collecte' && (
                          <button onClick={() => action.mutate({ id: order.id, act: 'ready' })}
                            disabled={action.isPending}
                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl transition">
                            ✅ Colis arrivé au point
                          </button>
                        )}

                        {/* Au PDR → Début essai OU remise directe */}
                        {order.status === 'au_point_retrait' && (
                          <>
                            <button onClick={() => action.mutate({ id: order.id, act: 'start_essai' })}
                              disabled={action.isPending}
                              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl transition">
                              👗 Début d'essai
                            </button>
                            <button onClick={() => action.mutate({ id: order.id, act: 'complete' })}
                              disabled={action.isPending}
                              className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl transition">
                              🤝 Remis (sans essai)
                            </button>
                          </>
                        )}

                        {/* En essai → Gardé ou Retourné */}
                        {isEssai && (
                          <>
                            <button onClick={() => action.mutate({ id: order.id, act: 'complete' })}
                              disabled={action.isPending}
                              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl transition">
                              ✅ Gardé
                            </button>
                            <button onClick={() => setRetourFor(order)}
                              disabled={action.isPending}
                              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl transition">
                              ❌ Retourné
                            </button>
                          </>
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
