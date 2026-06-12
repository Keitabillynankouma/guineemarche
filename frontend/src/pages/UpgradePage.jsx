import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authAPI } from '../services/api'

function fmt(n) {
    return new Intl.NumberFormat('fr-GN').format(n) + ' GNF'
}

// ── Données des plans ────────────────────────────────────────────────────────

const PRO_DURATIONS = [
    { months: 1,  label: '1 mois',  price: 40_000,  badge: '' },
    { months: 3,  label: '3 mois',  price: 105_000, badge: '🔥 -12%' },
    { months: 6,  label: '6 mois',  price: 190_000, badge: '⭐ -21%' },
    { months: 12, label: '1 an',    price: 350_000, badge: '💎 -27%' },
]

const SHOP_PLANS = [
    {
        id: 'standard',
        name: 'Boutique Standard',
        price_monthly: 80_000,
        color: 'from-blue-600 to-blue-800',
        badge: '',
        features: [
            '✅ Page boutique personnalisée',
            '✅ Logo + description + ville',
            '✅ Fil de vos annonces',
            '✅ Badge "Boutique Vérifiée"',
            '✅ Numéro WhatsApp visible',
            '✅ Annonces illimitées incluses',
        ],
    },
    {
        id: 'premium',
        name: 'Boutique Premium',
        price_monthly: 150_000,
        color: 'from-amber-500 to-orange-600',
        badge: '⭐ Recommandé',
        features: [
            '✅ Tout Boutique Standard',
            '✅ Mise en avant sur la homepage',
            '✅ Banner publicitaire 1 semaine/mois',
            '✅ Badge "Boutique Premium" doré',
            '✅ Priorité dans les résultats',
            '✅ Statistiques avancées',
        ],
    },
]

const BOOSTS = [
    { id: 'boost_3',  label: 'Boost 3 jours',    price: 5_000,  icon: '⚡' },
    { id: 'boost_7',  label: 'Boost 7 jours',    price: 10_000, icon: '🚀' },
    { id: 'banner_w', label: 'Banner 1 semaine',  price: 50_000, icon: '📢' },
    { id: 'banner_m', label: 'Banner 1 mois',     price: 150_000, icon: '🏆' },
]

// ── Composant Onglet ─────────────────────────────────────────────────────────

