import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { authAPI } from '../services/api'
import { VILLES, getCommunesByVille } from '../constants/communes'

// ── Input ─────────────────────────────────────────────────────────────────────
function Input({ icon, label, right, error, className = '', ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">{icon}</div>}
        <input
          className={`w-full bg-gray-50 border border-gray-200 rounded-xl py-3 text-sm text-gray-900
            placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:bg-white transition-all
            ${icon ? 'pl-10' : 'px-4'} ${right ? 'pr-10' : 'pr-4'} ${className}`}
          style={{ '--tw-ring-color': 'rgb(var(--ring))' }}
          {...props}
        />
        {right && <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{right}</div>}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function SelectField({ icon, label, children, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">{icon}</div>}
        <select className={`w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pr-4 text-sm text-gray-900
          focus:outline-none focus:ring-2 focus:bg-white transition-all appearance-none ${icon ? 'pl-10' : 'pl-4'}`} {...props}>
          {children}
        </select>
      </div>
    </div>
  )
}

// ── OTP ───────────────────────────────────────────────────────────────────────
function OTPInput({ value, onChange }) {
  const r0 = useRef(null), r1 = useRef(null), r2 = useRef(null)
  const r3 = useRef(null), r4 = useRef(null), r5 = useRef(null)
  const refs = [r0, r1, r2, r3, r4, r5]
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '')
  const handleChange = (i, e) => {
    const v = e.target.value.replace(/\D/g, '').slice(-1)
    onChange(digits.map((d, idx) => idx === i ? v : d).join(''))
    if (v && i < 5) refs[i + 1].current?.focus()
  }
  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      onChange(digits.map((d, idx) => idx === i ? '' : d).join(''))
      if (!digits[i] && i > 0) refs[i - 1].current?.focus()
    }
  }
  const handlePaste = (e) => {
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (p) { onChange(p); refs[Math.min(p.length, 5)].current?.focus() }
    e.preventDefault()
  }
  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input key={i} ref={refs[i]} type="text" inputMode="numeric" maxLength={1}
          value={d} onChange={e => handleChange(i, e)} onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste} autoFocus={i === 0}
          className="w-11 h-14 text-center text-xl font-bold border-2 rounded-xl bg-gray-50 text-gray-900
            border-gray-200 focus:outline-none focus:border-current focus:ring-2 focus:ring-current/20 focus:bg-white transition-all"
        />
      ))}
    </div>
  )
}

// ── Icônes ────────────────────────────────────────────────────────────────────
const UserIcon   = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
const MailIcon   = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
const PhoneIcon  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
const LockIcon   = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
const MapIcon    = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
const GiftIcon   = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>
const StoreIcon  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
const EyeIcon = ({ show }) => show
  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>

// ── Config par rôle ───────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  buyer: {
    color:        'green',
    gradient:     'from-green-700 via-green-600 to-emerald-500',
    ring:         'focus:ring-green-500/30 focus:border-green-500',
    btn:          'from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 shadow-green-500/20',
    otpBorder:    'focus:border-green-500 focus:ring-green-500/20',
    features: [
      { icon: '🛍️', title: 'Des milliers d\'articles', desc: 'Toutes catégories disponibles à Conakry et en Guinée' },
      { icon: '📦', title: 'Collecte & Point de retrait', desc: 'Commandez, on collecte chez le vendeur et vous récupérez près de chez vous' },
      { icon: '📱', title: 'Paiement sécurisé', desc: 'Orange Money, MTN MoMo, PayCard — escrow intégré' },
      { icon: '🤖', title: 'Recherche intelligente', desc: 'Trouvez ce que vous cherchez en langage naturel' },
    ],
    stats: [['10K+', 'Annonces'], ['5K+', 'Acheteurs'], ['4.8★', 'Note']],
    title: 'Créer votre compte acheteur',
    subtitle: 'Commandez depuis chez vous, récupérez près de chez vous.',
  },
  seller: {
    color:        'orange',
    gradient:     'from-orange-600 via-orange-500 to-amber-400',
    ring:         'focus:ring-orange-500/30 focus:border-orange-500',
    btn:          'from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 shadow-orange-500/20',
    otpBorder:    'focus:border-orange-500 focus:ring-orange-500/20',
    features: [
      { icon: '🏪', title: 'Vendez facilement', desc: 'Publiez vos annonces en quelques minutes, photos et tout' },
      { icon: '🚚', title: 'On collecte pour vous', desc: 'Notre équipe vient chercher vos articles et les dépose en point de retrait' },
      { icon: '💰', title: 'Payé à la collecte', desc: 'Vous recevez 70% dès que votre article est en point de retrait' },
      { icon: '📊', title: 'Dashboard complet', desc: 'Suivez vos ventes, commandes et revenus en temps réel' },
    ],
    stats: [['3K+', 'Vendeurs'], ['98%', 'Payés à temps'], ['0 GNF', 'Commission départ']],
    title: 'Devenir partenaire vendeur',
    subtitle: 'Candidature examinée sous 48h. Vendez sans vous déplacer.',
  },
}

