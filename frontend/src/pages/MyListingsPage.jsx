import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { listingsAPI } from '../services/api'

function formatPrice(price, type) {
    if (type === 'free') return 'Gratuit'
    return new Intl.NumberFormat('fr-GN').format(price) + ' GNF'
}

const STATUS = {
    active:    { label: 'Active',       color: 'bg-emerald-100 text-emerald-700',  dot: 'bg-emerald-500' },
    draft:     { label: 'En révision',  color: 'bg-amber-100 text-amber-700',      dot: 'bg-amber-400' },
    sold:      { label: 'Vendue',       color: 'bg-blue-100 text-blue-700',        dot: 'bg-blue-500' },
    expired:   { label: 'Expirée',      color: 'bg-gray-100 text-gray-500',        dot: 'bg-gray-400' },
    suspended: { label: 'Refusée',      color: 'bg-red-100 text-red-600',          dot: 'bg-red-500' },
}

function SkeletonRow() {
    return (
        <div className="bg-white rounded-2xl p-4 flex gap-4 animate-pulse border border-gray-100">
            <div className="w-20 h-20 bg-gray-200 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-gray-200 rounded-full w-3/4" />
                <div className="h-3 bg-gray-100 rounded-full w-1/3" />
                <div className="h-3 bg-gray-100 rounded-full w-1/2" />
            </div>
        </div>
    )
}

