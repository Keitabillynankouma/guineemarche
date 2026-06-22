import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersAPI } from '../services/api'

const STATUS_STEPS = ['pending', 'confirmed', 'completed']
const STATUS = {
    pending:   { label: 'En attente',  color: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
    confirmed: { label: 'Confirmée',   color: 'bg-blue-100 text-blue-700',     icon: '✅' },
    completed: { label: 'Terminée',    color: 'bg-green-100 text-green-700',   icon: '🎉' },
    cancelled: { label: 'Annulée',     color: 'bg-gray-100 text-gray-500',     icon: '❌' },
    disputed:  { label: 'Litige',      color: 'bg-red-100 text-red-600',       icon: '⚠️' },
}
const DELIVERY = {
    meeting_point: '🤝 Main propre',
    pickup_point:  '📦 Point retrait',
    home_delivery: '🚗 Livraison domicile',
}
function fmt(n) { return new Intl.NumberFormat('fr-GN').format(n) + ' GNF' }

// ── Countdown escrow ─────────────────────────────────────────────────────────
function EscrowCountdown({ releaseAt, adminHold }) {
    const [now, setNow] = useState(() => Date.now())
    useState(() => {
        const t = setInterval(() => setNow(Date.now()), 60_000)
        return () => clearInterval(t)
    }, [])
    if (adminHold) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-center gap-2">
                🔒 <span>Fonds bloqués par l'administration — en cours de vérification.</span>
            </div>
        )
    }
    if (!releaseAt) return null
    const diffMs   = new Date(releaseAt) - now
    const released = diffMs <= 0
    if (released) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700 flex items-center gap-2">
                ✅ <span>Fonds disponibles — libération en cours de traitement.</span>
            </div>
        )
    }
    const totalH = Math.ceil(diffMs / 3_600_000)
    const h      = Math.floor(diffMs / 3_600_000)
    const m      = Math.floor((diffMs % 3_600_000) / 60_000)
    return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2">
            ⏳ <span>Fonds disponibles dans <strong>{h > 0 ? `${h}h ${m}min` : `${m} min`}</strong> (protection Orange Money).</span>
        </div>
    )
}

// ── Timeline ────────────────────────────────────────────────────────────────
function Timeline({ status }) {
    const idx = STATUS_STEPS.indexOf(status)
    if (idx < 0) return null   // annulé ou litige : pas de timeline
    return (
        <div className="flex items-center gap-0 mt-3">
            {STATUS_STEPS.map((step, i) => {
                const done    = i <= idx
                const current = i === idx
                const last    = i === STATUS_STEPS.length - 1
                return (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                        <div className={`flex flex-col items-center ${!last ? 'flex-1' : ''}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition
                                ${done
                                    ? current
                                        ? 'bg-green-600 border-green-600 text-white shadow-md'
                                        : 'bg-green-500 border-green-500 text-white'
                                    : 'bg-white border-gray-300 text-gray-400'
                                }`}>
                                {done ? (current ? STATUS[step].icon : '✓') : i + 1}
                            </div>
                            <p className={`text-xs mt-1 text-center leading-tight max-w-[56px]
                                ${done ? (current ? 'text-green-700 font-semibold' : 'text-green-600') : 'text-gray-400'}`}>
                                {STATUS[step].label}
                            </p>
                        </div>
                        {!last && (
                            <div className={`h-0.5 flex-1 mx-1 -mt-4 transition ${i < idx ? 'bg-green-500' : 'bg-gray-200'}`} />
                        )}
                    </div>
                )
            })}
        </div>
    )
}

// ── Modal info escrow (affiché une seule fois avant le 1er paiement OM) ───────
function EscrowInfoModal({ onConfirm }) {
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
                <div className="text-center text-4xl">🔒</div>
                <h2 className="font-bold text-gray-900 text-center">Protection escrow</h2>
                <p className="text-sm text-gray-600 text-center">
                    Pour vous protéger des annulations Orange Money, vos fonds sont
                    temporairement retenus et libérés automatiquement au vendeur :
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <div className="font-bold text-blue-800 text-lg">6h</div>
                        <div className="text-xs text-blue-600">Moins de 500 000 GNF</div>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-3 text-center">
                        <div className="font-bold text-purple-800 text-lg">48h</div>
                        <div className="text-xs text-purple-600">500 000 GNF et plus</div>
                    </div>
                </div>
                <p className="text-xs text-gray-500 text-center">
                    Vous pouvez aussi libérer les fonds immédiatement en confirmant
                    la réception de l'article.
                </p>
                <button
                    onClick={onConfirm}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition"
                >
                    J'ai compris — continuer
                </button>
                <a href="/terms#refund" target="_blank"
                    className="block text-center text-xs text-green-600 hover:underline">
                    En savoir plus sur les remboursements →
                </a>
            </div>
        </div>
    )
}

