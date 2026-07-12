import { useState, useEffect, useRef } from 'react'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { listingsAPI, shopsAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { useDarkMode } from '../hooks/useDarkMode'
import Logo from '../components/Logo'
import AISearchBar from '../components/AISearchBar'

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
        <div className="bg-white rounded-2xl overflow-hidden animate-pulse" style={{boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
            <div className="h-44 bg-gradient-to-br from-gray-100 to-gray-200" />
            <div className="p-3 space-y-2">
                <div className="h-3.5 bg-gray-100 rounded-full w-3/4" />
                <div className="h-4 bg-gray-200 rounded-full w-1/2" />
                <div className="h-3 bg-gray-100 rounded-full w-2/3" />
            </div>
        </div>
    )
}

// ── Carte annonce ──────────────────────────────────────────────────────────────
function ListingCard({ listing }) {
    const { isAuthenticated } = useAuthStore()
    const qc = useQueryClient()
    const [favorited, setFavorited] = useState(listing.is_favorited ?? false)
    const cover = listing.media?.find(m => m.is_cover) || listing.media?.[0]
    const fresh = isNew(listing.created_at)

    const favMut = useMutation({
        mutationFn: () => listingsAPI.toggleFavorite(listing.id),
        onMutate: () => setFavorited(v => !v),
        onSuccess: (res) => {
            setFavorited(res.data.is_favorited)
            qc.invalidateQueries({ queryKey: ['favorites'] })
        },
        onError: () => setFavorited(v => !v),
    })

    const handleFav = (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!isAuthenticated) return
        favMut.mutate()
    }

    return (
        <div className="listing-card group relative animate-fade-in">
            <Link to={`/listings/${listing.id}`}>
                <div className="h-44 bg-gray-50 overflow-hidden relative">
                    {cover
                        ? <img src={cover.file} alt={listing.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        : <div className="w-full h-full flex items-center justify-center text-gray-200 text-5xl bg-gradient-to-br from-gray-50 to-gray-100">📦</div>
                    }
                    {/* Dégradé bas */}
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                    {/* Badges */}
                    {fresh && (
                        <span className="absolute top-2 left-2 bg-green-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm tracking-wide">Nouveau</span>
                    )}
                    {/* Vue count */}
                    {listing.view_count > 0 && (
                        <span className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full font-medium">
                            👁 {listing.view_count}
                        </span>
                    )}
                </div>
                <div className="p-3">
                    <h3 className="font-semibold text-gray-800 truncate text-sm leading-snug">{listing.title}</h3>
                    <p className="price-tag mt-1 text-sm">{formatPrice(listing.price_gnf, listing.price_type)}</p>
                    <p className="text-xs text-gray-400 mt-1 truncate">📍 {listing.city}{listing.quartier ? ` · ${listing.quartier}` : ''}</p>
                    {listing.category_name && (
                        <span className="inline-block mt-2 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">{listing.category_name}</span>
                    )}
                </div>
            </Link>
            {/* Bouton favori */}
            {isAuthenticated && (
                <button
                    onClick={handleFav}
                    className={`absolute top-2 right-2 w-8 h-8 bg-white/95 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center text-sm transition-all duration-200 hover:scale-110 ${favorited ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
                    title={favorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                    {favorited ? '❤️' : '🤍'}
                </button>
            )}
        </div>
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
    const [dark, toggleDark] = useDarkMode()
    return (
        <nav className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 sticky top-0 z-20" style={{boxShadow:'0 1px 0 rgba(0,0,0,0.05)'}}>
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                <Logo />
                <div className="flex items-center gap-1.5">
                    {isAuthenticated ? (
                        <>
                            <Link to="/create" className="btn-primary text-sm px-4 py-2 rounded-xl">+ Publier</Link>
                            <Link to="/messages" className="w-9 h-9 flex items-center justify-center text-gray-500 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition text-base" title="Messages">💬</Link>
                            <Link to="/favorites" className="w-9 h-9 flex items-center justify-center text-gray-500 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition text-base" title="Favoris">❤️</Link>
                            <Link to="/profile" className="w-9 h-9 flex items-center justify-center text-gray-500 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition text-base" title="Profil">👤</Link>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="text-gray-600 dark:text-gray-300 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition">Connexion</Link>
                            <Link to="/register" className="btn-primary text-sm">S'inscrire</Link>
                        </>
                    )}
                    <button onClick={toggleDark}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-base bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition ml-1"
                        title={dark ? 'Mode clair' : 'Mode sombre'}>
                        {dark ? '☀️' : '🌙'}
                    </button>
                </div>
            </div>
        </nav>
    )
}

const VILLES = ['', 'Conakry', 'Kankan', 'Labé', 'Kindia', 'Faranah', 'Nzérékoré', 'Boké', 'Mamou', 'Siguiri', 'Nzérékoré']
const TRIS   = [
    { value: '-is_boosted,-created_at', label: 'Récent en premier' },
    { value: 'price_gnf',               label: 'Prix croissant' },
    { value: '-price_gnf',              label: 'Prix décroissant' },
    { value: '-view_count',             label: 'Plus populaire' },
]

// ── Page principale ────────────────────────────────────────────────────────────
export default function HomePage() {
    const [search, setSearch]                   = useState('')
    const [city, setCity]                       = useState('')
    const [categoryId, setCategoryId]           = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [ordering, setOrdering]               = useState('-is_boosted,-created_at')
    const [priceMin, setPriceMin]               = useState('')
    const [priceMax, setPriceMax]               = useState('')
    const [showFilters, setShowFilters]         = useState(false)
    const [aiResults, setAiResults]             = useState(null)  // résultats de la recherche IA
    const [nearLat, setNearLat]                 = useState(null)
    const [nearLng, setNearLng]                 = useState(null)
    const [radiusKm, setRadiusKm]               = useState(20)
    const [geoLoading, setGeoLoading]           = useState(false)
    const isAuthenticated = useAuthStore(s => s.isAuthenticated)
    const navigate = useNavigate()
    const loadMoreRef = useRef(null)

    // Annonces récemment vues (localStorage)
    const [recentlyViewed] = useState(() => {
        try { return JSON.parse(localStorage.getItem('gm_recently_viewed') || '[]') }
        catch { return [] }
    })

    const handleGeolocate = () => {
        if (!navigator.geolocation) return
        setGeoLoading(true)
        navigator.geolocation.getCurrentPosition(
            (pos) => { setNearLat(pos.coords.latitude); setNearLng(pos.coords.longitude); setGeoLoading(false) },
            ()    => { setGeoLoading(false); alert('Géolocalisation refusée ou indisponible.') },
            { timeout: 8000 }
        )
    }

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
        queryKey: ['listings', debouncedSearch, city, categoryId, ordering, priceMin, priceMax, nearLat, nearLng, radiusKm],
        queryFn: ({ pageParam = 1 }) =>
            listingsAPI.getAll({
                search: debouncedSearch, city, category: categoryId, page: pageParam,
                ordering, min_price: priceMin || undefined, max_price: priceMax || undefined,
                ...(nearLat && nearLng ? { near_lat: nearLat, near_lng: nearLng, radius_km: radiusKm } : {}),
            }).then(r => r.data),
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
        <div className="min-h-screen" style={{background:'#f8fafc'}}>
            <Navbar isAuthenticated={isAuthenticated} />

            {/* Hero + Recherche */}
            <div className="hero-section text-white py-14 px-4 relative overflow-hidden">
                {/* Décoration */}
                <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/5 rounded-full pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-white/5 rounded-full pointer-events-none" />
                <div className="absolute top-1/2 left-1/4 w-2 h-2 bg-white/20 rounded-full pointer-events-none" />
                <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-emerald-300/40 rounded-full pointer-events-none" />

                <div className="max-w-2xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-xs font-semibold text-emerald-100 mb-5 tracking-wide">
                        🇬🇳 Marketplace N°1 en Guinée
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-3 leading-tight tracking-tight">
                        Achetez et vendez<br />
                        <span className="text-emerald-300">partout en Guinée</span>
                    </h1>
                    <p className="text-green-200/80 mb-7 text-sm">Des milliers d'annonces vérifiées, près de chez vous</p>

                    {/* Recherche IA */}
                    <div className="mb-4">
                        <AISearchBar
                            onResults={(data) => {
                                setAiResults(data)
                                window.scrollTo({ top: 500, behavior: 'smooth' })
                            }}
                            placeholder="✨ Décrivez ce que vous cherchez en français…"
                        />
                    </div>

                    <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-white/15"/>
                        <span className="text-white/40 text-xs font-medium">ou recherche classique</span>
                        <div className="flex-1 h-px bg-white/15"/>
                    </div>

                    {/* Barre classique */}
                    <div className="search-bar flex gap-2">
                        <input type="text" placeholder="Rechercher une annonce..."
                            value={search} onChange={handleSearchChange}
                            className="flex-1 px-4 py-2.5 text-gray-800 outline-none rounded-xl text-sm placeholder:text-gray-400" />
                        <select value={city} onChange={e => setCity(e.target.value)}
                            className="text-gray-700 px-3 py-2.5 rounded-xl outline-none text-sm border-l border-gray-200 bg-white">
                            {VILLES.map(v => <option key={v} value={v}>{v || 'Toute la Guinée'}</option>)}
                        </select>
                        <button onClick={() => setShowFilters(v => !v)}
                            className={`px-3 py-2.5 rounded-xl text-sm font-medium transition border-l border-gray-200
                                ${showFilters ? 'text-green-700 bg-green-50' : 'text-gray-500 hover:bg-gray-50'}`}
                            title="Filtres avancés">⚙️</button>
                    </div>

                    {/* Panneau filtres avancés */}
                    {showFilters && (
                        <div className="mt-3 bg-white/97 backdrop-blur rounded-2xl p-5 shadow-2xl text-left text-gray-700 space-y-4 border border-white/50">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Filtres avancés</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 block mb-1.5">Prix min (GNF)</label>
                                    <input type="number" placeholder="0" value={priceMin}
                                        onChange={e => setPriceMin(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 bg-gray-50" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 block mb-1.5">Prix max (GNF)</label>
                                    <input type="number" placeholder="∞" value={priceMax}
                                        onChange={e => setPriceMax(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 bg-gray-50" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 block mb-2">Trier par</label>
                                <div className="flex flex-wrap gap-2">
                                    {TRIS.map(t => (
                                        <button key={t.value} onClick={() => setOrdering(t.value)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition
                                                ${ordering === t.value ? 'bg-green-600 text-white shadow-sm shadow-green-500/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold text-gray-500">📍 Près de moi</label>
                                    {nearLat && (
                                        <button onClick={() => { setNearLat(null); setNearLng(null) }}
                                            className="text-xs text-red-400 hover:text-red-600 font-medium">Désactiver</button>
                                    )}
                                </div>
                                {nearLat ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-green-600 font-semibold">✓ Position activée</span>
                                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{radiusKm} km</span>
                                        </div>
                                        <input type="range" min="5" max="200" step="5" value={radiusKm}
                                            onChange={e => setRadiusKm(Number(e.target.value))}
                                            className="w-full accent-green-600" />
                                        <div className="flex justify-between text-xs text-gray-400"><span>5 km</span><span>200 km</span></div>
                                    </div>
                                ) : (
                                    <button onClick={handleGeolocate} disabled={geoLoading}
                                        className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-green-400 hover:text-green-600 transition disabled:opacity-50 font-medium">
                                        {geoLoading ? '⏳ Détection en cours...' : '📍 Détecter ma position'}
                                    </button>
                                )}
                            </div>
                            {(priceMin || priceMax || ordering !== '-is_boosted,-created_at' || nearLat) && (
                                <button onClick={() => { setPriceMin(''); setPriceMax(''); setOrdering('-is_boosted,-created_at'); setNearLat(null); setNearLng(null) }}
                                    className="text-xs text-red-500 hover:text-red-700 font-medium underline underline-offset-2">
                                    Réinitialiser tous les filtres
                                </button>
                            )}
                        </div>
                    )}

                    {/* Chiffres clés */}
                    <div className="grid grid-cols-3 gap-3 mt-7">
                        {[['10K+', 'Annonces'], ['5K+', 'Vendeurs actifs'], ['4.8★', 'Note moyenne']].map(([val, lbl]) => (
                            <div key={lbl} className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl py-3 px-2">
                                <p className="text-lg font-black text-white">{val}</p>
                                <p className="text-emerald-200/80 text-xs mt-0.5 leading-tight">{lbl}</p>
                            </div>
                        ))}
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
                <div className="bg-white/95 backdrop-blur-sm border-b border-gray-100 sticky top-14 z-10">
                    <div className="max-w-5xl mx-auto px-4 py-2.5 flex gap-2 overflow-x-auto" style={{scrollbarWidth:'none'}}>
                        <button onClick={() => setCategoryId('')}
                            className={`cat-pill flex-shrink-0 ${categoryId === '' ? 'cat-pill-active' : 'cat-pill-inactive'}`}>
                            Tout
                        </button>
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setCategoryId(cat.id === categoryId ? '' : cat.id)}
                                className={`cat-pill flex-shrink-0 ${categoryId === cat.id ? 'cat-pill-active' : 'cat-pill-inactive'}`}>
                                {cat.icon_url && <span className="mr-1">{cat.icon_url}</span>}
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Résultats IA */}
            {aiResults && (
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
                                <span>✨</span> Résultats IA
                                <span className="text-xs font-normal text-gray-400">({aiResults.count} annonce{aiResults.count > 1 ? 's' : ''})</span>
                            </h2>
                            {aiResults.interpretation && (
                                <p className="text-xs text-emerald-600 mt-0.5">🤖 {aiResults.interpretation}</p>
                            )}
                        </div>
                        <button onClick={() => setAiResults(null)}
                            className="text-xs text-gray-400 hover:text-gray-600 underline">
                            Effacer
                        </button>
                    </div>
                    {aiResults.results.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <p className="text-4xl mb-3">🔍</p>
                            <p className="text-sm">Aucun résultat pour cette recherche.</p>
                            <p className="text-xs mt-1">Essayez avec d'autres mots ou une autre ville.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {aiResults.results.map(l => <ListingCard key={l.id} listing={l} />)}
                        </div>
                    )}
                </div>
            )}

            {/* Grille annonces classiques */}
            <div className={`max-w-5xl mx-auto px-4 py-6 ${aiResults ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-base font-semibold text-gray-700">
                            {debouncedSearch ? `Résultats pour "${debouncedSearch}"` : city ? `Annonces à ${city}` : 'Annonces récentes'}
                            {!isLoading && totalCount > 0 && (
                                <span className="ml-2 text-xs font-normal text-gray-400">
                                    ({totalCount} annonce{totalCount > 1 ? 's' : ''})
                                </span>
                            )}
                        </h2>
                        {(priceMin || priceMax) && (
                            <p className="text-xs text-green-600 mt-0.5">
                                💰 {priceMin ? new Intl.NumberFormat('fr-GN').format(priceMin) + ' GNF' : '0'} → {priceMax ? new Intl.NumberFormat('fr-GN').format(priceMax) + ' GNF' : '∞'}
                            </p>
                        )}
                    </div>
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