function Tab({ id, label, active, onClick }) {
    return (
        <button
            onClick={() => onClick(id)}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition ${
                active ? 'bg-green-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'
            }`}
        >{label}</button>
    )
}

// ── Section Pro Vendeur ──────────────────────────────────────────────────────

function ProSection() {
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [months, setMonths]   = useState(1)
    const [provider, setProvider] = useState('orange_money')
    const [phone, setPhone]     = useState('')
    const [error, setError]     = useState('')

    const plan = PRO_DURATIONS.find(p => p.months === months)

    const mutation = useMutation({
        mutationFn: () => authAPI.subscribe({ months }),
        onSuccess: () => {
            qc.invalidateQueries(['subscription'])
            qc.invalidateQueries(['badges'])
            navigate('/profile')
        },
        onError: (e) => setError(e.response?.data?.error || 'Erreur de paiement'),
    })

    return (
        <div className="space-y-6">
            {/* Carte plan */}
            <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-6 text-white">
                <p className="text-2xl font-bold mb-1">💎 Pro Vendeur</p>
                <p className="text-green-100 text-sm mb-4">Pour les vendeurs actifs — annonces illimitées</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                        '✅ Annonces illimitées',
                        '✅ Badge Pro visible',
                        '✅ Priorité dans la recherche',
                        '✅ Statistiques d\'annonces',
                        '✅ Support prioritaire',
                        '✅ Accès anticipé aux nouvelles fonctions',
                    ].map(f => <div key={f}>{f}</div>)}
                </div>
            </div>

            {/* Durée */}
            <div>
                <p className="font-semibold text-gray-700 mb-3">Choisissez une durée</p>
                <div className="grid grid-cols-2 gap-3">
                    {PRO_DURATIONS.map(p => (
                        <button key={p.months} onClick={() => setMonths(p.months)}
                            className={`relative border-2 rounded-xl p-4 text-center transition ${
                                months === p.months ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-white hover:border-green-300'
                            }`}>
                            {p.badge && (
                                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-400 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
                                    {p.badge}
                                </span>
                            )}
                            <p className="font-bold text-gray-800">{p.label}</p>
                            <p className="text-green-700 font-bold text-sm mt-1">{fmt(p.price)}</p>
                            <p className="text-gray-400 text-xs">{fmt(Math.round(p.price / p.months))}/mois</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Paiement */}
            <div>
                <p className="font-semibold text-gray-700 mb-3">Mode de paiement</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                    {[['orange_money', '🟠 Orange Money'], ['mtn_momo', '🟡 MTN MoMo']].map(([k, l]) => (
                        <button key={k} onClick={() => setProvider(k)}
                            className={`border-2 rounded-xl p-3 text-sm font-medium transition ${
                                provider === k ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-600 hover:border-green-300'
                            }`}>{l}</button>
                    ))}
                </div>
                <input
                    type="tel" placeholder="+224 6XX XX XX XX"
                    value={phone} onChange={e => setPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
            </div>

            {/* Récap */}
            <div className="bg-white rounded-xl border p-4 text-sm space-y-2">
                <div className="flex justify-between text-gray-600">
                    <span>Pro Vendeur — {plan?.label}</span>
                    <span>{fmt(plan?.price ?? 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-800 border-t pt-2">
                    <span>Total à payer</span>
                    <span className="text-green-700">{fmt(plan?.price ?? 0)}</span>
                </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !phone}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl transition disabled:opacity-50"
            >
                {mutation.isPending ? 'Traitement…' : `Payer ${fmt(plan?.price ?? 0)}`}
            </button>
            <p className="text-xs text-center text-gray-400">Paiement sécurisé via Mobile Money · Pas de remboursement après activation</p>
        </div>
    )
}

// ── Section Boutique ─────────────────────────────────────────────────────────

function ShopSection() {
    const [selected, setSelected] = useState('standard')
    const plan = SHOP_PLANS.find(p => p.id === selected)

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-amber-200 p-4 text-sm text-amber-800">
                <p className="font-bold mb-1">💡 Comment ça marche ?</p>
                <p>Choisissez votre plan ci-dessous, puis créez votre boutique depuis votre profil. L'équipe GuinéeMarché validera votre boutique sous <strong>24–48h</strong> et vous recevrez une notification.</p>
            </div>

            {/* Sélection plan */}
            <div className="grid grid-cols-1 gap-4">
                {SHOP_PLANS.map(p => (
                    <button key={p.id} onClick={() => setSelected(p.id)}
                        className={`text-left border-2 rounded-2xl overflow-hidden transition ${
                            selected === p.id ? 'border-green-500 shadow-md' : 'border-gray-200 hover:border-green-300'
                        }`}
                    >
                        <div className={`bg-gradient-to-r ${p.color} p-4 flex items-center justify-between`}>
                            <div>
                                {p.badge && <span className="text-xs bg-white/30 text-white px-2 py-0.5 rounded-full mb-1 inline-block">{p.badge}</span>}
                                <p className="font-bold text-white text-lg">{p.name}</p>
                                <p className="text-white/80 text-sm">{fmt(p.price_monthly)}<span className="text-xs">/mois</span></p>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected === p.id ? 'bg-white border-white' : 'border-white/50'}`}>
                                {selected === p.id && <div className="w-3 h-3 rounded-full bg-green-600" />}
                            </div>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-1">
                            {p.features.map(f => (
                                <p key={f} className="text-xs text-gray-600">{f}</p>
                            ))}
                        </div>
                    </button>
                ))}
            </div>

            {/* Comparatif */}
            <div className="bg-gray-50 rounded-2xl p-4 text-sm">
                <p className="font-semibold text-gray-700 mb-3">Comparatif des plans boutiques</p>
                <table className="w-full text-xs text-gray-600">
                    <thead>
                        <tr className="border-b">
                            <th className="text-left py-2">Fonctionnalité</th>
                            <th className="text-center py-2 text-blue-600">Standard</th>
                            <th className="text-center py-2 text-amber-600">Premium</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            ['Page boutique dédiée',      '✅', '✅'],
                            ['Annonces illimitées',        '✅', '✅'],
                            ['Badge Boutique Vérifiée',    '✅', '✅'],
                            ['Mise en avant homepage',     '❌', '✅'],
                            ['Banner pub 1 sem./mois',     '❌', '✅'],
                            ['Badge Premium doré',         '❌', '✅'],
                            ['Stats avancées',             '❌', '✅'],
                            ['Prix mensuel',       fmt(80_000), fmt(150_000)],
                        ].map(([feat, std, prem]) => (
                            <tr key={feat} className="border-b last:border-0">
                                <td className="py-2">{feat}</td>
                                <td className="text-center py-2">{std}</td>
                                <td className="text-center py-2 font-medium text-amber-700">{prem}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="space-y-3">
                <div className="bg-white rounded-xl border p-4 text-sm flex justify-between items-center">
                    <div>
                        <p className="font-bold text-gray-800">{plan?.name}</p>
                        <p className="text-gray-500 text-xs">Soumis à validation admin (24–48h)</p>
                    </div>
                    <p className="font-bold text-green-700 text-lg">{fmt(plan?.price_monthly ?? 0)}<span className="text-xs font-normal text-gray-400">/mois</span></p>
                </div>
                <Link to="/profile"
                    className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl transition"
                >
                    Créer ma boutique → Profil
                </Link>
                <p className="text-xs text-center text-gray-400">
                    La boutique sera activée après validation par l'équipe GuinéeMarché. Paiement demandé à l'approbation.
                </p>
            </div>
        </div>
    )
}

