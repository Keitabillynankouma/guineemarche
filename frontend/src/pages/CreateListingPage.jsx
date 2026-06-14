import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { listingsAPI, authAPI } from '../services/api'
import { useQuery } from '@tanstack/react-query'

function AttributeField({ attr, value, onChange }) {
    const base = "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
    if (attr.field_type === 'select') {
        return (
            <select value={value || ''} onChange={e => onChange(attr.key, e.target.value)} className={base} required={attr.is_required}>
                <option value="">Choisir...</option>
                {attr.choices.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
        )
    }
    if (attr.field_type === 'year') {
        const currentYear = new Date().getFullYear()
        return (
            <select value={value || ''} onChange={e => onChange(attr.key, e.target.value)} className={base} required={attr.is_required}>
                <option value="">Choisir une année...</option>
                {Array.from({ length: 40 }, (_, i) => currentYear - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                ))}
            </select>
        )
    }
    if (attr.field_type === 'boolean') {
        return (
            <select value={value || ''} onChange={e => onChange(attr.key, e.target.value)} className={base} required={attr.is_required}>
                <option value="">Choisir...</option>
                <option value="true">Oui</option>
                <option value="false">Non</option>
            </select>
        )
    }
    return (
        <input type={attr.field_type === 'number' ? 'number' : 'text'}
            placeholder={attr.name} value={value || ''}
            onChange={e => onChange(attr.key, e.target.value)}
            className={base} required={attr.is_required} />
    )
}

const QUARTIERS = ['Kaloum', 'Dixinn', 'Matam', 'Ratoma', 'Matoto']
const VILLES    = ['Conakry', 'Kankan', 'Labé', 'Kindia', 'Faranah', 'Nzérékoré']

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

