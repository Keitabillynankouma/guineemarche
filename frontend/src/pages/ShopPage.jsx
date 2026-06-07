import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { shopsAPI, listingsAPI } from '../services/api'

function fmt(price, type) {
    if (type === 'free') return 'Gratuit'
    return new Intl.NumberFormat('fr-GN').format(price) + ' GNF'
}

export default function ShopPage() {
    const { id } = useParams()

    const { data: shop, isLoading: shopLoading } = useQuery({
        queryKey: ['shop', id],
        queryFn: () => shopsAPI.getOne(id).then(r => r.data),
    })

    const { data: listingsData, isLoading: listingsLoading } = useQuery({
        queryKey: ['shop-listings', shop?.owner],
        queryFn: () => listingsAPI.getAll({ seller: shop.owner }).then(r => r.data),
        enabled: !!shop?.owner,
    })
    const listings = Array.isArray(listingsData) ? listingsData : (listingsData?.results || [])

    if (shopLoading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-green-600">Chargement...</div>
        </div>
    )
    if (!shop) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-gray-500">Boutique introuvable</div>
        </div>
    )

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
                    <Link to="/" className="text-green-700 font-bold text-lg">←</Link>
                    <span className="font-bold text-gray-800">{shop.name}</span>
                    {shop.is_verified && <span className="text-green-600 text-sm">✅ Vérifiée</span>}
                </div>
            </nav>

            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* En-tête boutique */}
                <div className="bg-white rounded-2xl shadow p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-20 h-20 rounded-2xl bg-green-50 border-2 border-green-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                            {shop.logo_url
                                ? <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
                                : <span className="text-4xl">🏪</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl font-bold text-gray-800">{shop.name}</h1>
                            <p className="text-sm text-gray-500 mt-0.5">📍 {shop.city}{shop.address && ` · ${shop.address}`}</p>
                            {shop.phone && <p className="text-sm text-gray-500">📞 {shop.phone}</p>}
                            {shop.website && (
                                <a href={shop.website} target="_blank" rel="noopener noreferrer"
                                    className="text-sm text-green-600 hover:underline">🌐 {shop.website}</a>
                            )}
                            {shop.description && (
                                <p className="text-sm text-gray-600 mt-2">{shop.description}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-4 mt-4 pt-4 border-t text-sm">
                        <div className="text-center">
                            <p className="font-bold text-gray-800">{shop.listing_count}</p>
                            <p className="text-gray-400">Annonces</p>
                        </div>
                    </div>
                </div>

                {/* Annonces de la boutique */}
                <div>
                    <h2 className="font-semibold text-gray-700 mb-3">Annonces de {shop.name}</h2>
                    {listingsLoading ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {[...Array(6)].map((_, i) => <div key={i} className="bg-white rounded-xl h-48 animate-pulse" />)}
                        </div>
                    ) : listings.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <p className="text-4xl mb-2">📭</p>
                            <p className="text-sm">Aucune annonce pour le moment</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {listings.map(l => {
                                const cover = l.media?.find(m => m.is_cover) || l.media?.[0]
                                return (
                                    <Link key={l.id} to={`/listings/${l.id}`}
                                        className="bg-white rounded-xl shadow overflow-hidden hover:shadow-md transition group">
                                        <div className="h-36 bg-gray-100 overflow-hidden">
                                            {cover
                                                ? <img src={cover.file} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                : <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>}
                                        </div>
                                        <div className="p-3">
                                            <p className="font-semibold text-sm text-gray-800 truncate">{l.title}</p>
                                            <p className="text-green-600 font-bold text-sm mt-1">{fmt(l.price_gnf, l.price_type)}</p>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
