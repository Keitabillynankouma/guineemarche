import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { authAPI } from '../services/api'

const VILLES = ['Conakry', 'Kankan', 'Labé', 'Kindia', 'Faranah', 'Nzérékoré', 'Siguiri', 'Mamou', 'Boké', 'Coyah']
const QUARTIERS = ['Kaloum', 'Dixinn', 'Matam', 'Ratoma', 'Matoto']

export default function RegisterPage() {
    const [searchParams] = useSearchParams()
    const refCode = searchParams.get('ref') || ''
    const navigate = useNavigate()

    // Mode : 'guinea' (téléphone + SMS OTP) ou 'diaspora' (email + email OTP)
    const [mode, setMode] = useState('guinea')

    // Formulaire commun
    const [form, setForm] = useState({
        full_name: '', city: 'Conakry', quartier: '', referral_code: refCode,
        // Guinea
        phone_number: '', email: '',
        // Diaspora
        password: '', password2: '',
    })
    const [otp, setOtp] = useState('')
    const [step, setStep] = useState(1)   // 1 = formulaire, 2 = vérification OTP
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [acceptedTerms, setAcceptedTerms] = useState(false)

    useEffect(() => {
        if (refCode) setForm(f => ({ ...f, referral_code: refCode }))
    }, [refCode])

    // ── Inscription ───────────────────────────────────────────────────────────
    const handleRegister = async (e) => {
        e.preventDefault()
        if (!acceptedTerms) {
            setError("Vous devez accepter les conditions d'utilisation.")
            return
        }
        setError('')
        setLoading(true)
        try {
            if (mode === 'guinea') {
                await authAPI.register({
                    phone_number: form.phone_number,
                    email: form.email || undefined,
                    full_name: form.full_name,
                    password: form.password,
                    password2: form.password2,
                    city: form.city,
                    quartier: form.quartier,
                    referral_code: form.referral_code,
                })
            } else {
                await authAPI.registerEmail({
                    email: form.email,
                    full_name: form.full_name,
                    password: form.password,
                    password2: form.password2,
                    city: form.city,
                    quartier: form.quartier,
                    referral_code: form.referral_code,
                })
            }
            setStep(2)
        } catch (err) {
            const data = err.response?.data
            const msg = typeof data === 'string'
                ? data
                : Object.values(data || {})[0]?.[0] || "Erreur lors de l'inscription."
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    // ── Vérification OTP ─────────────────────────────────────────────────────
    const handleVerify = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            let res
            if (mode === 'guinea') {
                res = await authAPI.verifyOTP({
                    phone_number: form.phone_number,
                    code: otp,
                    purpose: 'register',
                })
            } else {
                res = await authAPI.verifyEmailOTP({
                    email: form.email,
                    code: otp,
                })
            }
            localStorage.setItem('access_token', res.data.tokens.access)
            localStorage.setItem('refresh_token', res.data.tokens.refresh)
            navigate('/')
        } catch (err) {
            setError(err.response?.data?.non_field_errors?.[0] || 'Code invalide ou expiré.')
        } finally {
            setLoading(false)
        }
    }

    const f = (field) => (e) => setForm({ ...form, [field]: e.target.value })

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow p-8 w-full max-w-md">

                {/* Logo */}
                <h1 className="text-2xl font-bold text-center text-green-700 mb-1">Guimatrix</h1>
                <p className="text-center text-gray-500 mb-5 text-sm">
                    {step === 1 ? 'Créer votre compte' : 'Vérification'}
                </p>

                {/* Toggle Guinée / Diaspora — seulement en step 1 */}
                {step === 1 && (
                    <div className="flex rounded-xl border border-gray-200 p-1 mb-6 gap-1">
                        <button
                            type="button"
                            onClick={() => { setMode('guinea'); setError('') }}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                                mode === 'guinea'
                                    ? 'bg-green-600 text-white shadow'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            🇬🇳 Je suis en Guinée
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMode('diaspora'); setError('') }}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                                mode === 'diaspora'
                                    ? 'bg-green-600 text-white shadow'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            🌍 Diaspora
                        </button>
                    </div>
                )}

                {mode === 'diaspora' && step === 1 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-700">
                        📧 Inscrivez-vous avec votre Gmail ou tout autre email — pas besoin de numéro guinéen.
                    </div>
                )}

                {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

                {/* ── STEP 1 : Formulaire ───────────────────────────────────── */}
                {step === 1 && (
                    <form onSubmit={handleRegister} className="space-y-4">

                        <input
                            type="text" placeholder="Nom complet"
                            value={form.full_name} onChange={f('full_name')}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                        />

                        {/* Email — toujours affiché, obligatoire en mode diaspora */}
                        <input
                            type="email"
                            placeholder={mode === 'diaspora' ? 'Votre adresse email (Gmail, etc.)' : 'Email (optionnel — pour les notifications)'}
                            value={form.email} onChange={f('email')}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            required={mode === 'diaspora'}
                        />

                        {/* Numéro de téléphone — uniquement mode Guinée */}
                        {mode === 'guinea' && (
                            <input
                                type="text" placeholder="Numéro de téléphone (+224…)"
                                value={form.phone_number} onChange={f('phone_number')}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                                required
                            />
                        )}

                        <select
                            value={form.city} onChange={f('city')}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                            {VILLES.map(v => <option key={v}>{v}</option>)}
                        </select>

                        {mode === 'guinea' && (
                            <select
                                value={form.quartier} onChange={f('quartier')}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                <option value="">Choisir un quartier</option>
                                {QUARTIERS.map(q => <option key={q}>{q}</option>)}
                            </select>
                        )}

                        <input
                            type="password" placeholder="Mot de passe (6 caractères min.)"
                            value={form.password} onChange={f('password')}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                        />
                        <input
                            type="password" placeholder="Confirmer le mot de passe"
                            value={form.password2} onChange={f('password2')}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                        />

                        <div>
                            <input
                                type="text" placeholder="Code de parrainage (facultatif)"
                                value={form.referral_code}
                                onChange={(e) => setForm({ ...form, referral_code: e.target.value.toUpperCase() })}
                                className={`w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono tracking-wider ${form.referral_code ? 'border-green-400 bg-green-50' : 'border-gray-300'}`}
                                maxLength={12}
                            />
                            {form.referral_code && (
                                <p className="text-xs text-green-600 mt-1">🎁 Code appliqué — vous gagnez des annonces gratuites !</p>
                            )}
                        </div>

                        <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={acceptedTerms}
                                onChange={e => setAcceptedTerms(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 flex-shrink-0"
                            />
                            <span className="text-xs text-gray-600 leading-relaxed">
                                J'accepte les{' '}
                                <a href="/terms" target="_blank" className="text-green-600 font-medium hover:underline">Conditions d'utilisation</a>
                                {' '}et la{' '}
                                <a href="/terms" target="_blank" className="text-green-600 font-medium hover:underline">Politique de confidentialité</a>
                                {' '}de Guimatrix.
                            </span>
                        </label>

                        <button
                            type="submit" disabled={loading || !acceptedTerms}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
                        >
                            {loading ? 'Inscription...' : "S'inscrire"}
                        </button>
                    </form>
                )}

                {/* ── STEP 2 : Vérification OTP ─────────────────────────────── */}
                {step === 2 && (
                    <form onSubmit={handleVerify} className="space-y-4">
                        <div className="text-center">
                            <div className="text-4xl mb-3">{mode === 'diaspora' ? '📧' : '📱'}</div>
                            <p className="text-sm text-gray-600">
                                {mode === 'diaspora'
                                    ? <>Code envoyé à <strong>{form.email}</strong><br /><span className="text-xs text-gray-400">Vérifiez vos spams si nécessaire — expire dans 30 min</span></>
                                    : <>Code envoyé au <strong>{form.phone_number}</strong></>
                                }
                            </p>
                        </div>
                        <input
                            type="text" placeholder="000000" maxLength={6}
                            value={otp} onChange={(e) => setOtp(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-4 text-center text-3xl tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                            required autoFocus
                        />
                        <button
                            type="submit" disabled={loading}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
                        >
                            {loading ? 'Vérification...' : 'Vérifier mon compte'}
                        </button>
                        <button type="button" onClick={() => setStep(1)}
                            className="w-full text-sm text-gray-400 hover:text-gray-600 transition">
                            ← Retour
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