export default function CreateListingPage() {
    const [form, setForm] = useState({
        title: '', description: '', price_gnf: '',
        price_type: 'fixed', condition: 'good',
        city: 'Conakry', quartier: '', category: ''
    })
    const [files, setFiles]           = useState([])
    const [previews, setPreviews]     = useState([])
    const [error, setError]           = useState('')
    const [loading, setLoading]       = useState(false)
    const [attributes, setAttributes] = useState({})
    const [subCategory, setSubCategory] = useState('')
    const navigate = useNavigate()

    const handleAttrChange = (key, val) => setAttributes(prev => ({ ...prev, [key]: val }))

    const { data: categoriesData } = useQuery({
        queryKey: ['categories'],
        queryFn: () => listingsAPI.categories().then(r => r.data),
    })
    const categories = Array.isArray(categoriesData) ? categoriesData : categoriesData?.results || []

    // Catégorie parente sélectionnée
    const selectedParent  = categories.find(c => c.id === form.category)
    const subCategories   = selectedParent?.children || []
    // ID effectif pour charger les attributs : sous-catégorie si dispo, sinon catégorie parente
    const effectiveCatId  = subCategory || form.category

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

    if (sub && !sub.can_post) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center space-y-4">
                    <p className="text-5xl">🔒</p>
                    <h2 className="text-xl font-bold text-gray-800">Limite atteinte</h2>
                    <p className="text-gray-500 text-sm">
                        Vous avez utilisé vos 5 annonces gratuites. Passez au plan Pro pour publier des annonces illimitées.
                    </p>
                    <Link to="/upgrade"
                        className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition">
                        💎 Passer au plan Pro
                    </Link>
                    <Link to="/" className="block text-sm text-gray-400 hover:text-gray-600">Retour à l'accueil</Link>
                </div>
            </div>
        )
    }

    const handleFiles = async (e) => {
        const selected = Array.from(e.target.files)
        const compressed = await Promise.all(selected.map(compressImage))
        setFiles(compressed)
        setPreviews(compressed.map(f => URL.createObjectURL(f)))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const formData = new FormData()
            const payload  = { ...form, category: subCategory || form.category }
            Object.entries(payload).forEach(([k, v]) => {
                if (v !== '' && v !== null && v !== undefined) formData.append(k, v)
            })
            if (Object.keys(attributes).length > 0) {
                formData.append('attributes', JSON.stringify(attributes))
            }
            files.forEach(f => formData.append('uploaded_files', f))
            const res = await listingsAPI.create(formData)
            const listingStatus = res.data?.status

            if (listingStatus === 'suspended') {
                setError("⛔ Votre annonce a été refusée automatiquement car elle ne respecte pas nos conditions d'utilisation. Contactez le support si vous pensez qu'il s'agit d'une erreur.")
            } else if (listingStatus === 'draft') {
                // Annonce en attente de révision — naviguer vers mes annonces avec un message
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

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
                    <Link to="/" className="text-green-700 font-bold text-lg">GuinéeMarché</Link>
                    <span className="text-gray-400">/</span>
                    <span className="text-gray-600">Publier une annonce</span>
                </div>
            </nav>

            <div className="max-w-2xl mx-auto px-4 py-8">
                <div className="bg-white rounded-2xl shadow p-6">
                    <h1 className="text-xl font-bold text-gray-800 mb-6">Nouvelle annonce</h1>

                    {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                            <input
                                type="text" placeholder="Ex: iPhone 13 Pro Max 256Go"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                rows={4} placeholder="Décrivez votre article en détail..."
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                            <select
                                value={form.category}
                                onChange={(e) => {
                                    setForm({ ...form, category: e.target.value })
                                    setSubCategory('')
                                    setAttributes({})
                                }}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                <option value="">Sans catégorie</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.icon_url ? c.icon_url + ' ' : ''}{c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Sous-catégories (si la catégorie parente en a) */}
                        {subCategories.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Sous-catégorie <span className="text-gray-400 font-normal">(facultatif)</span>
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {subCategories.map(sub => (
                                        <button
                                            key={sub.id} type="button"
                                            onClick={() => { setSubCategory(sub.id); setAttributes({}) }}
                                            className={`p-2 rounded-xl border-2 text-sm font-medium text-left transition ${
                                                subCategory === sub.id
                                                    ? 'border-green-500 bg-green-50 text-green-700'
                                                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                            }`}
                                        >
                                            {sub.icon_url && <span className="mr-1">{sub.icon_url}</span>}
                                            {sub.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Attributs dynamiques selon catégorie */}
                        {categoryAttrs.length > 0 && (
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                                    Caractéristiques du produit
                                </p>
                                {categoryAttrs.map(attr => (
                                    <div key={attr.key}>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
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

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Prix (GNF)</label>
                                <input
                                    type="number" placeholder="0"
                                    value={form.price_gnf}
                                    onChange={(e) => setForm({ ...form, price_gnf: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Type de prix</label>
                                <select
                                    value={form.price_type}
                                    onChange={(e) => setForm({ ...form, price_type: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                    <option value="fixed">Prix fixe</option>
                                    <option value="negotiable">À débattre</option>
                                    <option value="free">Gratuit</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">État</label>
                            <select
                                value={form.condition}
                                onChange={(e) => setForm({ ...form, condition: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                <option value="new">Neuf</option>
                                <option value="like_new">Comme neuf</option>
                                <option value="good">Bon état</option>
                                <option value="fair">État correct</option>
                                <option value="poor">Très usé</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                                <select
                                    value={form.city}
                                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                    {VILLES.map(v => <option key={v}>{v}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quartier</label>
                                <select
                                    value={form.quartier}
                                    onChange={(e) => setForm({ ...form, quartier: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                    <option value="">Choisir</option>
                                    {QUARTIERS.map(q => <option key={q}>{q}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Photos <span className="text-gray-400 font-normal">(compressées automatiquement)</span>
                            </label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                                <input
                                    type="file" multiple accept="image/*"
                                    onChange={handleFiles}
                                    className="hidden" id="photos"
                                />
                                <label htmlFor="photos" className="cursor-pointer block">
                                    <p className="text-4xl mb-2">📷</p>
                                    <p className="text-gray-500 text-sm">Cliquer pour ajouter des photos</p>
                                    {files.length > 0 && (
                                        <p className="text-green-600 mt-1 font-medium text-sm">{files.length} photo(s) — compressées</p>
                                    )}
                                </label>
                            </div>
                            {previews.length > 0 && (
                                <div className="flex gap-2 mt-3 flex-wrap">
                                    {previews.map((p, i) => (
                                        <img key={i} src={p} alt="" className="h-20 w-20 object-cover rounded-lg border" />
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            type="submit" disabled={loading}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
                        >
                            {loading ? 'Publication...' : 'Publier l\'annonce'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
