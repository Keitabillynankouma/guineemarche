import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { shopsAPI, listingsAPI } from '../services/api'
import useAuthStore from '../store/authStore'

// ── Composant carte pour choisir l'adresse de collecte ───────────────────────
function PickupMapEditor({ lat, lng, onChange }) {
  const mapRef    = useRef(null)
  const lMapRef   = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current || lMapRef.current) return
      const L = window.L
      const center = (lat && lng) ? [parseFloat(lat), parseFloat(lng)] : [9.5370, -13.6773]
      lMapRef.current = L.map(mapRef.current, { zoomControl: true }).setView(center, 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 18,
      }).addTo(lMapRef.current)

      const pinIcon = L.divIcon({
        html: '<div style="background:#16a34a;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,.35);border:2px solid white">🏠</div>',
        className: '', iconSize: [32, 32], iconAnchor: [16, 16],
      })

      if (lat && lng) {
        markerRef.current = L.marker([parseFloat(lat), parseFloat(lng)], { icon: pinIcon, draggable: true })
          .addTo(lMapRef.current)
          .on('dragend', e => {
            const p = e.target.getLatLng()
            onChange(p.lat, p.lng)
          })
      }

      lMapRef.current.on('click', e => {
        const { lat: la, lng: lo } = e.latlng
        if (markerRef.current) markerRef.current.remove()
        markerRef.current = L.marker([la, lo], { icon: pinIcon, draggable: true })
          .addTo(lMapRef.current)
          .on('dragend', ev => {
            const p = ev.target.getLatLng()
            onChange(p.lat, p.lng)
          })
        onChange(la, lo)
      })
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    if (!window.L) {
      const s = document.createElement('script')
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      s.onload = initMap
      document.head.appendChild(s)
    } else {
      setTimeout(initMap, 0)
    }
    return () => { if (lMapRef.current) { lMapRef.current.remove(); lMapRef.current = null } }
  }, [])

  return (
    <div>
      <div ref={mapRef} style={{ height: 220, borderRadius: 12, zIndex: 1, border: '1px solid #bbf7d0' }} />
      <p className="text-xs text-green-700 mt-1">
        🖱️ Appuie sur la carte pour placer le pin 🏠 — tu peux le glisser pour préciser la position
      </p>
    </div>
  )
}

function fmt(price, type) {
  if (type === 'free') return 'Gratuit'
  return new Intl.NumberFormat('fr-GN').format(price) + ' GNF'
}

const STATUS_CONFIG = {
  pending:  { color: 'bg-amber-50 border-amber-300 text-amber-800',  icon: '⏳', label: 'En attente de validation',  desc: "Votre boutique est en cours d'examen par notre équipe. Vous recevrez une notification sous 24-48h." },
  approved: { color: 'bg-green-50 border-green-300 text-green-800',  icon: '✅', label: 'Boutique approuvée',         desc: 'Votre boutique est visible par tous les acheteurs.' },
  rejected: { color: 'bg-red-50 border-red-300 text-red-800',        icon: '❌', label: 'Boutique non approuvée',     desc: 'Corrigez les informations ci-dessous et soumettez à nouveau.' },
}

