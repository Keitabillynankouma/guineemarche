import { useState, useEffect, useRef } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { listingsAPI, shopsAPI } from '../services/api'
import useAuthStore from '../store/authStore'

function formatPrice(price, type) {
    if (type === 'free') return 'Gratuit'
    return new Intl.NumberFormat('fr-GN').format(price) + ' GNF'
}

function isNew(dateStr) {
    if (!dateStr) return false
    return (Date.now() - new Date(dateStr).getTime()) < 24 * 60 * 60 * 1000
}

// ── Skeleton card ──────────────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <div className="bg-white rounded-xl shadow overflow-hidden animate-pulse">
            <div className="h-44 bg-gray-200" />
            <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
        </div>
    )
}

// ── Carte annonce ──────────────────────────────────────────────────────────────
function ListingCard({ listing }) {
    const cover = listing.media?.find(m => m.is_cover) || listing.media?.[0]
    const fresh = isNew(listing.created_at)
    return (
        <Link to={`/listings/${listing.id}`}
            className="bg-white rounded-xl shadow hover:shadow-md transition overflow-hidden group relative">
            <div className="h-44 bg-gray-100 overflow-hidden relative">
                {cover
                    ? <img src={cover.file} alt={listing.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <div className="w-full h-full flex items-center justify-center text-gray-300 text-5xl">📦</div>
                }
                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {listing.is_boosted && (
                        <span className="bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">⚡ Boosté</span>
                    )}
                    {fresh && (
                        <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">🆕 Nouveau</span>
                    )}
                </div>
                {/* Vue count */}
                {listing.view_count > 0 && (
                    <span className="absolute bottom-2 right-2 bg-black/40 text-white text-xs px-1.5 py-0.5 rounded-full">
                        👁 {listing.view_count}
                    </span>
                )}
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

// ── Carte "vu récemment" mini ──────────────────────────────────────────────────
function RecentCard({ item }) {
    return (
        <Link to={`/listings/${item.id}`}
            className="flex-shrink-0 w-36 bg-white rounded-xl shadow hover:shadow-md transition overflow-hidden group">
            <div className="h-24 bg-gray-100 overflow-hidden">
                {item.cover
                    ? <img src={item.cover} alt={item.title} loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                }
            </div>
            <div className="p-2">
                <p className="text-xs font-semibold text-gray-800 truncate">{item.title}</p>
                <p className="text-green-600 font-bold text-xs mt-0.5">{formatPrice(item.price_gnf, item.price_type)}</p>
            </div>
        </Link>
    )
}

// ── Banner carousel ────────────────────────────────────────────────────────────
function BannerCarousel({ banners }) {
    const [current, setCurrent] = useState(0)
    useEffect(() => {
        if (banners?.length <= 1) return
        const t = setInterval(() => setCurrent(c => (c + 1) % banners.length), 4000)
        return () => clearInterval(t)
    }, [banners?.length])
    if (!banners?.length) return null
    const b = banners[current]
    const handleClick = () => {
        listingsAPI.bannerClick(b.id).catch(() => {})
        if (b.link_url) window.open(b.link_url, '_blank', 'noopener')
    }
    return (
        <div className="max-w-5xl mx-auto px-4 pt-4">
            <div className="relative rounded-2xl overflow-hidden cursor-pointer shadow-md" style={{ height: 160 }} onClick={handleClick}>
                <img src={b.image} alt={b.title} className="w-full h-full object-cover transition-opacity duration-500" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex items-center px-6">
                    <p className="text-white font-bold text-lg drop-shadow">{b.title}</p>
                </div>
                {banners.length > 1 && (
                    <div className="absolute bottom-2 right-3 flex gap-1">
                        {banners.map((_, i) => (
                            <button key={i} onClick={e => { e.stopPropagation(); setCurrent(i) }}
                                className={`w-2 h-2 rounded-full transition ${i === current ? 'bg-white' : 'bg-white/40'}`} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Boutiques en vedette ───────────────────────────────────────────────────────
function FeaturedShops({ shops }) {
    if (!shops?.length) return null
    return (
        <div className="max-w-5xl mx-auto px-4 py-4">
            <h2 className="text-base font-semibold text-gray-700 mb-3">🏪 Boutiques en vedette</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
                {shops.map(shop => (
                    <Link key={shop.id} to={`/shops/${shop.id}`}
                        className="flex-shrink-0 bg-white rounded-xl shadow p-3 flex flex-col items-center w-28 hover:shadow-md transition">
                        <div className="w-14 h-14 rounded-full bg-green-50 overflow-hidden border-2 border-green-200 mb-2 flex items-center justify-center">
                            {shop.logo_url
                                ? <img src={shop.logo_url} alt={shop.name} loading="lazy" className="w-full h-full object-cover" />
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

// ── Navbar ─────────────────────────────────────────────────────────────────────
function Navbar({ isAuthenticated }) {
    return (
        <nav className="bg-white shadow sticky top-0 z-20">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                <Link to="/" className="text-xl font-bold text-green-700 tracking-tight">🛒 GuinéeMarché</Link>
                <div className="flex items-center gap-2">
                    {isAuthenticated ? (
                        <>
                            <Link to="/create" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition">+ Publier</Link>
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

// ── Page principale ────────────────────────────────────────────────────────────
export default function HomePage() {
    const [search, setSearch]               = useState('')
    const [city, setCity]                   = useState('')
    const [categoryId, setCategoryId]       = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const isAuthenticated = useAuthStore(s => s.isAuthenticated)
    const navigate = useNavigate()
    const loadMoreRef = useRef(null)

    // Annonces récemment vues (localStorage)
    const [recentlyViewed] = useState(() => {
        try { return JSON.parse(localStorage.getItem('gm_recently_viewed') || '[]') }
        catch { return [] }
    })

    const handleSearchChange = (e) => {
        const val = e.target.value
        setSearch(val)
        clearTimeout(window._searchTimer)
        window._searchTimer = setTimeout(() => setDebouncedSearch(val), 400)
    }

    const { data: categoriesData } = useQuery({
        queryKey: ['categories'],
        queryFn:  () => listingsAPI.categories().then(r => r.data),
        staleTime: 5 * 60 * 1000,
    })
    const categories = Array.isArray(categoriesData) ? categoriesData : (categoriesData?.results || [])

    const { data: bannersData } = useQuery({
        queryKey: ['banners'],
        queryFn:  () => listingsAPI.banners('hero').then(r => r.data),
        staleTime: 10 * 60 * 1000,
    })
    const banners = Array.isArray(bannersData) ? bannersData : (bannersData?.results || [])

    const { data: shopsData } = useQuery({
        queryKey: ['featured-shops'],
        queryFn:  () => shopsAPI.featured().then(r => r.data),
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

    // Infinite scroll automatique via IntersectionObserver
    useEffect(() => {
        if (!loadMoreRef.current) return
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage() },
            { threshold: 0.1 }
        )
        observer.observe(loadMoreRef.current)
        return () => observer.disconnect()
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

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

            {/* Boutiques en vedette */}
            <FeaturedShops shops={featuredShops} />

            {/* Annonces récemment vues */}
            {recentlyViewed.length > 0 && (
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <h2 className="text-base font-semibold text-gray-700 mb-3">🕐 Vus récemment</h2>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {recentlyViewed.map(item => <RecentCard key={item.id} item={item} />)}
                    </div>
                </div>
            )}

            {/* Filtres catégories */}
            {categories.length > 0 && (
                <div className="bg-white border-b shadow-sm sticky top-14 z-10">
                    <div className="max-w-5xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
                        <button onClick={() => setCategoryId('')}
                            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${categoryId === '' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            Tout
                        </button>
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setCategoryId(cat.id === categoryId ? '' : cat.id)}
                                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${categoryId === cat.id ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                {cat.icon_url && <span className="mr-1">{cat.icon_url}</span>}
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Grille annonces */}
            <div className="max-w-5xl mx-auto px-4 py-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-gray-700">
                        {debouncedSearch ? `Résultats pour "${debouncedSearch}"` : 'Annonces récentes'}
                        {!isLoading && totalCount > 0 && (
                            <span className="ml-2 text-xs font-normal text-gray-400">
                                ({totalCount} annonce{totalCount > 1 ? 's' : ''})
                            </span>
                        )}
                    </h2>
                    {isAuthenticated && (
                        <Link to="/create" className="text-sm text-green-600 font-medium hover:underline">+ Publier</Link>
                    )}
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
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
                            {listings.map(l => <ListingCard key={l.id} listing={l} />)}
                        </div>

                        {/* Skeleton pages suivantes */}
                        {isFetchingNextPage && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
                            </div>
                        )}

                        {/* Sentinelle pour infinite scroll */}
                        <div ref={loadMoreRef} className="h-10 mt-4" />

                        {!hasNextPage && listings.length > 0 && (
                            <p className="text-center text-sm text-gray-400 mt-4 py-4">
                                ✓ Toutes les annonces ont été chargées
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
