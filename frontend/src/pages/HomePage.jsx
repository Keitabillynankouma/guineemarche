import { useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { listingsAPI, shopsAPI } from '../services/api'
import useAuthStore from '../store/authStore'

function formatPrice(price, type) {
    if (type === 'free') return 'Gratuit'
    return new Intl.NumberFormat('fr-GN').format(price) + ' GNF'
}

function ListingCard({ listing }) {
    const cover = listing.media?.find(m => m.is_cover) || listing.media?.[0]
    return (
        <Link to={`/listings/${listing.id}`} className="bg-white rounded-xl shadow hover:shadow-md transition overflow-hidden group">
            <div className="h-44 bg-gray-100 overflow-hidden">
                {cover
                    ? <img src={cover.file} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <div className="w-full h-full flex items-center justify-center text-gray-300 text-5xl">📦</div>
                }
            </div>
            <div className="p-3">
                <h3 className="font-semibold text-gray-800 truncate text-sm">{listing.title}</h3>
                <p className="text-green-600 font-bold mt-1 text-sm">{formatPrice(listing.price_gnf, listing.price_type)}</p>
                <p className="text-xs text-gray-400 mt-1 truncate">📍 {listing.city}{listing.quartier ? ` · ${listing.quartier}` : ''}</p>
                {listing.category_name && (
                    <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{listing.category_name}</span>
                )}
            </div>
        </Link>
    )
}

function BannerCarousel({ banners }) {
    const [current, setCurrent] = useState(0)
    if (!banners?.length) return null
    const b = banners[current]

    const handleClick = () => {
        listingsAPI.bannerClick(b.id).catch(() => {})
        if (b.link_url) window.open(b.link_url, '_blank', 'noopener')
    }

    return (
        <div className="max-w-5xl mx-auto px-4 pt-4">
            <div className="relative rounded-2xl overflow-hidden cursor-pointer shadow-md" onClick={handleClick}
                style={{ height: 160 }}>
                <img src={b.image} alt={b.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent flex items-center px-6">
                    <p className="text-white font-bold text-lg drop-shadow">{b.title}</p>
                </div>
                {banners.length > 1 && (
                    <div className="absolute bottom-2 right-3 flex gap-1">
                        {banners.map((_, i) => (
                            <button key={i} onClick={(e) => { e.stopPropagation(); setCurrent(i) }}
                                className={`w-2 h-2 rounded-full transition ${i === current ? 'bg-white' : 'bg-white/40'}`} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function FeaturedShops({ shops }) {
    if (!shops?.length) return null
    return (
        <div className="max-w-5xl mx-auto px-4 py-4">
            <h2 className="text-base font-semibold text-gray-700 mb-3">🏪 Grandes Boutiques</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
                {shops.map(shop => (
                    <Link key={shop.id} to={`/shops/${shop.id}`}
                        className="flex-shrink-0 bg-white rounded-xl shadow p-3 flex flex-col items-center w-28 hover:shadow-md transition">
                        <div className="w-14 h-14 rounded-full bg-green-50 overflow-hidden border-2 border-green-200 mb-2 flex items-center justify-center">
                            {shop.logo_url
                                ? <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
                                : <span className="text-2xl">🏪</span>}
                        </div>
                        <p className="text-xs font-semibold text-gray-800 text-center truncate w-full">{shop.name}</p>
                        <p className="text-xs text-gray-400">{shop.listing_count} annonce{shop.listing_count !== 1 ? 's' : ''}</p>
                        {shop.is_verified && <span className="text-xs text-green-600 mt-0.5">✅ Vérifié</span>}
                    </Link>
                ))}
            </div>
        </div>
    )
}

function Navbar({ isAuthenticated }) {
    return (
        <nav className="bg-white shadow sticky top-0 z-20">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                <Link to="/" className="text-xl font-bold text-green-700 tracking-tight">
                    🛒 GuinéeMarché
                </Link>
                <div className="flex items-center gap-2">
                    {isAuthenticated ? (
                        <>
                            <Link to="/create" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition">
                                + Publier
                            </Link>
                            <Link to="/messages" className="text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-100 transition" title="Messages">💬</Link>
                            <Link to="/favorites" className="text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-100 transition" title="Favoris">❤️</Link>
                            <Link to="/profile" className="text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-100 transition" title="Profil">👤</Link>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-100 transition">Connexion</Link>
                            <Link to="/register" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition">S'inscrire</Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    )
}

const VILLES = ['', 'Conakry', 'Kankan', 'Labé', 'Kindia', 'Faranah', 'Nzérékoré']

export default function HomePage() {
    const [search, setSearch]         = useState('')
    const [city, setCity]             = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const isAuthenticated = useAuthStore(s => s.isAuthenticated)
    const navigate = useNavigate()

    const handleSearchChange = (e) => {
        const val = e.target.value
        setSearch(val)
        clearTimeout(window._searchTimer)
        window._searchTimer = setTimeout(() => setDebouncedSearch(val), 400)
    }

    const { data: categoriesData } = useQuery({
        queryKey: ['categories'],
        queryFn: () => listingsAPI.categories().then(r => r.data),
        staleTime: 5 * 60 * 1000,
    })
    const categories = Array.isArray(categoriesData) ? categoriesData : (categoriesData?.results || [])

    const { data: bannersData } = useQuery({
        queryKey: ['banners'],
        queryFn: () => listingsAPI.banners('hero').then(r => r.data),
        staleTime: 10 * 60 * 1000,
    })
    const banners = Array.isArray(bannersData) ? bannersData : (bannersData?.results || [])

    const { data: shopsData } = useQuery({
        queryKey: ['featured-shops'],
        queryFn: () => shopsAPI.featured().then(r => r.data),
        staleTime: 5 * 60 * 1000,
    })
    const featuredShops = Array.isArray(shopsData) ? shopsData : (shopsData?.results || [])

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
        queryKey: ['listings', debouncedSearch, city, categoryId],
        queryFn: ({ pageParam = 1 }) =>
            listingsAPI.getAll({ search: debouncedSearch, city, category: categoryId, page: pageParam }).then(r => r.data),
        getNextPageParam: (lastPage) => {
            if (!lastPage.next) return undefined
            return new URL(lastPage.next).searchParams.get('page')
        },
        initialPageParam: 1,
    })

    const listings   = data?.pages.flatMap(p => p.results ?? p) ?? []
    const totalCount = data?.pages[0]?.count ?? 0

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar isAuthenticated={isAuthenticated} />

            {/* Hero + Recherche */}
            <div className="bg-gradient-to-br from-green-700 to-green-600 text-white py-10 px-4">
                <div className="max-w-2xl mx-auto text-center">
                    <h1 className="text-3xl font-bold mb-1">Achetez et vendez en Guinée</h1>
                    <p className="text-green-200 mb-6 text-sm">Des milliers d'annonces près de chez vous</p>
                    <div className="flex gap-2 bg-white rounded-xl p-2 shadow-lg">
                        <input type="text" placeholder="Rechercher une annonce..."
                            value={search} onChange={handleSearchChange}
                            className="flex-1 px-3 py-2 text-gray-800 outline-none rounded-lg text-sm" />
                        <select value={city} onChange={e => setCity(e.target.value)}
                            className="text-gray-700 px-3 py-2 rounded-lg outline-none text-sm border-l border-gray-200">
                            {VILLES.map(v => <option key={v} value={v}>{v || 'Toute la Guinée'}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Banners publicitaires */}
            <BannerCarousel banners={banners} />

            {/* Grandes boutiques */}
            <FeaturedShops shops={featuredShops} />

            {/* Filtres catégories */}
            {categories.length > 0 && (
                <div className="bg-white border-b shadow-sm">
                    <div className="max-w-5xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
                        <button onClick={() => setCategoryId('')}
                            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${categoryId === '' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            Tout
                        </button>
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setCategoryId(cat.id === categoryId ? '' : cat.id)}
                                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${categoryId === cat.id ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                {cat.icon_url && <span className="mr-1">{cat.icon_url}</span>}
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Annonces */}
            <div className="max-w-5xl mx-auto px-4 py-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-gray-700">
                        {debouncedSearch ? `Résultats pour "${debouncedSearch}"` : 'Annonces récentes'}
                        {!isLoading && totalCount > 0 && (
                            <span className="ml-2 text-xs font-normal text-gray-400">({totalCount} annonce{totalCount > 1 ? 's' : ''})</span>
                        )}
                    </h2>
                    {isAuthenticated && (
                        <Link to="/create" className="text-sm text-green-600 font-medium hover:underline">+ Publier</Link>
                    )}
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[...Array(8)].map((_, i) => <div key={i} className="bg-white rounded-xl h-56 animate-pulse" />)}
                    </div>
                ) : listings.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <p className="text-5xl mb-4">📭</p>
                        <p className="text-sm">Aucune annonce trouvée</p>
                        {isAuthenticated && (
                            <button onClick={() => navigate('/create')}
                                className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700 transition">
                                Publier la première annonce
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {listings.map(listing => <ListingCard key={listing.id} listing={listing} />)}
                        </div>
                        {hasNextPage && (
                            <div className="text-center mt-8">
                                <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                                    className="bg-white border border-gray-300 text-gray-700 px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
                                    {isFetchingNextPage ? 'Chargement...' : "Voir plus d'annonces"}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
