import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../services/api'

export default function RegisterPage() {
    const [step, setStep] = useState(1)
    const [form, setForm] = useState({
        phone_number: '', full_name: '', password: '', password2: '',
        city: 'Conakry', quartier: ''
    })
    const [otp, setOtp] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleRegister = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await authAPI.register(form)
            setStep(2)
        } catch (err) {
            const data = err.response?.data
            setError(Object.values(data || {})[0]?.[0] || 'Erreur inscription.')
        } finally {
            setLoading(false)
        }
    }

    const handleVerify = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const res = await authAPI.verifyOTP({
                phone_number: form.phone_number,
                code: otp,
                purpose: 'register'
            })
            localStorage.setItem('access_token', res.data.tokens.access)
            localStorage.setItem('refresh_token', res.data.tokens.refresh)
            navigate('/')
        } catch (err) {
            setError(err.response?.data?.non_field_errors?.[0] || 'Code invalide.')
        } finally {
            setLoading(false)
        }
    }

    const QUARTIERS = ['Kaloum', 'Dixinn', 'Matam', 'Ratoma', 'Matoto']
    const VILLES = ['Conakry', 'Kankan', 'Labé', 'Kindia', 'Faranah', 'Nzérékoré', 'Siguiri']

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow p-8 w-full max-w-md">
                <h1 className="text-2xl font-bold text-center text-green-700 mb-2">GuinéeMarché</h1>
                <p className="text-center text-gray-500 mb-6">
                    {step === 1 ? 'Créer votre compte' : 'Vérifiez votre numéro'}
                </p>

                {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

                {step === 1 ? (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <input
                            type="text" placeholder="Nom complet"
                            value={form.full_name}
                            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                        />
                        <input
                            type="text" placeholder="+224620000001"
                            value={form.phone_number}
                            onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                        />
                        <select
                            value={form.city}
                            onChange={(e) => setForm({ ...form, city: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                            {VILLES.map(v => <option key={v}>{v}</option>)}
                        </select>
                        <select
                            value={form.quartier}
                            onChange={(e) => setForm({ ...form, quartier: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                            <option value="">Choisir un quartier</option>
                            {QUARTIERS.map(q => <option key={q}>{q}</option>)}
                        </select>
                        <input
                            type="password" placeholder="Mot de passe"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                        />
                        <input
                            type="password" placeholder="Confirmer le mot de passe"
                            value={form.password2}
                            onChange={(e) => setForm({ ...form, password2: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                        />
                        <button
                            type="submit" disabled={loading}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
                        >
                            {loading ? 'Inscription...' : "S'inscrire"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerify} className="space-y-4">
                        <p className="text-sm text-gray-600 text-center">
                            Entrez le code à 6 chiffres envoyé au {form.phone_number}
                        </p>
                        <input
                            type="text" placeholder="000000" maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                        />
                        <button
                            type="submit" disabled={loading}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
                        >
                            {loading ? 'Vérification...' : 'Vérifier'}
                        </button>
                    </form>
                )}

                <p className="text-center text-sm text-gray-500 mt-6">
                    Déjà un compte ?{' '}
                    <Link to="/login" className="text-green-600 font-medium hover:underline">Se connecter</Link>
                </p>
            </div>
        </div>
    )
}