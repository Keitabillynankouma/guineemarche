import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { listingsAPI, authAPI } from '../services/api'
import { useQuery } from '@tanstack/react-query'
import { VILLES, getCommunesByVille } from '../constants/communes'

function AttributeField({ attr, value, onChange }) {
    const base = "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 focus:bg-white transition-all"
    if (attr.field_type === 'select') {
        return (
            <select value={value || ''} onChange={e => onChange(attr.key, e.target.value)} className={base} required={attr.is_required}>
                <option value="">Choisir...</option>
                {attr.choices.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
        )
    }
    if (attr.field_type === 'boolean') {
        return (
            <select value={value ?? ''} onChange={e => onChange(attr.key, e.target.value)} className={base}>
                <option value="">—</option>
                <option value="true">Oui</option>
                <option value="false">Non</option>
            </select>
        )
    }
    return (
        <input
            type={attr.field_type === 'number' ? 'number' : 'text'}
            value={value || ''}
            onChange={e => onChange(attr.key, e.target.value)}
            placeholder={attr.name}
            className={base} required={attr.is_required} />
    )
}

// VILLES et communes par ville importés depuis ../constants/communes

async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
                const MAX = 1200
                let { width, height } = img
                if (width > MAX) { height = Math.round(height * MAX / width); width = MAX }
                if (height > MAX) { width = Math.round(width * MAX / height); height = MAX }
                const canvas = document.createElement('canvas')
                canvas.width  = width
                canvas.height = height
                canvas.getContext('2d').drawImage(img, 0, 0, width, height)
                canvas.toBlob(
                    (blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
                    'image/jpeg', 0.75
                )
            }
            img.src = e.target.result
        }
        reader.readAsDataURL(file)
    })
}