// ── Section Boosts ───────────────────────────────────────────────────────────

function BoostsSection() {
    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-blue-200 p-4 text-sm text-blue-800">
                <p className="font-bold mb-1">⚡ Qu'est-ce qu'un boost ?</p>
                <p>Un boost met votre annonce ou votre boutique en tête des résultats pendant la durée choisie. Idéal pour vendre rapidement ou attirer plus de clients.</p>
            </div>

            <div className="space-y-3">
                <p className="font-semibold text-gray-700">Boosts d'annonce</p>
                {BOOSTS.slice(0, 2).map(b => (
                    <div key={b.id} className="bg-white rounded-2xl shadow p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{b.icon}</span>
                            <div>
                                <p className="font-semibold text-gray-800">{b.label}</p>
                                <p className="text-xs text-gray-400">Annonce mise en avant dans les résultats</p>
                            </div>
                        </div>
                        <p className="font-bold text-green-700">{fmt(b.price)}</p>
                    </div>
                ))}
            </div>

            <div className="space-y-3">
                <p className="font-semibold text-gray-700">Publicités (Banners)</p>
                {BOOSTS.slice(2).map(b => (
                    <div key={b.id} className="bg-white rounded-2xl shadow p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{b.icon}</span>
                            <div>
                                <p className="font-semibold text-gray-800">{b.label}</p>
                                <p className="text-xs text-gray-400">Banner affiché sur la page d'accueil</p>
                            </div>
                        </div>
                        <p className="font-bold text-green-700">{fmt(b.price)}</p>
                    </div>
                ))}
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-600 space-y-2">
                <p className="font-semibold text-gray-800">📞 Pour commander un boost</p>
                <p>Contactez-nous directement sur WhatsApp pour activer un boost ou une publicité sur votre annonce.</p>
                <a
                    href="https://wa.me/224000000000?text=Bonjour%2C%20je%20souhaite%20booster%20mon%20annonce%20sur%20Guin%C3%A9eMarché"
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2.5 rounded-xl transition text-sm"
                >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Commander sur WhatsApp
                </a>
                <p className="text-xs text-gray-400">Vous pouvez aussi contacter l'admin depuis votre profil.</p>
            </div>
        </div>
    )
}

// ── Page principale ──────────────────────────────────────────────────────────

const TABS = [
    { id: 'pro',    label: '💎 Pro Vendeur' },
    { id: 'shop',   label: '🏪 Boutique' },
    { id: 'boosts', label: '⚡ Boosts' },
]

export default function UpgradePage() {
    const [activeTab, setActiveTab] = useState('pro')

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow sticky top-0 z-10">
                <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
                    <Link to="/profile" className="text-green-700 font-bold text-lg">←</Link>
                    <h1 className="font-bold text-gray-800">Plans &amp; Tarifs</h1>
                </div>
            </nav>

            <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
                {/* Onglets */}
                <div className="bg-white rounded-2xl shadow p-1.5 flex gap-1">
                    {TABS.map(t => (
                        <Tab key={t.id} id={t.id} label={t.label} active={activeTab === t.id} onClick={setActiveTab} />
                    ))}
                </div>

                {/* Commission info */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 flex items-start gap-2">
                    <span>🔒</span>
                    <span><strong>Commission plateforme : 4 %</strong> — prélevée uniquement sur les transactions Mobile Money sécurisées par l'escrow. Aucun frais sur les paiements en espèces.</span>
                </div>

                {activeTab === 'pro'    && <ProSection />}
                {activeTab === 'shop'   && <ShopSection />}
                {activeTab === 'boosts' && <BoostsSection />}
            </div>
        </div>
    )
}
