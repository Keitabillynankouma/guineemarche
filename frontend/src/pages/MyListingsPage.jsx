import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { listingsAPI } from '../services/api'

function formatPrice(price, type) {
    if (type === 'free') return 'Gratuit'
    return new Intl.NumberFormat('fr-GN').format(price) + ' GNF'
}

const STATUS_LABELS = {
    active: { label: 'Active', color: 'bg-green-100 text-green-700' },
    draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-600' },
    sold: { label: 'Vendue', color: 'bg-blue-100 text-blue-700' },
    expired: { label: 'Expirée', color: 'bg-red-100 text-red-600' },
}

const STATUS_LABELS_EXTRA = {
    ...STATUS_LABELS,
    suspended: { label: 'Refusée', color: 'bg-red-100 text-red-700' },
    draft:     { label: 'En révision', color: 'bg-amber-100 text-amber-700' },
}

export default function MyListingsPage() {
    const queryClient = useQueryClient()
    const location    = useLocation()
    const moderationPending = location.state?.moderationPending
    const { data, isLoading } = useQuery({
        queryKey: ['my-listings'],
        queryFn: () => listingsAPI.myListings().then(r => r.data),
    })

    const deleteMutation = useMutation({
        mutationFn: (id) => listingsAPI.delete(id),
        onSuccess: () => queryClient.invalidateQueries(['my-listings']),
    })

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Link to="/" className="text-green-700 font-bold text-lg">GuinéeMarché</Link>
                    <Link to="/create" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                        + Publier
                    </Link>
                </div>
            </nav>

            <div className="max-w-3xl mx-auto px-4 py-8">
                <h1 className="text-xl font-bold text-gray-800 mb-6">Mes annonces</h1>

                {moderationPending && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                        <span className="text-2xl">⏳</span>
                        <div>
                            <p className="font-semibold text-amber-800 text-sm">Annonce en cours de vérification</p>
                            <p className="text-amber-700 text-xs mt-1">
                                Votre annonce est en attente de vérification par notre équipe. Elle sera publiée sous peu. En cas de problème, contactez le support.
                            </p>
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl h-24 animate-pulse" />
                        ))}
                    </div>
                ) : data?.results?.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <p className="text-5xl mb-4">📭</p>
                        <p className="mb-4">Vous n'avez pas encore d'annonces</p>
                        <Link to="/create" className="bg-green-600 text-white px-6 py-2 rounded-lg inline-block">
                            Publier ma première annonce
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {data?.results?.map(listing => {
                            const cover = listing.media?.find(m => m.is_cover) || listing.media?.[0]
                            const status = STATUS_LABELS_EXTRA[listing.status] || STATUS_LABELS_EXTRA.draft
                            return (
                                <div key={listing.id} className="bg-white rounded-xl shadow p-4 flex gap-4">
                                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                        {cover
                                            ? <img src={cover.file} alt="" className="w-full h-full object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-semibold text-gray-800 truncate">{listing.title}</h3>
                                            <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${status.color}`}>
                                                {status.label}
                                            </span>
                                        </div>
                                        <p className="text-green-600 font-bold mt-1">{formatPrice(listing.price_gnf, listing.price_type)}</p>
                                        <p className="text-xs text-gray-400 mt-1">👁 {listing.view_count} vues · 📍 {listing.city}</p>
                                    </div>
                                    <div className="flex flex-col gap-2 flex-shrink-0">
                                        <Link to={`/listings/${listing.id}`} className="text-xs text-blue-600 hover:underline">Voir</Link>
                                        <button
                                            onClick={() => deleteMutation.mutate(listing.id)}
                                            className="text-xs text-red-500 hover:underline"
                                        >
                                            Supprimer
                                        </button>
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