// ── Modal d'édition d'annonce ────────────────────────────────────────────────
function EditModal({ listing, onClose, onSaved }) {
    const [form, setForm] = useState({
        title:       listing.title       || '',
        description: listing.description || '',
        price_gnf:   listing.price_gnf   || '',
        price_type:  listing.price_type  || 'fixed',
        condition:   listing.condition   || 'good',
    })
    const [saving, setSaving] = useState(false)
    const [error,  setError]  = useState('')

    const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

    const handleSave = async () => {
        if (!form.title.trim()) { setError('Le titre est obligatoire.'); return }
        setSaving(true); setError('')
        try {
            await listingsAPI.update(listing.id, {
                title:       form.title.trim(),
                description: form.description.trim(),
                price_gnf:   form.price_type === 'free' ? 0 : Number(form.price_gnf),
                price_type:  form.price_type,
                condition:   form.condition,
            })
            onSaved()
        } catch (err) {
            const d = err.response?.data
            setError(d?.detail || d?.error || Object.values(d || {})?.[0] || 'Erreur lors de la modification.')
        } finally { setSaving(false) }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="font-bold text-gray-900">Modifier l'annonce</h2>
                        <p className="text-xs text-amber-600 mt-0.5">⚠️ Un changement de titre ou description relance la modération</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition text-lg">✕</button>
                </div>

                <div className="p-5 space-y-4">
                    {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">⚠️ {error}</div>}

                    {/* Titre */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Titre *</label>
                        <input value={form.title} onChange={f('title')}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 bg-gray-50 focus:bg-white transition" />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
                        <textarea value={form.description} onChange={f('description')} rows={4}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 bg-gray-50 focus:bg-white transition resize-none" />
                    </div>

                    {/* Type de prix */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type de prix</label>
                        <select value={form.price_type} onChange={f('price_type')}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 bg-gray-50">
                            <option value="fixed">Prix fixe</option>
                            <option value="negotiable">À débattre</option>
                            <option value="free">Gratuit / Don</option>
                        </select>
                    </div>

                    {/* Prix */}
                    {form.price_type !== 'free' && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Prix (GNF)</label>
                            <input type="number" min="0" value={form.price_gnf} onChange={f('price_gnf')}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 bg-gray-50 focus:bg-white transition" />
                        </div>
                    )}

                    {/* État */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">État de l'article</label>
                        <select value={form.condition} onChange={f('condition')}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 bg-gray-50">
                            <option value="new">Neuf</option>
                            <option value="like_new">Comme neuf</option>
                            <option value="good">Bon état</option>
                            <option value="fair">État correct</option>
                            <option value="poor">Usé</option>
                        </select>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-5 pb-5">
                    <button onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition">
                        Annuler
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 text-white text-sm font-bold shadow-sm shadow-green-500/20 hover:from-green-700 hover:to-emerald-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enregistrement...</> : '✓ Enregistrer'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function MyListingsPage() {
    const queryClient = useQueryClient()
    const location    = useLocation()
    const moderationPending = location.state?.moderationPending
    const [editingListing, setEditingListing] = useState(null)

    const { data, isLoading } = useQuery({
        queryKey: ['my-listings'],
        queryFn: () => listingsAPI.myListings().then(r => r.data),
    })

    const deleteMutation = useMutation({
        mutationFn: (id) => listingsAPI.delete(id),
        onSuccess: () => queryClient.invalidateQueries(['my-listings']),
    })

    const listings    = data?.results ?? []
    const totalCount  = listings.length
    const activeCount = listings.filter(l => l.status === 'active').length
    const totalViews  = listings.reduce((acc, l) => acc + (l.view_count || 0), 0)

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Modal d'édition */}
            {editingListing && (
                <EditModal
                    listing={editingListing}
                    onClose={() => setEditingListing(null)}
                    onSaved={() => {
                        setEditingListing(null)
                        queryClient.invalidateQueries(['my-listings'])
                    }}
                />
            )}
            {/* Nav */}
            <nav className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20" style={{boxShadow:'0 1px 0 rgba(0,0,0,0.05)'}}>
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Link to="/" className="text-gray-400 hover:text-gray-600 transition">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </Link>
                        <div className="h-5 w-px bg-gray-200" />
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-green-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-black text-xs">G</span>
                            </div>
                            <span className="text-sm font-semibold text-gray-700">Mes annonces</span>
                        </div>
                    </div>
                    <Link to="/create"
                        className="bg-gradient-to-r from-green-600 to-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm shadow-green-500/20 hover:from-green-700 hover:to-emerald-600 transition">
                        + Publier
                    </Link>
                </div>
            </nav>

            <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

                {/* Alerte modération */}
                {moderationPending && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">⏳</div>
                        <div>
                            <p className="font-bold text-amber-800 text-sm">Annonce en cours de vérification</p>
                            <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
                                Votre annonce est en attente de vérification par notre équipe. Elle sera publiée sous peu. En cas de problème, contactez le support.
                            </p>
                        </div>
                    </div>
                )}

                {/* Stats */}
                {!isLoading && totalCount > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { val: totalCount,  label: 'Annonce' + (totalCount > 1 ? 's' : ''),  icon: '📋', color: 'text-gray-800' },
                            { val: activeCount, label: 'Active' + (activeCount > 1 ? 's' : ''),   icon: '✅', color: 'text-emerald-700' },
                            { val: totalViews,  label: 'Vue' + (totalViews > 1 ? 's' : '') + ' totales', icon: '👁', color: 'text-blue-700' },
                        ].map(s => (
                            <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 text-center shadow-sm">
                                <p className="text-xl mb-0.5">{s.icon}</p>
                                <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Liste */}
                {isLoading ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
                    </div>
                ) : listings.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center shadow-sm">
                        <div className="text-6xl mb-4">📭</div>
                        <p className="text-gray-800 font-bold text-base mb-1">Aucune annonce pour l'instant</p>
                        <p className="text-gray-400 text-sm mb-6">Publiez votre première annonce en quelques secondes</p>
                        <Link to="/create"
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold px-6 py-3 rounded-xl shadow-md shadow-green-500/20 hover:from-green-700 hover:to-emerald-600 transition">
                            🚀 Publier une annonce
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {listings.map(listing => {
                            const cover  = listing.media?.find(m => m.is_cover) || listing.media?.[0]
                            const status = STATUS[listing.status] || STATUS.draft
                            const isDeleting = deleteMutation.isPending && deleteMutation.variables === listing.id

                            return (
                                <div key={listing.id}
                                    className={`bg-white rounded-2xl border border-gray-100 p-4 flex gap-4 shadow-sm transition-opacity ${isDeleting ? 'opacity-40' : ''}`}>

                                    {/* Miniature */}
                                    <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                                        {cover
                                            ? <img src={cover.file} alt="" className="w-full h-full object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                                        }
                                    </div>

                                    {/* Infos */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h3 className="font-bold text-gray-900 text-sm truncate leading-snug">{listing.title}</h3>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {listing.is_boosted && (
                                                    <span className="inline-flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                                                        ⚡ Boosté
                                                    </span>
                                                )}
                                                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${status.color}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                                                    {status.label}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-emerald-700 font-black text-sm">
                                            {formatPrice(listing.price_gnf, listing.price_type)}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                                            <span>👁 {listing.view_count || 0} vue{listing.view_count !== 1 ? 's' : ''}</span>
                                            <span>📍 {listing.city}</span>
                                            {listing.created_at && (
                                                <span>{new Date(listing.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-2 flex-shrink-0 items-end justify-center">
                                        <Link to={`/listings/${listing.id}`}
                                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-3 py-1.5 rounded-lg transition">
                                            Voir
                                        </Link>
                                        <button
                                            onClick={() => setEditingListing(listing)}
                                            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold px-3 py-1.5 rounded-lg transition"
                                        >
                                            ✏️ Modifier
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (window.confirm('Supprimer cette annonce définitivement ?')) {
                                                    deleteMutation.mutate(listing.id)
                                                }
                                            }}
                                            disabled={isDeleting}
                                            className="text-xs text-red-500 hover:text-red-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                                        >
                                            Supprimer
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Upgrade nudge */}
                {!isLoading && listings.length > 0 && (
                    <div className="bg-gradient-to-r from-green-800 to-emerald-600 rounded-2xl p-5 text-white flex items-center justify-between gap-4">
                        <div>
                            <p className="font-black text-sm">Boostez vos annonces 🚀</p>
                            <p className="text-green-100 text-xs mt-0.5">Passez Pro pour des annonces illimitées et prioritaires</p>
                        </div>
                        <Link to="/upgrade"
                            className="flex-shrink-0 bg-white text-green-700 font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-green-50 transition shadow-sm">
                            Découvrir
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}
