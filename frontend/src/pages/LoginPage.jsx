import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useAuthStore from '../store/authStore'

export default function LoginPage() {
    const [form, setForm] = useState({ phone_number: '', password: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const login = useAuthStore((s) => s.login)
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await login(form.phone_number, form.password)
            navigate('/')
        } catch (err) {
            setError(err.response?.data?.non_field_errors?.[0] || 'Erreur de connexion.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow p-8 w-full max-w-md">
                <h1 className="text-2xl font-bold text-center text-green-700 mb-1">Guimatrix</h1>
                <p className="text-center text-xs text-green-600 font-medium mb-1">Le marché intelligent de la Guinée</p>
                <p className="text-center text-gray-500 mb-6 text-sm">Connectez-vous à votre compte</p>

                {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de téléphone</label>
                        <input
                            type="text"
                            placeholder="+224620000001"
                            value={form.phone_number}
                            onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                        />
                    </div>
                    <div className="flex justify-end">
                        <Link to="/forgot-password" className="text-xs text-green-600 hover:underline">
                            Mot de passe oublié ?
                        </Link>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
                    >
                        {loading ? 'Connexion...' : 'Se connecter'}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-6">
                    Pas encore de compte ?{' '}
                    <Link to="/register" className="text-green-600 font-medium hover:underline">S'inscrire</Link>
                </p>
            </div>
        </div>
    )
}