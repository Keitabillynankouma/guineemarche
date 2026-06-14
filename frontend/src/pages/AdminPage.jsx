import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import api from '../services/api'

// ── API ──────────────────────────────────────────────────────────────────────

const adminAPI = {
  // Ordres / litiges
  getStats:    () => api.get('/orders/admin/stats/'),
  getDisputes: () => api.get('/orders/admin/disputes/'),
  resolve:     (id, action) => api.post(`/orders/admin/disputes/${id}/resolve/`, { action }),

  // Annonces
  getListings:    (params) => api.get('/listings/admin/listings/', { params }),
  suspendListing: (id)     => api.delete(`/listings/admin/listings/${id}/`),

  // Publicités
  getBanners:   ()          => api.get('/listings/admin/banners/'),
  createBanner: (data)      => api.post('/listings/admin/banners/', data),
  deleteBanner: (id)        => api.delete(`/listings/admin/banners/${id}/`),
  toggleBanner: (id, data)  => api.patch(`/listings/admin/banners/${id}/`, data),

  // Catégories
  getCategories:  ()     => api.get('/listings/admin/categories/'),
  createCategory: (data) => api.post('/listings/admin/categories/', data),
  deleteCategory: (id)   => api.delete(`/listings/admin/categories/${id}/`),

  // Boutiques
  getShops:     (params) => api.get('/accounts/admin/shops/', { params }),
  approveShop:  (id, data) => api.post(`/accounts/admin/shops/${id}/approve/`, data),
  updateShop:   (id, data) => api.patch(`/accounts/admin/shops/${id}/`, data),

  // Paramètres
  getSettings:   () => api.get('/core/settings/'),
  patchSettings: (data) => api.patch('/core/settings/', data),

  // Points de retrait
  getPickupPoints:    () => api.get('/orders/admin/pickup-points/'),
  createPickupPoint:  (data) => api.post('/orders/admin/pickup-points/', data),
  updatePickupPoint:  (id, data) => api.patch(`/orders/admin/pickup-points/${id}/`, data),
  deletePickupPoint:  (id) => api.delete(`/orders/admin/pickup-points/${id}/`),
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat('fr-GN').format(n) + ' GNF'
}

function StatCard({ label, value, icon, color = 'green' }) {
  const colors = {
    green:  'bg-green-50  text-green-700  border-green-100',
    red:    'bg-red-50    text-red-700    border-red-100',
    blue:   'bg-blue-50   text-blue-700   border-blue-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  }
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <p className="text-2xl mb-1">{icon}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm font-medium opacity-80">{label}</p>
    </div>
  )
}

// ── Onglet 1 : Stats + Litiges ────────────────────────────────────────────────