function SectionHeader({ number, icon, title, subtitle }) {
    return (
        <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-600 to-emerald-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-sm shadow-green-500/30">
                {number}
            </div>
            <div>
                <h2 className="text-sm font-bold text-gray-800">{icon} {title}</h2>
                {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
            </div>
        </div>
    )
}

const inputClass = "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 focus:bg-white transition-all"
const labelClass = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"

export default function CreateListingPage() {
    const [form, setForm] = useState({
        title: '', description: '', price_gnf: '',
        price_type: 'fixed', condition: 'good',
        city: 'Conakry', quartier: '', category: '',
        weight_kg: '',
        pickup_address: '',
    })
    const [deliveryModes, setDeliveryModes] = useState(['home_delivery'])
    const [files, setFiles]               = useState([])
    const [previews, setPreviews]         = useState([])
    const [videoFile, setVideoFile]       = useState(null)
    const [videoPreview, setVideoPreview] = useState(null)
    const [error, setError]               = useState('')
    const [loading, setLoading]           = useState(false)
    const [attributes, setAttributes]     = useState({})
    const [subCategory, setSubCategory]   = useState('')
    const navigate = useNavigate()

    const handleAttrChange = (key, val) => setAttributes(prev => ({ ...prev, [key]: val }))

    const { data: categoriesData } = useQuery({
        queryKey: ['categories'],
        queryFn: () => listingsAPI.categories().then(r => r.data),
    })
    const categories = Array.isArray(categoriesData) ? categoriesData : categoriesData?.results || []

    const selectedParent = categories.find(c => c.id === form.category)
    const subCategories  = selectedParent?.children || []
    const effectiveCatId = subCategory || form.category

    const { data: attrsData } = useQuery({
        queryKey: ['category-attributes', effectiveCatId],
        queryFn: () => listingsAPI.categoryAttributes(effectiveCatId).then(r => r.data),
        enabled: !!effectiveCatId,
    })
    const categoryAttrs = Array.isArray(attrsData) ? attrsData : (attrsData?.results || [])

    const { data: sub } = useQuery({
        queryKey: ['subscription'],
        queryFn: () => authAPI.getSubscription().then(r => r.data),
    })

    // ── Limite atteinte ────────────────────────────────────────────────────────
    if (sub && !sub.can_post) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center space-y-5">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center text-4xl mx-auto">🔒</div>
                    <div>
                        <h2 className="text-xl font-black text-gray-900 mb-1">Limite atteinte</h2>
                        <p className="text-gray-500 text-sm leading-relaxed">
                            Vous avez utilisé vos 5 annonces gratuites. Passez au plan Pro pour publier des annonces illimitées.
                        </p>
                    </div>
                    <Link to="/upgrade"
                        className="block w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-green-500/20">
                        💎 Passer au plan Pro
                    </Link>
                    <Link to="/" className="block text-sm text-gray-400 hover:text-gray-600">← Retour à l'accueil</Link>
                </div>
            </div>
        )
    }

    const handleFiles = async (e) => {
        const selected = Array.from(e.target.files)
        const compressed = await Promise.all(selected.map(compressImage))
        setFiles(prev => [...prev, ...compressed])
        setPreviews(prev => [...prev, ...compressed.map(f => URL.createObjectURL(f))])
    }

    const removePhoto = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
        setPreviews(prev => prev.filter((_, i) => i !== index))
    }

    const handleVideo = (e) => {
        const file = e.target.files[0]
        if (!file) return
        if (file.size > 50 * 1024 * 1024) { setError('La vidéo doit faire moins de 50 Mo.'); return }
        setVideoFile(file)
        setVideoPreview(URL.createObjectURL(file))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            if (deliveryModes.length === 0) {
                setError('Sélectionnez au moins un mode de livraison.')
                setLoading(false)
                return
            }
            if (deliveryModes.includes('pickup') && !form.pickup_address.trim()) {
                setError('Veuillez indiquer l\'adresse du point de retrait.')
                setLoading(false)
                return
            }
            const formData = new FormData()
            const payload  = { ...form, category: subCategory || form.category }
            Object.entries(payload).forEach(([k, v]) => {
                if (v !== '' && v !== null && v !== undefined) formData.append(k, v)
            })
            formData.append('allowed_delivery_modes', JSON.stringify(deliveryModes))
            if (Object.keys(attributes).length > 0) {
                formData.append('attributes', JSON.stringify(attributes))
            }
            files.forEach(f => formData.append('uploaded_files', f))
            if (videoFile) formData.append('uploaded_video', videoFile)
            const res = await listingsAPI.create(formData)
            const listingStatus = res.data?.status

            if (listingStatus === 'suspended') {
                setError("⛔ Votre annonce a été refusée automatiquement car elle ne respecte pas nos conditions d'utilisation. Contactez le support si vous pensez qu'il s'agit d'une erreur.")
            } else if (listingStatus === 'draft') {
                navigate('/my-listings', { state: { moderationPending: true } })
            } else {
                navigate('/my-listings')
            }
        } catch (err) {
            const data = err.response?.data
            const msg  = data
                ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(', ')
                : 'Erreur lors de la publication.'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    const Spinner = () => <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Nav */}
            <nav className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20" style={{boxShadow:'0 1px 0 rgba(0,0,0,0.05)'}}>
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
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
                            <span className="text-sm font-semibold text-gray-700">Nouvelle annonce</span>
                        </div>
                    </div>
                    <Link to="/my-listings" className="text-xs text-gray-400 hover:text-gray-600 font-medium">
                        Mes annonces →
                    </Link>
                </div>
            </nav>

            <div className="max-w-2xl mx-auto px-4 py-8 pb-24">

                {/* Titre page */}
                <div className="mb-6">
                    <h1 className="text-2xl font-black text-gray-900">Publier une annonce</h1>
                    <p className="text-sm text-gray-500 mt-1">Complétez les informations ci-dessous pour mettre votre article en vente</p>
                </div>

                {error && (
                    <div className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl mb-6 text-sm">
                        <span className="text-base flex-shrink-0">⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">

                    {/* ── Section 1 : L'essentiel ── */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <SectionHeader number="1" icon="📝" title="L'essentiel" subtitle="Titre, description et catégorie" />

                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>Titre de l'annonce</label>
                                <input
                                    type="text" placeholder="Ex : iPhone 14 Pro 256 Go — Noir"
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    className={inputClass}
                                    required
                                />
                                <p className="text-xs text-gray-400 mt-1">{form.title.length}/80 caractères recommandés</p>
                            </div>

                            <div>
                                <label className={labelClass}>Description</label>
                                <textarea
                                    rows={4}
                                    placeholder="Décrivez votre article en détail : état, caractéristiques, raison de la vente…"
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    className={inputClass + ' resize-none'}
                                    required
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Catégorie</label>
                                <select
                                    value={form.category}
                                    onChange={e => { setForm({ ...form, category: e.target.value }); setSubCategory(''); setAttributes({}) }}
                                    className={inputClass}
                                >
                                    <option value="">Sans catégorie</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.icon_url ? c.icon_url + ' ' : ''}{c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {subCategories.length > 0 && (
                                <div>
                                    <label className={labelClass}>Sous-catégorie <span className="normal-case text-gray-400 font-normal">(facultatif)</span></label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {subCategories.map(sub => (
                                            <button
                                                key={sub.id} type="button"
                                                onClick={() => { setSubCategory(sub.id); setAttributes({}) }}
                                                className={`p-2.5 rounded-xl border-2 text-sm font-medium text-left transition ${
                                                    subCategory === sub.id
                                                        ? 'border-green-500 bg-green-50 text-green-700'
                                                        : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-gray-50'
                                                }`}
                                            >
                                                {sub.icon_url && <span className="mr-1">{sub.icon_url}</span>}
                                                {sub.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {categoryAttrs.length > 0 && (
                                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-4">
                                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">
                                        ✦ Caractéristiques du produit
                                    </p>
                                    {categoryAttrs.map(attr => (
                                        <div key={attr.key}>
                                            <label className={labelClass}>
                                                {attr.name}{attr.is_required && <span className="text-red-500 ml-1">*</span>}
                                            </label>
                                            <AttributeField
                                                attr={attr}
                                                value={attributes[attr.key]}
                                                onChange={handleAttrChange}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Section 2 : Prix & État ── */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <SectionHeader number="2" icon="💰" title="Prix & État" subtitle="Fixez votre prix et l'état de l'article" />

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Prix (GNF)</label>
                                    <input
                                        type="number" placeholder="0"
                                        value={form.price_gnf}
                                        onChange={e => setForm({ ...form, price_gnf: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Type de prix</label>
                                    <select
                                        value={form.price_type}
                                        onChange={e => setForm({ ...form, price_type: e.target.value })}
                                        className={inputClass}
                                    >
                                        <option value="fixed">Prix fixe</option>
                                        <option value="negotiable">À débattre</option>
                                        <option value="free">Gratuit</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>État de l'article</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {[
                                        { value: 'new',      label: '✨ Neuf',        sub: 'Jamais utilisé' },
                                        { value: 'like_new', label: '⭐ Comme neuf',  sub: 'Très peu utilisé' },
                                        { value: 'good',     label: '👍 Bon état',    sub: 'Quelques traces' },
                                        { value: 'fair',     label: '👌 Correct',     sub: 'Usure visible' },
                                        { value: 'poor',     label: '⚠️ Très usé',    sub: 'Beaucoup d\'usure' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value} type="button"
                                            onClick={() => setForm({ ...form, condition: opt.value })}
                                            className={`p-3 rounded-xl border-2 text-left transition ${
                                                form.condition === opt.value
                                                    ? 'border-green-500 bg-green-50'
                                                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                            }`}
                                        >
                                            <p className={`text-xs font-bold ${form.condition === opt.value ? 'text-green-700' : 'text-gray-700'}`}>{opt.label}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{opt.sub}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Section 2b : Poids ── */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <SectionHeader number="3" icon="⚖️" title="Poids du colis" subtitle="Optionnel — améliore le calcul des frais de livraison" />
                        <div className="flex items-center gap-3">
                            <input
                                type="number" min="0" step="0.1"
                                placeholder="Ex : 1.5"
                                value={form.weight_kg}
                                onChange={e => setForm({ ...form, weight_kg: e.target.value })}
                                className={inputClass + ' max-w-[160px]'}
                            />
                            <span className="text-sm text-gray-500">kg</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Laissez vide si l'article est léger ou si vous ne connaissez pas le poids exact.</p>
                    </div>

                    {/* ── Section 4 : Localisation ── */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <SectionHeader number="4" icon="📍" title="Localisation" subtitle="Où se trouve l'article ?" />

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelClass}>Ville</label>
                                <select
                                    value={form.city}
                                    onChange={e => setForm({ ...form, city: e.target.value, quartier: '' })}
                                    className={inputClass}
                                >
                                    {VILLES.map(v => <option key={v}>{v}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Commune / Quartier</label>
                                <select
                                    value={form.quartier}
                                    onChange={e => setForm({ ...form, quartier: e.target.value })}
                                    className={inputClass}
                                >
                                    <option value="">Choisir…</option>
                                    {getCommunesByVille(form.city).map(q => <option key={q}>{q}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* ── Section 5 : Modes de livraison ── */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <SectionHeader number="5" icon="🚚" title="Modes de livraison" subtitle="Comment l'acheteur peut-il récupérer l'article ?" />

                        <div className="space-y-3">
                            {/* Livraison à domicile */}
                            <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${
                                deliveryModes.includes('home_delivery')
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                            }`}>
                                <input
                                    type="checkbox"
                                    className="mt-0.5 w-4 h-4 accent-green-600"
                                    checked={deliveryModes.includes('home_delivery')}
                                    onChange={e => {
                                        setDeliveryModes(prev =>
                                            e.target.checked
                                                ? [...prev, 'home_delivery']
                                                : prev.filter(m => m !== 'home_delivery')
                                        )
                                    }}
                                />
                                <div className="flex-1">
                                    <p className={`text-sm font-bold ${deliveryModes.includes('home_delivery') ? 'text-green-800' : 'text-gray-700'}`}>
                                        🏠 Livraison à domicile
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">Un livreur GuinéeMarché récupère le colis et le livre à l'adresse de l'acheteur.</p>
                                </div>
                            </label>

                            {/* Point de retrait */}
                            <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${
                                deliveryModes.includes('pickup')
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                            }`}>
                                <input
                                    type="checkbox"
                                    className="mt-0.5 w-4 h-4 accent-blue-600"
                                    checked={deliveryModes.includes('pickup')}
                                    onChange={e => {
                                        setDeliveryModes(prev =>
                                            e.target.checked
                                                ? [...prev, 'pickup']
                                                : prev.filter(m => m !== 'pickup')
                                        )
                                    }}
                                />
                                <div className="flex-1">
                                    <p className={`text-sm font-bold ${deliveryModes.includes('pickup') ? 'text-blue-800' : 'text-gray-700'}`}>
                                        📦 Point de retrait
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">L'acheteur vient chercher l'article directement chez vous.</p>
                                </div>
                            </label>

                            {/* Adresse de retrait — s'affiche seulement si pickup coché */}
                            {deliveryModes.includes('pickup') && (
                                <div className="mt-1 ml-1">
                                    <label className={labelClass}>
                                        📍 Adresse du point de retrait <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex : Kaloum, en face de la mosquée centrale, Conakry"
                                        value={form.pickup_address}
                                        onChange={e => setForm({ ...form, pickup_address: e.target.value })}
                                        className={inputClass}
                                        required
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Soyez précis : quartier, repère, numéro de boutique…</p>
                                </div>
                            )}

                            {deliveryModes.length === 0 && (
                                <p className="text-xs text-red-500 mt-1">⚠️ Sélectionnez au moins un mode de livraison.</p>
                            )}
                        </div>
                    </div>

                    {/* ── Section 6 : Médias ── */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <SectionHeader number="6" icon="📷" title="Photos & Vidéo" subtitle="Les annonces avec photos obtiennent 5× plus de vues" />

                        <div className="space-y-5">
                            {/* Upload photos */}
                            <div>
                                <input type="file" multiple accept="image/*" onChange={handleFiles} className="hidden" id="photos" />
                                <label htmlFor="photos"
                                    className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl p-8 cursor-pointer hover:border-green-400 hover:bg-green-50/50 transition group">
                                    <div className="w-14 h-14 bg-gray-100 group-hover:bg-green-100 rounded-2xl flex items-center justify-center text-3xl transition">📷</div>
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-gray-700 group-hover:text-green-700 transition">Ajouter des photos</p>
                                        <p className="text-xs text-gray-400 mt-0.5">Compressées automatiquement · JPEG, PNG, WebP</p>
                                    </div>
                                    {files.length > 0 && (
                                        <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                                            {files.length} photo{files.length > 1 ? 's' : ''} sélectionnée{files.length > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </label>

                                {previews.length > 0 && (
                                    <div className="flex gap-2 mt-3 flex-wrap">
                                        {previews.map((p, i) => (
                                            <div key={i} className="relative group">
                                                <img src={p} alt="" className="h-20 w-20 object-cover rounded-xl border border-gray-200" />
                                                <button
                                                    type="button"
                                                    onClick={() => removePhoto(i)}
                                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm"
                                                >✕</button>
                                                {i === 0 && (
                                                    <span className="absolute bottom-1 left-1 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">Cover</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Upload vidéo */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                    Vidéo <span className="normal-case text-gray-400 font-normal">(optionnelle · max 50 Mo)</span>
                                </label>
                                <input type="file" accept="video/*" onChange={handleVideo} className="hidden" id="video" />
                                <label htmlFor="video"
                                    className="flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-2xl p-4 cursor-pointer hover:border-green-400 hover:bg-green-50/50 transition group">
                                    <div className="w-10 h-10 bg-gray-100 group-hover:bg-green-100 rounded-xl flex items-center justify-center text-xl transition flex-shrink-0">🎥</div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 group-hover:text-green-700 transition">
                                            {videoFile ? `✅ ${videoFile.name}` : 'Ajouter une vidéo de démonstration'}
                                        </p>
                                        {videoFile && (
                                            <p className="text-xs text-gray-400">{(videoFile.size / 1024 / 1024).toFixed(1)} Mo</p>
                                        )}
                                    </div>
                                </label>

                                {videoPreview && (
                                    <div className="mt-3">
                                        <video src={videoPreview} controls className="w-full max-h-48 rounded-2xl border bg-black" />
                                        <button
                                            type="button"
                                            onClick={() => { setVideoFile(null); setVideoPreview(null) }}
                                            className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium"
                                        >✕ Supprimer la vidéo</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            {/* Submit — sticky bottom */}
            <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-100 px-4 py-4 z-30">
                <div className="max-w-2xl mx-auto">
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
                    >
                        {loading
                            ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Publication en cours…</>
                            : '🚀 Publier l\'annonce'}
                    </button>
                </div>
            </div>
        </div>
    )
}
