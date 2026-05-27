import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { listingsAPI } from '../services/api'
import useAuthStore from '../store/authStore'

function formatPrice(price, type) {
    if (type === 'free') return 'Gratuit'
    return new Intl.NumberFormat('fr-GN').format(price) + ' GNF'
}

function ListingCard({ listing }) {
    const cover = listing.media?.find(m => m.is_cover) || listing.media?.[0]
    return (
        <Link to={`/listings/${listing.id}`} className="bg-white rounded-xl shadow hover:shadow-md transition overflow-hidden">
            <div className="h-48 bg-gray-100 overflow-hidden">
                {cover
                    ? <img src={cover.file} alt={listing.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">📦</div>
                }
            </div>
            <div className="p-3">
                <h3 className="font-semibold text-gray-800 truncate">{listing.title}</h3>
                <p className="text-green-600 font-bold mt-1">{formatPrice(listing.price_gnf, listing.price_type)}</p>
                <p className="text-xs text-gray-400 mt-1">📍 {listing.city} {listing.quartier && `· ${listing.quartier}`}</p>
            </div>
        </Link>
    )
}

export default function HomePage() {
    const [search, setSearch] = useState('')
    const [city, setCity] = useState('')
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
    const navigate = useNavigate()

    const { data, isLoading } = useQuery({
        queryKey: ['listings', search, city],
        queryFn: () => listingsAPI.getAll({ search, city }).then(r => r.data),
    })

    const VILLES = ['', 'Conakry', 'Kankan', 'Labé', 'Kindia', 'Faranah', 'Nzérékoré']

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navbar */}
            <nav className="bg-white shadow sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Link to="/" className="text-xl font-bold text-green-700">GuinéeMarché</Link>
                    <div className="flex gap-2">
                        {isAuthenticated ? (
                            <>
                                <Link to="/create" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                                    + Publier
                                </Link>
                                <Link to="/messages" className="text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-100">💬</Link>
                                <Link to="/profile" className="text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-100">👤</Link>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-100">Connexion</Link>
                                <Link to="/register" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">S'inscrire</Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <div className="bg-green-700 text-white py-10 px-4">
                <div className="max-w-2xl mx-auto text-center">
                    <h1 className="text-3xl font-bold mb-2">Achetez et vendez en Guinée</h1>
                    <p className="text-green-200 mb-6">Des milliers d'annonces près de chez vous</p>
                    <div className="flex gap-2 bg-white rounded-xl p-2">
                        <input
                            type="text"
                            placeholder="Rechercher une annonce..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 px-3 py-2 text-gray-800 outline-none rounded-lg"
                        />
                        <select
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="text-gray-700 px-3 py-2 rounded-lg outline-none"
                        >
                            {VILLES.map(v => <option key={v} value={v}>{v || 'Toute la Guinée'}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Annonces */}
            <div className="max-w-5xl mx-auto px-4 py-8">
                <h2 className="text-lg font-semibold text-gray-700 mb-4">
                    {search ? `Résultats pour "${search}"` : 'Annonces récentes'}
                </h2>

                {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl h-56 animate-pulse" />
                        ))}
                    </div>
                ) : data?.results?.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <p className="text-5xl mb-4">📭</p>
                        <p>Aucune annonce trouvée</p>
                        {isAuthenticated && (
                            <button onClick={() => navigate('/create')} className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg">
                                Publier la première annonce
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {data?.results?.map(listing => (
                            <ListingCard key={listing.id} listing={listing} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}