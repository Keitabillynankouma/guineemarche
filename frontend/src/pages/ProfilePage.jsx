import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from '../store/authStore'

export default function ProfilePage() {
    const { user, fetchMe, logout, isAuthenticated } = useAuthStore()
    const navigate = useNavigate()

    useEffect(() => {
        if (!isAuthenticated) navigate('/login')
        else fetchMe()
    }, [])

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
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">👤</div>
                    <h1 className="text-xl font-bold text-gray-800">{user.full_name}</h1>
                    <p className="text-gray-500">{String(user.phone_number)}</p>
                    <p className="text-sm text-gray-400 mt-1">📍 {user.city} {user.quartier && `· ${user.quartier}`}</p>
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

                <div className="bg-white rounded-2xl shadow overflow-hidden">
                    <Link to="/my-listings" className="flex items-center justify-between p-4 hover:bg-gray-50 border-b">
                        <span className="font-medium text-gray-700">📋 Mes annonces</span>
                        <span className="text-gray-400">›</span>
                    </Link>
                    <Link to="/messages" className="flex items-center justify-between p-4 hover:bg-gray-50 border-b">
                        <span className="font-medium text-gray-700">💬 Mes messages</span>
                        <span className="text-gray-400">›</span>
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-between p-4 hover:bg-red-50 text-red-500"
                    >
                        <span className="font-medium">🚪 Se déconnecter</span>
                        <span>›</span>
                    </button>
                </div>
            </div>
        </div>
    )
}