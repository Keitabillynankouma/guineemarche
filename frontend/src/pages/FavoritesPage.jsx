import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listingsAPI } from '../services/api'

function fmt(price, type) {
    if (type === 'free') return 'Gratuit'
    return new Intl.NumberFormat('fr-GN').format(price) + ' GNF'
}

export default function FavoritesPage() {
    const qc = useQueryClient()

    const { data, isLoading } = useQuery({
        queryKey: ['favorites'],
        queryFn: () => listingsAPI.getFavorites().then(r => r.data),
    })

    const removeMutation = useMutation({
        mutationFn: (id) => listingsAPI.removeFavorite(id),
        onSuccess: () => qc.invalidateQueries(['favorites']),
    })

    const favorites = Array.isArray(data) ? data : (data?.results ?? [])

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                    <Link to="/" className="text-green-700 font-bold text-lg">GuinéeMarché</Link>
                    <span className="text-gray-400">/</span>
                    <span className="text-gray-700 font-medium">Mes favoris</span>
                </div>
            </nav>

            <div className="max-w-3xl mx-auto px-4 py-8">
                <h1 className="text-xl font-bold text-gray-800 mb-6">❤️ Mes favoris</h1>

                {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl h-48 animate-pulse" />
                        ))}
                    </div>
                ) : favorites.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <p className="text-5xl mb-4">💔</p>
                        <p className="mb-4">Vous n'avez pas encore de favoris</p>
                        <Link to="/" className="bg-green-600 text-white px-6 py-2 rounded-lg inline-block text-sm font-medium">
                            Parcourir les annonces
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {favorites.map(fav => {
                            const listing = fav.listing
                            const cover = listing?.media?.find(m => m.is_cover) || listing?.media?.[0]
                            return (
                                <div key={fav.id} className="bg-white rounded-xl shadow overflow-hidden group relative">
                                    <Link to={`/listings/${listing.id}`}>
                                        <div className="h-36 bg-gray-100 overflow-hidden">
                                            {cover
                                                ? <img src={cover.file} alt={listing.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                : <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
                                            }
                                        </div>
                                        <div className="p-3">
                                            <p className="font-semibold text-gray-800 text-sm truncate">{listing.title}</p>
                                            <p className="text-green-600 font-bold text-sm mt-1">
                                                {fmt(listing.price_gnf, listing.price_type)}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                📍 {listing.city}
                                            </p>
                                        </div>
                                    </Link>
                                    <button
                                        onClick={() => removeMutation.mutate(fav.id)}
                                        className="absolute top-2 right-2 bg-white/90 hover:bg-red-50 text-red-500 rounded-full w-8 h-8 flex items-center justify-center text-sm shadow transition"
                                        title="Retirer des favoris"
                                    >
                                        ❤️
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