// ── Modal paiement ──────────────────────────────────────────────────────────
function PayModal({ order, onClose, onPaid }) {
    const [provider, setProvider] = useState('orange_money')
    const [phone, setPhone]       = useState('')
    const [error, setError]       = useState('')
    const [loading, setLoading]   = useState(false)
    const [showEscrowInfo, setShowEscrowInfo] = useState(false)
    const [escrowAcknowledged, setEscrowAcknowledged] = useState(
        () => localStorage.getItem('gm_escrow_acknowledged') === '1'
    )

    const handlePay = async () => {
        if (provider !== 'cash' && !phone.trim()) {
            setError('Entrez votre numéro Mobile Money.')
            return
        }
        setError('')
        setLoading(true)
        try {
            await ordersAPI.pay(order.id, { provider, phone_number: phone })
            onPaid()
            onClose()
        } catch (e) {
            setError(e.response?.data?.error || e.response?.data?.detail || 'Erreur de paiement')
        } finally { setLoading(false) }
    }

    // Montrer le modal escrow si Orange Money + jamais vu
    const handlePayClick = () => {
        if (provider === 'orange_money' && !escrowAcknowledged) {
            setShowEscrowInfo(true)
        } else {
            handlePay()
        }
    }

    return (
        <>
        {showEscrowInfo && (
            <EscrowInfoModal onConfirm={() => {
                localStorage.setItem('gm_escrow_acknowledged', '1')
                setEscrowAcknowledged(true)
                setShowEscrowInfo(false)
                handlePay()
            }} />
        )}
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end md:items-center justify-center p-4"
            onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4"
                onClick={e => e.stopPropagation()}>
                <h2 className="font-bold text-gray-800 text-lg">💳 Payer la commande</h2>
                <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                    <p className="font-medium text-gray-700">{order.listing_title}</p>
                    <p className="font-bold text-green-700 text-base">{fmt(order.amount_gnf)}</p>
                </div>

                <div className="space-y-2">
                    {[
                        { value: 'orange_money', label: 'Orange Money', emoji: '🟠' },
                        { value: 'cash',         label: 'Espèces (en main)', emoji: '💵' },
                    ].map(opt => (
                        <button key={opt.value} onClick={() => setProvider(opt.value)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition text-sm
                                ${provider === opt.value ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            <span className="text-xl">{opt.emoji}</span>
                            <span className={`font-medium ${provider === opt.value ? 'text-green-700' : 'text-gray-700'}`}>
                                {opt.label}
                            </span>
                            {provider === opt.value && <span className="ml-auto text-green-600">✓</span>}
                        </button>
                    ))}
                </div>

                {provider !== 'cash' && (
                    <input
                        type="tel" placeholder="224 6XX XXX XXX"
                        value={phone} onChange={e => setPhone(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                )}
                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition">
                        Annuler
                    </button>
                    <button onClick={handlePayClick} disabled={loading}
                        className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition disabled:opacity-50">
                        {loading ? 'Traitement...' : `Payer ${fmt(order.amount_gnf)}`}
                    </button>
                </div>
            </div>
        </div>
        </>
    )
}

// ── Carte commande ──────────────────────────────────────────────────────────
function OrderCard({ order, isBuyer, onInvalidate }) {
    const qc = useQueryClient()
    const [payOpen, setPayOpen] = useState(false)
    const st = STATUS[order.status] || STATUS.pending

    const confirmMutation = useMutation({
        mutationFn: () => ordersAPI.confirmReceipt(order.id),
        onSuccess:  onInvalidate,
    })
    const disputeMutation = useMutation({
        mutationFn: () => ordersAPI.dispute(order.id),
        onSuccess:  onInvalidate,
    })

    const canPay     = isBuyer && order.status === 'pending' && !order.payments?.length
    const canConfirm = isBuyer && order.status === 'confirmed'
    const canDispute = isBuyer && ['pending', 'confirmed'].includes(order.status)

    return (
        <>
            <div className="bg-white rounded-2xl shadow-card border border-gray-50 p-4 space-y-3">

                {/* En-tête */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{order.listing_title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {isBuyer ? `Vendeur : ${order.seller_name}` : `Acheteur : ${order.buyer_name}`}
                        </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${st.color}`}>
                        {st.icon} {st.label}
                    </span>
                </div>

                {/* Timeline */}
                <Timeline status={order.status} />

                {/* Infos */}
                <div className="flex items-center justify-between text-sm pt-1">
                    <span className="text-gray-500">{DELIVERY[order.delivery_mode] || order.delivery_mode}</span>
                    <span className="font-bold text-green-700">{fmt(order.amount_gnf)}</span>
                </div>

                {/* Point retrait / lieu */}
                {(order.pickup_point_detail?.name || order.meet_location) && (
                    <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                        📍 {order.pickup_point_detail?.name || order.meet_location}
                    </p>
                )}

                {/* Countdown escrow côté vendeur */}
                {!isBuyer && order.escrow_status === 'held' && (
                    <EscrowCountdown
                        releaseAt={order.escrow_release_at}
                        adminHold={order.escrow_admin_hold}
                    />
                )}

                {/* Commission côté vendeur */}
                {!isBuyer && order.status === 'completed' && order.seller_payout_gnf > 0 && (
                    <div className="bg-green-50 rounded-xl p-3 text-xs text-green-700 space-y-1">
                        <div className="flex justify-between"><span>Montant total</span><span>{fmt(order.amount_gnf)}</span></div>
                        <div className="flex justify-between text-gray-500"><span>Commission plateforme</span><span>- {fmt(order.commission_gnf)}</span></div>
                        <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Votre gain net</span><span>{fmt(order.seller_payout_gnf)}</span></div>
                    </div>
                )}

                {/* Paiements existants */}
                {order.payments?.length > 0 && (
                    <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 space-y-1">
                        {order.payments.map(p => (
                            <div key={p.id} className="flex justify-between">
                                <span>{p.provider === 'orange_money' ? '🟠 Orange Money' : '💵 Espèces'}</span>
                                <span className={p.status === 'paid' ? 'text-green-600 font-medium' : 'text-yellow-600'}>
                                    {p.status === 'paid' ? '✓ Payé' : p.status === 'pending' ? '⏳ En attente' : p.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1 flex-wrap">
                    {canPay && (
                        <button onClick={() => setPayOpen(true)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl transition">
                            💳 Payer maintenant
                        </button>
                    )}
                    {canConfirm && (
                        <button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 rounded-xl transition disabled:opacity-50">
                            ✅ Confirmer la réception
                        </button>
                    )}
                    {canDispute && (
                        <button onClick={() => disputeMutation.mutate()} disabled={disputeMutation.isPending}
                            className="px-4 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium py-2.5 rounded-xl transition disabled:opacity-50">
                            ⚠️ Litige
                        </button>
                    )}
                    <Link to={`/listings/${order.listing}`}
                        className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm py-2.5 rounded-xl transition text-center">
                        Voir annonce
                    </Link>
                </div>

                <p className="text-xs text-gray-400">
                    {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
            </div>

            {payOpen && (
                <PayModal
                    order={order}
                    onClose={() => setPayOpen(false)}
                    onPaid={onInvalidate}
                />
            )}
        </>
    )
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function OrdersPage() {
    const qc     = useQueryClient()
    const [active, setActive] = useState('buyer')

    const { data: buyerData, isLoading: buyerLoading } = useQuery({
        queryKey: ['orders-buyer'],
        queryFn:  () => ordersAPI.getAll().then(r => r.data),
    })
    const { data: sellerData, isLoading: sellerLoading } = useQuery({
        queryKey: ['orders-seller'],
        queryFn:  () => ordersAPI.getSeller().then(r => r.data),
    })

    const isLoading = active === 'buyer' ? buyerLoading : sellerLoading
    const rawData   = active === 'buyer' ? buyerData    : sellerData
    const orders    = Array.isArray(rawData) ? rawData : (rawData?.results ?? [])

    const invalidate = () => {
        qc.invalidateQueries(['orders-buyer'])
        qc.invalidateQueries(['orders-seller'])
    }

    const pendingCount = orders.filter(o => o.status === 'pending').length

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <nav className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
                    <Link to="/profile" className="text-green-700 font-bold text-lg">←</Link>
                    <h1 className="font-bold text-gray-800">Mes commandes</h1>
                    {pendingCount > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                            {pendingCount}
                        </span>
                    )}
                </div>
            </nav>

            <div className="max-w-2xl mx-auto px-4 py-6">
                {/* Tabs */}
                <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
                    {[['buyer', '🛍️ Mes achats'], ['seller', '🏪 Mes ventes']].map(([key, label]) => (
                        <button key={key} onClick={() => setActive(key)}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                                active === key ? 'bg-white shadow text-green-700' : 'text-gray-400 hover:text-gray-600'
                            }`}>
                            {label}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl h-44 animate-pulse" />
                        ))}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <p className="text-6xl mb-4">📭</p>
                        <p>Aucune commande pour le moment</p>
                        <Link to="/" className="mt-4 inline-block text-green-600 text-sm font-medium">
                            Parcourir les annonces →
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {orders.map(order => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                isBuyer={active === 'buyer'}
                                onInvalidate={invalidate}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
