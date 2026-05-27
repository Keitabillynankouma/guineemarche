import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listingsAPI, messagingAPI } from '../services/api'
import useAuthStore from '../store/authStore'

function formatPrice(price, type) {
    if (type === 'free') return 'Gratuit'
    return new Intl.NumberFormat('fr-GN').format(price) + ' GNF'
}

export default function ListingDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
    const [message, setMessage] = useState('')
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [activePhoto, setActivePhoto] = useState(0)

    const { data: listing, isLoading } = useQuery({
        queryKey: ['listing', id],
        queryFn: () => listingsAPI.getOne(id).then(r => r.data),
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
        good: 'Bon état', fair: 'État correct', poor: 'Très usé'
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Link to="/" className="text-green-700 font-bold text-lg">GuinéeMarché</Link>
                    <Link to="/" className="text-gray-500 text-sm hover:text-green-600">← Retour</Link>
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
                            <span>📍 {listing.city} {listing.quartier && `· ${listing.quartier}`}</span>
                            <span>👁 {listing.view_count} vues</span>
                        </div>
                    </div>
                </div>

                {/* Sidebar vendeur + contact */}
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

                    <div className="bg-white rounded-2xl shadow p-5">
                        <h2 className="font-semibold text-gray-700 mb-3">Contacter le vendeur</h2>
                        {sent ? (
                            <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm text-center">
                                ✅ Message envoyé ! Le vendeur vous répondra bientôt.
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
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg text-sm transition disabled:opacity-50"
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
        </div>
    )
}