export default function MyShopPage() {
  const { user } = useAuthStore()
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const fileRef   = useRef()

  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState({})
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)

  const { data: shop, isLoading } = useQuery({
    queryKey: ['my-shop'],
    queryFn:  () => shopsAPI.myShop().then(r => r.data),
  })

  const { data: listingsData } = useQuery({
    queryKey: ['my-listings'],
    queryFn:  () => listingsAPI.myListings().then(r => r.data),
    enabled:  !!shop,
  })
  const listings = Array.isArray(listingsData) ? listingsData : (listingsData?.results ?? [])
  const activeListings = listings.filter(l => l.status === 'active')

  const saveMutation = useMutation({
    mutationFn: (data) => shopsAPI.saveShop(data),
    onSuccess:  (res) => {
      qc.setQueryData(['my-shop'], res.data)
      qc.invalidateQueries(['me'])
      setEditing(false)
      setLogoFile(null)
      setLogoPreview(null)
    },
  })

  const handleEdit = () => {
    setForm({
      name:             shop?.name             ?? '',
      description:      shop?.description      ?? '',
      phone:            shop?.phone            ?? '',
      whatsapp:         shop?.whatsapp         ?? '',
      address:          shop?.address          ?? '',
      city:             shop?.city             ?? 'Conakry',
      website:          shop?.website          ?? '',
      pickup_address:   shop?.pickup_address   ?? '',
      pickup_latitude:  shop?.pickup_latitude  ?? null,
      pickup_longitude: shop?.pickup_longitude ?? null,
    })
    setEditing(true)
  }

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleSave = () => {
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => v !== undefined && fd.append(k, v))
    if (logoFile) fd.append('logo', logoFile)
    saveMutation.mutate(fd)
  }

  if (!user) return null

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-green-600 animate-pulse">Chargement...</div>
    </div>
  )

  const status = shop?.status
  const cfg    = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/profile')} className="text-green-700 text-lg">←</button>
          <span className="font-bold text-gray-800">Ma Boutique</span>
          {shop && (
            <Link to={`/shops/${shop.id}`}
              className="ml-auto text-xs text-green-600 border border-green-200 px-3 py-1 rounded-full hover:bg-green-50 transition">
              Voir la page publique →
            </Link>
          )}
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Bandeau statut */}
        {shop && (
          <div className={`rounded-2xl border p-4 ${cfg.color}`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">{cfg.icon}</span>
              <div>
                <p className="font-bold">{cfg.label}</p>
                <p className="text-sm mt-0.5 opacity-80">{cfg.desc}</p>
                {status === 'rejected' && shop.reject_reason && (
                  <p className="text-sm mt-2 font-medium">Raison : {shop.reject_reason}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Alerte : adresse de collecte non renseignée */}
        {shop && !shop.pickup_address && !editing && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">📍</span>
            <div className="flex-1">
              <p className="font-semibold text-amber-800">Adresse de collecte manquante</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Notre livreur ne sait pas où venir récupérer vos articles. Ajoutez votre adresse de collecte pour recevoir des commandes.
              </p>
              <button
                onClick={handleEdit}
                className="mt-3 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
              >
                📝 Renseigner maintenant
              </button>
            </div>
          </div>
        )}

        {/* Alerte : adresse texte OK mais pas de GPS */}
        {shop && shop.pickup_address && !shop.pickup_latitude && !editing && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center gap-3">
            <span className="text-xl">🗺️</span>
            <div className="flex-1">
              <p className="text-sm text-blue-800 font-medium">Précisez votre position sur la carte</p>
              <p className="text-xs text-blue-600 mt-0.5">Le pin GPS permet à notre livreur de vous trouver plus facilement.</p>
            </div>
            <button onClick={handleEdit} className="text-xs text-blue-700 border border-blue-300 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition font-medium">
              Ajouter →
            </button>
          </div>
        )}

        {/* Pas encore de boutique */}
        {!shop && (
          <div className="bg-white rounded-2xl shadow p-8 text-center space-y-4">
            <p className="text-5xl">🏪</p>
            <h2 className="text-lg font-bold text-gray-800">Créez votre boutique</h2>
            <p className="text-sm text-gray-500">Donnez une identité professionnelle à vos annonces. Les clients pourront voir toutes vos offres en un seul endroit.</p>
            <button onClick={() => setEditing(true)}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl transition text-sm">
              Créer ma boutique
            </button>
          </div>
        )}

        {/* Formulaire création / édition */}
        {(editing || !shop) && (
          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <h3 className="font-bold text-gray-800">{shop ? 'Modifier la boutique' : 'Informations de la boutique'}</h3>

            {/* Logo */}
            <div className="flex items-center gap-4">
              <div
                onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center cursor-pointer hover:border-green-400 transition flex-shrink-0"
              >
                {(logoPreview || shop?.logo_url)
                  ? <img src={logoPreview || shop.logo_url} alt="logo" className="w-full h-full object-cover" />
                  : <span className="text-3xl">📷</span>
                }
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Logo de la boutique</p>
                <p className="text-xs text-gray-400 mt-0.5">JPG ou PNG, carré recommandé</p>
                <button onClick={() => fileRef.current?.click()} className="text-xs text-green-600 mt-1 hover:underline">
                  Changer le logo
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>

            <div className="space-y-3">
              {[
                { key: 'name',        label: 'Nom de la boutique *',   placeholder: 'Ex: Electro Conakry' },
                { key: 'description', label: 'Description',            placeholder: 'Décrivez votre boutique...', multiline: true },
                { key: 'phone',       label: 'Téléphone',              placeholder: '+224 6XX XXX XXX' },
                { key: 'whatsapp',    label: 'WhatsApp',               placeholder: '+224 6XX XXX XXX' },
                { key: 'address',     label: 'Adresse de la boutique', placeholder: 'Ex: Kaloum, face à la cathédrale' },
                { key: 'city',        label: 'Ville',                  placeholder: 'Conakry' },
                { key: 'website',     label: 'Site web (facultatif)',  placeholder: 'https://...' },
              ].map(({ key, label, placeholder, multiline }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  {multiline
                    ? <textarea rows={3} value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
                    : <input value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                  }
                </div>
              ))}

              {/* ── Adresse de collecte avec carte ───────────────────────── */}
              <div className="border border-green-200 bg-green-50 rounded-2xl p-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-green-800 mb-1">
                    📍 Adresse de collecte des colis <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-green-700 mb-2">
                    Là où notre livreur viendra récupérer vos articles. Tapez l'adresse <strong>et</strong> placez le pin sur la carte.
                  </p>
                  <input
                    value={form.pickup_address ?? ''}
                    onChange={e => setForm(f => ({ ...f, pickup_address: e.target.value }))}
                    placeholder="Ex: Ratoma, derrière l'école centrale, maison rouge"
                    className="w-full border border-green-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <PickupMapEditor
                  lat={form.pickup_latitude}
                  lng={form.pickup_longitude}
                  onChange={(lat, lng) => setForm(f => ({ ...f, pickup_latitude: lat, pickup_longitude: lng }))}
                />
                {form.pickup_latitude && form.pickup_longitude && (
                  <p className="text-xs text-green-700 font-medium">
                    ✅ Position enregistrée : {Number(form.pickup_latitude).toFixed(5)}, {Number(form.pickup_longitude).toFixed(5)}
                  </p>
                )}
              </div>
            </div>

            {saveMutation.isError && (
              <p className="text-sm text-red-500">Erreur : {saveMutation.error?.response?.data?.name?.[0] || 'Veuillez vérifier les informations.'}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl text-sm transition disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Enregistrement...' : (shop ? 'Mettre à jour' : 'Soumettre la boutique')}
              </button>
              {shop && (
                <button onClick={() => setEditing(false)} className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm transition">
                  Annuler
                </button>
              )}
            </div>

            {!shop && (
              <p className="text-xs text-gray-400 text-center">
                Votre boutique sera vérifiée par notre équipe avant d'être publiée (24-48h).
              </p>
            )}
          </div>
        )}

        {/* Aperçu boutique existante (mode lecture) */}
        {shop && !editing && (
          <div className="bg-white rounded-2xl shadow p-5">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {shop.logo_url
                  ? <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
                  : <span className="text-3xl">🏪</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold text-gray-800">{shop.name}</h2>
                  <button onClick={handleEdit}
                    className="text-xs text-green-600 border border-green-200 px-3 py-1 rounded-full hover:bg-green-50 transition">
                    ✏️ Modifier
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">📍 {shop.city}{shop.address && ` · ${shop.address}`}</p>
                {shop.pickup_address && (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-2 py-1 mt-1">
                    📦 Collecte : {shop.pickup_address}
                  </p>
                )}
                {!shop.pickup_address && (
                  <p className="text-xs text-gray-400 mt-1 italic">⚠️ Adresse de collecte non renseignée — le livreur ne saura pas où récupérer vos colis.</p>
                )}
                {shop.phone    && <p className="text-sm text-gray-500">📞 {shop.phone}</p>}
                {shop.whatsapp && <p className="text-sm text-gray-500">💬 {shop.whatsapp}</p>}
                {shop.description && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{shop.description}</p>}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t text-center text-sm">
              <div>
                <p className="font-bold text-gray-800 text-lg">{activeListings.length}</p>
                <p className="text-gray-400 text-xs">Annonces actives</p>
              </div>
              <div>
                <p className="font-bold text-gray-800 text-lg">{shop.plan === 'premium' ? '⭐' : '📦'}</p>
                <p className="text-gray-400 text-xs">{shop.plan === 'premium' ? 'Premium' : 'Standard'}</p>
              </div>
              <div>
                <p className="font-bold text-gray-800 text-lg">{shop.is_verified ? '✅' : '⏳'}</p>
                <p className="text-gray-400 text-xs">{shop.is_verified ? 'Vérifiée' : 'En attente'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Annonces actives */}
        {shop && activeListings.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">Mes annonces actives</h3>
              <Link to="/my-listings" className="text-xs text-green-600 hover:underline">Tout voir</Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {activeListings.slice(0, 4).map(l => {
                const cover = l.media?.find(m => m.is_cover) || l.media?.[0]
                return (
                  <Link key={l.id} to={`/listings/${l.id}`}
                    className="bg-white rounded-xl shadow overflow-hidden hover:shadow-md transition group">
                    <div className="h-28 bg-gray-100 overflow-hidden relative">
                      {cover
                        ? <img src={cover.file} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        : <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                      }
                      {l.is_boosted && (
                        <span className="absolute top-1.5 left-1.5 bg-amber-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">⚡ Boosté</span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="font-medium text-xs text-gray-800 truncate">{l.title}</p>
                      <p className="text-green-600 font-bold text-xs mt-0.5">{fmt(l.price_gnf, l.price_type)}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* CTA créer annonce */}
        {shop?.status === 'approved' && (
          <Link to="/create"
            className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 rounded-2xl text-sm transition shadow">
            ➕ Publier une annonce
          </Link>
        )}
      </div>
    </div>
  )
}
