import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersAPI, reviewsAPI } from '../services/api'
import Logo from '../components/Logo'

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
    useEffect(() => {
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
const PROVIDERS = [
    {
        value: 'chachap',
        label: 'ChaChap Pay',
        emoji: '🔐',
        desc: 'Orange Money · MTN · PayCard · Kulu · Soutra Money',
        badge: 'Recommandé',
    },
    { value: 'cash', label: 'Espèces (remise en main)', emoji: '💵', desc: 'Paiement à la livraison / en personne' },
]

function PayModal({ order, onClose, onPaid }) {
    const [provider, setProvider] = useState('chachap')
    const [error, setError]       = useState('')
    const [loading, setLoading]   = useState(false)
    const [showEscrowInfo, setShowEscrowInfo] = useState(false)
    const [escrowAcknowledged, setEscrowAcknowledged] = useState(
        () => localStorage.getItem('gm_escrow_acknowledged') === '1'
    )

    const handlePay = async () => {
        setError('')
        setLoading(true)
        try {
            const res = await ordersAPI.pay(order.id, { provider })

            // ChaChap Pay → redirection vers page hébergée
            if (res.data?.chachap && res.data?.payment_url) {
                window.location.href = res.data.payment_url
                return
            }

            onPaid()
            onClose()
        } catch (e) {
            setError(e.response?.data?.error || e.response?.data?.detail || 'Erreur de paiement')
            setLoading(false)
        }
    }

    const handlePayClick = () => {
        if (provider === 'chachap' && !escrowAcknowledged) {
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
                <h2 className="font-bold text-gray-800 text-lg">Choisir le mode de paiement</h2>
                <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                    <p className="font-medium text-gray-700">{order.listing_title}</p>
                    <p className="font-bold text-green-700 text-base">{fmt(order.amount_gnf)}</p>
                </div>

                <div className="space-y-2">
                    {PROVIDERS.map(opt => (
                        <button key={opt.value} onClick={() => setProvider(opt.value)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition text-sm
                                ${provider === opt.value ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            <span className="text-xl">{opt.emoji}</span>
                            <div className="text-left flex-1">
                                <div className={`font-medium ${provider === opt.value ? 'text-green-700' : 'text-gray-700'}`}>
                                    {opt.label}
                                    {opt.badge && (
                                        <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                                            {opt.badge}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-gray-400">{opt.desc}</div>
                            </div>
                            {provider === opt.value && <span className="text-green-600">✓</span>}
                        </button>
                    ))}
                </div>

                {provider === 'chachap' && (
                    <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                        <p className="font-medium">🔐 Paiement sécurisé agréé BCRG</p>
                        <p>Vous serez redirigé vers ChaChap Pay pour choisir votre moyen de paiement (Orange Money, MTN, carte Visa…). Votre commande se confirme automatiquement à la réception.</p>
                    </div>
                )}

                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition">
                        Annuler
                    </button>
                    <button onClick={handlePayClick} disabled={loading}
                        className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition disabled:opacity-50">
                        {loading ? 'Traitement...' : provider === 'chachap' ? `🔐 Payer ${fmt(order.amount_gnf)}` : '💵 Confirmer (espèces)'}
                    </button>
                </div>
            </div>
        </div>
        </>
    )
}

// ── Modal notation ──────────────────────────────────────────────────────────
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
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400/30"
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition">
                        Annuler
                    </button>
                    <button onClick={submit} disabled={loading || !rating}
                        className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition disabled:opacity-50">
                        {loading ? '…' : 'Envoyer'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Bloc tracking livreur (acheteur) ────────────────────────────────────────
function DeliveryTracker({ orderId }) {
    const [tracking, setTracking] = useState(null)
    const intervalRef = useRef(null)

    async function fetchTracking() {
        try {
            const res = await ordersAPI.trackDelivery(orderId)
            setTracking(res.data)
        } catch { /* silencieux si non disponible */ }
    }

    useEffect(() => {
        fetchTracking()
        intervalRef.current = setInterval(fetchTracking, 10_000)
        return () => clearInterval(intervalRef.current)
    }, [orderId])

    if (!tracking) return null

    const pos = tracking.current_position
    const hasPos = pos?.lat && pos?.lng

    const osmUrl = hasPos
        ? `https://www.openstreetmap.org/export/embed.html?bbox=${pos.lng - 0.02},${pos.lat - 0.02},${pos.lng + 0.02},${pos.lat + 0.02}&layer=mapnik&marker=${pos.lat},${pos.lng}`
        : null

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                    <span className="text-xs font-semibold text-blue-800">
                        🚗 {tracking.livreur} — en route vers vous
                    </span>
                </div>
                {pos?.updated_at && (
                    <span className="text-xs text-blue-400">
                        {new Date(pos.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>
            {hasPos ? (
                <iframe
                    title="Position livreur"
                    width="100%"
                    height="180"
                    src={osmUrl}
                    frameBorder="0"
                    className="block"
                    style={{ pointerEvents: 'none' }}
                />
            ) : (
                <div className="px-3 pb-3 text-xs text-blue-600">
                    📍 Position en cours de chargement…
                </div>
            )}
            {tracking.livreur_phone && (
                <div className="px-3 py-2 border-t border-blue-200 text-xs text-blue-700">
                    📞 <a href={`tel:${tracking.livreur_phone}`} className="underline font-medium">
                        Appeler le livreur
                    </a>
                </div>
            )}
        </div>
    )
}

// ── Carte commande ──────────────────────────────────────────────────────────
function OrderCard({ order, isBuyer, onInvalidate }) {
    const [payOpen, setPayOpen]           = useState(false)
    const [ratingModal, setRatingModal]   = useState(null)   // { id, name, label }
    const [rated, setRated]               = useState({})     // { [revieweeId]: true }
    const [showReturn, setShowReturn]     = useState(false)
    const [returnReason, setReturnReason] = useState('')
    const [returnDesc, setReturnDesc]     = useState('')
    const [returnDone, setReturnDone]     = useState(!!order.return_request)
    const st  = STATUS[order.status] || STATUS.pending
    const da  = order.delivery_assignment_detail           // assignment (home_delivery)

    const confirmMutation = useMutation({
        mutationFn: () => ordersAPI.confirmReceipt(order.id),
        onSuccess:  onInvalidate,
    })
    const sellerConfirmMutation = useMutation({
        mutationFn: () => ordersAPI.updateStatus(order.id, 'confirm'),
        onSuccess:  onInvalidate,
    })
    const disputeMutation = useMutation({
        mutationFn: () => ordersAPI.dispute(order.id),
        onSuccess:  onInvalidate,
    })
    const returnMutation = useMutation({
        mutationFn: () => ordersAPI.createReturn(order.id, { reason: returnReason, description: returnDesc }),
        onSuccess:  () => { setReturnDone(true); setShowReturn(false); onInvalidate() },
    })

    const canPay           = isBuyer  && order.status === 'pending'   && !order.payments?.length
    const canConfirm       = isBuyer  && order.status === 'confirmed'
    const canDispute       = isBuyer  && ['pending', 'confirmed'].includes(order.status)
    const canReturn        = isBuyer  && order.status === 'completed' && !returnDone
    const canSellerConfirm = !isBuyer && order.status === 'pending'

    // Notation : disponible seulement si commande terminée
    const isCompleted  = order.status === 'completed'
    const hasLivreur   = !!da?.livreur_name
    const livreurId    = da?.livreur_id    // absent pour l'instant — voir note ci-dessous

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

                {/* Point retrait / lieu / adresse domicile */}
                {(order.pickup_point_detail?.name || order.meet_location) && (
                    <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                        📍 {order.pickup_point_detail?.name || order.meet_location}
                    </p>
                )}
                {order.delivery_mode === 'home_delivery' && order.delivery_address && (
                    <div className="text-xs bg-green-50 border border-green-100 px-3 py-2 rounded-lg text-green-800 space-y-0.5">
                        <p className="font-semibold">🚗 Livraison à domicile</p>
                        <p className="text-green-700">{order.delivery_address}</p>
                        {order.delivery_fee_gnf > 0 && (
                            <p className="text-green-600">Frais : {new Intl.NumberFormat('fr-GN').format(order.delivery_fee_gnf)} GNF</p>
                        )}
                    </div>
                )}

                {/* Codes de livraison — affichés seulement si un livreur est assigné */}
                {da && order.delivery_mode === 'home_delivery' && (
                    <div className="space-y-2">
                        {/* Vendeur : code que le livreur doit lui montrer */}
                        {!isBuyer && da.pickup_code && da.status !== 'delivered' && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1">
                                <p className="font-bold text-amber-800">🔑 Code de retrait livreur</p>
                                <p className="text-2xl font-black tracking-[0.2em] text-amber-900 text-center py-1">{da.pickup_code}</p>
                                <p className="text-amber-700">Le livreur vous montrera ce code — vérifiez-le avant de lui remettre le colis.</p>
                            </div>
                        )}
                        {/* Acheteur : code qu'il doit donner au livreur */}
                        {isBuyer && da.verification_code && da.status !== 'delivered' && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs space-y-1">
                                <p className="font-bold text-blue-800">🔐 Votre code de réception</p>
                                <p className="text-2xl font-black tracking-[0.2em] text-blue-900 text-center py-1">{da.verification_code}</p>
                                <p className="text-blue-700">Donnez ce code au livreur UNIQUEMENT quand vous recevez votre colis.</p>
                            </div>
                        )}
                        {/* Nom du livreur si assigné */}
                        {da.livreur_name && (
                            <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                                🚗 Livreur : <span className="font-semibold text-gray-700">{da.livreur_name}</span>
                                {da.livreur_phone && ` · ${da.livreur_phone}`}
                            </p>
                        )}
                        {/* Carte tracking temps réel — acheteur uniquement, quand en route */}
                        {isBuyer && da.status === 'en_route' && (
                            <DeliveryTracker orderId={order.id} />
                        )}
                    </div>
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
                                <span>{
                                    p.provider === 'orange_money' ? '🟠 Orange Money' :
                                    p.provider === 'mtn_momo'     ? '🟡 MTN MoMo' :
                                    p.provider === 'card'         ? '💳 Carte Visa (Paycard)' :
                                    '💵 Espèces'
                                }</span>
                                <span className={p.status === 'paid' ? 'text-green-600 font-medium' : 'text-yellow-600'}>
                                    {p.status === 'paid' ? '✓ Payé' : p.status === 'pending' ? '⏳ En attente' : p.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1 flex-wrap">
                    {/* Vendeur : confirmer une commande en espèces */}
                    {canSellerConfirm && (
                        <button onClick={() => {
                            if (window.confirm('Confirmez-vous avoir reçu le paiement pour cette commande ?')) {
                                sellerConfirmMutation.mutate()
                            }
                        }} disabled={sellerConfirmMutation.isPending}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50">
                            ✅ Confirmer la commande
                        </button>
                    )}
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
                    {canReturn && (
                        <button onClick={() => setShowReturn(true)}
                            className="px-4 bg-orange-50 hover:bg-orange-100 text-orange-600 text-sm font-medium py-2.5 rounded-xl transition border border-orange-200">
                            ↩️ Retour
                        </button>
                    )}
                    {returnDone && order.return_request && (
                        <span className={`px-3 py-2 rounded-xl text-xs font-medium border ${
                            order.return_request.status === 'approved'  ? 'bg-green-50 text-green-700 border-green-200' :
                            order.return_request.status === 'rejected'  ? 'bg-red-50 text-red-700 border-red-200' :
                            order.return_request.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-orange-50 text-orange-700 border-orange-200'
                        }`}>
                            ↩️ {
                                order.return_request.status === 'approved'  ? 'Retour approuvé' :
                                order.return_request.status === 'rejected'  ? 'Retour refusé' :
                                order.return_request.status === 'completed' ? 'Retour effectué' :
                                'Retour en attente'
                            }
                        </span>
                    )}
                    <Link to={`/listings/${order.listing}`}
                        className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm py-2.5 rounded-xl transition text-center">
                        Voir annonce
                    </Link>
                </div>

                {/* ── Notation (commande terminée) ── */}
                {isCompleted && (
                    <div className="border-t pt-3 space-y-2">
                        <p className="text-xs text-gray-400 font-medium">Laisser un avis :</p>
                        <div className="flex gap-2 flex-wrap">
                            {/* Acheteur note le vendeur */}
                            {isBuyer && !rated[order.seller] && (
                                <button
                                    onClick={() => setRatingModal({ id: order.seller, name: order.seller_name, label: 'le vendeur' })}
                                    className="flex-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold py-2 px-3 rounded-xl border border-amber-200 transition">
                                    ⭐ Vendeur
                                </button>
                            )}
                            {/* Vendeur note l'acheteur */}
                            {!isBuyer && !rated[order.buyer] && (
                                <button
                                    onClick={() => setRatingModal({ id: order.buyer, name: order.buyer_name, label: "l'acheteur" })}
                                    className="flex-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold py-2 px-3 rounded-xl border border-amber-200 transition">
                                    ⭐ Acheteur
                                </button>
                            )}
                            {/* Acheteur ou vendeur note le livreur */}
                            {hasLivreur && da?.livreur_id && !rated[da.livreur_id] && (
                                <button
                                    onClick={() => setRatingModal({ id: da.livreur_id, name: da.livreur_name, label: 'le livreur' })}
                                    className="flex-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2 px-3 rounded-xl border border-blue-200 transition">
                                    ⭐ Livreur
                                </button>
                            )}
                        </div>
                    </div>
                )}

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

            {ratingModal && (
                <RatingModal
                    orderId={order.id}
                    revieweeId={ratingModal.id}
                    revieweeName={ratingModal.name}
                    label={ratingModal.label}
                    onClose={() => setRatingModal(null)}
                    onDone={() => {
                        setRated(p => ({ ...p, [ratingModal.id]: true }))
                        setRatingModal(null)
                        onInvalidate()
                    }}
                />
            )}

            {showReturn && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <h3 className="text-lg font-bold text-gray-800">↩️ Demander un retour</h3>
                        <p className="text-sm text-gray-500">Commande : <span className="font-medium text-gray-700">{order.listing_title}</span></p>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Motif *</label>
                            <select
                                value={returnReason}
                                onChange={e => setReturnReason(e.target.value)}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                            >
                                <option value="">— Choisir un motif —</option>
                                <option value="defective">Article défectueux</option>
                                <option value="not_as_described">Ne correspond pas à la description</option>
                                <option value="wrong_item">Mauvais article reçu</option>
                                <option value="changed_mind">Changement d&apos;avis</option>
                                <option value="other">Autre</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optionnel)</label>
                            <textarea
                                value={returnDesc}
                                onChange={e => setReturnDesc(e.target.value)}
                                rows={3}
                                placeholder="Décrivez le problème..."
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                            />
                        </div>

                        {returnMutation.isError && (
                            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                                {returnMutation.error?.response?.data?.error || 'Une erreur est survenue.'}
                            </p>
                        )}

                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={() => { setShowReturn(false); setReturnReason(''); setReturnDesc('') }}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
                                Annuler
                            </button>
                            <button
                                onClick={() => returnMutation.mutate()}
                                disabled={!returnReason || returnMutation.isPending}
                                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition disabled:opacity-50">
                                {returnMutation.isPending ? 'Envoi…' : 'Envoyer la demande'}
                            </button>
                        </div>
                    </div>
                </div>
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
                    <Logo back />
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
