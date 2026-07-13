import { useState, useRef, useEffect } from 'react'
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
  holdEscrow:  (id, action) => api.post(`/orders/admin/escrow/${id}/hold/`, { action }),

  // Toutes les commandes
  getOrders: (params) => api.get('/orders/admin/orders/', { params }),

  // Annonces
  getListings:     (params) => api.get('/listings/admin/listings/', { params }),
  suspendListing:  (id)          => api.delete(`/listings/admin/listings/${id}/`),
  approveListing:  (id)          => api.post(`/listings/admin/listings/${id}/approve/`),
  rejectListing:   (id, reason)  => api.post(`/listings/admin/listings/${id}/reject/`, { reason }),

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

  // Zones de rencontre
  getMeetingZones:    () => api.get('/orders/admin/meeting-zones/'),
  createMeetingZone:  (data) => api.post('/orders/admin/meeting-zones/', data),
  updateMeetingZone:  (id, data) => api.patch(`/orders/admin/meeting-zones/${id}/`, data),
  deleteMeetingZone:  (id) => api.delete(`/orders/admin/meeting-zones/${id}/`),

  // Livraisons
  getDeliveries:    (params) => api.get('/orders/admin/assignments/', { params }),
  getLivreurs:      ()       => api.get('/orders/admin/livreurs/'),
  reassignDelivery: (id, data) => api.post(`/orders/admin/assignments/${id}/reassign/`, data),

  // Zones de livraison
  getDeliveryZones:    ()          => api.get('/orders/admin/delivery-zones/'),
  createDeliveryZone:  (data)      => api.post('/orders/admin/delivery-zones/', data),
  updateDeliveryZone:  (id, data)  => api.patch(`/orders/admin/delivery-zones/${id}/`, data),
  deleteDeliveryZone:  (id)        => api.delete(`/orders/admin/delivery-zones/${id}/`),

  // Tarifs inter-communes
  getZoneRates:    ()         => api.get('/orders/admin/zone-rates/'),
  createZoneRate:  (data)     => api.post('/orders/admin/zone-rates/', data),
  updateZoneRate:  (id, data) => api.patch(`/orders/admin/zone-rates/${id}/`, data),
  deleteZoneRate:  (id)       => api.delete(`/orders/admin/zone-rates/${id}/`),

  // Retours
  getReturns:    (params)      => api.get('/orders/admin/returns/', { params }),
  updateReturn:  (id, data)    => api.patch(`/orders/admin/returns/${id}/`, data),

  // Utilisateurs
  getUsers:   (params)      => api.get('/accounts/admin/users/', { params }),
  updateUser: (id, data)    => api.patch(`/accounts/admin/users/${id}/`, data),
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Utilisateurs"           value={stats.users}                icon="👥" color="blue" />
            <StatCard label="Vendeurs"               value={stats.users_sellers}         icon="🏷️" color="blue" />
            <StatCard label="Livreurs actifs"        value={`${stats.livreurs_available ?? '—'}/${stats.users_livreurs ?? '—'}`} icon="🚴" color="green" />
            <StatCard label="Annonces actives"       value={stats.active_listings}       icon="📦" color="green" />
            <StatCard label="Commandes totales"      value={stats.orders_total}          icon="🛍️" color="blue" />
            <StatCard label="Commandes aujourd'hui"  value={stats.orders_today}          icon="📅" color="green" />
            <StatCard label="Livraisons en cours"    value={(stats.deliveries_assigned ?? 0) + (stats.deliveries_en_route ?? 0)} icon="🚚" color="yellow" />
            <StatCard label="Litiges en cours"       value={stats.orders_disputed}       icon="⚠️" color="red" />
            <StatCard label="Commandes terminées"    value={stats.orders_completed}      icon="✅" color="green" />
            <StatCard label="Livrées aujourd'hui"    value={stats.deliveries_today}      icon="🏁" color="green" />
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
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [rejectId, setRejectId]         = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-listings', search, statusFilter],
    queryFn:  () => adminAPI.getListings({ search: search || undefined, status: statusFilter || undefined }).then(r => r.data),
  })

  const listings = Array.isArray(data) ? data : (data?.results ?? [])

  const suspendMutation = useMutation({
    mutationFn: (id) => adminAPI.suspendListing(id),
    onSuccess:  () => qc.invalidateQueries(['admin-listings']),
  })

  const approveMutation = useMutation({
    mutationFn: (id) => adminAPI.approveListing(id),
    onSuccess:  () => qc.invalidateQueries(['admin-listings']),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => adminAPI.rejectListing(id, reason),
    onSuccess:  () => { qc.invalidateQueries(['admin-listings']); setRejectId(null); setRejectReason('') },
  })

  const STATUS_LABELS = {
    active:    { label: 'Active',       color: 'bg-green-100 text-green-700' },
    draft:     { label: '⏳ En révision', color: 'bg-amber-100 text-amber-700' },
    sold:      { label: 'Vendue',       color: 'bg-blue-100 text-blue-700' },
    expired:   { label: 'Expirée',      color: 'bg-orange-100 text-orange-600' },
    suspended: { label: 'Refusée',      color: 'bg-red-100 text-red-600' },
  }

  // Compter les annonces en révision pour le badge
  const { data: draftData } = useQuery({
    queryKey: ['admin-listings-draft-count'],
    queryFn:  () => adminAPI.getListings({ status: 'draft' }).then(r => r.data),
    refetchInterval: 30000,
  })
  const draftCount = Array.isArray(draftData) ? draftData.length : (draftData?.results?.length ?? 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">📦 Toutes les annonces</h2>
        {draftCount > 0 && (
          <button
            onClick={() => setStatusFilter('draft')}
            className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-amber-100 transition">
            ⏳ {draftCount} en révision
          </button>
        )}
      </div>

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
            <option key={v} value={v}>{label.replace('⏳ ', '')}</option>
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
              <div key={l.id} className="bg-white rounded-2xl shadow p-4">
                <div className="flex items-center gap-4">
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
                    {l.status === 'draft' && (
                      <button
                        onClick={() => { if (confirm('Approuver cette annonce ?')) approveMutation.mutate(l.id) }}
                        disabled={approveMutation.isPending}
                        className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg transition disabled:opacity-50 font-medium"
                      >✅ Approuver</button>
                    )}
                    {l.status !== 'suspended' && (
                      rejectId === l.id ? null : (
                        <button
                          onClick={() => { setRejectId(l.id); setRejectReason('') }}
                          className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg transition"
                        >❌ Refuser</button>
                      )
                    )}
                  </div>
                </div>
                {/* Formulaire refus inline */}
                {rejectId === l.id && (
                  <div className="mt-3 flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Raison du refus (obligatoire)…"
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      className="flex-1 border border-red-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      autoFocus
                    />
                    <button
                      onClick={() => rejectReason.trim() && rejectMutation.mutate({ id: l.id, reason: rejectReason.trim() })}
                      disabled={!rejectReason.trim() || rejectMutation.isPending}
                      className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50 font-medium"
                    >Confirmer</button>
                    <button
                      onClick={() => { setRejectId(null); setRejectReason('') }}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5"
                    >Annuler</button>
                  </div>
                )}
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

// ── Onglet : Zones de rencontre ───────────────────────────────────────────────

function TabMeetingZones() {
  const qc = useQueryClient()
  const EMPTY = { name: '', address: '', city: 'Conakry', latitude: '', longitude: '' }
  const [form, setForm]     = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-meeting-zones'],
    queryFn:  () => adminAPI.getMeetingZones().then(r => r.data?.results ?? r.data ?? []),
  })
  const zones = Array.isArray(data) ? data : []

  const saveMutation = useMutation({
    mutationFn: (d) => editId
      ? adminAPI.updateMeetingZone(editId, d)
      : adminAPI.createMeetingZone(d),
    onSuccess: () => {
      qc.invalidateQueries(['admin-meeting-zones'])
      setForm(EMPTY); setEditId(null); setShowForm(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => adminAPI.deleteMeetingZone(id),
    onSuccess:  () => qc.invalidateQueries(['admin-meeting-zones']),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => adminAPI.updateMeetingZone(id, { is_active }),
    onSuccess:  () => qc.invalidateQueries(['admin-meeting-zones']),
  })

  const startEdit = (z) => {
    setForm({ name: z.name, address: z.address || '', city: z.city, latitude: z.latitude || '', longitude: z.longitude || '' })
    setEditId(z.id); setShowForm(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form, latitude: form.latitude || null, longitude: form.longitude || null }
    saveMutation.mutate(payload)
  }

  const byCity = zones.reduce((acc, z) => {
    if (!acc[z.city]) acc[z.city] = []
    acc[z.city].push(z)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">🤝 Zones de rencontre</h2>
          <p className="text-xs text-gray-400 mt-0.5">Lieux de remise en main propre disponibles pour les acheteurs</p>
        </div>
        <button onClick={() => { setEditId(null); setForm(EMPTY); setShowForm(s => !s) }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
          {showForm ? 'Annuler' : '+ Ajouter une zone'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-4">{editId ? '✏️ Modifier la zone' : '➕ Nouvelle zone de rencontre'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nom du lieu *</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                placeholder="Ex: Marché Madina — Centre"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ville *</label>
              <select value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                {VILLES_GN.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Adresse / Description</label>
              <input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))}
                placeholder="Ex: Quartier Madina, en face du marché central"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Latitude (optionnel)</label>
              <input type="number" step="any" value={form.latitude} onChange={e => setForm(f => ({...f, latitude: e.target.value}))}
                placeholder="Ex: 9.5370"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Longitude (optionnel)</label>
              <input type="number" step="any" value={form.longitude} onChange={e => setForm(f => ({...f, longitude: e.target.value}))}
                placeholder="Ex: -13.6773"
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

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl h-16 animate-pulse" />)}</div>
      ) : zones.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
          <p className="text-4xl mb-3">🤝</p>
          <p className="text-sm">Aucune zone de rencontre configurée</p>
          <p className="text-xs mt-1">Les zones pré-remplies via la migration apparaissent ici</p>
        </div>
      ) : (
        Object.entries(byCity).map(([city, czones]) => (
          <div key={city} className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b">
              <h3 className="font-semibold text-gray-700 text-sm">📍 {city} <span className="text-gray-400 font-normal">({czones.length})</span></h3>
            </div>
            <div className="divide-y">
              {czones.map(z => (
                <div key={z.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${z.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{z.name}</p>
                    <p className="text-xs text-gray-400 truncate">{z.address || '—'}{z.latitude ? ` · 📌 ${z.latitude}, ${z.longitude}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => toggleMutation.mutate({ id: z.id, is_active: !z.is_active })}
                      className={`text-xs px-2 py-1 rounded-lg font-medium transition ${z.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {z.is_active ? 'Actif' : 'Inactif'}
                    </button>
                    <button onClick={() => startEdit(z)}
                      className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">✏️</button>
                    <button onClick={() => { if (window.confirm(`Supprimer "${z.name}" ?`)) deleteMutation.mutate(z.id) }}
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

// ── Onglet : Suivi des livraisons ─────────────────────────────────────────────

function TabDeliveries() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [reassignId, setReassignId]     = useState(null)
  const [selectedLivreur, setSelected]  = useState('')

  const { data: deliveriesData, isLoading } = useQuery({
    queryKey: ['admin-deliveries', statusFilter],
    queryFn:  () => adminAPI.getDeliveries({ status: statusFilter || undefined }).then(r => r.data),
    refetchInterval: 30000,
  })
  const deliveries = Array.isArray(deliveriesData) ? deliveriesData : (deliveriesData?.results ?? [])

  const { data: livreursData } = useQuery({
    queryKey: ['admin-livreurs'],
    queryFn:  () => adminAPI.getLivreurs().then(r => r.data),
  })
  const livreurs = Array.isArray(livreursData) ? livreursData : []

  const reassignMutation = useMutation({
    mutationFn: ({ id, livreur_id }) => adminAPI.reassignDelivery(id, { livreur_id }),
    onSuccess:  () => { qc.invalidateQueries(['admin-deliveries']); setReassignId(null); setSelected('') },
  })

  const ST_COLORS = { assigned: 'bg-blue-100 text-blue-700', en_route: 'bg-amber-100 text-amber-700', delivered: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-600' }
  const ST_LABELS = { assigned: '⏳ À récupérer', en_route: '🚚 En route', delivered: '✅ Livrée', cancelled: '❌ Annulée' }

  const inProgress  = deliveries.filter(d => d.status === 'en_route').length
  const toPickup    = deliveries.filter(d => d.status === 'assigned').length
  const delivered   = deliveries.filter(d => d.status === 'delivered').length

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-gray-800">🚚 Suivi des livraisons</h2>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 text-center">
          <p className="text-2xl font-bold text-blue-700">{toPickup}</p>
          <p className="text-xs text-blue-600 mt-0.5">⏳ À récupérer</p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 text-center">
          <p className="text-2xl font-bold text-amber-700">{inProgress}</p>
          <p className="text-xs text-amber-600 mt-0.5">🚚 En route</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-4 border border-green-100 text-center">
          <p className="text-2xl font-bold text-green-700">{delivered}</p>
          <p className="text-xs text-green-600 mt-0.5">✅ Livrées</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {[['', 'Toutes'], ['assigned', '⏳ À récupérer'], ['en_route', '🚚 En route'], ['delivered', '✅ Livrées']].map(([v, l]) => (
          <button key={v} onClick={() => setStatusFilter(v)}
            className={`text-xs font-medium px-3 py-2 rounded-xl transition ${statusFilter === v ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-green-400'}`}>
            {l}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-xl h-28 animate-pulse" />)}</div>
      ) : deliveries.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-12 text-center text-gray-400">
          <p className="text-5xl mb-3">🚚</p><p>Aucune livraison trouvée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deliveries.map(d => {
            const sc = ST_COLORS[d.status] || 'bg-gray-100 text-gray-600'
            const sl = ST_LABELS[d.status]  || d.status
            return (
              <div key={d.id} className="bg-white rounded-2xl shadow p-4 space-y-3">
                {/* En-tête */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{d.order_detail?.listing_title || '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      🛒 {d.order_detail?.buyer_name} → 🏷️ {d.order_detail?.seller_name}
                    </p>
                    {d.order_detail?.delivery_address && (
                      <p className="text-xs text-gray-500 mt-0.5">📍 {d.order_detail.delivery_address}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${sc}`}>{sl}</span>
                    <p className="text-sm font-bold text-green-600 mt-1">{fmt(d.order_detail?.amount_gnf || 0)}</p>
                  </div>
                </div>

                {/* Livreur + Codes */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">🚴 Livreur assigné</p>
                    <p className="text-sm font-semibold text-gray-800">{d.livreur_name}</p>
                    <p className="text-xs text-gray-500">{d.livreur_phone}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">🔑 Codes de sécurité</p>
                    <p className="text-xs">Pickup : <span className="font-bold text-orange-600">{d.pickup_code}</span></p>
                    <p className="text-xs">Remise : <span className="font-bold text-blue-600">{d.verification_code}</span></p>
                  </div>
                </div>

                {/* Réassignation */}
                {d.status !== 'delivered' && d.status !== 'cancelled' && (
                  reassignId === d.id ? (
                    <div className="flex gap-2 items-center">
                      <select value={selectedLivreur} onChange={e => setSelected(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                        <option value="">— Choisir un livreur —</option>
                        {livreurs.filter(l => l.is_active).map(l => (
                          <option key={l.id} value={l.id}>
                            {l.full_name} · {l.city} {l.is_available ? '✅' : '⏸️'}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => selectedLivreur && reassignMutation.mutate({ id: d.id, livreur_id: selectedLivreur })}
                        disabled={!selectedLivreur || reassignMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl text-sm disabled:opacity-50 font-medium"
                      >✓</button>
                      <button onClick={() => { setReassignId(null); setSelected('') }}
                        className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-sm">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setReassignId(d.id); setSelected('') }}
                      className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-xl transition">
                      🔄 Réassigner le livreur
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Onglet : Toutes les commandes ─────────────────────────────────────────────

function TabOrders() {
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatus] = useState('')
  const [modeFilter, setMode]   = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', search, statusFilter, modeFilter],
    queryFn:  () => adminAPI.getOrders({
      search:  search        || undefined,
      status:  statusFilter  || undefined,
      mode:    modeFilter    || undefined,
    }).then(r => r.data),
  })
  const orders = Array.isArray(data) ? data : []

  const ORDER_STATUS = {
    pending:   { label: '⏳ En attente',  color: 'bg-gray-100 text-gray-600' },
    paid:      { label: '💳 Payée',       color: 'bg-blue-100 text-blue-700' },
    confirmed: { label: '✅ Confirmée',    color: 'bg-emerald-100 text-emerald-700' },
    completed: { label: '🏁 Terminée',    color: 'bg-green-100 text-green-700' },
    disputed:  { label: '⚠️ Litige',      color: 'bg-red-100 text-red-700' },
    cancelled: { label: '❌ Annulée',     color: 'bg-red-50 text-red-500' },
  }
  const MODE_LABELS = { home_delivery: '🚚 Livraison', pickup: '📦 Retrait', meetup: '🤝 Rencontre' }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-gray-800">📋 Toutes les commandes</h2>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <input type="text" placeholder="Acheteur, vendeur, article..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-40 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">Tous statuts</option>
          {Object.entries(ORDER_STATUS).map(([v, { label }]) => (
            <option key={v} value={v}>{label.replace(/[⏳💳✅🏁⚠️❌] /g, '')}</option>
          ))}
        </select>
        <select value={modeFilter} onChange={e => setMode(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">Tous modes</option>
          <option value="home_delivery">Livraison à domicile</option>
          <option value="pickup">Point de retrait</option>
          <option value="meetup">Rencontre</option>
        </select>
      </div>

      {!isLoading && <p className="text-sm text-gray-400">{orders.length} commande{orders.length > 1 ? 's' : ''}</p>}

      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="bg-white rounded-xl h-16 animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">🛍️</p><p>Aucune commande trouvée</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(o => {
            const st = ORDER_STATUS[o.status] || { label: o.status, color: 'bg-gray-100 text-gray-500' }
            return (
              <div key={o.id} className="bg-white rounded-2xl shadow p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{o.listing_title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    🛒 {o.buyer_name}
                    <span className="text-gray-300"> → </span>
                    🏷️ {o.seller_name}
                    {o.delivery_mode && <span className="ml-2">{MODE_LABELS[o.delivery_mode] || o.delivery_mode}</span>}
                  </p>
                  <p className="text-xs text-gray-300">{new Date(o.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                  <span className="text-sm font-bold text-green-600">{fmt(o.amount_gnf)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Onglet : Gestion des utilisateurs ─────────────────────────────────────────

function TabUsers() {
  const qc = useQueryClient()
  const [search, setSearch]     = useState('')
  const [roleFilter, setRole]   = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, roleFilter],
    queryFn:  () => adminAPI.getUsers({
      search: search     || undefined,
      role:   roleFilter || undefined,
    }).then(r => r.data),
  })
  const users = Array.isArray(data) ? data : []

  const updateMutation = useMutation({
    mutationFn: ({ id, ...patch }) => adminAPI.updateUser(id, patch),
    onSuccess:  () => qc.invalidateQueries(['admin-users']),
  })

  const ROLE_COLORS = { admin: 'bg-red-100 text-red-700', seller: 'bg-blue-100 text-blue-700', buyer: 'bg-gray-100 text-gray-600', livreur: 'bg-amber-100 text-amber-700' }
  const ROLE_LABELS = { admin: 'Admin', seller: 'Vendeur', buyer: 'Acheteur', livreur: 'Livreur' }

  const roleCounts = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc }, {})

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-gray-800">👥 Gestion des utilisateurs</h2>

      {/* Stats par rôle */}
      {!isLoading && users.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[['buyer','🛒 Acheteurs','bg-gray-50 border-gray-200 text-gray-600'],['seller','🏷️ Vendeurs','bg-blue-50 border-blue-200 text-blue-700'],['livreur','🚴 Livreurs','bg-amber-50 border-amber-200 text-amber-700'],['admin','🔑 Admins','bg-red-50 border-red-200 text-red-700']].map(([r, l, cls]) => (
            <button key={r} onClick={() => setRole(r === roleFilter ? '' : r)}
              className={`rounded-xl p-3 border-2 transition text-center ${roleFilter === r ? 'ring-2 ring-green-500' : ''} ${cls}`}>
              <p className="text-xl font-bold">{roleCounts[r] || 0}</p>
              <p className="text-xs mt-0.5">{l}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-3 flex-wrap">
        <input type="text" placeholder="Nom, téléphone, email..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-40 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <select value={roleFilter} onChange={e => setRole(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">Tous les rôles</option>
          <option value="buyer">Acheteurs</option>
          <option value="seller">Vendeurs</option>
          <option value="livreur">Livreurs</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {!isLoading && <p className="text-sm text-gray-400">{users.length} utilisateur{users.length > 1 ? 's' : ''}</p>}

      {isLoading ? (
        <div className="space-y-2">{[...Array(7)].map((_, i) => <div key={i} className="bg-white rounded-xl h-14 animate-pulse" />)}</div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">👥</p><p>Aucun utilisateur trouvé</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="bg-white rounded-2xl shadow px-4 py-3 flex items-center gap-3">
              {/* Avatar initial */}
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700 flex-shrink-0">
                {u.full_name?.[0]?.toUpperCase() || '?'}
              </div>
              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-gray-800 text-sm truncate">{u.full_name}</p>
                  {u.is_verified && <span className="text-green-500 text-xs" title="Compte vérifié">✓</span>}
                  {u.is_staff    && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">staff</span>}
                </div>
                <p className="text-xs text-gray-400 truncate">{u.phone_number || u.email || '—'} · {u.city}</p>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                  {ROLE_LABELS[u.role] || u.role}
                </span>
                {/* Toggle actif/inactif */}
                <button
                  onClick={() => updateMutation.mutate({ id: u.id, is_active: !u.is_active })}
                  disabled={updateMutation.isPending}
                  className={`text-xs px-2 py-1 rounded-lg font-medium transition disabled:opacity-50
                    ${u.is_active
                      ? 'bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600'
                      : 'bg-red-100 text-red-600 hover:bg-green-50 hover:text-green-600'}`}
                  title={u.is_active ? 'Cliquer pour désactiver' : 'Cliquer pour activer'}
                >
                  {u.is_active ? 'Actif' : 'Inactif'}
                </button>
                {/* Changer rôle */}
                <select
                  value={u.role}
                  onChange={e => {
                    if (window.confirm(`Changer ${u.full_name} → ${ROLE_LABELS[e.target.value] || e.target.value} ?`)) {
                      updateMutation.mutate({ id: u.id, role: e.target.value })
                    }
                  }}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400 bg-white"
                >
                  <option value="buyer">Acheteur</option>
                  <option value="seller">Vendeur</option>
                  <option value="livreur">Livreur</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Onglet : Configuration livraison ──────────────────────────────────────────

const COMMUNES_GN = ['Kaloum','Dixinn','Matam','Ratoma','Matoto','Coyah','Dubréka']

// Matrice de proximité entre communes (1=proche, 2=moyen, 3=loin)
// Géographie : Kaloum(pointe) → Dixinn → Matam → Ratoma → Matoto → puis Dubréka(nord ~45km) / Coyah(est ~55km)
const COMMUNE_TIERS = {
  'Kaloum':  { 'Dixinn':1,  'Matam':1,  'Ratoma':2, 'Matoto':2, 'Coyah':3, 'Dubréka':3 },
  'Dixinn':  { 'Kaloum':1,  'Matam':1,  'Ratoma':2, 'Matoto':2, 'Coyah':3, 'Dubréka':3 },
  'Matam':   { 'Kaloum':1,  'Dixinn':1, 'Ratoma':1, 'Matoto':2, 'Coyah':3, 'Dubréka':3 },
  'Ratoma':  { 'Kaloum':2,  'Dixinn':2, 'Matam':1,  'Matoto':1, 'Coyah':2, 'Dubréka':2 },
  'Matoto':  { 'Kaloum':2,  'Dixinn':2, 'Matam':2,  'Ratoma':1, 'Coyah':2, 'Dubréka':2 },
  'Coyah':   { 'Kaloum':3,  'Dixinn':3, 'Matam':3,  'Ratoma':2, 'Matoto':2, 'Dubréka':3 },
  'Dubréka': { 'Kaloum':3,  'Dixinn':3, 'Matam':3,  'Ratoma':2, 'Matoto':2, 'Coyah':3  },
}

function TabDeliveryConfig() {
  const qc = useQueryClient()

  // ── Zones de livraison ────────────────────────────────────────────────────
  const ZONE_EMPTY = { city:'', fee_gnf:'', estimated_days:1, free_km_radius:0, price_per_km_gnf:0, free_weight_kg:0, price_per_kg_gnf:0 }
  const [zoneForm, setZoneForm]     = useState(ZONE_EMPTY)
  const [zoneEditId, setZoneEditId] = useState(null)
  const [showZoneForm, setShowZoneForm] = useState(false)

  const { data: zonesRaw = [] } = useQuery({
    queryKey: ['admin-delivery-zones'],
    queryFn:  () => adminAPI.getDeliveryZones().then(r => r.data?.results ?? r.data ?? []),
  })
  const zones = Array.isArray(zonesRaw) ? zonesRaw : []

  const saveZone = useMutation({
    mutationFn: (d) => zoneEditId ? adminAPI.updateDeliveryZone(zoneEditId, d) : adminAPI.createDeliveryZone(d),
    onSuccess: () => { qc.invalidateQueries(['admin-delivery-zones']); setZoneForm(ZONE_EMPTY); setZoneEditId(null); setShowZoneForm(false) },
  })
  const deleteZone = useMutation({
    mutationFn: (id) => adminAPI.deleteDeliveryZone(id),
    onSuccess: () => qc.invalidateQueries(['admin-delivery-zones']),
  })
  const toggleZone = useMutation({
    mutationFn: ({ id, is_active }) => adminAPI.updateDeliveryZone(id, { is_active }),
    onSuccess: () => qc.invalidateQueries(['admin-delivery-zones']),
  })

  const startEditZone = (z) => {
    setZoneForm({ city: z.city, fee_gnf: z.fee_gnf, estimated_days: z.estimated_days, free_km_radius: z.free_km_radius, price_per_km_gnf: z.price_per_km_gnf, free_weight_kg: z.free_weight_kg, price_per_kg_gnf: z.price_per_kg_gnf })
    setZoneEditId(z.id); setShowZoneForm(true)
  }

  // ── Tarifs inter-communes ─────────────────────────────────────────────────
  const RATE_EMPTY = { city:'Conakry', from_commune:'', to_commune:'', fee_gnf:'', estimated_hours:2 }
  const [rateForm, setRateForm]     = useState(RATE_EMPTY)
  const [rateEditId, setRateEditId] = useState(null)
  const [showRateForm, setShowRateForm] = useState(false)

  // Génération en masse
  const [bulkCity, setBulkCity]         = useState('Conakry')
  const [bulkPrice1, setBulkPrice1]     = useState('')   // proche
  const [bulkPrice2, setBulkPrice2]     = useState('')   // moyen
  const [bulkPrice3, setBulkPrice3]     = useState('')   // loin
  const [bulkHours, setBulkHours]       = useState(2)
  const [bulkLoading, setBulkLoading]   = useState(false)
  const [bulkResult, setBulkResult]     = useState(null)   // { created, skipped }
  const [showBulk, setShowBulk]         = useState(false)

  const { data: ratesRaw = [] } = useQuery({
    queryKey: ['admin-zone-rates'],
    queryFn:  () => adminAPI.getZoneRates().then(r => r.data?.results ?? r.data ?? []),
  })
  const rates = Array.isArray(ratesRaw) ? ratesRaw : []

  const handleBulkGenerate = async (e) => {
    e.preventDefault()
    setBulkLoading(true); setBulkResult(null)
    const tierPrices = { 1: +bulkPrice1, 2: +bulkPrice2, 3: +bulkPrice3 }
    const pairs = []
    for (const from of COMMUNES_GN)
      for (const to of COMMUNES_GN)
        if (from !== to) {
          const tier = (COMMUNE_TIERS[from] && COMMUNE_TIERS[from][to]) || 2
          pairs.push({ city: bulkCity, from_commune: from, to_commune: to, fee_gnf: tierPrices[tier] || tierPrices[2], estimated_hours: +bulkHours })
        }

    const existing = rates.filter(r => r.city.toLowerCase() === bulkCity.toLowerCase())
    const toCreate = pairs.filter(p => !existing.some(e => e.from_commune === p.from_commune && e.to_commune === p.to_commune))
    let created = 0
    for (const p of toCreate) {
      try { await adminAPI.createZoneRate(p); created++ } catch {}
    }
    qc.invalidateQueries(['admin-zone-rates'])
    setBulkResult({ created, skipped: pairs.length - toCreate.length })
    setBulkLoading(false)
  }

  const saveRate = useMutation({
    mutationFn: (d) => rateEditId ? adminAPI.updateZoneRate(rateEditId, d) : adminAPI.createZoneRate(d),
    onSuccess: () => { qc.invalidateQueries(['admin-zone-rates']); setRateForm(RATE_EMPTY); setRateEditId(null); setShowRateForm(false) },
  })
  const deleteRate = useMutation({
    mutationFn: (id) => adminAPI.deleteZoneRate(id),
    onSuccess: () => qc.invalidateQueries(['admin-zone-rates']),
  })

  const startEditRate = (r) => {
    setRateForm({ city: r.city, from_commune: r.from_commune, to_commune: r.to_commune, fee_gnf: r.fee_gnf, estimated_hours: r.estimated_hours })
    setRateEditId(r.id); setShowRateForm(true)
  }

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
  const lbl = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="space-y-8">

      {/* ── Section : Zones de livraison ── */}
      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">🌍 Zones de livraison</h2>
            <p className="text-xs text-gray-400 mt-0.5">Tarifs de base par ville (distance + poids en option)</p>
          </div>
          <button onClick={() => { setZoneEditId(null); setZoneForm(ZONE_EMPTY); setShowZoneForm(s => !s) }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
            {showZoneForm && !zoneEditId ? 'Annuler' : '+ Ajouter'}
          </button>
        </div>

        {showZoneForm && (
          <form onSubmit={e => { e.preventDefault(); saveZone.mutate({ ...zoneForm, fee_gnf: +zoneForm.fee_gnf, estimated_days: +zoneForm.estimated_days, free_km_radius: +zoneForm.free_km_radius, price_per_km_gnf: +zoneForm.price_per_km_gnf, free_weight_kg: +zoneForm.free_weight_kg, price_per_kg_gnf: +zoneForm.price_per_kg_gnf }) }}
            className="bg-gray-50 rounded-xl p-4 mb-5 space-y-3 border border-gray-200">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Ville</label><input className={inp} value={zoneForm.city} onChange={e => setZoneForm({...zoneForm, city: e.target.value})} placeholder="Ex: Conakry" required /></div>
              <div><label className={lbl}>Tarif de base (GNF)</label><input type="number" className={inp} value={zoneForm.fee_gnf} onChange={e => setZoneForm({...zoneForm, fee_gnf: e.target.value})} placeholder="50000" required /></div>
              <div><label className={lbl}>Délai estimé (jours)</label><input type="number" min="1" className={inp} value={zoneForm.estimated_days} onChange={e => setZoneForm({...zoneForm, estimated_days: e.target.value})} /></div>
              <div><label className={lbl}>Km gratuits inclus</label><input type="number" min="0" className={inp} value={zoneForm.free_km_radius} onChange={e => setZoneForm({...zoneForm, free_km_radius: e.target.value})} /></div>
              <div><label className={lbl}>Prix / km sup. (GNF)</label><input type="number" min="0" className={inp} value={zoneForm.price_per_km_gnf} onChange={e => setZoneForm({...zoneForm, price_per_km_gnf: e.target.value})} /></div>
              <div><label className={lbl}>Poids gratuit (kg)</label><input type="number" min="0" step="0.1" className={inp} value={zoneForm.free_weight_kg} onChange={e => setZoneForm({...zoneForm, free_weight_kg: e.target.value})} /></div>
              <div><label className={lbl}>Prix / kg sup. (GNF)</label><input type="number" min="0" className={inp} value={zoneForm.price_per_kg_gnf} onChange={e => setZoneForm({...zoneForm, price_per_kg_gnf: e.target.value})} /></div>
            </div>
            <button type="submit" disabled={saveZone.isPending} className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50">
              {saveZone.isPending ? 'Enregistrement…' : zoneEditId ? 'Modifier' : 'Créer'}
            </button>
          </form>
        )}

        <div className="space-y-3">
          {zones.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucune zone configurée.</p>}
          {zones.map(z => (
            <div key={z.id} className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${z.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-gray-800">{z.city}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${z.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{z.is_active ? 'Actif' : 'Inactif'}</span>
                </div>
                <p className="text-sm text-gray-600 mt-0.5">Base : {fmt(z.fee_gnf)} · {z.estimated_days}j</p>
                {(z.price_per_km_gnf > 0 || z.price_per_kg_gnf > 0) && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {z.price_per_km_gnf > 0 && `+${fmt(z.price_per_km_gnf)}/km (après ${z.free_km_radius}km)`}
                    {z.price_per_km_gnf > 0 && z.price_per_kg_gnf > 0 && ' · '}
                    {z.price_per_kg_gnf > 0 && `+${fmt(z.price_per_kg_gnf)}/kg (après ${z.free_weight_kg}kg)`}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => toggleZone.mutate({ id: z.id, is_active: !z.is_active })}
                  className={`text-xs px-3 py-1.5 rounded-lg transition border font-medium ${z.is_active ? 'border-gray-300 text-gray-600 hover:bg-gray-50' : 'border-green-300 text-green-700 hover:bg-green-50'}`}>
                  {z.is_active ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={() => startEditZone(z)} className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition">✏️</button>
                <button onClick={() => window.confirm('Supprimer cette zone ?') && deleteZone.mutate(z.id)} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section : Tarifs inter-communes ── */}
      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">🗺️ Tarifs inter-communes</h2>
            <p className="text-xs text-gray-400 mt-0.5">Tarifs fixes entre communes (prioritaires sur la distance)</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowBulk(s => !s); setShowRateForm(false) }}
              className="border border-blue-300 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl text-sm font-medium transition">
              ⚡ Générer
            </button>
            <button onClick={() => { setRateEditId(null); setRateForm(RATE_EMPTY); setShowRateForm(s => !s); setShowBulk(false) }}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
              {showRateForm && !rateEditId ? 'Annuler' : '+ Ajouter'}
            </button>
          </div>
        </div>

        {/* Génération en masse */}
        {showBulk && (
          <form onSubmit={handleBulkGenerate} className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 space-y-3">
            <p className="text-sm font-semibold text-blue-800">⚡ Générer toutes les combinaisons inter-communes</p>
            <p className="text-xs text-blue-600">
              Les prix varient selon la distance. Les paires déjà existantes sont ignorées.
            </p>

            {/* Explication des tiers */}
            <div className="grid grid-cols-3 gap-2 text-xs text-blue-700 bg-white rounded-lg p-3 border border-blue-100">
              <div><span className="font-semibold">🟢 Proche</span><br/>ex: Kaloum↔Dixinn, Matam↔Ratoma</div>
              <div><span className="font-semibold">🟡 Moyen</span><br/>ex: Kaloum↔Ratoma, Ratoma↔Coyah</div>
              <div><span className="font-semibold">🔴 Loin</span><br/>ex: Kaloum↔Coyah, Dixinn↔Dubréka</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Ville</label>
                <input className={inp} value={bulkCity} onChange={e => setBulkCity(e.target.value)} placeholder="Conakry" required />
              </div>
              <div>
                <label className={lbl}>Délai estimé (h)</label>
                <input type="number" min="1" className={inp} value={bulkHours} onChange={e => setBulkHours(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>🟢 Prix Proche (GNF)</label>
                <input type="number" className={inp} value={bulkPrice1} onChange={e => setBulkPrice1(e.target.value)} placeholder="ex: 30 000" required />
              </div>
              <div>
                <label className={lbl}>🟡 Prix Moyen (GNF)</label>
                <input type="number" className={inp} value={bulkPrice2} onChange={e => setBulkPrice2(e.target.value)} placeholder="ex: 50 000" required />
              </div>
              <div>
                <label className={lbl}>🔴 Prix Loin (GNF)</label>
                <input type="number" className={inp} value={bulkPrice3} onChange={e => setBulkPrice3(e.target.value)} placeholder="ex: 100 000" required />
              </div>
            </div>

            {bulkResult && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                ✅ {bulkResult.created} tarif(s) créé(s) · {bulkResult.skipped} déjà existant(s) ignoré(s)
              </p>
            )}
            <button type="submit" disabled={bulkLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
              {bulkLoading ? 'Génération…' : `Générer les ${COMMUNES_GN.length * (COMMUNES_GN.length - 1)} combinaisons`}
            </button>
          </form>
        )}

        {showRateForm && (
          <form onSubmit={e => { e.preventDefault(); saveRate.mutate({ ...rateForm, fee_gnf: +rateForm.fee_gnf, estimated_hours: +rateForm.estimated_hours }) }}
            className="bg-gray-50 rounded-xl p-4 mb-5 space-y-3 border border-gray-200">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Ville</label><input className={inp} value={rateForm.city} onChange={e => setRateForm({...rateForm, city: e.target.value})} placeholder="Conakry" required /></div>
              <div><label className={lbl}>Tarif (GNF)</label><input type="number" className={inp} value={rateForm.fee_gnf} onChange={e => setRateForm({...rateForm, fee_gnf: e.target.value})} required /></div>
              <div>
                <label className={lbl}>Commune vendeur</label>
                <select className={inp} value={rateForm.from_commune} onChange={e => setRateForm({...rateForm, from_commune: e.target.value})} required>
                  <option value="">— Choisir —</option>
                  {COMMUNES_GN.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Commune acheteur</label>
                <select className={inp} value={rateForm.to_commune} onChange={e => setRateForm({...rateForm, to_commune: e.target.value})} required>
                  <option value="">— Choisir —</option>
                  {COMMUNES_GN.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Délai estimé (h)</label><input type="number" min="1" className={inp} value={rateForm.estimated_hours} onChange={e => setRateForm({...rateForm, estimated_hours: e.target.value})} /></div>
            </div>
            <button type="submit" disabled={saveRate.isPending} className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50">
              {saveRate.isPending ? 'Enregistrement…' : rateEditId ? 'Modifier' : 'Créer'}
            </button>
          </form>
        )}

        {/* Grille groupée par ville */}
        {rates.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucun tarif inter-commune configuré.</p>}
        {Object.entries(rates.reduce((acc, r) => { if (!acc[r.city]) acc[r.city] = []; acc[r.city].push(r); return acc }, {})).map(([city, cityRates]) => (
          <div key={city} className="mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{city}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead><tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-3 py-2 text-left">Vendeur</th>
                  <th className="px-3 py-2 text-left">Acheteur</th>
                  <th className="px-3 py-2 text-right">Tarif</th>
                  <th className="px-3 py-2 text-right">Délai</th>
                  <th className="px-3 py-2"></th>
                </tr></thead>
                <tbody>
                  {cityRates.map(r => (
                    <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-700">{r.from_commune}</td>
                      <td className="px-3 py-2 text-gray-600">{r.to_commune}</td>
                      <td className="px-3 py-2 text-right font-bold text-green-700">{fmt(r.fee_gnf)}</td>
                      <td className="px-3 py-2 text-right text-gray-400 text-xs">~{r.estimated_hours}h</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => startEditRate(r)} className="text-xs text-blue-600 hover:underline mr-2">Modifier</button>
                        <button onClick={() => window.confirm('Supprimer ce tarif ?') && deleteRate.mutate(r.id)} className="text-xs text-red-500 hover:underline">Suppr.</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


// ── Onglet : Gestion des retours ───────────────────────────────────────────────

const RETURN_STATUS = {
  pending:   { label: 'En attente',      color: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
  approved:  { label: 'Approuvé',        color: 'bg-blue-100 text-blue-700',     icon: '✅' },
  rejected:  { label: 'Refusé',          color: 'bg-red-100 text-red-600',       icon: '❌' },
  completed: { label: 'Retour effectué', color: 'bg-green-100 text-green-700',   icon: '📦' },
}
const RETURN_REASONS = {
  defective:        'Article défectueux',
  not_as_described: 'Ne correspond pas à la description',
  wrong_item:       'Mauvais article reçu',
  changed_mind:     "Changement d'avis",
  other:            'Autre',
}

function TabReturns() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]             = useState('')
  const [noteModal, setNoteModal]       = useState(null) // { id, currentNote }
  const [noteText, setNoteText]         = useState('')

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-returns', statusFilter, search],
    queryFn:  () => adminAPI.getReturns({ status: statusFilter || undefined, search: search || undefined }).then(r => r.data),
  })
  const returns = Array.isArray(data) ? data : (data?.results ?? [])

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }) => adminAPI.updateReturn(id, payload),
    onSuccess: () => {
      qc.invalidateQueries(['admin-returns'])
      setNoteModal(null)
      setNoteText('')
    },
  })

  const setStatus = (id, newStatus) => {
    const note = noteModal?.id === id ? noteText : ''
    updateMutation.mutate({ id, status: newStatus, ...(note ? { admin_note: note } : {}) })
  }

  const pending = returns.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">↩️ Demandes de retour</h2>
          {pending > 0 && <p className="text-xs text-amber-600 font-medium mt-0.5">{pending} en attente de traitement</p>}
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl shadow p-4 flex flex-wrap gap-3">
        <input
          type="text" placeholder="🔍 Rechercher article, acheteur…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <div className="flex gap-2 flex-wrap">
          {['', 'pending', 'approved', 'rejected', 'completed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-xl border transition font-medium ${statusFilter === s ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s === '' ? 'Tous' : RETURN_STATUS[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {isLoading && <p className="text-center text-gray-400 py-8">Chargement…</p>}
      {!isLoading && returns.length === 0 && <p className="text-center text-gray-400 py-8">Aucune demande trouvée.</p>}

      <div className="space-y-4">
        {returns.map(r => {
          const s = RETURN_STATUS[r.status] || RETURN_STATUS.pending
          return (
            <div key={r.id} className="bg-white rounded-2xl shadow p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${s.color}`}>{s.icon} {s.label}</span>
                    <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <p className="font-semibold text-gray-800 truncate">{r.listing_title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Acheteur : <span className="font-medium text-gray-700">{r.buyer_name}</span>
                    <span className="mx-1">·</span>
                    Vendeur : <span className="font-medium text-gray-700">{r.seller_name}</span>
                    <span className="mx-1">·</span>
                    {fmt(r.amount_gnf)}
                  </p>
                  <div className="mt-2 bg-gray-50 rounded-xl p-3">
                    <p className="text-xs font-medium text-gray-600 mb-0.5">Raison : {RETURN_REASONS[r.reason] || r.reason}</p>
                    {r.description && <p className="text-xs text-gray-500 italic">« {r.description} »</p>}
                  </div>
                  {r.admin_note && (
                    <p className="text-xs text-blue-600 mt-2 bg-blue-50 rounded-lg px-3 py-1.5">📝 Note admin : {r.admin_note}</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              {r.status === 'pending' && (
                <div className="mt-4 space-y-2">
                  {noteModal?.id === r.id ? (
                    <div className="space-y-2">
                      <textarea rows={2} placeholder="Note admin (optionnel)…"
                        value={noteText} onChange={e => setNoteText(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setStatus(r.id, 'approved')} disabled={updateMutation.isPending}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 rounded-xl transition disabled:opacity-50">
                          ✅ Approuver
                        </button>
                        <button onClick={() => setStatus(r.id, 'rejected')} disabled={updateMutation.isPending}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2 rounded-xl transition disabled:opacity-50">
                          ❌ Refuser
                        </button>
                        <button onClick={() => { setNoteModal(null); setNoteText('') }}
                          className="px-4 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50 transition">
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setNoteModal({ id: r.id }); setNoteText('') }}
                      className="w-full border-2 border-dashed border-green-300 text-green-700 text-sm font-medium py-2.5 rounded-xl hover:bg-green-50 transition">
                      Traiter cette demande →
                    </button>
                  )}
                </div>
              )}

              {r.status === 'approved' && (
                <div className="mt-3">
                  <button onClick={() => updateMutation.mutate({ id: r.id, status: 'completed' })} disabled={updateMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50">
                    📦 Marquer comme retour effectué
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── Page principale ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',         label: '📊 Dashboard' },
  { id: 'deliveries',       label: '🚚 Livraisons' },
  { id: 'orders',           label: '📋 Commandes' },
  { id: 'returns',          label: '↩️ Retours' },
  { id: 'users',            label: '👥 Utilisateurs' },
  { id: 'listings',         label: '📦 Annonces' },
  { id: 'shops',            label: '🏪 Boutiques' },
  { id: 'banners',          label: '📢 Publicités' },
  { id: 'categories',       label: '🏷️ Catégories' },
  { id: 'pickup-points',    label: '📍 Points retrait' },
  { id: 'meeting-zones',    label: '🤝 Zones rencontre' },
  { id: 'delivery-config',  label: '🌍 Config livraison' },
  { id: 'settings',         label: '⚙️ Paramètres' },
]

export default function AdminPage() {
  const user            = useAuthStore(s => s.user)
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const fetchMe         = useAuthStore(s => s.fetchMe)
  const qc              = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')

  // Charger l'user si token présent mais user pas encore en mémoire
  useEffect(() => {
    if (isAuthenticated && !user) fetchMe()
  }, [])

  // Tous les hooks AVANT les returns conditionnels
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn:  () => adminAPI.getStats().then(r => r.data),
    enabled:  !!user && user.role === 'admin',
  })

  const { data: disputesData, isLoading: disputesLoading } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn:  () => adminAPI.getDisputes().then(r => r.data),
    enabled:  !!user && user.role === 'admin',
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
    enabled:       !!user && user.role === 'admin',
    refetchInterval: 60000,
  })
  const pendingShopsCount = pendingShopsData ?? 0

  const { data: pendingReturnsData } = useQuery({
    queryKey: ['admin-returns-pending-count'],
    queryFn:  () => adminAPI.getReturns({ status: 'pending' }).then(r => {
      const d = r.data; return Array.isArray(d) ? d.length : (d?.results?.length ?? 0)
    }),
    enabled:       !!user && user.role === 'admin',
    refetchInterval: 60000,
  })
  const pendingReturnsCount = pendingReturnsData ?? 0

  // Returns conditionnels APRÈS tous les hooks
  if (!isAuthenticated) return <Navigate to="/login" />
  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-green-600">Chargement...</div>
    </div>
  )
  if (user.role !== 'admin') return <Navigate to="/" />

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-green-700 font-bold text-lg">Guimatrix</Link>
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
              {tab.id === 'deliveries' && stats && ((stats.deliveries_assigned || 0) + (stats.deliveries_en_route || 0)) > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 align-middle">{(stats.deliveries_assigned || 0) + (stats.deliveries_en_route || 0)}</span>
              )}
              {tab.id === 'shops' && pendingShopsCount > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 align-middle">{pendingShopsCount}</span>
              )}
              {tab.id === 'returns' && pendingReturnsCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 align-middle">{pendingReturnsCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Contenu */}
        {activeTab === 'overview'      && <TabOverview stats={stats} disputes={disputes} isLoading={disputesLoading} resolveMutation={resolveMutation} />}
        {activeTab === 'deliveries'    && <TabDeliveries />}
        {activeTab === 'orders'        && <TabOrders />}
        {activeTab === 'users'         && <TabUsers />}
        {activeTab === 'listings'      && <TabListings />}
        {activeTab === 'banners'       && <TabBanners />}
        {activeTab === 'categories'    && <TabCategories />}
        {activeTab === 'shops'         && <TabShops />}
        {activeTab === 'pickup-points'   && <TabPickupPoints />}
        {activeTab === 'meeting-zones'   && <TabMeetingZones />}
        {activeTab === 'delivery-config' && <TabDeliveryConfig />}
        {activeTab === 'returns'         && <TabReturns />}
        {activeTab === 'settings'        && <TabSettings />}
      </div>
    </div>
  )
}
