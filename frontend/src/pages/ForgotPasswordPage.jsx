import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'

const STEPS = { PHONE: 1, OTP: 2, PASSWORD: 3, DONE: 4 }

export default function ForgotPasswordPage() {
    const navigate = useNavigate()
    const [step, setStep]               = useState(STEPS.PHONE)
    const [phone, setPhone]             = useState('')
    const [otp, setOtp]                 = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirm, setConfirm]         = useState('')
    const [error, setError]             = useState('')
    const [loading, setLoading]         = useState(false)

    async function sendOTP(e) {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await api.post('/accounts/forgot-password/', { phone_number: phone })
            setStep(STEPS.OTP)
        } catch (err) {
            setError(err.response?.data?.error || 'Erreur lors de l\'envoi du code.')
        } finally {
            setLoading(false)
        }
    }

    function verifyOTP(e) {
        e.preventDefault()
        setError('')
        if (otp.trim().length < 4) {
            setError('Veuillez saisir le code reçu par SMS.')
            return
        }
        setStep(STEPS.PASSWORD)
    }

    async function resetPassword(e) {
        e.preventDefault()
        setError('')
        if (newPassword !== confirm) {
            setError('Les mots de passe ne correspondent pas.')
            return
        }
        if (newPassword.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caractères.')
            return
        }
        setLoading(true)
        try {
            await api.post('/accounts/reset-password/', {
                phone_number: phone,
                code: otp.trim(),
                new_password: newPassword,
            })
            setStep(STEPS.DONE)
        } catch (err) {
            setError(err.response?.data?.error || 'Code invalide ou expiré.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow p-8 w-full max-w-md">
                <h1 className="text-2xl font-bold text-center text-green-700 mb-1">Guimatrix</h1>
                <p className="text-center text-xs text-green-600 font-medium mb-2">Le marché intelligent de la Guinée</p>

                {/* Stepper */}
                {step !== STEPS.DONE && (
                    <div className="flex items-center justify-center gap-2 mb-6">
                        {[STEPS.PHONE, STEPS.OTP, STEPS.PASSWORD].map((s, i) => (
                            <div key={s} className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                                    ${step >= s ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                                    {i + 1}
                                </div>
                                {i < 2 && <div className={`h-0.5 w-8 ${step > s ? 'bg-green-600' : 'bg-gray-200'}`} />}
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
                )}

                {/* Étape 1 : Numéro */}
                {step === STEPS.PHONE && (
                    <>
                        <p className="text-center text-gray-500 mb-6 text-sm">
                            Saisissez votre numéro de téléphone pour recevoir un code de réinitialisation.
                        </p>
                        <form onSubmit={sendOTP} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de téléphone</label>
                                <input
                                    type="text"
                                    placeholder="+224620000001"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
                            >
                                {loading ? 'Envoi...' : 'Recevoir le code SMS'}
                            </button>
                        </form>
                    </>
                )}

                {/* Étape 2 : OTP */}
                {step === STEPS.OTP && (
                    <>
                        <p className="text-center text-gray-500 mb-6 text-sm">
                            Un code a été envoyé au <strong>{phone}</strong>. Saisissez-le ci-dessous.
                        </p>
                        <form onSubmit={verifyOTP} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Code de vérification</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="123456"
                                    value={otp}
                                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                                    maxLength={6}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition"
                            >
                                Vérifier le code
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep(STEPS.PHONE)}
                                className="w-full text-sm text-gray-500 hover:underline"
                            >
                                ← Changer de numéro
                            </button>
                        </form>
                    </>
                )}

                {/* Étape 3 : Nouveau mot de passe */}
                {step === STEPS.PASSWORD && (
                    <>
                        <p className="text-center text-gray-500 mb-6 text-sm">
                            Choisissez un nouveau mot de passe sécurisé.
                        </p>
                        <form onSubmit={resetPassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                    autoFocus
                                    minLength={6}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirm}
                                    onChange={e => setConfirm(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                    minLength={6}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
                            >
                                {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
                            </button>
                        </form>
                    </>
                )}

                {/* Succès */}
                {step === STEPS.DONE && (
                    <div className="text-center py-6">
                        <p className="text-5xl mb-4">✅</p>
                        <h2 className="text-lg font-bold text-gray-800 mb-2">Mot de passe réinitialisé !</h2>
                        <p className="text-gray-500 text-sm mb-6">
                            Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg transition"
                        >
                            Se connecter
                        </button>
                    </div>
                )}

                {step !== STEPS.DONE && (
                    <p className="text-center text-sm text-gray-500 mt-6">
                        <Link to="/login" className="text-green-600 hover:underline">← Retour à la connexion</Link>
                    </p>
                )}
            </div>
        </div>
    )
}