async function downloadCSV(type) {
  const token = localStorage.getItem('access_token')
  const res   = await fetch(`/api/v1/orders/admin/export/?type=${type}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) { alert('Erreur export CSV'); return }
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${type}_export.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function TabOverview({ stats, disputes, isLoading, resolveMutation }) {
  return (
    <div className="space-y-8">
      {stats && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Vue d'ensemble</h2>
            <div className="flex gap-2">
              <button onClick={() => downloadCSV('orders')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition">
                ⬇️ Commandes CSV
              </button>
              <button onClick={() => downloadCSV('users')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition">
                ⬇️ Utilisateurs CSV
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="Utilisateurs"           value={stats.users}            icon="👥" color="blue" />
            <StatCard label="Annonces actives"        value={stats.active_listings}  icon="📦" color="green" />
            <StatCard label="Commandes totales"       value={stats.orders_total}     icon="🛍️" color="blue" />
            <StatCard label="Commandes terminées"     value={stats.orders_completed} icon="✅" color="green" />
            <StatCard label="Litiges en cours"        value={stats.orders_disputed}  icon="⚠️" color="red" />
            <StatCard
              label="Revenus plateforme (5%)"
              value={Math.round((stats.revenue_gnf || 0) * 0.05).toLocaleString('fr-GN') + ' GNF'}
              icon="💰" color="yellow"
            />
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          ⚠️ Litiges en attente
          {disputes.length > 0 && (
            <span className="ml-2 text-sm bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{disputes.length}</span>
          )}
        </h2>
        {isLoading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl h-32 animate-pulse" />)}</div>
        ) : disputes.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-12 text-center text-gray-400">
            <p className="text-5xl mb-3">✅</p>
            <p className="font-medium">Aucun litige en cours</p>
          </div>
        ) : (
          <div className="space-y-4">
            {disputes.map(order => (
              <div key={order.id} className="bg-white rounded-2xl shadow p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-800">{order.listing_title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Acheteur : <span className="font-medium text-gray-700">{order.buyer_name}</span>
                      {' · '}
                      Vendeur : <span className="font-medium text-gray-700">{order.seller_name}</span>
                    </p>
                  </div>
                  <span className="text-sm font-bold text-green-600">{fmt(order.amount_gnf)}</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                  <strong>Comment trancher ?</strong> Contacte les deux parties, vérifie les preuves (photos, messages), puis décide.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { if (confirm(`Libérer ${fmt(order.amount_gnf)} au vendeur ${order.seller_name} ?`)) resolveMutation.mutate({ id: order.id, action: 'release' }) }}
                    disabled={resolveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-50"
                  >✅ Libérer au vendeur</button>
                  <button
                    onClick={() => { if (confirm(`Rembourser l'acheteur ${order.buyer_name} ?`)) resolveMutation.mutate({ id: order.id, action: 'refund' }) }}
                    disabled={resolveMutation.isPending}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-50"
                  >🔄 Rembourser l'acheteur</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Onglet 2 : Annonces ───────────────────────────────────────────────────────

function TabListings() {
  const qc = useQueryClient()
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-listings', search, statusFilter],
    queryFn:  () => adminAPI.getListings({ search: search || undefined, status: statusFilter || undefined }).then(r => r.data),
  })

  const listings = Array.isArray(data) ? data : (data?.results ?? [])

  const suspendMutation = useMutation({
    mutationFn: (id) => adminAPI.suspendListing(id),
    onSuccess:  () => qc.invalidateQueries(['admin-listings']),
  })

  const STATUS_LABELS = {
    active:    { label: 'Active',    color: 'bg-green-100 text-green-700' },
    draft:     { label: 'Brouillon', color: 'bg-gray-100 text-gray-500' },
    sold:      { label: 'Vendue',    color: 'bg-blue-100 text-blue-700' },
    expired:   { label: 'Expirée',   color: 'bg-orange-100 text-orange-600' },
    suspended: { label: 'Suspendue', color: 'bg-red-100 text-red-600' },
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-gray-800">📦 Toutes les annonces</h2>

      <div className="flex gap-3 flex-wrap">
        <input
          type="text" placeholder="Rechercher par titre, ville, vendeur..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-40 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <select
          value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="bg-white rounded-xl h-20 animate-pulse" />)}</div>
      ) : listings.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p>Aucune annonce trouvée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map(l => {
            const s = STATUS_LABELS[l.status] || { label: l.status, color: 'bg-gray-100 text-gray-500' }
            return (
              <div key={l.id} className="bg-white rounded-2xl shadow p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                  {l.media?.[0]?.file
                    ? <img src={l.media[0].file} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{l.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {l.seller_name} · {l.city} · {new Intl.NumberFormat('fr-GN').format(l.price_gnf)} GNF
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${s.color}`}>{s.label}</span>
                  <Link
                    to={`/listings/${l.id}`}
                    className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg transition"
                  >Voir</Link>
                  {l.status !== 'suspended' && (
                    <button
                      onClick={() => { if (confirm('Suspendre cette annonce ?')) suspendMutation.mutate(l.id) }}
                      disabled={suspendMutation.isPending}
                      className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                    >Suspendre</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Onglet 3 : Publicités ─────────────────────────────────────────────────────

function TabBanners() {
  const qc      = useQueryClient()
  const fileRef = useRef(null)
  const [form, setForm]     = useState({ title: '', link_url: '', position: 'hero', start_date: '', end_date: '', sort_order: 0 })
  const [file, setFile]     = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError]   = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn:  () => adminAPI.getBanners().then(r => r.data),
  })
  const banners = Array.isArray(data) ? data : (data?.results ?? [])

  const createMutation = useMutation({
    mutationFn: (fd) => adminAPI.createBanner(fd),
    onSuccess: () => {
      qc.invalidateQueries(['admin-banners'])
      setForm({ title: '', link_url: '', position: 'hero', start_date: '', end_date: '', sort_order: 0 })
      setFile(null); setPreview(null); setError('')
    },
    onError: (err) => setError(JSON.stringify(err.response?.data || 'Erreur')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => adminAPI.deleteBanner(id),
    onSuccess:  () => qc.invalidateQueries(['admin-banners']),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => adminAPI.toggleBanner(id, { is_active }),
    onSuccess:  () => qc.invalidateQueries(['admin-banners']),
  })

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!file) { setError('Veuillez sélectionner une image.'); return }
    const fd = new FormData()
    fd.append('image_file', file)
    Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v) })
    createMutation.mutate(fd)
  }

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-bold text-gray-800">📢 Publicités (Banners)</h2>

      {/* Formulaire */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="font-semibold text-gray-700 mb-4">Ajouter une publicité</h3>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
              <input
                type="text" required value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Ex: Promo Ramadan 2026"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lien URL (optionnel)</label>
              <input
                type="url" value={form.link_url}
                onChange={(e) => setForm(f => ({ ...f, link_url: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <select
                value={form.position} onChange={(e) => setForm(f => ({ ...f, position: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="hero">Bandeau principal (haut de page)</option>
                <option value="inline">Entre les annonces</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordre d'affichage</label>
              <input
                type="number" min="0" value={form.sort_order}
                onChange={(e) => setForm(f => ({ ...f, sort_order: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de début (optionnel)</label>
              <input
                type="datetime-local" value={form.start_date}
                onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin (optionnel)</label>
              <input
                type="datetime-local" value={form.end_date}
                onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-green-400 transition text-center"
            >
              {preview ? (
                <img src={preview} alt="preview" className="max-h-32 mx-auto rounded-lg object-contain" />
              ) : (
                <div className="text-gray-400">
                  <p className="text-3xl mb-1">🖼️</p>
                  <p className="text-sm">Cliquer pour choisir une image</p>
                  <p className="text-xs mt-1">Recommandé : 1200×400 px, JPG ou PNG</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </div>

          <button
            type="submit" disabled={createMutation.isPending}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
          >
            {createMutation.isPending ? 'Envoi en cours...' : '➕ Ajouter la publicité'}
          </button>
        </form>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl h-24 animate-pulse" />)}</div>
      ) : banners.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
          <p className="text-4xl mb-2">📭</p>
          <p>Aucune publicité pour l'instant</p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map(b => (
            <div key={b.id} className="bg-white rounded-2xl shadow p-4 flex items-center gap-4">
              <div className="w-24 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                {b.image_url
                  ? <img src={b.image_url} alt={b.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-2xl">🖼️</div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">{b.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {b.position === 'hero' ? 'Bandeau principal' : 'Entre les annonces'}
                  {b.link_url && <> · <a href={b.link_url} target="_blank" rel="noreferrer" className="text-green-600 underline">Lien</a></>}
                  {' · '}{b.click_count} clics
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleMutation.mutate({ id: b.id, is_active: !b.is_active })}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition ${b.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >{b.is_active ? '✅ Active' : '⏸ Inactif'}</button>
                <button
                  onClick={() => { if (confirm('Supprimer cette publicité définitivement ?')) deleteMutation.mutate(b.id) }}
                  className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg transition"
                >🗑 Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Onglet 4 : Catégories ─────────────────────────────────────────────────────

function TabCategories() {
  const qc = useQueryClient()
  const [form, setForm]   = useState({ name: '', icon_url: '', parent: '', sort_order: 0 })
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn:  () => adminAPI.getCategories().then(r => r.data),
  })

  const allCats  = Array.isArray(data) ? data : (data?.results ?? [])
  const parents  = allCats.filter(c => !c.parent)
  const childMap = allCats.reduce((acc, c) => {
    if (c.parent) { acc[c.parent] = [...(acc[c.parent] || []), c] }
    return acc
  }, {})

  const createMutation = useMutation({
    mutationFn: (d) => adminAPI.createCategory(d),
    onSuccess: () => {
      qc.invalidateQueries(['admin-categories'])
      setForm({ name: '', icon_url: '', parent: '', sort_order: 0 })
      setError('')
    },
    onError: (err) => setError(JSON.stringify(err.response?.data || 'Erreur')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => adminAPI.deleteCategory(id),
    onSuccess:  () => qc.invalidateQueries(['admin-categories']),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Le nom est obligatoire.'); return }
    const payload = { name: form.name.trim(), icon_url: form.icon_url.trim(), sort_order: Number(form.sort_order) || 0 }
    if (form.parent) payload.parent = form.parent
    createMutation.mutate(payload)
  }

  const iconOf = (c) => c.icon_url && !c.icon_url.startsWith('http') ? c.icon_url : null

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-bold text-gray-800">🏷️ Catégories &amp; Sous-catégories</h2>

      {/* Formulaire */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="font-semibold text-gray-700 mb-4">
          {form.parent ? '➕ Nouvelle sous-catégorie' : '➕ Nouvelle catégorie principale'}
        </h3>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input
                type="text" required value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Ex: Voitures, Toyota, Téléphones..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icône (emoji ou URL image)</label>
              <div className="flex gap-2 items-center">
                {form.icon_url && !form.icon_url.startsWith('http') && (
                  <span className="text-2xl">{form.icon_url}</span>
                )}
                <input
                  type="text" value={form.icon_url}
                  onChange={(e) => setForm(f => ({ ...f, icon_url: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="🚗 ou https://..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catégorie parente <span className="text-gray-400">(laisser vide = catégorie principale)</span>
              </label>
              <select
                value={form.parent} onChange={(e) => setForm(f => ({ ...f, parent: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">— Catégorie principale —</option>
                {parents.map(p => (
                  <option key={p.id} value={p.id}>{iconOf(p) ? iconOf(p) + ' ' : ''}{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordre d'affichage</label>
              <input
                type="number" min="0" value={form.sort_order}
                onChange={(e) => setForm(f => ({ ...f, sort_order: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <button
            type="submit" disabled={createMutation.isPending}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
          >
            {createMutation.isPending ? 'Création...' : `➕ Créer ${form.parent ? 'la sous-catégorie' : 'la catégorie'}`}
          </button>
        </form>
      </div>

      {/* Résumé */}
      {!isLoading && (
        <div className="flex gap-4 text-sm text-gray-500">
          <span>🗂 {parents.length} catégorie{parents.length !== 1 ? 's' : ''} principales</span>
          <span>·</span>
          <span>📂 {allCats.length - parents.length} sous-catégorie{allCats.length - parents.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Arbre */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-xl h-16 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {parents.map(cat => {
            const subs = childMap[cat.id] || []
            return (
              <div key={cat.id} className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="flex items-center gap-3 p-4 bg-gray-50 border-b">
                  <span className="text-2xl w-8 text-center">{iconOf(cat) || '📁'}</span>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{cat.name}</p>
                    <p className="text-xs text-gray-400">{subs.length} sous-catégorie{subs.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {cat.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => { if (confirm(`Désactiver « ${cat.name} » et toutes ses sous-catégories ?`)) deleteMutation.mutate(cat.id) }}
                      disabled={deleteMutation.isPending}
                      className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                    >Désactiver</button>
                  </div>
                </div>
                {subs.map(sub => (
                  <div key={sub.id} className="flex items-center gap-3 px-5 py-3 border-b last:border-b-0 hover:bg-gray-50 transition">
                    <span className="text-gray-300 text-sm">└</span>
                    <span className="text-lg w-6 text-center">{iconOf(sub) || '📂'}</span>
                    <p className="flex-1 text-sm text-gray-700 font-medium">{sub.name}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${sub.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {sub.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => { if (confirm(`Désactiver « ${sub.name} » ?`)) deleteMutation.mutate(sub.id) }}
                        disabled={deleteMutation.isPending}
                        className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                      >Désactiver</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Onglet 5 : Boutiques ──────────────────────────────────────────────────────

function TabShops() {
  const qc = useQueryClient()
  const [filter, setFilter]         = useState('pending')
  const [rejectId, setRejectId]     = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-shops', filter],
    queryFn:  () => adminAPI.getShops({ status: filter || undefined }).then(r => r.data),
  })

  const shops = Array.isArray(data) ? data : (data?.results ?? [])

  const approveMutation = useMutation({
    mutationFn: ({ id, action, plan, reason }) => adminAPI.approveShop(id, { action, plan, reason }),
    onSuccess:  () => qc.invalidateQueries(['admin-shops']),
  })

  const STATUS_COLORS = {
    pending:  'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600',
  }
  const STATUS_LABELS = { pending: 'En attente', approved: 'Approuvée', rejected: 'Rejetée' }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-gray-800">🏪 Boutiques</h2>

      {/* Filtres */}
      <div className="flex gap-2">
        {[['pending', '⏳ En attente'], ['approved', '✅ Approuvées'], ['rejected', '❌ Rejetées'], ['', '🗂 Toutes']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`text-xs font-medium px-3 py-2 rounded-xl transition ${filter === v ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-green-400'}`}
          >{l}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl h-28 animate-pulse" />)}</div>
      ) : shops.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">🏪</p>
          <p>Aucune boutique {filter === 'pending' ? 'en attente' : ''}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {shops.map(shop => (
            <div key={shop.id} className="bg-white rounded-2xl shadow p-5 space-y-4">
              {/* En-tête */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                  {shop.logo_url
                    ? <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl">🏪</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-800">{shop.name}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[shop.status]}`}>
                      {STATUS_LABELS[shop.status]}
                    </span>
                    {shop.plan === 'premium' && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">⭐ Premium</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Propriétaire : <span className="font-medium">{shop.owner_name}</span>
                    {' · '}{shop.owner_phone}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    📍 {shop.city}
                    {shop.phone && <> · 📞 {shop.phone}</>}
                    {shop.whatsapp && <> · 💬 {shop.whatsapp}</>}
                  </p>
                </div>
              </div>

              {shop.description && (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3 line-clamp-2">{shop.description}</p>
              )}

              {shop.reject_reason && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                  <strong>Raison du rejet :</strong> {shop.reject_reason}
                </div>
              )}

              {/* Actions approbation */}
              {shop.status === 'pending' && (
                <div className="space-y-3">
                  {/* Choisir plan avant approbation */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => approveMutation.mutate({ id: shop.id, action: 'approve', plan: 'standard' })}
                      disabled={approveMutation.isPending}
                      className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-50"
                    >✅ Approuver Standard</button>
                    <button
                      onClick={() => approveMutation.mutate({ id: shop.id, action: 'approve', plan: 'premium' })}
                      disabled={approveMutation.isPending}
                      className="bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-50"
                    >⭐ Approuver Premium</button>
                  </div>

                  {/* Rejection avec raison */}
                  {rejectId === shop.id ? (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        placeholder="Raison du rejet (ex: informations incomplètes, photos incorrectes...)"
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        className="w-full border border-red-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            approveMutation.mutate({ id: shop.id, action: 'reject', reason: rejectReason })
                            setRejectId(null); setRejectReason('')
                          }}
                          disabled={approveMutation.isPending}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 rounded-xl text-sm transition disabled:opacity-50"
                        >Confirmer le rejet</button>
                        <button onClick={() => setRejectId(null)} className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm transition">Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setRejectId(shop.id); setRejectReason('') }}
                      className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2 rounded-xl text-sm border border-red-200 transition"
                    >❌ Rejeter</button>
                  )}
                </div>
              )}

              {/* Actions sur boutiques approuvées */}
              {shop.status === 'approved' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approveMutation.mutate({ id: shop.id, action: 'approve', plan: shop.plan === 'standard' ? 'premium' : 'standard' })}
                    disabled={approveMutation.isPending}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-xl text-xs transition"
                  >
                    {shop.plan === 'premium' ? '⬇️ Rétrograder Standard' : '⬆️ Promouvoir Premium'}
                  </button>
                  <button
                    onClick={() => adminAPI.updateShop(shop.id, { is_featured: !shop.is_featured }).then(() => qc.invalidateQueries(['admin-shops']))}
                    className={`flex-1 font-medium py-2 rounded-xl text-xs transition ${shop.is_featured ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {shop.is_featured ? '⭐ En vedette' : '☆ Mettre en vedette'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Onglet 6 : Paramètres du site ────────────────────────────────────────────

function Toggle({ label, description, checked, onChange, disabled }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 text-sm">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
          checked ? 'bg-green-500' : 'bg-gray-300'
        } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
          checked ? 'translate-x-7' : 'translate-x-1'
        }`} />
      </button>
    </div>
  )
}

function TabSettings() {
  const qc = useQueryClient()

  const { data: rawSettings, isLoading } = useQuery({
    queryKey: ['site-settings'],
    queryFn:  () => adminAPI.getSettings().then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: (patch) => adminAPI.patchSettings(patch),
    onSuccess:  (res) => qc.setQueryData(['site-settings'], res.data),
  })

  const s = rawSettings ?? {}

  const toggle = (key) => (val) => mutation.mutate({ [key]: val })

  const [wpEdit, setWpEdit]       = useState(false)
  const [wpVal, setWpVal]         = useState('')
  const [emailEdit, setEmailEdit] = useState(false)
  const [emailVal, setEmailVal]   = useState('')

  const saveWhatsApp = () => {
    mutation.mutate({ whatsapp_contact: wpVal })
    setWpEdit(false)
  }
  const saveEmail = () => {
    mutation.mutate({ support_email: emailVal })
    setEmailEdit(false)
  }

  if (isLoading) return (
    <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="bg-white rounded-xl h-14 animate-pulse" />)}</div>
  )

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-800">⚙️ Paramètres du site</h2>

      {/* Monétisation */}
      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="font-bold text-gray-700 mb-1">💰 Monétisation</h3>
        <p className="text-xs text-gray-400 mb-4">Contrôle les restrictions de publication et les abonnements.</p>

        <Toggle
          label="Publications gratuites illimitées"
          description="Tous les utilisateurs peuvent publier sans limite. Désactivez pour appliquer les quotas."
          checked={!!s.free_listings_enabled}
          onChange={toggle('free_listings_enabled')}
        />
        <Toggle
          label="Activer les abonnements payants"
          description="Affiche la page Tarifs et applique les limites par plan. N'a d'effet que si publications gratuites est désactivé."
          checked={!!s.subscriptions_enabled}
          onChange={toggle('subscriptions_enabled')}
        />

        <div className="flex items-center justify-between py-4 border-b border-gray-100">
          <div>
            <p className="font-medium text-gray-800 text-sm">Limite annonces gratuites</p>
            <p className="text-xs text-gray-400">Nombre d'annonces sur le plan gratuit</p>
          </div>
          <select
            value={s.max_free_listings ?? 5}
            onChange={e => mutation.mutate({ max_free_listings: Number(e.target.value) })}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            {[3, 5, 10, 20, 50].map(n => <option key={n} value={n}>{n} annonces</option>)}
          </select>
        </div>

        <div className="flex items-center justify-between py-4">
          <div>
            <p className="font-medium text-gray-800 text-sm">Commission escrow</p>
            <p className="text-xs text-gray-400">Prélevée sur les paiements Mobile Money</p>
          </div>
          <select
            value={s.commission_pct ?? 4}
            onChange={e => mutation.mutate({ commission_pct: Number(e.target.value) })}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}%</option>)}
          </select>
        </div>
      </div>

      {/* Fonctionnalités */}
      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="font-bold text-gray-700 mb-4">🔧 Fonctionnalités</h3>
        <Toggle
          label="Paiement escrow (Mobile Money sécurisé)"
          description="Désactivez pour masquer le bouton Payer sur les annonces."
          checked={!!s.escrow_enabled}
          onChange={toggle('escrow_enabled')}
        />
        <Toggle
          label="Validation admin pour les boutiques"
          description="Les nouvelles boutiques passent en statut 'En attente' avant d'être visibles."
          checked={!!s.shop_approval_required}
          onChange={toggle('shop_approval_required')}
        />
      </div>

      {/* Contact support */}
      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="font-bold text-gray-700 mb-1">📞 Contact &amp; Support</h3>
        <p className="text-xs text-gray-400 mb-4">Affiché dans le bouton support flottant sur tout le site.</p>

        {/* WhatsApp */}
        <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-100">
          <div className="flex-1">
            <p className="font-medium text-gray-800 text-sm">📱 WhatsApp support</p>
            <p className="text-xs text-gray-400">Numéro international sans + (ex: 224623000000)</p>
          </div>
          {wpEdit ? (
            <div className="flex gap-2">
              <input value={wpVal} onChange={e => setWpVal(e.target.value)}
                placeholder="224XXXXXXXXX"
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <button onClick={saveWhatsApp} className="bg-green-500 text-white text-sm px-3 py-1.5 rounded-xl">✓</button>
              <button onClick={() => setWpEdit(false)} className="bg-gray-100 text-gray-600 text-sm px-3 py-1.5 rounded-xl">✕</button>
            </div>
          ) : (
            <button onClick={() => { setWpEdit(true); setWpVal(s.whatsapp_contact ?? '') }}
              className="text-sm text-green-600 font-medium border border-green-200 px-3 py-1.5 rounded-xl hover:bg-green-50 transition">
              {s.whatsapp_contact || '+ Ajouter'}
            </button>
          )}
        </div>

        {/* Email */}
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="flex-1">
            <p className="font-medium text-gray-800 text-sm">✉️ Email support</p>
            <p className="text-xs text-gray-400">Adresse email de contact pour les utilisateurs</p>
          </div>
          {emailEdit ? (
            <div className="flex gap-2">
              <input value={emailVal} onChange={e => setEmailVal(e.target.value)}
                placeholder="support@guineemarche.com"
                type="email"
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button onClick={saveEmail} className="bg-blue-500 text-white text-sm px-3 py-1.5 rounded-xl">✓</button>
              <button onClick={() => setEmailEdit(false)} className="bg-gray-100 text-gray-600 text-sm px-3 py-1.5 rounded-xl">✕</button>
            </div>
          ) : (
            <button onClick={() => { setEmailEdit(true); setEmailVal(s.support_email ?? '') }}
              className="text-sm text-blue-600 font-medium border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-50 transition">
              {s.support_email || '+ Ajouter'}
            </button>
          )}
        </div>
      </div>

      {/* Maintenance */}
      <div className="bg-white rounded-2xl shadow p-5">
        <Toggle
          label="🚧 Mode maintenance"
          description="Affiche une bannière jaune sur toutes les pages du site."
          checked={!!s.maintenance_mode}
          onChange={toggle('maintenance_mode')}
        />
        {s.maintenance_mode && (
          <div className="mt-3">
            <textarea
              rows={2}
              placeholder="Message affiché aux utilisateurs..."
              defaultValue={s.maintenance_message}
              onBlur={e => mutation.mutate({ maintenance_message: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        )}
      </div>

      {mutation.isPending && (
        <p className="text-xs text-center text-green-600 animate-pulse">Enregistrement…</p>
      )}
    </div>
  )
}

// ── Onglet Points de retrait ──────────────────────────────────────────────────
const VILLES_GN = ['Conakry','Kindia','Mamou','Labé','Kankan','Faranah','Kissidougou','Guéckédou','Macenta','Nzérékoré','Boké','Fria','Coyah','Dubréka','Siguiri','Koundara','Gaoual','Dinguiraye','Kérouané','Pita','Télimélé']

function TabPickupPoints() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', address: '', city: 'Conakry', commune: '', phone: '' })
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-pickup-points'],
    queryFn:  () => adminAPI.getPickupPoints().then(r => r.data),
  })
  const points = Array.isArray(data) ? data : (data?.results ?? [])

  const saveMutation = useMutation({
    mutationFn: (d) => editId
      ? adminAPI.updatePickupPoint(editId, d)
      : adminAPI.createPickupPoint(d),
    onSuccess: () => {
      qc.invalidateQueries(['admin-pickup-points'])
      setForm({ name: '', address: '', city: 'Conakry', commune: '', phone: '' })
      setEditId(null)
      setShowForm(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => adminAPI.deletePickupPoint(id),
    onSuccess:  () => qc.invalidateQueries(['admin-pickup-points']),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => adminAPI.updatePickupPoint(id, { is_active }),
    onSuccess:  () => qc.invalidateQueries(['admin-pickup-points']),
  })

  const startEdit = (p) => {
    setForm({ name: p.name, address: p.address, city: p.city, commune: p.commune || '', phone: p.phone || '' })
    setEditId(p.id)
    setShowForm(true)
  }

  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(form) }

  const byCity = points.reduce((acc, p) => {
    if (!acc[p.city]) acc[p.city] = []
    acc[p.city].push(p)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">📍 Points de retrait</h2>
          <p className="text-xs text-gray-400 mt-0.5">Lieux où les acheteurs peuvent retirer leurs commandes</p>
        </div>
        <button onClick={() => { setEditId(null); setForm({ name:'',address:'',city:'Conakry',commune:'',phone:'' }); setShowForm(s => !s) }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
          {showForm ? 'Annuler' : '+ Ajouter un point'}
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-4">{editId ? '✏️ Modifier le point' : '➕ Nouveau point de retrait'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nom du lieu *</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                placeholder="Ex: Marché Madina — Entrée principale"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ville *</label>
              <select value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                {VILLES_GN.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Adresse / Quartier *</label>
              <input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))}
                placeholder="Ex: Quartier Madina, en face du marché central"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Commune / Secteur</label>
              <input value={form.commune} onChange={e => setForm(f => ({...f, commune: e.target.value}))}
                placeholder="Ex: Matam"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Téléphone du point</label>
              <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                placeholder="Ex: +224 6XX XXX XXX"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div className="md:col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition">Annuler</button>
              <button type="submit" disabled={saveMutation.isPending}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm transition disabled:opacity-50">
                {saveMutation.isPending ? 'Enregistrement...' : editId ? '✓ Enregistrer' : '+ Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste par ville */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl h-16 animate-pulse" />)}</div>
      ) : points.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
          <p className="text-4xl mb-3">📍</p>
          <p className="text-sm">Aucun point de retrait configuré</p>
          <p className="text-xs mt-1">Ajoutez des points pour que les acheteurs puissent retirer leurs commandes</p>
        </div>
      ) : (
        Object.entries(byCity).map(([city, pts]) => (
          <div key={city} className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b">
              <h3 className="font-semibold text-gray-700 text-sm">📍 {city} <span className="text-gray-400 font-normal">({pts.length})</span></h3>
            </div>
            <div className="divide-y">
              {pts.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${p.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{p.name}</p>
                    <p className="text-xs text-gray-400 truncate">{p.address}{p.commune && ` · ${p.commune}`}</p>
                    {p.phone && <p className="text-xs text-green-600">{p.phone}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => toggleMutation.mutate({ id: p.id, is_active: !p.is_active })}
                      className={`text-xs px-2 py-1 rounded-lg font-medium transition ${p.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {p.is_active ? 'Actif' : 'Inactif'}
                    </button>
                    <button onClick={() => startEdit(p)}
                      className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">✏️</button>
                    <button onClick={() => { if (window.confirm(`Supprimer "${p.name}" ?`)) deleteMutation.mutate(p.id) }}
                      className="text-xs px-2 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',      label: '📊 Tableau de bord' },
  { id: 'listings',      label: '📦 Annonces' },
  { id: 'banners',       label: '📢 Publicités' },
  { id: 'categories',    label: '🏷️ Catégories' },
  { id: 'shops',         label: '🏪 Boutiques' },
  { id: 'pickup-points', label: '📍 Points retrait' },
  { id: 'settings',      label: '⚙️ Paramètres' },
]

export default function AdminPage() {
  const user = useAuthStore(s => s.user)
  const qc   = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')

  if (!user || user.role !== 'admin') return <Navigate to="/" />

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn:  () => adminAPI.getStats().then(r => r.data),
  })

  const { data: disputesData, isLoading: disputesLoading } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn:  () => adminAPI.getDisputes().then(r => r.data),
  })

  const disputes = Array.isArray(disputesData) ? disputesData : (disputesData?.results ?? [])

  const resolveMutation = useMutation({
    mutationFn: ({ id, action }) => adminAPI.resolve(id, action),
    onSuccess:  () => {
      qc.invalidateQueries(['admin-disputes'])
      qc.invalidateQueries(['admin-stats'])
    },
  })

  const { data: pendingShopsData } = useQuery({
    queryKey: ['admin-shops-pending-count'],
    queryFn:  () => adminAPI.getShops({ status: 'pending' }).then(r => {
      const d = r.data
      return Array.isArray(d) ? d.length : (d?.count ?? d?.results?.length ?? 0)
    }),
    refetchInterval: 60000,
  })
  const pendingShopsCount = pendingShopsData ?? 0

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-green-700 font-bold text-lg">GuinéeMarché</Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600 font-medium">Administration</span>
          </div>
          <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">Admin</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Onglets */}
        <div className="bg-white rounded-2xl shadow p-1.5 flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-max text-sm font-medium px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              {tab.id === 'overview' && disputes.length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 align-middle">{disputes.length}</span>
              )}
              {tab.id === 'shops' && pendingShopsCount > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 align-middle">{pendingShopsCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Contenu */}
        {activeTab === 'overview'   && <TabOverview stats={stats} disputes={disputes} isLoading={disputesLoading} resolveMutation={resolveMutation} />}
        {activeTab === 'listings'   && <TabListings />}
        {activeTab === 'banners'    && <TabBanners />}
        {activeTab === 'categories' && <TabCategories />}
        {activeTab === 'shops'         && <TabShops />}
        {activeTab === 'pickup-points' && <TabPickupPoints />}
        {activeTab === 'settings'      && <TabSettings />}
      </div>
    </div>
  )
}