// ── Panneau gauche dynamique ──────────────────────────────────────────────────
function BrandPanel({ role }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.buyer
  return (
    <div className={`hidden lg:flex flex-col justify-between bg-gradient-to-br ${cfg.gradient} p-10 text-white relative overflow-hidden`}>
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full" />
      <div className="absolute -bottom-24 -left-12 w-96 h-96 bg-white/5 rounded-full" />
      <div className="relative z-10 flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
          <span className="text-white font-black text-lg">G</span>
        </div>
        <div>
          <span className="text-2xl font-black tracking-tight">Guimatrix</span>
          <p className="text-white/70 text-xs">La marketplace intelligente de la Guinée</p>
        </div>
      </div>
      <div className="relative z-10 space-y-5">
        {cfg.features.map(f => (
          <div key={f.title} className="flex items-start gap-4">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-xl flex-shrink-0">{f.icon}</div>
            <div>
              <p className="font-semibold text-sm">{f.title}</p>
              <p className="text-white/70 text-xs leading-relaxed mt-0.5">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="relative z-10 grid grid-cols-3 gap-3">
        {cfg.stats.map(([val, lbl]) => (
          <div key={lbl} className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
            <p className="text-lg font-black">{val}</p>
            <p className="text-white/70 text-xs">{lbl}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function RegisterPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const refCode = searchParams.get('ref') || ''

  // step 0 = choix du rôle, step 1 = formulaire, step 2 = OTP
  const [step, setStep]   = useState(0)
  const [role, setRole]   = useState(null)   // 'buyer' | 'seller'
  const [mode, setMode]   = useState('guinea')
  const [otp,  setOtp]    = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [acceptedTerms,  setAcceptedTerms]  = useState(false)
  const [acceptedAntiVol, setAcceptedAntiVol] = useState(false)
  const [showPwd,  setShowPwd]  = useState(false)
  const [showPwd2, setShowPwd2] = useState(false)

  const [form, setForm] = useState({
    full_name: '', city: 'Conakry', quartier: '', phone_number: '',
    email: '', password: '', password2: '', referral_code: refCode,
    // Champs vendeur
    shop_name: '', business_type: 'boutique', nif: '',
  })

  useEffect(() => { if (refCode) setForm(f => ({ ...f, referral_code: refCode })) }, [refCode])
  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }))

  const cfg = role ? ROLE_CONFIG[role] : ROLE_CONFIG.buyer
  const ringClass = role === 'seller'
    ? 'focus:ring-orange-500/30 focus:border-orange-500'
    : 'focus:ring-green-500/30 focus:border-green-500'

  // ── Inscription ──────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e?.preventDefault()
    if (!acceptedTerms)   { setError("Veuillez accepter les conditions d'utilisation."); return }
    if (!acceptedAntiVol) { setError("Veuillez cocher la déclaration obligatoire."); return }
    if (form.password !== form.password2) { setError("Les mots de passe ne correspondent pas."); return }
    if (form.password.length < 6) { setError("Mot de passe : 6 caractères minimum."); return }
    setError(''); setLoading(true)
    try {
      const payload = {
        full_name: form.full_name, password: form.password, password2: form.password2,
        city: form.city, referral_code: form.referral_code || undefined, role,
        ...(role === 'seller' && {
          shop_name: form.shop_name,
          business_type: form.business_type,
          nif: form.nif || undefined,
        }),
      }
      if (mode === 'guinea') {
        await authAPI.register({ ...payload, phone_number: form.phone_number, email: form.email || undefined, quartier: form.quartier || undefined })
      } else {
        await authAPI.registerEmail({ ...payload, email: form.email })
      }
      setStep(2)
    } catch (err) {
      const data = err.response?.data
      let msg = data?.error || data?.detail || data?.non_field_errors?.[0]
      if (!msg && typeof data === 'object') {
        const fe = Object.entries(data || {}).filter(([k]) => k !== 'non_field_errors')
          .map(([k, v]) => {
            const l = { phone_number: 'Téléphone', email: 'Email', password: 'Mot de passe', full_name: 'Nom complet' }[k] || k
            return `${l} : ${Array.isArray(v) ? v[0] : v}`
          })
        msg = fe[0] || "Erreur lors de l'inscription."
      }
      setError(msg || "Erreur lors de l'inscription.")
    } finally { setLoading(false) }
  }

  // ── Vérification OTP ─────────────────────────────────────────────────────
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
      if (role === 'seller') {
        setStep(3) // page d'attente validation
      } else {
        navigate('/')
      }
    } catch (err) {
      const data = err.response?.data
      setError(data?.non_field_errors?.[0] || data?.error || data?.detail || 'Code invalide ou expiré.')
      setOtp('')
    } finally { setLoading(false) }
  }

  const Spinner = () => <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />

  const accentColor = role === 'seller' ? 'orange' : 'green'

  return (
    <div className="min-h-screen bg-white">
      <div className="min-h-screen lg:grid lg:grid-cols-2">

        {/* ── Panneau gauche ───────────────────────────────────────────────── */}
        <BrandPanel role={role || 'buyer'} />

        {/* ── Panneau droit ────────────────────────────────────────────────── */}
        <div className="flex flex-col justify-center px-6 py-12 lg:px-12 xl:px-16 bg-white">

          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-1">
              <div className={`w-9 h-9 ${role === 'seller' ? 'bg-orange-500' : 'bg-green-600'} rounded-xl flex items-center justify-center shadow-md`}>
                <span className="text-white font-black text-base">G</span>
              </div>
              <span className="text-xl font-black text-gray-900">Guimatrix</span>
            </div>
            <p className="text-xs text-gray-500">La marketplace de la Guinée</p>
          </div>

          <div className="w-full max-w-md mx-auto">

            {/* ══════════════════════════════════════════════════════════
                STEP 0 — CHOIX DU RÔLE
            ══════════════════════════════════════════════════════════ */}
            {step === 0 && (
              <div>
                <div className="mb-8 text-center">
                  <h1 className="text-2xl font-black text-gray-900 mb-2">Rejoindre Guimatrix</h1>
                  <p className="text-sm text-gray-500">
                    Déjà inscrit ?{' '}
                    <Link to="/login" className="text-green-600 font-semibold hover:underline">Se connecter</Link>
                  </p>
                </div>

                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-5">Je veux…</p>

                <div className="space-y-4">
                  {/* Carte Acheteur */}
                  <button
                    onClick={() => { setRole('buyer'); setStep(1); setError('') }}
                    className="w-full group relative overflow-hidden rounded-2xl border-2 border-gray-200 hover:border-green-500 bg-white hover:bg-green-50 transition-all duration-200 text-left p-5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-green-100 group-hover:bg-green-200 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 transition-colors">
                        🛒
                      </div>
                      <div className="flex-1">
                        <p className="text-lg font-black text-gray-900 group-hover:text-green-700 transition-colors">Acheter</p>
                        <p className="text-sm text-gray-500 leading-relaxed mt-0.5">Je veux commander des articles et les récupérer en point de retrait</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {['Paiement sécurisé', 'Point de retrait', 'Parrainage'].map(t => (
                            <span key={t} className="text-[10px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">{t}</span>
                          ))}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-300 group-hover:text-green-500 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                      </svg>
                    </div>
                  </button>

                  {/* Carte Vendeur Partenaire */}
                  <button
                    onClick={() => { setRole('seller'); setStep(1); setError('') }}
                    className="w-full group relative overflow-hidden rounded-2xl border-2 border-gray-200 hover:border-orange-500 bg-white hover:bg-orange-50 transition-all duration-200 text-left p-5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-orange-100 group-hover:bg-orange-200 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 transition-colors">
                        🏪
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-black text-gray-900 group-hover:text-orange-600 transition-colors">Devenir Partenaire</p>
                          <span className="text-[10px] bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full">Sur candidature</span>
                        </div>
                        <p className="text-sm text-gray-500 leading-relaxed mt-0.5">Je veux vendre mes produits sur Guimatrix en tant que vendeur partenaire agréé</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {['Collecte gratuite', 'Payé à la collecte', 'Espace vendeur dédié'].map(t => (
                            <span key={t} className="text-[10px] bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">{t}</span>
                          ))}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-300 group-hover:text-orange-500 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                      </svg>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                STEP 1 — FORMULAIRE D'INSCRIPTION
            ══════════════════════════════════════════════════════════ */}
            {step === 1 && (
              <>
                {/* Header avec retour */}
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => { setStep(0); setError('') }}
                    className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{role === 'seller' ? '🏪' : '🛒'}</span>
                      <h1 className="text-xl font-black text-gray-900">{cfg.title}</h1>
                    </div>
                    <p className="text-xs text-gray-500 ml-7">{cfg.subtitle}</p>
                  </div>
                </div>

                {/* Badge rôle */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold mb-5 ${
                  role === 'seller' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                }`}>
                  <span>{role === 'seller' ? '🏪' : '🛒'}</span>
                  Compte {role === 'seller' ? 'Vendeur' : 'Acheteur'}
                  <button onClick={() => { setStep(0); setRole(null) }}
                    className="ml-1 opacity-60 hover:opacity-100 transition-opacity text-[10px] underline">
                    Changer
                  </button>
                </div>

                {/* Toggle Guinée / International */}
                <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
                  {[{ key: 'guinea', label: '🇬🇳 Je suis en Guinée' }, { key: 'international', label: '🌍 Étranger' }].map(m => (
                    <button key={m.key} type="button"
                      onClick={() => { setMode(m.key); setError('') }}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        mode === m.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >{m.label}</button>
                  ))}
                </div>

                {mode === 'international' && (
                  <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3.5 mb-4">
                    <span>📧</span>
                    <p className="text-blue-700 text-xs leading-relaxed">Inscrivez-vous avec votre Gmail. Pas besoin de numéro guinéen.</p>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 p-3.5 rounded-xl mb-4 text-sm">
                    <span>⚠️</span> {error}
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">

                  <Input icon={<UserIcon />} label="Nom complet" placeholder="Mamadou Diallo"
                    value={form.full_name} onChange={f('full_name')} required
                    className={`focus:ring-2 ${ringClass}`} />

                  {/* Champs candidature vendeur */}
                  {role === 'seller' && (
                    <div className="space-y-3">
                      <div className="bg-orange-50 border border-orange-100 rounded-xl p-3.5">
                        <p className="text-orange-700 text-xs font-semibold">🏪 Candidature partenaire</p>
                        <p className="text-orange-600 text-xs mt-0.5 leading-relaxed">
                          Votre dossier sera examiné par notre équipe sous 48h. Vous serez notifié par SMS.
                        </p>
                      </div>
                      <Input icon={<span className="text-sm">🏪</span>} label="Nom de votre boutique / activité"
                        placeholder="Ex : Boutique Mamadou, Diallo Electronics..."
                        value={form.shop_name} onChange={f('shop_name')} required
                        className={`focus:ring-2 ${ringClass}`} />
                      <SelectField icon={<span className="text-sm">📋</span>} label="Type d'activité"
                        value={form.business_type}
                        onChange={e => setForm(p => ({ ...p, business_type: e.target.value }))}>
                        <option value="boutique">Boutique / Commerce</option>
                        <option value="grossiste">Grossiste / Importateur</option>
                        <option value="marque">Marque / Fabricant</option>
                        <option value="particulier">Particulier</option>
                      </SelectField>
                      <Input icon={<span className="text-sm">🪪</span>} label="NIF fiscal (facultatif)"
                        placeholder="Numéro d'identification fiscale"
                        value={form.nif} onChange={f('nif')}
                        className={`focus:ring-2 ${ringClass}`} />
                    </div>
                  )}

                  <Input icon={<MailIcon />}
                    label={mode === 'international' ? 'Adresse email' : 'Email'}
                    type="email"
                    placeholder={mode === 'international' ? 'votre@gmail.com' : 'votre@email.com (optionnel)'}
                    value={form.email} onChange={f('email')}
                    required={mode === 'international'}
                    className={`focus:ring-2 ${ringClass}`} />

                  {mode === 'guinea' && (
                    <Input icon={<PhoneIcon />} label="Téléphone" placeholder="+224 620 00 00 01"
                      value={form.phone_number} onChange={f('phone_number')} required
                      className={`focus:ring-2 ${ringClass}`} />
                  )}

                  {mode === 'guinea' && (
                    <>
                      <SelectField icon={<MapIcon />} label="Ville" value={form.city}
                        onChange={e => setForm(p => ({ ...p, city: e.target.value, quartier: '' }))}>
                        {VILLES.map(v => <option key={v}>{v}</option>)}
                      </SelectField>
                      {getCommunesByVille(form.city).length > 0 && (
                        <SelectField icon={<MapIcon />} label="Commune / Quartier" value={form.quartier} onChange={f('quartier')}>
                          <option value="">— Choisir votre commune —</option>
                          {getCommunesByVille(form.city).map(c => <option key={c}>{c}</option>)}
                        </SelectField>
                      )}
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Input icon={<LockIcon />} label="Mot de passe" type={showPwd ? 'text' : 'password'}
                      placeholder="Min. 6 caractères" value={form.password} onChange={f('password')} required
                      className={`focus:ring-2 ${ringClass}`}
                      right={<button type="button" onClick={() => setShowPwd(v => !v)} className="text-gray-400 hover:text-gray-600"><EyeIcon show={showPwd} /></button>} />
                    <Input icon={<LockIcon />} label="Confirmation" type={showPwd2 ? 'text' : 'password'}
                      placeholder="Répéter" value={form.password2} onChange={f('password2')} required
                      className={`focus:ring-2 ${ringClass}`}
                      right={<button type="button" onClick={() => setShowPwd2(v => !v)} className="text-gray-400 hover:text-gray-600"><EyeIcon show={showPwd2} /></button>} />
                  </div>

                  <Input icon={<GiftIcon />} label="Code de parrainage (facultatif)"
                    placeholder="EX: GUIM2024" value={form.referral_code}
                    onChange={e => setForm(p => ({ ...p, referral_code: e.target.value.toUpperCase() }))}
                    maxLength={12} className={`font-mono tracking-widest uppercase focus:ring-2 ${ringClass}`} />
                  {form.referral_code && (
                    <p className={`text-xs -mt-2 ml-1 ${role === 'seller' ? 'text-orange-600' : 'text-green-600'}`}>
                      ✓ Code appliqué — annonces gratuites offertes !
                    </p>
                  )}

                  {/* CGU */}
                  <label className="flex items-start gap-3 cursor-pointer select-none group">
                    <div className="relative mt-0.5 flex-shrink-0">
                      <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)}
                        className="absolute opacity-0 w-5 h-5 cursor-pointer" />
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        acceptedTerms
                          ? role === 'seller' ? 'bg-orange-500 border-orange-500' : 'bg-green-600 border-green-600'
                          : 'border-gray-300 group-hover:border-gray-400'
                      }`}>
                        {acceptedTerms && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 leading-relaxed">
                      J'accepte les{' '}
                      <a href="/terms" target="_blank" onClick={e => e.stopPropagation()} className={`font-medium hover:underline ${role === 'seller' ? 'text-orange-600' : 'text-green-600'}`}>Conditions d'utilisation</a>,{' '}la{' '}
                      <a href="/privacy" target="_blank" onClick={e => e.stopPropagation()} className={`font-medium hover:underline ${role === 'seller' ? 'text-orange-600' : 'text-green-600'}`}>Politique de confidentialité</a>{' '}et la{' '}
                      <a href="/terms#cgv" target="_blank" onClick={e => e.stopPropagation()} className={`font-medium hover:underline ${role === 'seller' ? 'text-orange-600' : 'text-green-600'}`}>Politique de vente</a>
                    </span>
                  </label>

                  {/* Anti-vol */}
                  <label className="flex items-start gap-3 cursor-pointer select-none group">
                    <div className="relative mt-0.5 flex-shrink-0">
                      <input type="checkbox" checked={acceptedAntiVol} onChange={e => setAcceptedAntiVol(e.target.checked)}
                        className="absolute opacity-0 w-5 h-5 cursor-pointer" />
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        acceptedAntiVol ? 'bg-red-600 border-red-600' : 'border-red-300 group-hover:border-red-400'
                      }`}>
                        {acceptedAntiVol && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                      </div>
                    </div>
                    <span className="text-xs text-gray-600 leading-relaxed">
                      <span className="font-semibold text-red-700">⚠️ Déclaration obligatoire : </span>
                      Je certifie que les articles que je vendrai m'appartiennent légalement et ne sont pas volés ou contrefaits.
                      Guimatrix coopérera avec les autorités en cas d'infraction.
                    </span>
                  </label>

                  <button type="submit"
                    disabled={loading || !acceptedTerms || !acceptedAntiVol}
                    className={`w-full bg-gradient-to-r ${cfg.btn} text-white font-bold py-3.5 rounded-xl
                      transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
                      flex items-center justify-center gap-2 mt-2`}
                  >
                    {loading
                      ? <><Spinner /> {role === 'seller' ? 'Envoi de la candidature...' : 'Création du compte...'}</>
                      : role === 'seller' ? 'Soumettre ma candidature →' : 'Créer mon compte acheteur →'}
                  </button>

                  <p className="text-center text-xs text-gray-500">
                    Déjà inscrit ?{' '}
                    <Link to="/login" className={`font-semibold hover:underline ${role === 'seller' ? 'text-orange-600' : 'text-green-600'}`}>
                      Se connecter
                    </Link>
                  </p>
                </form>
              </>
            )}

            {/* ══════════════════════════════════════════════════════════
                STEP 2 — OTP
            ══════════════════════════════════════════════════════════ */}
            {step === 2 && (
              <div>
                <button onClick={() => { setStep(1); setOtp(''); setError('') }}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                  Retour
                </button>

                <div className="text-center mb-8">
                  <div className={`w-16 h-16 ${role === 'seller' ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'} border-2 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4`}>
                    {mode === 'international' ? '📧' : '📱'}
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 mb-2">Vérifiez votre {mode === 'international' ? 'email' : 'téléphone'}</h2>
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

                <style>{`
                  .otp-seller input { --ring-color: rgb(249 115 22); }
                  .otp-seller input:focus { border-color: rgb(249 115 22) !important; }
                  .otp-buyer  input:focus { border-color: rgb(34 197 94) !important; }
                `}</style>

                <form onSubmit={handleVerify} className={`space-y-6 ${role === 'seller' ? 'otp-seller' : 'otp-buyer'}`}>
                  <OTPInput value={otp} onChange={setOtp} />
                  <button type="submit" disabled={loading || otp.length < 6}
                    className={`w-full bg-gradient-to-r ${cfg.btn} text-white font-bold py-3.5 rounded-xl
                      shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed
                      flex items-center justify-center gap-2`}>
                    {loading ? <><Spinner /> Vérification...</> : 'Activer mon compte'}
                  </button>
                </form>

                <p className="text-center text-xs text-gray-400 mt-4">
                  Code non reçu ?{' '}
                  <button type="button" onClick={handleRegister}
                    className={`font-semibold hover:underline ${role === 'seller' ? 'text-orange-600' : 'text-green-600'}`}>
                    Renvoyer
                  </button>
                </p>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                STEP 3 — CANDIDATURE VENDEUR EN ATTENTE
            ══════════════════════════════════════════════════════════ */}
            {step === 3 && role === 'seller' && (
              <div className="text-center py-4">
                <div className="w-20 h-20 bg-orange-50 border-2 border-orange-100 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6">
                  ⏳
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Candidature soumise !</h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                  Notre équipe examine votre dossier.<br />
                  Vous recevrez une notification SMS dans les <strong className="text-gray-700">48 heures</strong>.
                </p>

                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-left space-y-3 mb-6">
                  <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">Prochaines étapes</p>
                  {[
                    ['1', 'Examen de votre dossier (48h)'],
                    ['2', 'Notification SMS de validation'],
                    ['3', 'Accès à votre espace vendeur'],
                    ['4', 'Première collecte organisée'],
                  ].map(([n, t]) => (
                    <div key={n} className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">{n}</div>
                      <p className="text-sm text-gray-600">{t}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => navigate('/')}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all"
                >
                  Explorer la marketplace
                </button>
                <p className="text-xs text-gray-400 mt-3">
                  Des questions ?{' '}
                  <a href="https://wa.me/224" className="text-orange-600 font-semibold hover:underline">Contactez-nous sur WhatsApp</a>
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
