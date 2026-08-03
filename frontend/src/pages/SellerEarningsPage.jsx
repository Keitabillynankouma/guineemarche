import { useState, useEffect } from 'react'
import { ordersAPI } from '../services/api'
import useAuthStore from '../store/authStore'

const STATUS = {
  pending:    { label: 'En attente',  color: 'bg-amber-100 text-amber-700 border-amber-200' },
  processing: { label: 'En cours',   color: 'bg-blue-100 text-blue-700 border-blue-200' },
  completed:  { label: 'Versé',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  failed:     { label: 'Échoué',     color: 'bg-red-100 text-red-700 border-red-200' },
}

const PROVIDER = {
  orange_money: { label: 'Orange Money', color: 'text-orange-600', icon: '🟠' },
  mtn_momo:     { label: 'MTN MoMo',     color: 'text-yellow-600', icon: '🟡' },
  paycard:      { label: 'PayCard',      color: 'text-blue-600',   icon: '💳' },
  kulu:         { label: 'Kulu',         color: 'text-sky-600',    icon: '🔵' },
  soutra_money: { label: 'Soutra Money', color: 'text-green-600',  icon: '🟢' },
  akiba:        { label: 'Akiba',        color: 'text-purple-600', icon: '💜' },
  manual:       { label: 'Manuel',       color: 'text-gray-600',   icon: '💼' },
}

function fmt(n) {
  if (!n && n !== 0) return '—'
  return n.toLocaleString('fr-FR') + ' GNF'
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Modale mise à jour infos paiement ────────────────────────────────────────
function PayoutInfoModal({ current, onClose, onSaved }) {
  const [phone,    setPhone]    = useState(current?.phone    || '')
  const [provider, setProvider] = useState(current?.provider || 'orange_money')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function save() {
    if (!phone.trim()) { setError('Entrez votre numéro mobile money.'); return }
    setLoading(true); setError('')
    try {
      await ordersAPI.updatePayoutInfo({ payout_phone: phone.trim(), payout_provider: provider })
      onSaved({ phone: phone.trim(), provider })
      onClose()
    } catch (e) {
      const d = e.response?.data
      setError(d?.error || d?.detail || 'Erreur lors de la mise à jour.')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">💳 Infos de paiement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <p className="text-sm text-gray-600">
          Renseignez le numéro mobile money sur lequel vous voulez recevoir vos gains après chaque vente.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Opérateur</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'orange_money', label: '🟠 Orange Money' },
                { value: 'mtn_momo',     label: '🟡 MTN MoMo' },
                { value: 'paycard',      label: '💳 PayCard' },
                { value: 'kulu',         label: '🔵 Kulu' },
                { value: 'soutra_money', label: '🟢 Soutra Money' },
                { value: 'akiba',        label: '💜 Akiba' },
              ].map(op => (
                <button
                  key={op.value}
                  onClick={() => setProvider(op.value)}
                  className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    provider === op.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Numéro de téléphone</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="ex: +224 622 00 00 00"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button
            onClick={save}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function SellerEarningsPage() {
  const { user } = useAuthStore()
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [payoutInfo, setPayoutInfo] = useState({
    phone:    user?.profile?.payout_phone    || '',
    provider: user?.profile?.payout_provider || 'orange_money',
  })

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await ordersAPI.getSellerEarnings()
      setData(res.data)
    } catch (e) {
      setError(e.response?.data?.error || 'Impossible de charger vos gains.')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <p className="text-red-600">{error}</p>
        <button onClick={load} className="text-sm text-emerald-600 underline">Réessayer</button>
      </div>
    </div>
  )

  const { summary, payouts } = data || { summary: {}, payouts: [] }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {showModal && (
        <PayoutInfoModal
          current={payoutInfo}
          onClose={() => setShowModal(false)}
          onSaved={info => setPayoutInfo(info)}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-6">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-gray-900">💰 Mes gains</h1>
              <p className="text-sm text-gray-500 mt-0.5">Vos revenus de vente sur Guimatrix</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors"
            >
              <span>💳</span>
              <span>Infos paiement</span>
            </button>
          </div>

          {/* Alerte si pas de numéro configuré */}
          {!payoutInfo.phone && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">Numéro mobile money manquant</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Ajoutez votre numéro Orange Money ou MTN MoMo pour recevoir vos paiements automatiquement.
                </p>
                <button
                  onClick={() => setShowModal(true)}
                  className="text-xs font-semibold text-amber-800 underline mt-1"
                >
                  Ajouter maintenant →
                </button>
              </div>
            </div>
          )}

          {/* Infos paiement configurées */}
          {payoutInfo.phone && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{PROVIDER[payoutInfo.provider]?.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-emerald-800">{PROVIDER[payoutInfo.provider]?.label}</p>
                  <p className="text-xs text-emerald-700">{payoutInfo.phone}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(true)} className="text-xs text-emerald-700 underline">
                Modifier
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cartes résumé */}
      <div className="max-w-lg mx-auto px-4 mt-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Versé</p>
            <p className="text-lg font-black text-emerald-600">
              {(summary.total_earned || 0).toLocaleString('fr-FR')}
            </p>
            <p className="text-xs text-gray-400">GNF</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-xs text-gray-500 mb-1">En attente</p>
            <p className="text-lg font-black text-amber-600">
              {(summary.total_pending || 0).toLocaleString('fr-FR')}
            </p>
            <p className="text-xs text-gray-400">GNF</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Ventes</p>
            <p className="text-lg font-black text-gray-900">{summary.count || 0}</p>
            <p className="text-xs text-gray-400">total</p>
          </div>
        </div>
      </div>

      {/* Liste paiements */}
      <div className="max-w-lg mx-auto px-4 mt-6 space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Historique des versements</h2>

        {payouts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-3xl mb-2">💸</p>
            <p className="text-gray-500 text-sm">Aucun versement pour l'instant.</p>
            <p className="text-gray-400 text-xs mt-1">Les gains apparaissent ici après chaque vente confirmée.</p>
          </div>
        ) : (
          payouts.map(p => {
            const st = STATUS[p.status] || STATUS.pending
            const pr = PROVIDER[p.provider] || PROVIDER.manual
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-black text-gray-900">{fmt(p.amount_gnf)}</p>
                    <p className="text-xs text-gray-400">Commande · {p.order_id?.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${st.color}`}>
                    {st.label}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className={`flex items-center gap-1 font-medium ${pr.color}`}>
                    {pr.icon} {pr.label}
                    {p.payout_phone && <span className="text-gray-400 font-normal ml-1">· {p.payout_phone}</span>}
                  </span>
                  <span>
                    {p.status === 'completed' ? `Versé le ${fmtDate(p.processed_at)}` : `Créé le ${fmtDate(p.created_at)}`}
                  </span>
                </div>

                {p.external_ref && (
                  <p className="text-xs text-gray-400 font-mono truncate">Réf : {p.external_ref}</p>
                )}
                {p.admin_note && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">{p.admin_note}</p>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Explication du système */}
      <div className="max-w-lg mx-auto px-4 mt-8">
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
          <p className="text-sm font-bold text-blue-800">ℹ️ Comment fonctionne le paiement ?</p>
          <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
            <li>L'acheteur paie lors de la commande — les fonds sont sécurisés par Guimatrix.</li>
            <li>Quand l'acheteur confirme la réception, les fonds sont libérés.</li>
            <li>Guimatrix prélève une commission de 4% sur le prix de vente.</li>
            <li>Le solde net est viré sur votre numéro mobile money sous 24–48h.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
