import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { authAPI } from '../services/api'

const VILLES = ['Conakry', 'Kankan', 'Labé', 'Kindia', 'Faranah', 'Nzérékoré', 'Siguiri', 'Mamou', 'Boké', 'Coyah']

// ── Input avec icône ───────────────────────────────────────────────────────────
function Input({ icon, label, right, error, className = '', ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">{icon}</div>}
        <input
          className={`w-full bg-gray-50 border border-gray-200 rounded-xl py-3 text-sm text-gray-900
            placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500
            focus:bg-white transition-all ${icon ? 'pl-10' : 'px-4'} ${right ? 'pr-10' : 'pr-4'} ${className}`}
          {...props}
        />
        {right && <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{right}</div>}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function SelectField({ icon, label, children, className = '', ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">{icon}</div>}
        <select
          className={`w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pr-4 text-sm text-gray-900
            focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500
            focus:bg-white transition-all appearance-none ${icon ? 'pl-10' : 'pl-4'} ${className}`}
          {...props}
        >
          {children}
        </select>
      </div>
    </div>
  )
}

// ── OTP 6 cases ────────────────────────────────────────────────────────────────
function OTPInput({ value, onChange }) {
  const refs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)]
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '')

  const handleChange = (i, e) => {
    const v = e.target.value.replace(/\D/g, '').slice(-1)
    const next = digits.map((d, idx) => (idx === i ? v : d)).join('')
    onChange(next)
    if (v && i < 5) refs[i + 1].current?.focus()
  }

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      const next = digits.map((d, idx) => (idx === i ? '' : d)).join('')
      onChange(next)
      if (!digits[i] && i > 0) refs[i - 1].current?.focus()
    }
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted) { onChange(pasted); refs[Math.min(pasted.length, 5)].current?.focus() }
    e.preventDefault()
  }

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          autoFocus={i === 0}
          className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold border-2 rounded-xl
            bg-gray-50 text-gray-900 transition-all focus:outline-none
            border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:bg-white"
          style={{ height: '3.25rem' }}
        />
      ))}
    </div>
  )
}

// ── Panel gauche branding ──────────────────────────────────────────────────────
function BrandPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-green-800 via-green-600 to-emerald-500 p-10 text-white relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full" />
      <div className="absolute -bottom-24 -left-12 w-96 h-96 bg-white/5 rounded-full" />
      <div className="absolute top-1/2 -right-12 w-48 h-48 bg-white/5 rounded-full" />

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <span className="text-white font-black text-lg">G</span>
          </div>
          <span className="text-2xl font-black tracking-tight">Guimatrix</span>
        </div>
        <p className="text-green-100 text-sm">La marketplace intelligente de la Guinée</p>
      </div>

      <div className="relative z-10 space-y-5">
        {[
          { icon: '🛍️', title: 'Achetez & vendez', desc: 'Des milliers d\'annonces dans toutes les catégories' },
          { icon: '📱', title: 'Paiement sécurisé', desc: 'Orange Money, MTN MoMo, Visa — escrow intégré' },
          { icon: '🌍', title: 'Accessible partout', desc: 'Inscrivez-vous depuis la Guinée ou depuis l\'étranger' },
          { icon: '🤖', title: 'Recherche IA', desc: 'Trouvez ce que vous cherchez en langage naturel' },
        ].map(feat => (
          <div key={feat.title} className="flex items-start gap-4">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
              {feat.icon}
            </div>
            <div>
              <p className="font-semibold text-sm">{feat.title}</p>
              <p className="text-green-200 text-xs leading-relaxed mt-0.5">{feat.desc}</p>
            </div>
          </div>
        ))}
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

// ── Icônes SVG ────────────────────────────────────────────────────────────────
const UserIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
const MailIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
const PhoneIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
const LockIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
const MapIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
const GiftIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>
const EyeIcon = ({ show }) => show
  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>

