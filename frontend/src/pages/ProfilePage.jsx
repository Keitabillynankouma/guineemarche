import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from '../store/authStore'
import { authAPI } from '../services/api'

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

    const handleLogout = async () => {
        await logout()
        navigate('/')
    }

    if (!user) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-green-600">Chargement...</div>
        </div>
    )

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Link to="/" className="text-green-700 font-bold text-lg">GuinéeMarché</Link>
                </div>
            </nav>

            <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
                <div className="bg-white rounded-2xl shadow p-6 text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 overflow-hidden">
                        {user.profile?.avatar_url
                            ? <img src={user.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                            : '👤'}
                    </div>
                    <h1 className="text-xl font-bold text-gray-800">{user.full_name}</h1>
                    <p className="text-gray-500">{String(user.phone_number)}</p>
                    <p className="text-sm text-gray-400 mt-1">📍 {user.city}{user.quartier && ` · ${user.quartier}`}</p>
                    {user.profile && (
                        <div className="flex justify-center gap-6 mt-4 text-sm">
                            <div className="text-center">
                                <p className="font-bold text-gray-800">{user.profile.rating_avg?.toFixed(1) || '0.0'}</p>
                                <p className="text-gray-400">Note</p>
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-gray-800">{user.profile.total_ratings}</p>
                                <p className="text-gray-400">Avis</p>
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-gray-800">{user.profile.total_sales}</p>
                                <p className="text-gray-400">Ventes</p>
                            </div>
                        </div>
                    )}
                </div>

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

                <div className="bg-white rounded-2xl shadow overflow-hidden">
                    <Link to="/my-listings" className="flex items-center justify-between p-4 hover:bg-gray-50 border-b">
                        <span className="font-medium text-gray-700">📋 Mes annonces</span>
                        <span className="text-gray-400">›</span>
                    </Link>
                    <Link to="/orders" className="flex items-center justify-between p-4 hover:bg-gray-50 border-b">
                        <span className="font-medium text-gray-700">🛍️ Mes commandes</span>
                        <span className="text-gray-400">›</span>
                    </Link>
                    <Link to="/messages" className="flex items-center justify-between p-4 hover:bg-gray-50 border-b">
                        <span className="font-medium text-gray-700">💬 Mes messages</span>
                        <span className="text-gray-400">›</span>
                    </Link>
                    <button onClick={handleLogout}
                        className="w-full flex items-center justify-between p-4 hover:bg-red-50 text-red-500">
                        <span className="font-medium">🚪 Se déconnecter</span>
                        <span>›</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
