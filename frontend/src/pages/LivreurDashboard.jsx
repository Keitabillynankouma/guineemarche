import { useState, useEffect, useRef } from 'react'
import { ordersAPI, reviewsAPI, authAPI } from '../services/api'
import useAuthStore from '../store/authStore'

const STATUS_LABEL = {
  assigned:  { label: 'Assignée',  color: 'bg-amber-100 text-amber-700 border-amber-200' },
  en_route:  { label: 'En route',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  delivered: { label: 'Livrée',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  failed:    { label: 'Échec',     color: 'bg-red-100 text-red-700 border-red-200' },
}

function CodeBox({ label, code, subtitle }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center space-y-1">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-black tracking-[0.2em] text-gray-900">{code}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  )
}

// ── Modal notation ────────────────────────────────────────────────────────────
function RatingModal({ orderId, revieweeId, revieweeName, label, onClose, onDone }) {
  const [rating, setRating]   = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function submit() {
    if (!rating) { setError('Choisissez une note.'); return }
    setLoading(true); setError('')
    try {
      await reviewsAPI.create({ order: orderId, rating, comment, reviewee: revieweeId })
      onDone()
    } catch (e) {
      const d = e.response?.data
      setError(Array.isArray(d) ? d[0] : (d?.detail || d?.non_field_errors?.[0] || 'Erreur.'))
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="font-bold text-gray-800 text-lg">Noter {label}</h2>
        <p className="text-sm text-gray-500">{revieweeName}</p>
        <div className="flex justify-center gap-2">
          {[1,2,3,4,5].map(s => (
            <button key={s} onClick={() => setRating(s)}
              className={`text-3xl transition ${s <= rating ? 'opacity-100' : 'opacity-30'}`}>⭐</button>
          ))}
        </div>
        <textarea
          value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Commentaire (optionnel)" rows={3}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">
            Annuler
          </button>
          <button onClick={submit} disabled={loading || !rating}
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition disabled:opacity-50">
            {loading ? '…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Carte livraison ───────────────────────────────────────────────────────────
function AssignmentCard({ assignment, onStart, onConfirm, onRefresh }) {
  const [inputCode, setInputCode]     = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [ratingModal, setRatingModal] = useState(null)
  const [rated, setRated]             = useState({})
  const [gpsActive, setGpsActive]     = useState(false)
  const [gpsError, setGpsError]       = useState('')
  const lastSentRef                   = useRef(0)
  const watchIdRef                    = useRef(null)

  // ── GPS tracking actif quand en_route ─────────────────────────────────────
  useEffect(() => {
    if (assignment.status !== 'en_route') return
    if (!navigator.geolocation) {
      setGpsError('GPS non disponible sur cet appareil.')
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsActive(true)
        setGpsError('')
        const now = Date.now()
        // Envoie au max toutes les 30 secondes pour ne pas saturer le backend
        if (now - lastSentRef.current < 30_000) return
        lastSentRef.current = now
        ordersAPI.updatePosition(
          assignment.id,
          pos.coords.latitude,
          pos.coords.longitude,
        ).catch(() => {})
      },
      (err) => {
        setGpsActive(false)
        setGpsError(
          err.code === 1 ? 'GPS refusé — autorisez la localisation dans votre navigateur.'
          : 'Erreur GPS — vérifiez votre signal.',
        )
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 10_000 },
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [assignment.status, assignment.id])

  const o    = assignment.order_detail || {}
  const meta = STATUS_LABEL[assignment.status] || STATUS_LABEL.assigned

  async function handleStart() {
    setLoading(true)
    await onStart(assignment.id)
    setLoading(false)
  }

  async function handleConfirm() {
    if (inputCode.length !== 6) { setError('Entrez les 6 chiffres.'); return }
    setLoading(true); setError('')
    const ok = await onConfirm(assignment.id, inputCode)
    if (!ok) setError("Code incorrect. Demandez à l'acheteur.")
    setLoading(false)
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-800 to-emerald-700 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-white font-bold text-base leading-tight">{o.listing_title || '—'}</h3>
              <p className="text-emerald-200 text-sm mt-0.5">#{assignment.id?.slice(0, 8)}</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border bg-white/90 ${meta.color}`}>
              {meta.label}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Infos */}
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="w-5 mt-0.5">👤</span>
              <div>
                <p className="text-gray-400 text-xs">Acheteur</p>
                <p className="font-semibold text-gray-800">{o.buyer_name}</p>
                {o.buyer_phone && <p className="text-emerald-700 text-xs">{o.buyer_phone}</p>}
              </div>
            </div>
            {o.seller_name && (
              <div className="flex items-start gap-2">
                <span className="w-5 mt-0.5">🏪</span>
                <div>
                  <p className="text-gray-400 text-xs">Vendeur</p>
                  <p className="font-semibold text-gray-800">{o.seller_name}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <span className="w-5 mt-0.5">📍</span>
              <div>
                <p className="text-gray-400 text-xs">Adresse</p>
                <p className="font-semibold text-gray-800">{o.delivery_address || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 mt-0.5">💰</span>
              <div>
                <p className="text-gray-400 text-xs">Montant</p>
                <p className="font-bold text-gray-800">
                  {new Intl.NumberFormat('fr-GN').format(o.amount_gnf)} GNF
                </p>
              </div>
            </div>
          </div>

          {/* ── ÉTAPE 1 : assigned — récupérer chez vendeur ── */}
          {assignment.status === 'assigned' && (
            <div className="border-t pt-4 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <p className="font-bold mb-1">📋 Étape 1 — Récupérer le colis chez le vendeur</p>
                <p>Montrez ce code au vendeur. Il doit le vérifier avant de vous remettre le colis.</p>
              </div>
              <CodeBox
                label="Code de retrait — à montrer au vendeur"
                code={assignment.pickup_code}
                subtitle="Le vendeur vérifie ce code avant de vous confier le colis"
              />
              <button onClick={handleStart} disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60">
                {loading ? 'Chargement…' : '✅ Colis récupéré — En route !'}
              </button>
            </div>
          )}

          {/* ── ÉTAPE 2 : en_route — livrer à l'acheteur ── */}
          {assignment.status === 'en_route' && (
            <div className="border-t pt-4 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                <p className="font-bold mb-1">📋 Étape 2 — Confirmer la remise à l'acheteur</p>
                <p>Demandez le code à l'acheteur et saisissez-le ci-dessous pour confirmer la livraison.</p>
              </div>
              {/* Statut GPS */}
              {gpsActive ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs text-green-700">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                  GPS actif — votre position est partagée avec l'acheteur
                </div>
              ) : gpsError ? (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                  ⚠️ {gpsError}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-gray-300 animate-pulse flex-shrink-0" />
                  Localisation en cours…
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm text-gray-600 font-medium text-center">Code donné par l'acheteur :</p>
                <input
                  type="number" value={inputCode}
                  onChange={e => { setInputCode(e.target.value.slice(0, 6)); setError('') }}
                  placeholder="_ _ _ _ _ _"
                  inputMode="numeric"
                  autoFocus
                  className="w-full text-center text-3xl font-black tracking-[0.3em] px-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <button onClick={handleConfirm} disabled={loading || inputCode.length !== 6}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50">
                  {loading ? '…' : '✅ Confirmer la livraison'}
                </button>
              </div>
            </div>
          )}

          {/* ── LIVRÉE : notation ── */}
          {assignment.status === 'delivered' && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-center text-emerald-700 font-semibold text-sm">✅ Livraison confirmée</p>
              {(o.buyer_id || o.seller_id) && (
                <>
                  <p className="text-xs text-center text-gray-400">Notez les parties :</p>
                  <div className="flex gap-2">
                    {o.buyer_id && !rated[o.buyer_id] && (
                      <button
                        onClick={() => setRatingModal({ id: o.buyer_id, name: o.buyer_name, label: "l'acheteur" })}
                        className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-semibold py-2.5 rounded-xl border border-amber-200 transition">
                        ⭐ Acheteur
                      </button>
                    )}
                    {o.seller_id && !rated[o.seller_id] && (
                      <button
                        onClick={() => setRatingModal({ id: o.seller_id, name: o.seller_name, label: 'le vendeur' })}
                        className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-semibold py-2.5 rounded-xl border border-amber-200 transition">
                        ⭐ Vendeur
                      </button>
                    )}
                  </div>
                  {rated[o.buyer_id] && rated[o.seller_id] && (
                    <p className="text-xs text-gray-400 text-center">Merci pour vos avis !</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {ratingModal && (
        <RatingModal
          orderId={o.id}
          revieweeId={ratingModal.id}
          revieweeName={ratingModal.name}
          label={ratingModal.label}
          onClose={() => setRatingModal(null)}
          onDone={() => { setRated(p => ({ ...p, [ratingModal.id]: true })); setRatingModal(null); onRefresh() }}
        />
      )}
    </>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function LivreurDashboard() {
  const user                          = useAuthStore(s => s.user)
  const setUser                       = useAuthStore(s => s.setUser)
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [toggling, setToggling]       = useState(false)

  // is_available vient du store auth (mis à jour par /me/ au login)
  const isAvailable = user?.is_available ?? true

  async function load() {
    try {
      const res  = await ordersAPI.getMyAssignments()
      const data = res.data
      setAssignments(Array.isArray(data) ? data : (data?.results ?? []))
    } catch {
      setError('Impossible de charger vos livraisons.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleToggleAvailability() {
    setToggling(true)
    try {
      const res = await authAPI.toggleAvailability()
      // Mettre à jour le store auth pour refléter le nouveau statut
      if (user) setUser({ ...user, is_available: res.data.is_available })
    } catch {
      alert('Erreur lors du changement de statut.')
    } finally {
      setToggling(false) }
  }

  async function handleStart(id) {
    try {
      const res = await ordersAPI.startDelivery(id)
      setAssignments(prev => prev.map(a => a.id === id ? res.data : a))
    } catch {
      alert('Erreur lors du démarrage.')
    }
  }

  async function handleConfirm(id, code) {
    try {
      const res = await ordersAPI.confirmDelivery(id, code)
      setAssignments(prev => prev.map(a => a.id === id ? res.data : a))
      return true
    } catch (err) {
      if (err.response?.status === 400) return false
      alert('Erreur réseau. Réessayez.')
      return false
    }
  }

  const active    = assignments.filter(a => a.status !== 'delivered' && a.status !== 'failed')
  const delivered = assignments.filter(a => a.status === 'delivered')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-green-800 to-emerald-700 px-4 pt-10 pb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-white text-2xl font-black">Mes livraisons</h1>
            <p className="text-emerald-200 text-sm mt-1">
              {active.length} en cours · {delivered.length} livrée{delivered.length !== 1 ? 's' : ''}
            </p>
          </div>
          {/* Toggle disponibilité */}
          <button
            onClick={handleToggleAvailability}
            disabled={toggling}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg
              ${isAvailable
                ? 'bg-emerald-400 hover:bg-emerald-300 text-emerald-900'
                : 'bg-white/20 hover:bg-white/30 text-white border border-white/30'
              } disabled:opacity-60`}
          >
            <span className={`w-3 h-3 rounded-full ${isAvailable ? 'bg-emerald-900 animate-pulse' : 'bg-white/50'}`} />
            {toggling ? '…' : isAvailable ? 'Disponible' : 'Indisponible'}
          </button>
        </div>
        {!isAvailable && (
          <div className="mt-3 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white/80">
            ⚠️ Vous êtes indisponible — aucune nouvelle commande ne vous sera assignée.
          </div>
        )}
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-green-700 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{error}</div>
        )}
        {!loading && active.length === 0 && delivered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📦</p>
            <p className="font-semibold">Aucune livraison assignée</p>
            <p className="text-sm mt-1">Vous recevrez une notification dès qu'une commande vous est assignée.</p>
          </div>
        )}
        {!loading && active.map(a => (
          <AssignmentCard key={a.id} assignment={a} onStart={handleStart} onConfirm={handleConfirm} onRefresh={load} />
        ))}
        {delivered.length > 0 && (
          <>
            <h2 className="text-gray-500 text-xs font-bold uppercase tracking-wide pt-2">Livrées</h2>
            {delivered.map(a => (
              <AssignmentCard key={a.id} assignment={a} onStart={handleStart} onConfirm={handleConfirm} onRefresh={load} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
