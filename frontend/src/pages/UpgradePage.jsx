import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authAPI } from '../services/api'

const PLANS = [
    { months: 1, label: '1 mois',   price: 50_000,  badge: '' },
    { months: 3, label: '3 mois',   price: 130_000, badge: '🔥 -13%' },
    { months: 6, label: '6 mois',   price: 240_000, badge: '⭐ -20%' },
]

function fmt(n) {
    return new Intl.NumberFormat('fr-GN').format(n) + ' GNF'
}

export default function UpgradePage() {
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [selected, setSelected] = useState(1)
    const [provider, setProvider] = useState('orange_money')
    const [phone, setPhone] = useState('')
    const [error, setError] = useState('')

    const upgradeMutation = useMutation({
        mutationFn: () => authAPI.subscribe({ months: selected }),
        onSuccess: () => {
            qc.invalidateQueries(['subscription'])
            qc.invalidateQueries(['badges'])
            navigate('/profile')
        },
        onError: (e) => setError(e.response?.data?.error || 'Erreur de paiement'),
    })

    const plan = PLANS.find(p => p.months === selected)

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow sticky top-0 z-10">
                <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
                    <Link to="/profile" className="text-green-700 font-bold text-lg">←</Link>
                    <h1 className="font-bold text-gray-800">Passer au plan Pro</h1>
                </div>
            </nav>

            <div className="max-w-xl mx-auto px-4 py-8 space-y-6">

                {/* Avantages */}
                <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-6 text-white">
                    <p className="text-2xl font-bold mb-1">💎 Plan Pro</p>
                    <p className="text-green-100 text-sm mb-4">Débloquez toutes les fonctionnalités</p>
                    <ul className="space-y-2 text-sm">
                        {[
                            '✅ Annonces illimitées',
                            '✅ Badge Pro visible sur votre profil',
                            '✅ Priorité dans les résultats de recherche',
                            '✅ Support prioritaire',
                            '✅ Statistiques avancées de vos annonces',
                        ].map(f => <li key={f}>{f}</li>)}
                    </ul>
                </div>

                {/* Sélection durée */}
                <div>
                    <p className="font-semibold text-gray-700 mb-3">Choisissez une durée</p>
                    <div className="grid grid-cols-3 gap-3">
                        {PLANS.map(p => (
                            <button key={p.months} onClick={() => setSelected(p.months)}
                                className={`relative border-2 rounded-xl p-3 text-center transition ${
                                    selected === p.months
                                        ? 'border-green-600 bg-green-50'
                                        : 'border-gray-200 bg-white hover:border-green-300'
                                }`}>
                                {p.badge && (
                                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-400 text-white text-xs px-2 py-0.5 rounded-full">
                                        {p.badge}
                                    </span>
                                )}
                                <p className="font-bold text-gray-800 text-sm">{p.label}</p>
                                <p className="text-green-700 font-bold text-xs mt-1">{fmt(p.price)}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mode de paiement */}
                <div>
                    <p className="font-semibold text-gray-700 mb-3">Mode de paiement</p>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            ['orange_money', '🟠 Orange Money'],
                            ['mtn_momo',     '🟡 MTN MoMo'],
                        ].map(([key, label]) => (
                            <button key={key} onClick={() => setProvider(key)}
                                className={`border-2 rounded-xl p-3 text-sm font-medium transition ${
                                    provider === key
                                        ? 'border-green-600 bg-green-50 text-green-700'
                                        : 'border-gray-200 bg-white text-gray-600 hover:border-green-300'
                                }`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    <input
                        type="tel" placeholder="+224 6XX XX XX XX"
                        value={phone} onChange={e => setPhone(e.target.value)}
                        className="mt-3 w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                </div>

                {/* Récapitulatif */}
                <div className="bg-white rounded-xl border p-4 text-sm space-y-2">
                    <div className="flex justify-between text-gray-600">
                        <span>Plan Pro — {plan?.label}</span>
                        <span>{fmt(plan?.price ?? 0)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-800 border-t pt-2">
                        <span>Total à payer</span>
                        <span className="text-green-700">{fmt(plan?.price ?? 0)}</span>
                    </div>
                </div>

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <button
                    onClick={() => upgradeMutation.mutate()}
                    disabled={upgradeMutation.isPending || !phone}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl transition disabled:opacity-50 text-base">
                    {upgradeMutation.isPending ? 'Traitement…' : `Payer ${fmt(plan?.price ?? 0)}`}
                </button>

                <p className="text-xs text-center text-gray-400">
                    Paiement sécurisé via Mobile Money. Aucun remboursement après activation.
                </p>
            </div>
        </div>
    )
}
