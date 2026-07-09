import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'

const STEPS = { PHONE: 1, OTP: 2, PASSWORD: 3, DONE: 4 }

const EyeIcon = ({ show }) => show
  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>

const Spinner = () => <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />

function StepBar({ step }) {
  const steps = [
    { id: STEPS.PHONE, label: 'Téléphone' },
    { id: STEPS.OTP,   label: 'Code SMS' },
    { id: STEPS.PASSWORD, label: 'Mot de passe' },
  ]
  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center flex-1">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step > s.id ? 'bg-green-600 text-white' :
              step === s.id ? 'bg-green-600 text-white ring-4 ring-green-100' :
              'bg-gray-100 text-gray-400'
            }`}>
              {step > s.id
                ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                : i + 1
              }
            </div>
            <span className={`text-xs mt-1 font-medium ${step >= s.id ? 'text-green-600' : 'text-gray-400'}`}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${step > s.id ? 'bg-green-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep]               = useState(STEPS.PHONE)
  const [phone, setPhone]             = useState('')
  const [otp, setOtp]                 = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm]         = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [showPwd, setShowPwd]         = useState(false)
  const [showConf, setShowConf]       = useState(false)

  async function sendOTP(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await api.post('/accounts/forgot-password/', { phone_number: phone })
      setStep(STEPS.OTP)
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'envoi du code.")
    } finally { setLoading(false) }
  }

  function verifyOTP(e) {
    e.preventDefault()
    setError('')
    if (otp.trim().length < 4) { setError('Veuillez saisir le code reçu par SMS.'); return }
    setStep(STEPS.PASSWORD)
  }

  async function resetPassword(e) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    if (newPassword.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return }
    setLoading(true)
    try {
      await api.post('/accounts/reset-password/', { phone_number: phone, code: otp.trim(), new_password: newPassword })
      setStep(STEPS.DONE)
    } catch (err) {
      setError(err.response?.data?.error || 'Code invalide ou expiré.')
    } finally { setLoading(false) }
  }

  const inputClass = "w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 focus:bg-white transition-all"

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center shadow-md shadow-green-500/30">
              <span className="text-white font-black text-base">G</span>
            </div>
            <span className="text-xl font-black text-gray-900">Guimatrix</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

          {/* Titre */}
          {step !== STEPS.DONE && (
            <div className="text-center mb-6">
              <h1 className="text-xl font-black text-gray-900 mb-1">Réinitialiser le mot de passe</h1>
              <p className="text-sm text-gray-500">Suivez les étapes pour créer un nouveau mot de passe</p>
            </div>
          )}

          {/* Stepper */}
          {step !== STEPS.DONE && <StepBar step={step} />}

          {/* Erreur */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 p-3.5 rounded-xl mb-5 text-sm">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* ── Étape 1 : Téléphone ──────────────────────────────────────── */}
          {step === STEPS.PHONE && (
            <form onSubmit={sendOTP} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Numéro de téléphone</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                  </div>
                  <input type="text" placeholder="+224 620 00 00 01" value={phone} onChange={e => setPhone(e.target.value)}
                    className={inputClass} required autoFocus />
                </div>
                <p className="text-xs text-gray-400 mt-1.5 ml-1">Vous recevrez un code SMS de vérification</p>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600
                  text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-green-500/20
                  disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><Spinner /> Envoi du code...</> : 'Recevoir le code SMS →'}
              </button>
            </form>
          )}

          {/* ── Étape 2 : Code SMS ────────────────────────────────────────── */}
          {step === STEPS.OTP && (
            <form onSubmit={verifyOTP} className="space-y-4">
              <div className="bg-green-50 border border-green-100 rounded-xl p-3.5 mb-2 text-sm text-green-700">
                📱 Code envoyé au <strong>{phone}</strong>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Code de vérification</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  </div>
                  <input type="text" inputMode="numeric" placeholder="123456" value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} maxLength={6}
                    className={`${inputClass} text-center text-2xl tracking-widest font-mono`}
                    required autoFocus />
                </div>
              </div>
              <button type="submit"
                className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600
                  text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-green-500/20
                  flex items-center justify-center gap-2">
                Vérifier le code →
              </button>
              <button type="button" onClick={() => setStep(STEPS.PHONE)}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-2">
                ← Changer de numéro
              </button>
            </form>
          )}

          {/* ── Étape 3 : Nouveau mot de passe ───────────────────────────── */}
          {step === STEPS.PASSWORD && (
            <form onSubmit={resetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nouveau mot de passe</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  </div>
                  <input type={showPwd ? 'text' : 'password'} placeholder="••••••••" value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className={`${inputClass} pr-10`} required autoFocus minLength={6} />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <EyeIcon show={showPwd} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Confirmer le mot de passe</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  </div>
                  <input type={showConf ? 'text' : 'password'} placeholder="••••••••" value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className={`${inputClass} pr-10`} required minLength={6} />
                  <button type="button" onClick={() => setShowConf(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <EyeIcon show={showConf} />
                  </button>
                </div>
                {confirm && newPassword !== confirm && (
                  <p className="text-xs text-red-500 mt-1.5 ml-1">Les mots de passe ne correspondent pas</p>
                )}
                {confirm && newPassword === confirm && confirm.length >= 6 && (
                  <p className="text-xs text-green-600 mt-1.5 ml-1">✓ Les mots de passe correspondent</p>
                )}
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600
                  text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-green-500/20
                  disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><Spinner /> Réinitialisation...</> : 'Définir le nouveau mot de passe →'}
              </button>
            </form>
          )}

          {/* ── Succès ───────────────────────────────────────────────────── */}
          {step === STEPS.DONE && (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-green-50 border-2 border-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">Mot de passe réinitialisé !</h2>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                Votre mot de passe a été changé avec succès.<br />
                Vous pouvez maintenant vous connecter.
              </p>
              <button onClick={() => navigate('/login')}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600
                  text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-green-500/20">
                Se connecter →
              </button>
            </div>
          )}

          {/* Lien retour */}
          {step !== STEPS.DONE && (
            <p className="text-center text-sm text-gray-400 mt-6">
              <Link to="/login" className="text-green-600 font-medium hover:underline">← Retour à la connexion</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
