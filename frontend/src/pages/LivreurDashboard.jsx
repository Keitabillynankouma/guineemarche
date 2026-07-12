import { useState, useEffect } from 'react'
import { ordersAPI, reviewsAPI } from '../services/api'

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

function QRCodeDisplay({ code }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(code)}&size=180x180&margin=10`
  return (
    <div className="flex flex-col items-center gap-2">
      <img src={url} alt={`QR ${code}`} className="rounded-xl border border-gray-200 shadow-sm" width={180} height={180} />
      <p className="text-sm text-gray-500">Code : <span className="font-black text-gray-800 tracking-widest">{code}</span></p>
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
  const [showConfirm, setShowConfirm] = useState(false)
  const [inputCode, setInputCode]     = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [ratingModal, setRatingModal] = useState(null)
  const [rated, setRated]             = useState({})

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
                <p className="font-bold mb-1">📋 Étape 2 — Livrer à l'acheteur</p>
                <p>L'acheteur doit vous donner son code à la réception pour confirmer la livraison.</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-gray-600 font-medium">Code que l'acheteur doit vous donner :</p>
                <QRCodeDisplay code={assignment.verification_code} />
              </div>
              {!showConfirm ? (
                <button onClick={() => setShowConfirm(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition">
                  ✅ Saisir le code de l'acheteur
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 font-medium">Code donné par l'acheteur :</p>
                  <input
                    type="number" value={inputCode}
                    onChange={e => { setInputCode(e.target.value.slice(0, 6)); setError('') }}
                    placeholder="123456"
                    className="w-full text-center text-2xl font-black tracking-widest px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => { setShowConfirm(false); setInputCode(''); setError('') }}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition">
                      Annuler
                    </button>
                    <button onClick={handleConfirm} disabled={loading}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60">
                      {loading ? '…' : 'Valider'}
                    </button>
                  </div>
                </div>
              )}
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
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

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
        <h1 className="text-white text-2xl font-black">Mes livraisons</h1>
        <p className="text-emerald-200 text-sm mt-1">
          {active.length} en cours · {delivered.length} livrée{delivered.length !== 1 ? 's' : ''}
        </p>
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
