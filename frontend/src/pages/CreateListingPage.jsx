import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { listingsAPI } from '../services/api'
import { useQuery } from '@tanstack/react-query'

export default function CreateListingPage() {
    const [form, setForm] = useState({
        title: '', description: '', price_gnf: '',
        price_type: 'fixed', condition: 'good',
        city: 'Conakry', quartier: '', category: ''
    })
    const [files, setFiles] = useState([])
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const { data: categoriesData } = useQuery({
        queryKey: ['categories'],
        queryFn: () => listingsAPI.categories().then(r => r.data),
        onError: () => { },
    })

    const categories = Array.isArray(categoriesData)
        ? categoriesData
        : categoriesData?.results || []

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const formData = new FormData()
            Object.entries(form).forEach(([k, v]) => {
                if (v !== '' && v !== null && v !== undefined) {
                    formData.append(k, v)
                }
            })
            // N'ajouter uploaded_files que s'il y a des fichiers
            if (files.length > 0) {
                files.forEach(f => formData.append('uploaded_files', f))
            }
            await listingsAPI.create(formData)
            navigate('/my-listings')
        } catch (err) {
            console.error('Erreur:', err.response?.data)
            const data = err.response?.data
            const msg = data
                ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(', ')
                : 'Erreur lors de la publication.'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    const QUARTIERS = ['Kaloum', 'Dixinn', 'Matam', 'Ratoma', 'Matoto']
    const VILLES = ['Conakry', 'Kankan', 'Labé', 'Kindia', 'Faranah', 'Nzérékoré']

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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Titre de l'annonce</label>
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
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                <option value="">Sans catégorie</option>
                                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Photos</label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                                <input
                                    type="file" multiple accept="image/*"
                                    onChange={(e) => setFiles(Array.from(e.target.files))}
                                    className="hidden" id="photos"
                                />
                                <label htmlFor="photos" className="cursor-pointer">
                                    <p className="text-4xl mb-2">📷</p>
                                    <p className="text-gray-500 text-sm">Cliquez pour ajouter des photos</p>
                                    {files.length > 0 && (
                                        <p className="text-green-600 mt-2 font-medium">{files.length} photo(s) sélectionnée(s)</p>
                                    )}
                                </label>
                            </div>
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