// ── Composant principal ────────────────────────────────────────────────────────
export default function RegisterPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const refCode = searchParams.get('ref') || ''

  const [mode, setMode] = useState('guinea')
  const [step, setStep] = useState(1)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [showPwd2, setShowPwd2] = useState(false)

  const [form, setForm] = useState({
    full_name: '', city: 'Conakry', phone_number: '', email: '',
    password: '', password2: '', referral_code: refCode,
  })

  useEffect(() => { if (refCode) setForm(f => ({ ...f, referral_code: refCode })) }, [refCode])

  const f = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleRegister = async (e) => {
    e?.preventDefault()
    if (!acceptedTerms) { setError("Veuillez accepter les conditions d'utilisation."); return }
    if (form.password !== form.password2) { setError("Les mots de passe ne correspondent pas."); return }
    if (form.password.length < 6) { setError("Le mot de passe doit contenir au moins 6 caractères."); return }
    setError(''); setLoading(true)
    try {
      if (mode === 'guinea') {
        await authAPI.register({
          phone_number: form.phone_number, email: form.email || undefined,
          full_name: form.full_name, password: form.password, password2: form.password2,
          city: form.city, referral_code: form.referral_code,
        })
      } else {
        await authAPI.registerEmail({
          email: form.email, full_name: form.full_name,
          password: form.password, password2: form.password2,
          city: form.city, referral_code: form.referral_code,
        })
      }
      setStep(2)
    } catch (err) {
      const data = err.response?.data
      let msg = data?.error || data?.detail || data?.non_field_errors?.[0]
      if (!msg && typeof data === 'object') {
        // Champs spécifiques : phone_number, email, etc.
        const fieldErrors = Object.entries(data || {})
          .filter(([k]) => k !== 'non_field_errors')
          .map(([k, v]) => {
            const label = k === 'phone_number' ? 'Téléphone'
              : k === 'email' ? 'Email'
              : k === 'password' ? 'Mot de passe'
              : k === 'full_name' ? 'Nom complet'
              : k
            return `${label} : ${Array.isArray(v) ? v[0] : v}`
          })
        msg = fieldErrors[0] || "Erreur lors de l'inscription."
      }
      setError(msg || "Erreur lors de l'inscription.")
    } finally { setLoading(false) }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (otp.length < 6) { setError("Saisissez les 6 chiffres du code."); return }
    setError(''); setLoading(true)
    try {
      let res
      if (mode === 'guinea') {
        res = await authAPI.verifyOTP({ phone_number: form.phone_number, code: otp, purpose: 'register' })
      } else {
        res = await authAPI.verifyEmailOTP({ email: form.email, code: otp })
      }
      localStorage.setItem('access_token', res.data.tokens.access)
      localStorage.setItem('refresh_token', res.data.tokens.refresh)
      navigate('/')
    } catch (err) {
      const data = err.response?.data
      setError(data?.non_field_errors?.[0] || data?.error || data?.detail || 'Code invalide ou expiré. Vérifiez le code reçu ou demandez-en un nouveau.')
      setOtp('')
    } finally { setLoading(false) }
  }

  const Spinner = () => <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />

  return (
    <div className="min-h-screen bg-white">
      <div className="min-h-screen lg:grid lg:grid-cols-2">

        {/* ── Panneau gauche ───────────────────────────────────────────────── */}
        <BrandPanel />

        {/* ── Panneau droit ────────────────────────────────────────────────── */}
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

            {/* ── STEP 1 ──────────────────────────────────────────────────── */}
            {step === 1 && (
              <>
                <div className="mb-7">
                  <h1 className="text-2xl font-black text-gray-900 mb-1">Créer votre compte</h1>
                  <p className="text-sm text-gray-500">
                    Déjà inscrit ?{' '}
                    <Link to="/login" className="text-green-600 font-semibold hover:underline">Se connecter</Link>
                  </p>
                </div>

                {/* Toggle mode */}
                <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
                  {[{ key: 'guinea', label: '🇬🇳 Je suis en Guinée' }, { key: 'international', label: '🌍 Je suis à l\'étranger' }].map(m => (
                    <button key={m.key} type="button"
                      onClick={() => { setMode(m.key); setError('') }}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        mode === m.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >{m.label}</button>
                  ))}
                </div>

                {mode === 'international' && (
                  <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3.5 mb-5">
                    <span className="text-lg">📧</span>
                    <p className="text-blue-700 text-xs leading-relaxed">
                      Inscrivez-vous avec votre Gmail ou tout autre email.{' '}
                      <span className="text-blue-500">Pas besoin de numéro guinéen.</span>
                    </p>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 p-3.5 rounded-xl mb-5 text-sm">
                    <span>⚠️</span> {error}
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                  <Input icon={<UserIcon />} label="Nom complet" placeholder="Mamadou Diallo" value={form.full_name} onChange={f('full_name')} required />

                  <Input
                    icon={<MailIcon />}
                    label={mode === 'international' ? 'Adresse email' : 'Email'}
                    type="email"
                    placeholder={mode === 'international' ? 'votre@gmail.com' : 'votre@email.com (optionnel)'}
                    value={form.email} onChange={f('email')}
                    required={mode === 'international'}
                  />

                  {mode === 'guinea' && (
                    <Input icon={<PhoneIcon />} label="Téléphone" placeholder="+224 620 00 00 01" value={form.phone_number} onChange={f('phone_number')} required />
                  )}

                  {mode === 'guinea' && (
                    <SelectField icon={<MapIcon />} label="Ville" value={form.city} onChange={f('city')}>
                      {VILLES.map(v => <option key={v}>{v}</option>)}
                    </SelectField>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      icon={<LockIcon />} label="Mot de passe" type={showPwd ? 'text' : 'password'}
                      placeholder="Min. 6 caractères" value={form.password} onChange={f('password')} required
                      right={<button type="button" onClick={() => setShowPwd(v => !v)} className="text-gray-400 hover:text-gray-600"><EyeIcon show={showPwd} /></button>}
                    />
                    <Input
                      icon={<LockIcon />} label="Confirmation" type={showPwd2 ? 'text' : 'password'}
                      placeholder="Répéter" value={form.password2} onChange={f('password2')} required
                      right={<button type="button" onClick={() => setShowPwd2(v => !v)} className="text-gray-400 hover:text-gray-600"><EyeIcon show={showPwd2} /></button>}
                    />
                  </div>

                  <Input
                    icon={<GiftIcon />} label="Code de parrainage (facultatif)"
                    placeholder="EX: GUIM2024" value={form.referral_code}
                    onChange={e => setForm(p => ({ ...p, referral_code: e.target.value.toUpperCase() }))}
                    maxLength={12} className="font-mono tracking-widest uppercase"
                  />
                  {form.referral_code && (
                    <p className="text-xs text-green-600 -mt-2 ml-1">✓ Code appliqué — annonces gratuites offertes !</p>
                  )}

                  {/* Checkbox CGU */}
                  <label className="flex items-start gap-3 cursor-pointer select-none group">
                    <div
                      onClick={() => setAcceptedTerms(v => !v)}
                      className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        acceptedTerms ? 'bg-green-600 border-green-600' : 'border-gray-300 group-hover:border-green-400'
                      }`}
                    >
                      {acceptedTerms && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                    </div>
                    <input type="checkbox" className="sr-only" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} />
                    <span className="text-xs text-gray-500 leading-relaxed">
                      J'accepte les{' '}
                      <a href="/terms" target="_blank" className="text-green-600 font-medium hover:underline">Conditions d'utilisation</a>
                      {' '}et la{' '}
                      <a href="/terms" target="_blank" className="text-green-600 font-medium hover:underline">Politique de confidentialité</a>
                    </span>
                  </label>

                  <button
                    type="submit" disabled={loading || !acceptedTerms}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600
                      text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-green-500/20
                      disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                  >
                    {loading ? <><Spinner /> Création du compte...</> : "S'inscrire sur Guimatrix →"}
                  </button>
                </form>
              </>
            )}

            {/* ── STEP 2 : OTP ────────────────────────────────────────────── */}
            {step === 2 && (
              <div>
                <button onClick={() => { setStep(1); setOtp(''); setError('') }}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                  Retour
                </button>

                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-green-50 border-2 border-green-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                    {mode === 'international' ? '📧' : '📱'}
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 mb-2">
                    Vérifiez votre {mode === 'international' ? 'email' : 'téléphone'}
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Code envoyé à <strong className="text-gray-700">{mode === 'international' ? form.email : form.phone_number}</strong>
                  </p>
                  {mode === 'international' && <p className="text-xs text-gray-400 mt-1">Vérifiez vos spams · expire dans 30 min</p>}
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 p-3.5 rounded-xl mb-6 text-sm">
                    <span>⚠️</span> {error}
                  </div>
                )}

                <form onSubmit={handleVerify} className="space-y-6">
                  <OTPInput value={otp} onChange={setOtp} />

                  <button
                    type="submit" disabled={loading || otp.length < 6}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600
                      text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-green-500/20
                      disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? <><Spinner /> Vérification...</> : 'Activer mon compte'}
                  </button>
                </form>

                <p className="text-center text-xs text-gray-400 mt-4">
                  Code non reçu ?{' '}
                  <button className="text-green-600 font-semibold hover:underline" type="button" onClick={handleRegister}>
                    Renvoyer
                  </button>
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
