import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listingsAPI, messagingAPI, ordersAPI } from '../services/api'
import useAuthStore from '../store/authStore'

function formatPrice(price, type) {
    if (type === 'free') return 'Gratuit'
    return new Intl.NumberFormat('fr-GN').format(price) + ' GNF'
}

const MEETING_ZONES = {
    Conakry:    ['Carrefour Kipé', 'Carrefour Bambéto', 'Carrefour Cosa', 'Marché Madina', 'Carrefour Hamdallaye', 'Marché Dixinn', 'Centre Commercial Kaloum', 'Carrefour Sonfonia'],
    Kankan:     ['Grand Marché Kankan', 'Carrefour Central Kankan'],
    Labé:       ['Grand Marché Labé', 'Carrefour Central Labé'],
    Kindia:     ['Grand Marché Kindia'],
    Faranah:    ['Grand Marché Faranah'],
    Nzérékoré: ['Grand Marché Nzérékoré'],
}

function OrderModal({ listing, onClose, onSuccess }) {
    const [step, setStep]           = useState(1)
    const [deliveryMode, setDeliveryMode] = useState('meeting_point')
    const [meetLocation, setMeetLocation] = useState('')
    const [pickupPoint, setPickupPoint]   = useState('')
    const [provider, setProvider]         = useState('orange_money')
    const [phone, setPhone]               = useState('')
    const [error, setError]               = useState('')
    const queryClient = useQueryClient()

    const { data: pickupPoints = [] } = useQuery({
        queryKey: ['pickup-points', listing.city],
        queryFn: () => ordersAPI.getPickupPoints(listing.city).then(r => r.data?.results || r.data || []),
        enabled: deliveryMode === 'pickup_point',
    })

    const createOrder = useMutation({
        mutationFn: (data) => ordersAPI.create(data),
        onError: (err) => setError(err.response?.data?.detail || 'Erreur lors de la commande.'),
    })

    const pay = useMutation({
        mutationFn: ({ id, data }) => ordersAPI.pay(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['listing', listing.id])
            onSuccess()
        },
        onError: (err) => setError(err.response?.data?.error || 'Erreur paiement.'),
    })

    const handleOrder = async (e) => {
        e.preventDefault()
        setError('')
        try {
            const orderData = {
                listing:       listing.id,
                delivery_mode: deliveryMode,
                meet_location: deliveryMode === 'meeting_point' ? meetLocation : '',
                pickup_point:  deliveryMode === 'pickup_point'  ? pickupPoint  : null,
            }
            const order = await createOrder.mutateAsync(orderData)
            await pay.mutateAsync({
                id:   order.data.id,
                data: { provider, phone_number: phone },
            })
        } catch { }
    }

    const zones = MEETING_ZONES[listing.city] || []

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="p-5 border-b flex items-center justify-between">
                    <h2 className="font-bold text-gray-800">Passer commande</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>

                <div className="p-5">
                    <div className="bg-gray-50 rounded-xl p-3 mb-5 flex items-center gap-3">
                        <div className="text-2xl">📦</div>
                        <div>
                            <p className="font-medium text-gray-800 text-sm">{listing.title}</p>
                            <p className="text-green-600 font-bold">{formatPrice(listing.price_gnf, listing.price_type)}</p>
                        </div>
                    </div>

                    {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

                    <form onSubmit={handleOrder} className="space-y-4">
                        {/* Mode de livraison */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Mode de livraison</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: 'meeting_point', label: 'Remise en main propre', icon: '🤝' },
                                    { value: 'pickup_point',  label: 'Point de retrait',      icon: '🏪' },
                                ].map(m => (
                                    <button
                                        key={m.value} type="button"
                                        onClick={() => setDeliveryMode(m.value)}
                                        className={`p-3 rounded-xl border-2 text-left transition ${deliveryMode === m.value ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                                    >
                                        <div className="text-xl mb-1">{m.icon}</div>
                                        <div className="text-xs font-medium text-gray-700">{m.label}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Zone de rencontre */}
                        {deliveryMode === 'meeting_point' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Zone de rencontre</label>
                                <select
                                    value={meetLocation}
                                    onChange={(e) => setMeetLocation(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                >
                                    <option value="">Choisir un lieu</option>
                                    {zones.map(z => <option key={z}>{z}</option>)}
                                </select>
                            </div>
                        )}

                        {/* Point de retrait */}
                        {deliveryMode === 'pickup_point' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Point de retrait</label>
                                {pickupPoints.length === 0 ? (
                                    <p className="text-sm text-gray-400 bg-gray-50 p-3 rounded-lg">
                                        Aucun point de retrait disponible à {listing.city} pour l'instant. Choisissez la remise en main propre.
                                    </p>
                                ) : (
                                    <select
                                        value={pickupPoint}
                                        onChange={(e) => setPickupPoint(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                        required
                                    >
                                        <option value="">Choisir un point</option>
                                        {pickupPoints.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} — {p.address}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        )}

                        {/* Paiement */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Paiement</label>
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                {[
                                    { value: 'orange_money', label: 'Orange Money', color: 'orange' },
                                    { value: 'mtn_momo',     label: 'MTN MoMo',    color: 'yellow' },
                                    { value: 'cash',         label: 'Espèces',     color: 'green'  },
                                ].map(p => (
                                    <button
                                        key={p.value} type="button"
                                        onClick={() => setProvider(p.value)}
                                        className={`p-2 rounded-xl border-2 text-xs font-medium transition ${provider === p.value ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            {provider !== 'cash' && (
                                <input
                                    type="tel" placeholder="+224 6XX XX XX XX"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                />
                            )}
                        </div>

                        {/* Info escrow */}
                        {provider !== 'cash' && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                                🔒 <strong>Paiement sécurisé :</strong> votre argent est conservé par GuinéeMarché et libéré au vendeur uniquement après votre confirmation de réception.
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={createOrder.isPending || pay.isPending || (deliveryMode === 'pickup_point' && !pickupPoint && pickupPoints.length > 0)}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
                        >
                            {(createOrder.isPending || pay.isPending) ? 'Traitement...' : `Payer ${formatPrice(listing.price_gnf, listing.price_type)}`}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default function ListingDetailPage() {
    const { id } = useParams()
    const navigate   = useNavigate()
    const isAuthenticated = useAuthStore(s => s.isAuthenticated)
    const user            = useAuthStore(s => s.user)
    const queryClient = useQueryClient()
    const [message, setMessage]       = useState('')
    const [sending, setSending]       = useState(false)
    const [sent, setSent]             = useState(false)
    const [activePhoto, setActivePhoto] = useState(0)
    const [showBuyModal, setShowBuyModal] = useState(false)
    const [orderDone, setOrderDone]   = useState(false)

    const { data: listing, isLoading } = useQuery({
        queryKey: ['listing', id],
        queryFn: () => listingsAPI.getOne(id).then(r => r.data),
    })

    const confirmReceipt = useMutation({
        mutationFn: (orderId) => ordersAPI.confirmReceipt(orderId),
        onSuccess: () => queryClient.invalidateQueries(['my-orders']),
    })

    const handleContact = async (e) => {
        e.preventDefault()
        if (!isAuthenticated) return navigate('/login')
        setSending(true)
        try {
            await messagingAPI.startConversation({ listing_id: id, message })
            setSent(true)
            setMessage('')
        } catch { }
        finally { setSending(false) }
    }

    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-green-600 text-lg">Chargement...</div>
        </div>
    )
    if (!listing) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-gray-500">Annonce introuvable</div>
        </div>
    )

    const CONDITION_LABELS = {
        new: 'Neuf', like_new: 'Comme neuf',
        good: 'Bon état', fair: 'État correct', poor: 'Très usé',
    }

    const isSeller = user?.id === listing.seller

    const shareOnWhatsApp = () => {
        const url  = encodeURIComponent(window.location.href)
        const text = encodeURIComponent(
            `🛒 *${listing.title}* — ${formatPrice(listing.price_gnf, listing.price_type)}\n📍 ${listing.city}\nVoir l'annonce sur GuinéeMarché :`
        )
        window.open(`https://wa.me/?text=${text}%20${url}`, '_blank')
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Link to="/" className="text-green-700 font-bold text-lg">GuinéeMarché</Link>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={shareOnWhatsApp}
                            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition"
                            title="Partager sur WhatsApp"
                        >
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            Partager
                        </button>
                        <Link to="/" className="text-gray-500 text-sm hover:text-green-600">← Retour</Link>
                    </div>
                </div>
            </nav>

            <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Photos + détails */}
                <div className="md:col-span-2 space-y-4">
                    <div className="bg-white rounded-2xl shadow overflow-hidden">
                        <div className="h-72 bg-gray-100">
                            {listing.media?.length > 0 ? (
                                <img
                                    src={listing.media[activePhoto]?.file}
                                    alt={listing.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-6xl">📦</div>
                            )}
                        </div>
                        {listing.media?.length > 1 && (
                            <div className="flex gap-2 p-3 overflow-x-auto">
                                {listing.media.map((m, i) => (
                                    <img
                                        key={m.id} src={m.file} alt=""
                                        onClick={() => setActivePhoto(i)}
                                        className={`h-16 w-16 object-cover rounded-lg cursor-pointer border-2 ${i === activePhoto ? 'border-green-500' : 'border-transparent'}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Attributs spécifiques à la catégorie */}
                    {listing.attributes && Object.keys(listing.attributes).length > 0 && (
                        <div className="bg-white rounded-2xl shadow p-5">
                            <h2 className="font-semibold text-gray-700 mb-3">Caractéristiques</h2>
                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(listing.attributes).map(([k, v]) => (
                                    <div key={k} className="bg-gray-50 rounded-xl p-3">
                                        <p className="text-xs text-gray-400 capitalize">{k.replace(/_/g, ' ')}</p>
                                        <p className="font-semibold text-gray-800 text-sm mt-0.5">{String(v)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-2xl shadow p-5">
                        <div className="flex items-start justify-between mb-3">
                            <h1 className="text-xl font-bold text-gray-800">{listing.title}</h1>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                {CONDITION_LABELS[listing.condition]}
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-green-600 mb-4">
                            {formatPrice(listing.price_gnf, listing.price_type)}
                            {listing.price_type === 'negotiable' && (
                                <span className="text-sm font-normal text-gray-400 ml-2">· Prix négociable</span>
                            )}
                        </p>
                        <p className="text-gray-600 leading-relaxed">{listing.description}</p>
                        <div className="flex gap-4 mt-4 text-sm text-gray-400">
                            <span>📍 {listing.city}{listing.quartier && ` · ${listing.quartier}`}</span>
                            <span>👁 {listing.view_count} vues</span>
                        </div>
                    </div>
                </div>

                {/* Sidebar vendeur + actions */}
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl shadow p-5">
                        <h2 className="font-semibold text-gray-700 mb-3">Vendeur</h2>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-xl">👤</div>
                            <div>
                                <p className="font-medium text-gray-800">{listing.seller_name}</p>
                                <p className="text-xs text-gray-400">{listing.seller_phone}</p>
                            </div>
                        </div>
                    </div>

                    {/* Bouton acheter */}
                    {!isSeller && listing.status === 'active' && (
                        <div className="bg-white rounded-2xl shadow p-5 space-y-3">
                            {orderDone ? (
                                <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm text-center">
                                    ✅ Commande passée ! Le vendeur va confirmer sous peu.
                                </div>
                            ) : (
                                <button
                                    onClick={() => isAuthenticated ? setShowBuyModal(true) : navigate('/login')}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition"
                                >
                                    Acheter maintenant
                                </button>
                            )}
                        </div>
                    )}

                    {/* Contact vendeur */}
                    <div className="bg-white rounded-2xl shadow p-5">
                        <h2 className="font-semibold text-gray-700 mb-3">Contacter le vendeur</h2>
                        {sent ? (
                            <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm text-center">
                                ✅ Message envoyé !
                            </div>
                        ) : (
                            <form onSubmit={handleContact} className="space-y-3">
                                <textarea
                                    rows={3}
                                    placeholder="Bonjour, est-ce encore disponible ?"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                />
                                <button
                                    type="submit" disabled={sending}
                                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg text-sm transition disabled:opacity-50"
                                >
                                    {sending ? 'Envoi...' : 'Envoyer un message'}
                                </button>
                                {!isAuthenticated && (
                                    <p className="text-xs text-center text-gray-400">
                                        <Link to="/login" className="text-green-600 underline">Connectez-vous</Link> pour contacter
                                    </p>
                                )}
                            </form>
                        )}
                    </div>
                </div>
            </div>

            {showBuyModal && (
                <OrderModal
                    listing={listing}
                    onClose={() => setShowBuyModal(false)}
                    onSuccess={() => { setShowBuyModal(false); setOrderDone(true) }}
                />
            )}
        </div>
    )
}
