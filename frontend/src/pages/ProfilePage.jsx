import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from '../store/authStore'
import { authAPI, ordersAPI, listingsAPI, referralAPI } from '../services/api'
import Logo from '../components/Logo'

// ── Graphique barres SVG pur ──────────────────────────────────────────────────
function BarChart({ data, color = '#16a34a', label = '' }) {
    if (!data.length) return null
    const max = Math.max(...data.map(d => d.value), 1)
    const W = 100 / data.length
    return (
        <div>
            {label && <p className="text-xs text-gray-500 mb-2 font-medium">{label}</p>}
            <div className="flex items-end gap-1 h-24">
                {data.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                        <div
                            className="w-full rounded-t-md transition-all duration-500"
                            style={{ height: `${Math.max(4, (d.value / max) * 88)}px`, background: color, opacity: d.value ? 1 : 0.2 }}
                            title={`${d.label}: ${d.value}`}
                        />
                        <p className="text-xs text-gray-400 truncate w-full text-center">{d.label}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Dashboard vendeur ─────────────────────────────────────────────────────────
function SellerDashboard({ userId }) {
    const { data: ordersRaw } = useQuery({
        queryKey: ['seller-dashboard-orders'],
        queryFn: () => ordersAPI.getSeller().then(r => r.data),
    })
    const { data: sellerStats } = useQuery({
        queryKey: ['seller-stats-advanced'],
        queryFn: () => listingsAPI.sellerStats().then(r => r.data),
    })

    const orders    = Array.isArray(ordersRaw) ? ordersRaw : (ordersRaw?.results ?? [])
    const stats     = sellerStats || {}

    // Commandes par mois (6 derniers mois)
    const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date()
        d.setMonth(d.getMonth() - (5 - i))
        return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('fr-FR', { month: 'short' }), value: 0 }
    })
    for (const o of orders) {
        const k = o.created_at?.slice(0, 7)
        const m = months.find(m => m.key === k)
        if (m) m.value++
    }

    // Revenus par mois (commandes completed)
    const revMonths = months.map(m => ({ ...m, value: 0 }))
    for (const o of orders.filter(o => o.status === 'completed')) {
        const k = o.created_at?.slice(0, 7)
        const m = revMonths.find(m => m.key === k)
        if (m) m.value += (o.seller_payout_gnf || o.amount_gnf || 0)
    }

    // Stats commandes
    const totalRev  = orders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.seller_payout_gnf || 0), 0)
    const completed = orders.filter(o => o.status === 'completed').length
    const pending   = orders.filter(o => o.status === 'pending').length
    const convRate  = orders.length ? Math.round((completed / orders.length) * 100) : 0

    // Comparaison mois
    const listingsThisMonth = stats.listings_this_month ?? 0
    const listingsLastMonth = stats.listings_last_month ?? 0
    const listingsTrend = listingsLastMonth > 0
        ? Math.round(((listingsThisMonth - listingsLastMonth) / listingsLastMonth) * 100)
        : null

    // Vues mensuelles pour graphique
    const viewsChartData = (stats.monthly_views || []).map(m => ({ label: m.month, value: m.views }))

    const fmt = n => new Intl.NumberFormat('fr-GN').format(n) + ' GNF'

    return (
        <div className="bg-white rounded-2xl shadow p-5 space-y-5">
            <h2 className="font-bold text-gray-800">📊 Tableau de bord vendeur</h2>

            {/* KPIs commandes */}
            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: 'Ventes terminées', value: completed, icon: '✅', color: 'text-green-600' },
                    { label: 'En attente', value: pending, icon: '⏳', color: 'text-yellow-600' },
                    { label: 'Taux conversion', value: convRate + '%', icon: '📈', color: 'text-blue-600' },
                    { label: 'Revenu net total', value: fmt(totalRev), icon: '💰', color: 'text-green-700', small: true },
                ].map(k => (
                    <div key={k.label} className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xl mb-1">{k.icon}</p>
                        <p className={`font-bold ${k.color} ${k.small ? 'text-sm' : 'text-xl'}`}>{k.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
                    </div>
                ))}
            </div>

            {/* KPIs portée & engagement */}
            {sellerStats && (
                <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Portée & engagement</p>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Vues totales', value: (stats.total_views || 0).toLocaleString('fr-FR'), icon: '👁', color: 'text-indigo-600' },
                            { label: 'Moy. vues/annonce', value: stats.avg_views_per_listing ?? 0, icon: '📊', color: 'text-indigo-500' },
                            { label: 'Favoris reçus', value: stats.total_favorites || 0, icon: '❤️', color: 'text-red-500' },
                            { label: 'Taux engagement', value: (stats.engagement_rate || 0) + '%', icon: '🎯', color: 'text-purple-600' },
                        ].map(k => (
                            <div key={k.label} className="bg-indigo-50 rounded-xl p-3">
                                <p className="text-xl mb-1">{k.icon}</p>
                                <p className={`font-bold text-xl ${k.color}`}>{k.value}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Comparaison avec mois précédent */}
            {sellerStats && (
                <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-500 font-medium">Annonces ce mois-ci</p>
                        <p className="text-2xl font-bold text-gray-800">{listingsThisMonth}</p>
                        <p className="text-xs text-gray-400">{listingsLastMonth} le mois dernier</p>
                    </div>
                    {listingsTrend !== null && (
                        <div className={`text-right ${listingsTrend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            <p className="text-2xl font-bold">{listingsTrend >= 0 ? '↑' : '↓'} {Math.abs(listingsTrend)}%</p>
                            <p className="text-xs opacity-80">vs mois dernier</p>
                        </div>
                    )}
                    {listingsTrend === null && listingsLastMonth === 0 && listingsThisMonth > 0 && (
                        <div className="text-green-600 text-right">
                            <p className="text-2xl font-bold">🆕</p>
                            <p className="text-xs">Première annonce !</p>
                        </div>
                    )}
                </div>
            )}

            {/* Graphique vues mensuelles */}
            {viewsChartData.length > 0 && (
                <BarChart data={viewsChartData} color="#6366f1" label="Vues des annonces (6 derniers mois)" />
            )}

            {/* Graphique commandes */}
            <BarChart data={months} color="#16a34a" label="Commandes reçues (6 derniers mois)" />

            {/* Graphique revenus */}
            <BarChart data={revMonths.map(m => ({ ...m, label: m.label }))} color="#2563eb" label="Revenus nets (GNF)" />

            {/* Top annonces avec taux d'engagement */}
            {(stats.top_listings || []).length > 0 && (
                <div>
                    <p className="text-xs text-gray-500 mb-2 font-medium">🏆 Top annonces</p>
                    <div className="space-y-2">
                        {(stats.top_listings || []).map((l, i) => (
                            <Link key={l.id} to={`/listings/${l.id}`}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition">
                                <span className="text-sm font-bold text-gray-400 w-4">#{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{l.title}</p>
                                    <p className="text-xs text-gray-400">
                                        👁 {l.view_count || 0} vues · ❤️ {l.favorites || 0}
                                        {l.listing_engagement > 0 && ` · 🎯 ${l.listing_engagement}%`}
                                        {l.is_boosted && ' · ⚡ Boosté'}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            <Link to={`/reviews/${userId}`}
                className="block text-center text-sm text-green-600 font-medium hover:underline">
                Voir mes avis clients →
            </Link>
        </div>
    )
}

// ── Section Parrainage ────────────────────────────────────────────────────────
function ReferralSection({ referral }) {
    const [copied, setCopied] = useState(false)

    const copy = () => {
        navigator.clipboard.writeText(referral.referral_url).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    const waText = encodeURIComponent(
        `🛒 Rejoins-moi sur Guimatrix — la marketplace #1 en Guinée !\nInscris-toi avec mon code et on gagne tous les deux des annonces gratuites : ${referral.referral_url}`
    )
    const waUrl = `https://wa.me/?text=${waText}`

    return (
        <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <h2 className="font-bold text-gray-800">🎁 Programme de parrainage</h2>

            {/* Statistiques */}
            <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-green-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-green-700">{referral.referral_count}</p>
                    <p className="text-xs text-gray-500 mt-1">Filleuls actifs</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-blue-700">+{referral.reward_per_ref}</p>
                    <p className="text-xs text-gray-500 mt-1">Annonces / filleul</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-purple-700">+{referral.total_bonus}</p>
                    <p className="text-xs text-gray-500 mt-1">Slots gagnés</p>
                </div>
            </div>

            <p className="text-sm text-gray-600">
                Partage ton lien. Chaque filleul qui s'inscrit et active son compte te rapporte <strong>{referral.reward_per_ref} annonces gratuites</strong> supplémentaires.
            </p>

            {/* Code */}
            <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between gap-2">
                <div>
                    <p className="text-xs text-gray-400 mb-1">Ton code</p>
                    <p className="font-mono font-bold text-lg text-green-700 tracking-widest">{referral.referral_code}</p>
                </div>
                <button
                    onClick={copy}
                    className="shrink-0 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                >
                    {copied ? '✅ Copié !' : '📋 Copier le lien'}
                </button>
            </div>

            {/* Partage WhatsApp */}
            <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-[#25D366] hover:bg-[#20bb5a] text-white font-semibold rounded-xl transition"
            >
                📱 Partager sur WhatsApp
            </a>
        </div>
    )
}

export default function ProfilePage() {
    const { user, fetchMe, logout, isAuthenticated } = useAuthStore()
    const navigate = useNavigate()

    useEffect(() => {
        if (!isAuthenticated) navigate('/login')
        else fetchMe()
    }, [])

    const { data: sub } = useQuery({
        queryKey: ['subscription'],
        queryFn: () => authAPI.getSubscription().then(r => r.data),
        enabled: isAuthenticated,
    })

    const { data: badges = [] } = useQuery({
        queryKey: ['badges'],
        queryFn: () => authAPI.getBadges().then(r => r.data),
        enabled: isAuthenticated,
    })

    const { data: referral } = useQuery({
        queryKey: ['referral-stats'],
        queryFn: () => referralAPI.getStats().then(r => r.data),
        enabled: isAuthenticated,
    })

    const handleLogout = async () => {
        await logout()
        navigate('/')
    }

    // ── Supprimer compte ──────────────────────────────────────────────────────
    const [showDelete, setShowDelete]       = useState(false)
    const [deletePassword, setDeletePassword] = useState('')
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteError, setDeleteError]     = useState('')

    const openDeleteModal = () => {
        setDeletePassword('')
        setDeleteError('')
        setShowDelete(true)
    }

    const handleDeleteAccount = async (e) => {
        e.preventDefault()
        setDeleteLoading(true)
        setDeleteError('')
        try {
            const refresh = localStorage.getItem('refresh_token')
            await authAPI.deleteAccount({ password: deletePassword, refresh_token: refresh })
            await logout()
            navigate('/')
        } catch (err) {
            setDeleteError(err?.response?.data?.error || 'Une erreur est survenue.')
        } finally {
            setDeleteLoading(false)
        }
    }

    // ── Modifier profil ───────────────────────────────────────────────────────
    const [showEdit, setShowEdit] = useState(false)
    const [editForm, setEditForm] = useState({ email: '', city: 'Conakry', quartier: '' })
    const [editLoading, setEditLoading] = useState(false)
    const [editSuccess, setEditSuccess] = useState(false)

    const openEdit = () => {
        setEditForm({ email: user.email || '', city: user.city || 'Conakry', quartier: user.quartier || '' })
        setEditSuccess(false)
        setShowEdit(true)
    }

    const handleSaveProfile = async (e) => {
        e.preventDefault()
        setEditLoading(true)
        try {
            await authAPI.updateProfile(editForm)
            await fetchMe()
            setEditSuccess(true)
            setTimeout(() => setShowEdit(false), 1200)
        } catch {
            // erreur silencieuse — le champ email invalide sera refusé par Django
        } finally {
            setEditLoading(false)
        }
    }

    const VILLES_EDIT = ['Conakry', 'Kankan', 'Labé', 'Kindia', 'Faranah', 'Nzérékoré', 'Siguiri', 'Mamou', 'Boké', 'Coyah']
    const QUARTIERS_EDIT = ['Kaloum', 'Dixinn', 'Matam', 'Ratoma', 'Matoto']

    if (!user) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-green-600">Chargement...</div>
        </div>
    )

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <nav className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Logo back />
                    <span className="text-sm font-semibold text-gray-700">Mon profil</span>
                </div>
            </nav>

            <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
                {/* Carte profil avec bannière */}
                <div className="bg-white rounded-2xl shadow-card overflow-hidden">
                    {/* Bannière verte */}
                    <div className="h-20 bg-hero-gradient" />
                    <div className="px-6 pb-6 -mt-10 text-center">
                        <div className="w-20 h-20 bg-white border-4 border-white rounded-full flex items-center justify-center text-3xl mx-auto shadow-md overflow-hidden">
                            {user.profile?.avatar_url
                                ? <img src={user.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                                : <span className="bg-gradient-to-br from-green-100 to-green-200 w-full h-full flex items-center justify-center font-bold text-green-700 text-2xl">{user.full_name?.[0]?.toUpperCase() ?? '?'}</span>}
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mt-3">{user.full_name}</h1>
                        <p className="text-gray-500 text-sm mt-0.5">{String(user.phone_number)}</p>
                        {user.email && (
                            <p className="text-xs text-green-600 mt-0.5">✉️ {user.email}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">📍 {user.city}{user.quartier && ` · ${user.quartier}`}</p>
                        <button onClick={openEdit}
                            className="mt-3 text-xs text-green-600 border border-green-200 rounded-full px-3 py-1 hover:bg-green-50 transition">
                            ✏️ Modifier mon profil
                        </button>
                        {user.profile && (
                            <div className="flex justify-center gap-8 mt-5 text-sm border-t pt-4">
                                <Link to={`/reviews/${user.id}`} className="text-center hover:text-green-600 transition">
                                    <p className="font-bold text-gray-900 text-base">{user.profile.rating_avg?.toFixed(1) || '0.0'} <span className="text-amber-400">★</span></p>
                                    <p className="text-gray-400 text-xs mt-0.5">Note</p>
                                </Link>
                                <Link to={`/reviews/${user.id}`} className="text-center hover:text-green-600 transition">
                                    <p className="font-bold text-gray-900 text-base">{user.profile.total_ratings}</p>
                                    <p className="text-gray-400 text-xs mt-0.5">Avis</p>
                                </Link>
                                <div className="text-center">
                                    <p className="font-bold text-gray-900 text-base">{user.profile.total_sales}</p>
                                    <p className="text-gray-400 text-xs mt-0.5">Ventes</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Dashboard vendeur */}
                {user.role === 'seller' && <SellerDashboard userId={user.id} />}

                {badges.length > 0 && (
                    <div className="bg-white rounded-2xl shadow p-4">
                        <h2 className="font-semibold text-gray-700 mb-3">Mes badges</h2>
                        <div className="flex flex-wrap gap-2">
                            {badges.map(b => (
                                <span key={b.type}
                                    className="flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1 text-sm font-medium">
                                    {b.icon} {b.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow p-4">
                    <h2 className="font-semibold text-gray-700 mb-3">Mon abonnement</h2>
                    {sub?.is_pro ? (
                        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                            <span className="text-2xl">💎</span>
                            <div>
                                <p className="font-bold text-green-700">Plan Pro actif</p>
                                {sub.valid_until && (
                                    <p className="text-xs text-gray-500">
                                        Expire le {new Date(sub.valid_until).toLocaleDateString('fr-FR')}
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Annonces gratuites utilisées</span>
                                <span className={`font-bold ${sub?.remaining_free === 0 ? 'text-red-500' : 'text-gray-800'}`}>
                                    {sub?.listings_used ?? '…'} / 5
                                </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all ${sub?.remaining_free === 0 ? 'bg-red-500' : 'bg-green-500'}`}
                                    style={{ width: `${Math.min(100, ((sub?.listings_used ?? 0) / 5) * 100)}%` }}
                                />
                            </div>
                            {sub?.remaining_free === 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                                    Limite atteinte. Passez au plan Pro pour continuer à publier.
                                </div>
                            )}
                            <p className="text-xs text-gray-400">
                                {sub?.remaining_free > 0
                                    ? `Il vous reste ${sub.remaining_free} annonce(s) gratuite(s)`
                                    : 'Plan gratuit — 5 annonces maximum'}
                            </p>
                            <Link to="/upgrade"
                                className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm transition">
                                💎 Passer au plan Pro — annonces illimitées
                            </Link>
                        </div>
                    )}
                </div>

                {/* Boutique */}
                {user.shop ? (
                    <Link to="/my-shop" className="bg-white rounded-2xl shadow p-4 flex items-center gap-3 hover:shadow-md transition">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {user.shop.logo_url
                                ? <img src={user.shop.logo_url} alt={user.shop.name} className="w-full h-full object-cover" />
                                : <span className="text-2xl">🏪</span>
                            }
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{user.shop.name}</p>
                            <p className={`text-xs mt-0.5 font-medium ${
                                user.shop.status === 'approved' ? 'text-green-600' :
                                user.shop.status === 'rejected' ? 'text-red-500' : 'text-amber-600'
                            }`}>
                                {user.shop.status === 'approved' ? '✅ Approuvée' :
                                 user.shop.status === 'rejected' ? '❌ Non approuvée' : '⏳ En attente de validation'}
                            </p>
                        </div>
                        <span className="text-gray-400">›</span>
                    </Link>
                ) : (
                    <Link to="/my-shop"
                        className="bg-white rounded-2xl shadow p-4 flex items-center gap-3 hover:shadow-md transition border-2 border-dashed border-green-200">
                        <span className="text-2xl">🏪</span>
                        <div className="flex-1">
                            <p className="font-semibold text-green-700">Créer ma boutique</p>
                            <p className="text-xs text-gray-400">Donnez une vitrine professionnelle à vos annonces</p>
                        </div>
                        <span className="text-green-400">›</span>
                    </Link>
                )}

                {/* ── Section Parrainage ─────────────────────────────────────── */}
                {referral && (
                    <ReferralSection referral={referral} />
                )}

                <div className="bg-white rounded-2xl shadow-card overflow-hidden">
                    {[
                        { to: '/my-listings', label: '📋 Mes annonces' },
                        { to: '/orders',      label: '🛍️ Mes commandes' },
                        { to: '/messages',    label: '💬 Mes messages' },
                        { to: '/favorites',   label: '❤️ Mes favoris' },
                    ].map(item => (
                        <Link key={item.to} to={item.to}
                            className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 border-b border-gray-50 transition-colors">
                            <span className="font-medium text-gray-700">{item.label}</span>
                            <span className="text-gray-300 text-lg">›</span>
                        </Link>
                    ))}
                    {user.role === 'livreur' && (
                        <Link to="/livreur" className="flex items-center justify-between px-5 py-4 hover:bg-blue-50 border-b transition-colors">
                            <span className="font-medium text-blue-600">🚗 Mes livraisons</span>
                            <span className="text-blue-300 text-lg">›</span>
                        </Link>
                    )}
                    {user.role === 'admin' && (
                        <Link to="/admin" className="flex items-center justify-between px-5 py-4 hover:bg-red-50 border-b transition-colors">
                            <span className="font-medium text-red-600">🛡️ Administration</span>
                            <span className="text-red-300 text-lg">›</span>
                        </Link>
                    )}
                    <button onClick={handleLogout}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-red-50 text-red-500 transition-colors border-b border-gray-50">
                        <span className="font-medium">🚪 Se déconnecter</span>
                        <span className="text-lg">›</span>
                    </button>
                    <button onClick={openDeleteModal}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-red-50 text-red-400 transition-colors">
                        <span className="font-medium text-sm">🗑️ Supprimer mon compte</span>
                        <span className="text-lg">›</span>
                    </button>
                </div>
            </div>

            {/* ── Modal suppression de compte ─────────────────────────────── */}
            {showDelete && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
                    onClick={(e) => e.target === e.currentTarget && setShowDelete(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="text-center mb-5">
                            <div className="text-4xl mb-3">⚠️</div>
                            <h2 className="font-bold text-gray-900 text-lg">Supprimer mon compte</h2>
                            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                                Cette action est <strong>irréversible</strong>. Toutes vos données personnelles seront effacées. Vos annonces et historique de commandes seront anonymisés.
                            </p>
                        </div>

                        <form onSubmit={handleDeleteAccount} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Confirmez avec votre mot de passe
                                </label>
                                <input
                                    type="password"
                                    placeholder="Votre mot de passe"
                                    value={deletePassword}
                                    onChange={(e) => setDeletePassword(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                                    autoFocus
                                />
                            </div>

                            {deleteError && (
                                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{deleteError}</p>
                            )}

                            <button
                                type="submit"
                                disabled={deleteLoading || !deletePassword}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-40 text-sm"
                            >
                                {deleteLoading ? 'Suppression…' : 'Oui, supprimer définitivement'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowDelete(false)}
                                className="w-full text-gray-500 text-sm py-2 hover:text-gray-700 transition"
                            >
                                Annuler
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Modal modifier profil ────────────────────────────────────── */}
            {showEdit && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
                    onClick={(e) => e.target === e.currentTarget && setShowEdit(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="font-bold text-gray-900">Modifier mon profil</h2>
                            <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                        </div>

                        {editSuccess ? (
                            <div className="text-center py-6">
                                <div className="text-4xl mb-2">✅</div>
                                <p className="text-green-700 font-semibold">Profil mis à jour !</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSaveProfile} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                                    <input
                                        type="email"
                                        placeholder="votre@email.com"
                                        value={editForm.email}
                                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Pour recevoir commandes et paiements par email</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Ville</label>
                                    <select
                                        value={editForm.city}
                                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                    >
                                        {VILLES_EDIT.map(v => <option key={v}>{v}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Quartier</label>
                                    <input
                                        type="text"
                                        placeholder="Hamdallaye, Kipé…"
                                        value={editForm.quartier}
                                        onChange={(e) => setEditForm({ ...editForm, quartier: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>

                                <button type="submit" disabled={editLoading}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 text-sm">
                                    {editLoading ? 'Enregistrement…' : 'Enregistrer'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
