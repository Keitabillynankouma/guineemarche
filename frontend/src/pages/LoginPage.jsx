import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useAuthStore from '../store/authStore'

const EyeIcon = ({ show }) => show
  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>

function BrandPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-green-800 via-green-600 to-emerald-500 p-10 text-white relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full" />
      <div className="absolute -bottom-24 -left-12 w-96 h-96 bg-white/5 rounded-full" />

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <span className="text-white font-black text-lg">G</span>
          </div>
          <span className="text-2xl font-black tracking-tight">Guimatrix</span>
        </div>
        <p className="text-green-100 text-sm">La marketplace intelligente de la Guinée</p>
      </div>

      <div className="relative z-10">
        <p className="text-4xl mb-6">💬</p>
        <blockquote className="text-lg font-medium leading-relaxed text-white/90 mb-6">
          "Guimatrix m'a permis de vendre mes produits à la diaspora depuis Conakry. Simple, rapide et sécurisé."
        </blockquote>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-lg">👤</div>
          <div>
            <p className="font-semibold text-sm">Aissatou Bah</p>
            <p className="text-green-200 text-xs">Vendeuse à Conakry · 4.9★</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-3 gap-3">
        {[['10K+', 'Annonces'], ['5K+', 'Membres'], ['4.8★', 'Satisfaction']].map(([val, lbl]) => (
          <div key={lbl} className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
            <p className="text-lg font-black">{val}</p>
            <p className="text-green-200 text-xs">{lbl}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [showPwd, setShowPwd]       = useState(false)
  const login    = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  const isEmail = identifier.includes('@')
  const Spinner = () => <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(identifier, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.non_field_errors?.[0] || 'Identifiants incorrects.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="min-h-screen lg:grid lg:grid-cols-2">

        <BrandPanel />

        <div className="flex flex-col justify-center px-6 py-12 lg:px-12 xl:px-16 bg-white">

          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-1">
              <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center shadow-md shadow-green-500/30">
                <span className="text-white font-black text-base">G</span>
              </div>
              <span className="text-xl font-black text-gray-900">Guimatrix</span>
            </div>
            <p className="text-xs text-gray-500">La marketplace de la Guinée</p>
          </div>

          <div className="w-full max-w-md mx-auto">

            <div className="mb-8">
              <h1 className="text-2xl font-black text-gray-900 mb-1">Bon retour 👋</h1>
              <p className="text-sm text-gray-500">
                Pas encore de compte ?{' '}
                <Link to="/register" className="text-green-600 font-semibold hover:underline">S'inscrire gratuitement</Link>
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 p-3.5 rounded-xl mb-6 text-sm">
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Identifiant */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  {isEmail ? 'Adresse email' : 'Téléphone ou email'}
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    {isEmail
                      ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                    }
                  </div>
                  <input
                    type="text"
                    placeholder="+224620000001 ou votre@gmail.com"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900
                      placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500
                      focus:bg-white transition-all"
                    required
                    autoComplete="username"
                  />
                </div>
                {isEmail && (
                  <p className="text-xs text-green-600 mt-1.5 ml-1">✓ Connexion internationale détectée</p>
                )}
              </div>

              {/* Mot de passe */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mot de passe</label>
                  <Link to="/forgot-password" className="text-xs text-green-600 hover:underline font-medium">Mot de passe oublié ?</Link>
                </div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  </div>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900
                      placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500
                      focus:bg-white transition-all"
                    required
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <EyeIcon show={showPwd} />
                  </button>
                </div>
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600
                  text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-green-500/20
                  disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <><Spinner /> Connexion en cours...</> : 'Se connecter →'}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 font-medium">ou</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <Link to="/register"
              className="w-full flex items-center justify-center gap-2 border-2 border-gray-200 hover:border-green-400
                hover:bg-green-50/50 text-gray-700 hover:text-green-700 font-semibold py-3 rounded-xl transition-all text-sm">
              Créer un compte gratuitement
            </Link>

          </div>
        </div>
      </div>
    </div>
  )
}
