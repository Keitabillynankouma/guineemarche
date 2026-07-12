import { useState, useEffect } from 'react'
import { ordersAPI } from '../services/api'

const STATUS_LABEL = {
  assigned:  { label: 'Assignée',    color: 'bg-amber-100 text-amber-700 border-amber-200' },
  en_route:  { label: 'En route',    color: 'bg-blue-100 text-blue-700 border-blue-200' },
  delivered: { label: 'Livrée',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  failed:    { label: 'Échec',        color: 'bg-red-100 text-red-700 border-red-200' },
}

function QRCodeDisplay({ code }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(code)}&size=180x180&margin=10`
  return (
    <div className="flex flex-col items-center gap-2">
      <img src={url} alt={`QR code ${code}`} className="rounded-xl border border-gray-200 shadow-sm" width={180} height={180} />
      <p className="text-sm text-gray-500">Code : <span className="font-black text-gray-800 tracking-widest text-base">{code}</span></p>
    </div>
  )
}

function AssignmentCard({ assignment, onStart, onConfirm }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [inputCode, setInputCode]     = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)

  const o    = assignment.order_detail || {}
  const meta = STATUS_LABEL[assignment.status] || STATUS_LABEL.assigned

  async function handleStart() {
    setLoading(true)
    await onStart(assignment.id)
    setLoading(false)
  }

  async function handleConfirm() {
    if (inputCode.length !== 6) { setError('Entrez les 6 chiffres.'); return }
    setLoading(true)
    setError('')
    const ok = await onConfirm(assignment.id, inputCode)
    if (!ok) setError('Code incorrect. Demandez à l\'acheteur.')
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-800 to-emerald-700 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-white font-bold text-base leading-tight">{o.listing_title}</h3>
            <p className="text-emerald-200 text-sm mt-0.5">#{assignment.id.slice(0, 8)}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.color} bg-white/90`}>
            {meta.label}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Infos livraison */}
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-gray-400 w-5 mt-0.5">📦</span>
            <div>
              <p className="text-gray-500">Acheteur</p>
              <p className="font-semibold text-gray-800">{o.buyer_name}</p>
              {o.buyer_phone && <p className="text-emerald-700">{o.buyer_phone}</p>}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-400 w-5 mt-0.5">📍</span>
            <div>
              <p className="text-gray-500">Adresse</p>
              <p className="font-semibold text-gray-800">{o.delivery_address || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-400 w-5 mt-0.5">💰</span>
            <div>
              <p className="text-gray-500">Montant</p>
              <p className="font-bold text-gray-800">
                {new Intl.NumberFormat('fr-GN').format(o.amount_gnf)} GNF
              </p>
            </div>
          </div>
        </div>

        {/* QR code — visible uniquement quand on est en route */}
        {assignment.status === 'en_route' && (
          <div className="border-t pt-4">
            <p className="text-sm text-gray-600 font-medium mb-3">QR code de la livraison :</p>
            <QRCodeDisplay code={assignment.verification_code} />
          </div>
        )}

        {/* Actions */}
        {assignment.status === 'assigned' && (
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60"
          >
            {loading ? 'Chargement…' : '🚗 Démarrer la livraison'}
          </button>
        )}

        {assignment.status === 'en_route' && (
          <div className="space-y-3">
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                ✅ Confirmer la livraison
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Demandez le code 6 chiffres à l'acheteur :</p>
                <input
                  type="number"
                  maxLength={6}
                  value={inputCode}
                  onChange={e => { setInputCode(e.target.value.slice(0, 6)); setError('') }}
                  placeholder="123456"
                  className="w-full text-center text-2xl font-black tracking-widest px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowConfirm(false); setInputCode(''); setError('') }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={loading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60"
                  >
                    {loading ? '…' : 'Valider'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {assignment.status === 'delivered' && (
          <div className="text-center py-2 text-emerald-700 font-semibold text-sm">
            ✅ Livraison confirmée
          </div>
        )}
      </div>
    </div>
  )
}

export default function LivreurDashboard() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  async function load() {
    try {
      const res = await ordersAPI.getMyAssignments()
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
      alert('Erreur lors du démarrage de la livraison.')
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

  const pending   = assignments.filter(a => a.status !== 'delivered')
  const delivered = assignments.filter(a => a.status === 'delivered')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-gradient-to-r from-green-800 to-emerald-700 px-4 pt-10 pb-8">
        <h1 className="text-white text-2xl font-black">Mes livraisons</h1>
        <p className="text-emerald-200 text-sm mt-1">
          {pending.length} en cours · {delivered.length} livrée{delivered.length !== 1 ? 's' : ''}
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

        {!loading && pending.length === 0 && delivered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📦</p>
            <p className="font-semibold">Aucune livraison assignée</p>
            <p className="text-sm mt-1">L'admin vous assignera des livraisons bientôt.</p>
          </div>
        )}

        {!loading && pending.map(a => (
          <AssignmentCard
            key={a.id}
            assignment={a}
            onStart={handleStart}
            onConfirm={handleConfirm}
          />
        ))}

        {delivered.length > 0 && (
          <>
            <h2 className="text-gray-500 text-xs font-bold uppercase tracking-wide pt-2">Livrées</h2>
            {delivered.map(a => (
              <AssignmentCard
                key={a.id}
                assignment={a}
                onStart={handleStart}
                onConfirm={handleConfirm}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
