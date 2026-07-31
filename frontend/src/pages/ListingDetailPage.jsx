import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listingsAPI, messagingAPI, ordersAPI, deliveryAPI } from '../services/api'
import { COMMUNES_PAR_VILLE } from '../constants/communes'

// ── Haversine distance (km) ────────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
    const R    = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a    = Math.sin(dLat / 2) ** 2 +
                 Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    return +(R * 2 * Math.asin(Math.sqrt(a))).toFixed(1)
}
import useAuthStore from '../store/authStore'
import { useRecentlyViewed } from '../hooks/useRecentlyViewed'
import Logo from '../components/Logo'
import ListingAssistant from '../components/ListingAssistant'
import SimilarListings from '../components/SimilarListings'

function formatPrice(price, type) {
    if (type === 'free') return 'Gratuit'
    return new Intl.NumberFormat('fr-GN').format(price) + ' GNF'
}

function isNew(dateStr) {
    if (!dateStr) return false
    return (Date.now() - new Date(dateStr).getTime()) < 24 * 60 * 60 * 1000
}

const CONDITION_LABELS = {
    new: 'Neuf', like_new: 'Comme neuf',
    good: 'Bon état', fair: 'État correct', poor: 'Très usé',
}

const BOOST_PLANS = [
  { days: 3,  price: '5 000 GNF',  label: '3 jours',  popular: false },
  { days: 7,  price: '10 000 GNF', label: '7 jours',  popular: true  },
  { days: 14, price: '18 000 GNF', label: '14 jours', popular: false },
  { days: 30, price: '30 000 GNF', label: '30 jours', popular: false },
]
const BOOST_PRICES = Object.fromEntries(BOOST_PLANS.map(p => [p.days, p.price]))


// ── Image Lightbox ─────────────────────────────────────────────────────────────
function ImageLightbox({ images, startIndex, onClose }) {
    const [current, setCurrent] = useState(startIndex)

    const prev = useCallback(() => setCurrent(c => (c - 1 + images.length) % images.length), [images.length])
    const next = useCallback(() => setCurrent(c => (c + 1) % images.length), [images.length])

    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'ArrowLeft')  prev()
            if (e.key === 'ArrowRight') next()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose, prev, next])

    return (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col" onClick={onClose}>
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3" onClick={e => e.stopPropagation()}>
                <span className="text-white/60 text-sm">{current + 1} / {images.length}</span>
                <button onClick={onClose} className="text-white text-3xl leading-none hover:text-gray-300 transition">✕</button>
            </div>

            {/* Image principale */}
            <div className="flex-1 flex items-center justify-center relative px-4" onClick={e => e.stopPropagation()}>
                {images.length > 1 && (
                    <button onClick={prev}
                        className="absolute left-2 md:left-6 bg-white/10 hover:bg-white/25 text-white w-10 h-10 rounded-full flex items-center justify-center text-xl transition z-10">
                        ‹
                    </button>
                )}
                <img
                    src={images[current]?.file}
                    alt=""
                    className="max-h-[70vh] max-w-full object-contain rounded-lg select-none"
                    draggable={false}
                />
                {images.length > 1 && (
                    <button onClick={next}
                        className="absolute right-2 md:right-6 bg-white/10 hover:bg-white/25 text-white w-10 h-10 rounded-full flex items-center justify-center text-xl transition z-10">
                        ›
                    </button>
                )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
                <div className="flex gap-2 justify-center p-4 overflow-x-auto" onClick={e => e.stopPropagation()}>
                    {images.map((img, i) => (
                        <img key={i} src={img.file} alt=""
                            onClick={() => setCurrent(i)}
                            className={`h-14 w-14 object-cover rounded-lg cursor-pointer border-2 transition flex-shrink-0 ${i === current ? 'border-white' : 'border-white/20 opacity-60 hover:opacity-100'}`}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

// ── QR Code Modal ──────────────────────────────────────────────────────────────
function QRModal({ listing, onClose }) {
    const qrRef    = useRef(null)
    const canvasRef = useRef(null)

    useEffect(() => {
        if (!window.QRCode || !qrRef.current) return
        qrRef.current.innerHTML = ''
        new window.QRCode(qrRef.current, {
            text: window.location.href,
            width:  200,
            height: 200,
            colorDark: '#16a34a',
            colorLight: '#ffffff',
        })
    }, [])

    const downloadPoster = () => {
        const canvas = document.createElement('canvas')
        canvas.width  = 600
        canvas.height = 800
        const ctx = canvas.getContext('2d')

        // Fond blanc
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 600, 800)

        // Header vert
        ctx.fillStyle = '#16a34a'
        ctx.fillRect(0, 0, 600, 120)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 36px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Guimatrix', 300, 55)
        ctx.font = '18px sans-serif'
        ctx.fillText('Le marché intelligent de la Guinée', 300, 95)

        // Titre annonce
        ctx.fillStyle = '#1f2937'
        ctx.font = 'bold 26px sans-serif'
        ctx.textAlign = 'center'
        const words  = listing.title.split(' ')
        let line = '', lines = []
        for (const word of words) {
            const test = line + word + ' '
            if (ctx.measureText(test).width > 520 && line) { lines.push(line.trim()); line = word + ' ' }
            else line = test
        }
        lines.push(line.trim())
        lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, 300, 160 + i * 36))

        // Prix
        ctx.fillStyle = '#16a34a'
        ctx.font = 'bold 32px sans-serif'
        const priceText = listing.price_type === 'free' ? 'Gratuit'
            : new Intl.NumberFormat('fr-GN').format(listing.price_gnf) + ' GNF'
        ctx.fillText(priceText, 300, 255)

        // Ville
        ctx.fillStyle = '#6b7280'
        ctx.font = '20px sans-serif'
        ctx.fillText('📍 ' + listing.city, 300, 295)

        // QR Code image
        const qrImg = qrRef.current?.querySelector('img') || qrRef.current?.querySelector('canvas')
        if (qrImg) {
            const src = qrImg.src || qrImg.toDataURL()
            const img = new Image()
            img.onload = () => {
                ctx.drawImage(img, 200, 320, 200, 200)
                ctx.fillStyle = '#374151'
                ctx.font = '16px sans-serif'
                ctx.textAlign = 'center'
                ctx.fillText('Scannez pour voir l\'annonce', 300, 545)
                // URL
                ctx.fillStyle = '#9ca3af'
                ctx.font = '13px sans-serif'
                ctx.fillText(window.location.href.slice(0, 60), 300, 575)
                // Footer
                ctx.fillStyle = '#f3f4f6'
                ctx.fillRect(0, 750, 600, 50)
                ctx.fillStyle = '#6b7280'
                ctx.font = '14px sans-serif'
                ctx.fillText('guimatrix.com — Achetez et vendez en Guinée', 300, 780)

                const link = document.createElement('a')
                link.download = `guimatrix-annonce-${listing.id}.png`
                link.href = canvas.toDataURL('image/png')
                link.click()
            }
            img.src = src
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-gray-800">📷 QR Code</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>
                <p className="text-xs text-gray-400 mb-4">Scannez pour accéder à cette annonce</p>
                <div ref={qrRef} className="flex justify-center mb-4" />
                <p className="text-xs font-medium text-gray-700 mb-4 truncate">{listing.title}</p>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={downloadPoster}
                        className="col-span-2 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-semibold transition">
                        ⬇️ Télécharger l'affiche
                    </button>
                    <button onClick={onClose}
                        className="bg-gray-100 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-200 transition">
                        Fermer
                    </button>
                    <button onClick={() => {
                        const url = window.location.href
                        navigator.clipboard?.writeText(url)
                        alert('Lien copié !')
                    }} className="bg-blue-50 text-blue-600 py-2 rounded-lg text-sm hover:bg-blue-100 transition">
                        🔗 Copier le lien
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Carte de localisation de l'annonce ─────────────────────────────────────────
function ListingLocationMap({ lat, lng, title, city }) {
    const mapRef    = useRef(null)
    const leafletRef = useRef(null)

    useEffect(() => {
        if (!window.L || !mapRef.current || leafletRef.current) return
        const map = window.L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false })
            .setView([lat, lng], 14)
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map)
        const icon = window.L.divIcon({
            className: '',
            html: `<div style="background:#16a34a;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)">📦</div>`,
            iconSize: [32, 32], iconAnchor: [16, 16],
        })
        window.L.marker([lat, lng], { icon }).addTo(map).bindPopup(`<strong>${title}</strong><br/>📍 ${city}`).openPopup()
        leafletRef.current = map
        return () => { map.remove(); leafletRef.current = null }
    }, [lat, lng])

    return (
        <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="font-semibold text-gray-700 mb-3">📍 Localisation</h2>
            <div ref={mapRef} style={{ height: 200, borderRadius: 12, zIndex: 1 }} className="border border-gray-100" />
            <p className="text-xs text-gray-400 mt-2 text-center">Position approximative — {city}</p>
        </div>
    )
}

// ── Mini carte Leaflet (zones de rencontre) ────────────────────────────────────
function MeetingMap({ zones, selected, onSelect, city }) {
    const mapRef    = useRef(null)
    const leafletRef = useRef(null)
    const markersRef = useRef([])

    useEffect(() => {
        if (!window.L || !mapRef.current || leafletRef.current) return
        // Centre sur Conakry par défaut, coordonnées approximatives par ville
        const CITY_COORDS = {
            Conakry: [9.5370, -13.6773], Kindia: [10.0583, -12.8657], Mamou: [10.3742, -12.0858],
            Labé:    [11.3181, -12.2849], Kankan: [10.3873, -9.3058],  Faranah: [10.0358, -10.7414],
            Nzérékoré:[7.7561, -8.8153],  Boké: [10.9321, -14.2958],  Siguiri: [11.4148, -9.1668],
        }
        const center = CITY_COORDS[city] || [9.5370, -13.6773]
        const map = window.L.map(mapRef.current).setView(center, zones.length ? 13 : 11)
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map)
        leafletRef.current = map
        return () => { map.remove(); leafletRef.current = null }
    }, [])

    useEffect(() => {
        const map = leafletRef.current
        if (!map || !window.L) return
        markersRef.current.forEach(m => m.remove())
        markersRef.current = []
        zones.forEach(zone => {
            if (!zone.latitude || !zone.longitude) return
            const isSelected = selected === zone.name
            const icon = window.L.divIcon({
                className: '',
                html: `<div style="background:${isSelected ? '#16a34a' : '#3b82f6'};color:white;border-radius:50% 50% 50% 0;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3)"><span style="transform:rotate(45deg)">📍</span></div>`,
                iconSize: [28, 28], iconAnchor: [14, 28],
            })
            const marker = window.L.marker([zone.latitude, zone.longitude], { icon })
                .addTo(map)
                .bindPopup(`<strong>${zone.name}</strong>${zone.address ? '<br/>' + zone.address : ''}`)
                .on('click', () => onSelect(zone.name))
            markersRef.current.push(marker)
        })
    }, [zones, selected])

    if (zones.filter(z => z.latitude).length === 0) return null

    return (
        <div>
            <div ref={mapRef} style={{ height: 180, borderRadius: 12, zIndex: 1 }} className="border border-gray-200 mb-2" />
            <p className="text-xs text-gray-400 text-center">📍 Cliquez sur un marqueur pour sélectionner le lieu</p>
        </div>
    )
}

// ── Order Modal ────────────────────────────────────────────────────────────────
function OrderModal({ listing, onClose, onSuccess }) {
    const [deliveryMode, setDeliveryMode]   = useState('meeting_point')
    const [meetLocation, setMeetLocation]   = useState('')
    const [customLocation, setCustomLocation] = useState('')
    const [pickupPoint, setPickupPoint]     = useState('')
    const [deliveryAddress, setDeliveryAddress] = useState('')
    const [distanceKm, setDistanceKm]       = useState('')
    const [weightKg, setWeightKg]           = useState(listing.weight_kg ? String(listing.weight_kg) : '')
    const [buyerCommune, setBuyerCommune]   = useState('')
    const [geoLoading, setGeoLoading]       = useState(false)
    const [geoError, setGeoError]           = useState('')
    // ChaChap Pay est le seul mode de paiement — pas de sélection nécessaire
    const [error, setError]                 = useState('')
    const [negotiatedPrice, setNegotiatedPrice] = useState(listing.price_type === 'negotiable' ? String(listing.price_gnf) : '')
    const queryClient = useQueryClient()

    const { data: pickupPoints = [] } = useQuery({
        queryKey: ['pickup-points', listing.city],
        queryFn:  () => ordersAPI.getPickupPoints(listing.city).then(r => r.data?.results || r.data || []),
        enabled:  deliveryMode === 'pickup_point',
    })

    const { data: meetingZones = [] } = useQuery({
        queryKey: ['meeting-zones', listing.city],
        queryFn:  () => ordersAPI.getMeetingZones(listing.city).then(r => r.data?.results || r.data || []),
        enabled:  deliveryMode === 'meeting_point',
    })

    const { data: deliveryZone = null } = useQuery({
        queryKey: ['delivery-zone', listing.city],
        queryFn:  () => ordersAPI.getDeliveryZones(listing.city).then(r => {
            const list = r.data?.results || r.data || []
            return Array.isArray(list) ? list[0] || null : null
        }),
        enabled:  deliveryMode === 'home_delivery',
    })

    const { data: zoneRates = [] } = useQuery({
        queryKey: ['zone-rates', listing.city],
        queryFn:  () => deliveryAPI.getZoneRates(listing.city).then(r => r.data?.results || r.data || []),
        enabled:  deliveryMode === 'home_delivery',
    })

    // Communes disponibles : toutes les communes de la ville du vendeur (+ eventuels tarifs inter-communes)
    const sellerCommune   = listing.quartier || ''
    const sellerCity      = listing.city || 'Conakry'
    // Afficher toutes les communes de la ville du vendeur + celles des tarifs inter-communes
    const communesDeVille = COMMUNES_PAR_VILLE[sellerCity] || []
    const communesTarifs  = zoneRates.filter(r => r.from_commune === sellerCommune).map(r => r.to_commune)
    const availableComm   = [...new Set([...communesDeVille, ...communesTarifs])]
    const communeRate     = buyerCommune
        ? zoneRates.find(r => r.from_commune === sellerCommune && r.to_commune === buyerCommune)
        : null

    // Géolocalisation navigateur
    const handleGeolocate = () => {
        if (!navigator.geolocation) { setGeoError("Géolocalisation non supportée par ce navigateur."); return }
        setGeoLoading(true); setGeoError('')
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude: bLat, longitude: bLon } = pos.coords
                if (listing.latitude && listing.longitude) {
                    const km = haversineKm(listing.latitude, listing.longitude, bLat, bLon)
                    // Coefficient routier ×1.3 pour approximer la distance réelle
                    setDistanceKm(String(+(km * 1.3).toFixed(1)))
                    setGeoError('')
                } else {
                    setGeoError("Ce vendeur n'a pas renseigné ses coordonnées — saisissez la distance manuellement.")
                }
                setGeoLoading(false)
            },
            () => { setGeoError("Position refusée. Saisissez la distance manuellement."); setGeoLoading(false) },
            { timeout: 8000 }
        )
    }

    const createOrder = useMutation({
        mutationFn: (data) => ordersAPI.create(data),
        onError: (err) => setError(err.response?.data?.detail || 'Erreur lors de la commande.'),
    })

    const pay = useMutation({
        mutationFn: ({ id, data }) => ordersAPI.pay(id, data),
        onSuccess: () => { queryClient.invalidateQueries(['listing', listing.id]); onSuccess() },
        onError: (err) => setError(err.response?.data?.error || 'Erreur paiement.'),
    })

    const finalMeetLocation = meetLocation || customLocation

    // ── Calcul du tarif de livraison ──────────────────────────────────────────
    // Priorité : tarif inter-commune > distance+poids > base
    const calcDeliveryFee = () => {
        if (deliveryMode !== 'home_delivery') return { fee: 0, distCharge: 0, weightCharge: 0, source: null }
        if (communeRate) {
            return { fee: communeRate.fee_gnf, distCharge: 0, weightCharge: 0, source: 'commune' }
        }
        if (!deliveryZone) return { fee: 0, distCharge: 0, weightCharge: 0, source: null }
        const dist   = parseFloat(distanceKm) || 0
        const weight = parseFloat(weightKg) || 0
        const distCharge   = Math.max(0, dist - (deliveryZone.free_km_radius || 0)) * (deliveryZone.price_per_km_gnf || 0)
        const weightCharge = Math.max(0, weight - parseFloat(deliveryZone.free_weight_kg || 0)) * (deliveryZone.price_per_kg_gnf || 0)
        return { fee: Math.round(deliveryZone.fee_gnf + distCharge + weightCharge), distCharge: Math.round(distCharge), weightCharge: Math.round(weightCharge), source: 'distance' }
    }
    const { fee: deliveryFee, distCharge, weightCharge, source: feeSource } = calcDeliveryFee()
    const hasDynamicPricing = deliveryZone && (deliveryZone.price_per_km_gnf > 0 || deliveryZone.price_per_kg_gnf > 0)
    const articlePrice  = listing.price_type === 'negotiable' ? (parseInt(negotiatedPrice) || listing.price_gnf) : listing.price_gnf
    const totalAmount   = articlePrice + deliveryFee

    const handleOrder = async (e) => {
        e.preventDefault(); setError('')
        if (deliveryMode === 'meeting_point' && !finalMeetLocation) {
            setError('Veuillez choisir ou saisir un lieu de rencontre.'); return
        }
        if (deliveryMode === 'home_delivery' && !deliveryAddress.trim()) {
            setError('Veuillez saisir votre adresse de livraison.'); return
        }
        if (listing.price_type === 'negotiable') {
            const np = parseInt(negotiatedPrice)
            if (!np || np <= 0) { setError('Entrez un prix négocié valide.'); return }
        }
        try {
            const orderPayload = {
                listing:          listing.id,
                delivery_mode:    deliveryMode,
                meet_location:    deliveryMode === 'meeting_point'  ? finalMeetLocation : '',
                pickup_point:     deliveryMode === 'pickup_point'   ? pickupPoint       : null,
                delivery_address: deliveryMode === 'home_delivery'  ? deliveryAddress   : '',
            }
            if (listing.price_type === 'negotiable' && negotiatedPrice) {
                orderPayload.negotiated_price = parseInt(negotiatedPrice)
            }
            if (deliveryMode === 'home_delivery') {
                if (distanceKm)   orderPayload.delivery_distance_km    = parseFloat(distanceKm)
                if (weightKg)     orderPayload.delivery_weight_kg      = parseFloat(weightKg)
                if (buyerCommune) orderPayload.delivery_buyer_commune  = buyerCommune
            }
            const order = await createOrder.mutateAsync(orderPayload)
            let payResult
            try {
                payResult = await pay.mutateAsync({ id: order.data.id, data: { provider: 'chachap' } })
            } catch (payErr) {
                const msg = payErr?.response?.data?.error
                    || payErr?.response?.data?.detail
                    || 'Erreur lors de l\'initialisation du paiement ChaChap Pay.'
                setError(msg)
                return
            }
            // ChaChap Pay : rediriger vers la page de paiement
            const payUrl = payResult?.data?.payment_url
            if (payUrl) {
                window.location.href = payUrl
            } else {
                setError('Aucune URL de paiement reçue. Vérifiez la configuration ChaChap Pay.')
            }
        } catch (err) {
            const msg = err?.response?.data?.detail
                || err?.response?.data?.error
                || Object.values(err?.response?.data || {}).flat().join(' ')
                || 'Une erreur est survenue. Réessayez.'
            setError(msg)
        }
    }

    const DELIVERY_MODES = [
        { value: 'meeting_point', label: 'Main propre',     icon: '🤝', sub: 'Rencontre physique' },
        { value: 'pickup_point',  label: 'Point retrait',   icon: '🏪', sub: 'Dans notre réseau' },
        { value: 'home_delivery', label: 'Domicile',        icon: '🚗', sub: 'Livraison chez vous' },
    ]

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
                <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white z-10">
                    <h2 className="font-bold text-gray-800">Passer commande</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>
                <div className="p-5">
                    {/* Résumé article */}
                    <div className="bg-gray-50 rounded-2xl p-4 mb-5 flex items-center gap-3">
                        <span className="text-2xl">📦</span>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate">{listing.title}</p>
                            <p className="text-green-600 font-black">{formatPrice(listing.price_gnf, listing.price_type)}</p>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-700 p-3 rounded-xl mb-4 text-sm flex items-center gap-2">
                            ⚠️ {error}
                        </div>
                    )}

                    <form onSubmit={handleOrder} className="space-y-5">

                        {/* Prix négocié */}
                        {listing.price_type === 'negotiable' && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                <label className="block text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">
                                    🤝 Prix négocié (GNF)
                                </label>
                                <p className="text-xs text-amber-600 mb-2">
                                    Prix affiché : <strong>{new Intl.NumberFormat('fr-GN').format(listing.price_gnf)} GNF</strong> — entrez le prix convenu avec le vendeur.
                                </p>
                                <input
                                    type="number" min="1" step="1000"
                                    value={negotiatedPrice}
                                    onChange={e => setNegotiatedPrice(e.target.value)}
                                    className="w-full border border-amber-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white font-semibold"
                                    placeholder="Ex: 250000"
                                />
                            </div>
                        )}

                        {/* Mode livraison */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Mode de livraison</label>
                            <div className="grid grid-cols-3 gap-2">
                                {DELIVERY_MODES.map(m => (
                                    <button key={m.value} type="button"
                                        onClick={() => { setDeliveryMode(m.value); setMeetLocation(''); setCustomLocation(''); setDeliveryAddress('') }}
                                        className={`p-3 rounded-xl border-2 text-left transition ${deliveryMode === m.value ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                        <div className="text-xl mb-1">{m.icon}</div>
                                        <div className={`text-xs font-bold ${deliveryMode === m.value ? 'text-green-700' : 'text-gray-700'}`}>{m.label}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">{m.sub}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Zone de rencontre */}
                        {deliveryMode === 'meeting_point' && (
                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">📍 Lieu de rencontre</label>
                                <MeetingMap zones={meetingZones} selected={meetLocation} onSelect={setMeetLocation} city={listing.city} />
                                {meetingZones.length > 0 && (
                                    <select value={meetLocation} onChange={e => { setMeetLocation(e.target.value); setCustomLocation('') }}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50">
                                        <option value="">— Choisir un lieu prédéfini —</option>
                                        {meetingZones.map(z => <option key={z.id} value={z.name}>{z.name}{z.address ? ` (${z.address})` : ''}</option>)}
                                    </select>
                                )}
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <div className="flex-1 h-px bg-gray-200" />
                                    {meetingZones.length > 0 ? 'ou saisir librement' : 'Saisissez le lieu de rencontre'}
                                    <div className="flex-1 h-px bg-gray-200" />
                                </div>
                                <input type="text" placeholder="Ex: Marché Madina, devant la pharmacie"
                                    value={customLocation}
                                    onChange={e => { setCustomLocation(e.target.value); if (e.target.value) setMeetLocation('') }}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50" />
                            </div>
                        )}

                        {/* Point de retrait */}
                        {deliveryMode === 'pickup_point' && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Point de retrait</label>
                                {pickupPoints.length === 0 ? (
                                    <p className="text-sm text-gray-400 bg-gray-50 p-3 rounded-xl">Aucun point disponible à {listing.city}.</p>
                                ) : (
                                    <select value={pickupPoint} onChange={e => setPickupPoint(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50" required>
                                        <option value="">Choisir un point</option>
                                        {pickupPoints.map(p => <option key={p.id} value={p.id}>{p.name} — {p.address}</option>)}
                                    </select>
                                )}
                            </div>
                        )}

                        {/* Livraison à domicile */}
                        {deliveryMode === 'home_delivery' && (
                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">🏠 Adresse de livraison</label>

                                {/* Bannière tarif */}
                                {(deliveryZone || communeRate) ? (
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-xs font-bold text-green-800">
                                                Livraison disponible à {listing.city}
                                                {feeSource === 'commune' && communeRate && (
                                                    <span className="ml-1 text-green-600">· ~{communeRate.estimated_hours}h</span>
                                                )}
                                                {feeSource === 'distance' && deliveryZone && (
                                                    <span className="ml-1 text-green-600">· ~{deliveryZone.estimated_days}j</span>
                                                )}
                                            </p>
                                            <span className="bg-green-600 text-white text-xs font-black px-3 py-1 rounded-full">
                                                {new Intl.NumberFormat('fr-GN').format(deliveryFee)} GNF
                                            </span>
                                        </div>
                                        {feeSource === 'commune' && (
                                            <p className="text-xs text-green-600 opacity-80">Tarif fixe {sellerCommune} → {buyerCommune}</p>
                                        )}
                                        {feeSource === 'distance' && hasDynamicPricing && (
                                            <p className="text-xs text-green-600 opacity-80">
                                                Base {new Intl.NumberFormat('fr-GN').format(deliveryZone.fee_gnf)} GNF
                                                {deliveryZone.price_per_km_gnf > 0 && ` · +${new Intl.NumberFormat('fr-GN').format(deliveryZone.price_per_km_gnf)} GNF/km`}
                                                {deliveryZone.price_per_kg_gnf > 0 && ` · +${new Intl.NumberFormat('fr-GN').format(deliveryZone.price_per_kg_gnf)} GNF/kg`}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                                        ⚠️ Aucun tarif configuré pour {listing.city}. Contactez le vendeur.
                                    </div>
                                )}

                                {/* Option 3 : sélecteur commune (si des tarifs inter-communes existent) */}
                                {availableComm.length > 0 && (
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">🗺️ Votre commune</label>
                                        <select
                                            value={buyerCommune}
                                            onChange={e => { setBuyerCommune(e.target.value); setDistanceKm('') }}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
                                        >
                                            <option value="">— Choisir votre commune —</option>
                                            {availableComm.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                )}

                                {/* Option 1 : GPS + distance manuelle (si pas de tarif commune ou commune non sélectionnée) */}
                                {!communeRate && deliveryZone && hasDynamicPricing && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <label className="block text-xs text-gray-500 mb-1">📍 Distance (km)</label>
                                                <input
                                                    type="number" min="0" step="0.1"
                                                    placeholder="Ex : 8"
                                                    value={distanceKm}
                                                    onChange={e => setDistanceKm(e.target.value)}
                                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs text-gray-500 mb-1">⚖️ Poids (kg)</label>
                                                <input
                                                    type="number" min="0" step="0.1"
                                                    placeholder="Ex : 2.5"
                                                    value={weightKg}
                                                    onChange={e => setWeightKg(e.target.value)}
                                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleGeolocate}
                                            disabled={geoLoading}
                                            className="w-full flex items-center justify-center gap-2 border border-green-300 text-green-700 text-xs font-semibold py-2 rounded-xl hover:bg-green-50 transition disabled:opacity-50"
                                        >
                                            {geoLoading ? '⏳ Localisation…' : '📍 Détecter ma position (auto)'}
                                        </button>
                                        {geoError && <p className="text-xs text-amber-600">{geoError}</p>}
                                        {distanceKm && !geoError && (
                                            <p className="text-xs text-green-600">✅ Distance : {distanceKm} km (approximation routière)</p>
                                        )}
                                    </div>
                                )}

                                <textarea
                                    rows={3}
                                    placeholder={`Quartier, rue, repère… (ex: Ratoma, face à l'hôpital)`}
                                    value={deliveryAddress}
                                    onChange={e => setDeliveryAddress(e.target.value)}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 resize-none"
                                    required
                                />
                            </div>
                        )}

                        {/* Récapitulatif total si livraison */}
                        {deliveryMode === 'home_delivery' && deliveryFee > 0 && (
                            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
                                <div className="flex justify-between text-gray-600">
                                    <span>Prix article{listing.price_type === 'negotiable' ? ' (négocié)' : ''}</span>
                                    <span>{new Intl.NumberFormat('fr-GN').format(articlePrice)} GNF</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Frais de base livraison</span>
                                    <span>{new Intl.NumberFormat('fr-GN').format(deliveryZone?.fee_gnf || 0)} GNF</span>
                                </div>
                                {distCharge > 0 && (
                                    <div className="flex justify-between text-gray-500 text-xs">
                                        <span>Surcharge distance ({distanceKm} km)</span>
                                        <span>+{new Intl.NumberFormat('fr-GN').format(distCharge)} GNF</span>
                                    </div>
                                )}
                                {weightCharge > 0 && (
                                    <div className="flex justify-between text-gray-500 text-xs">
                                        <span>Surcharge poids ({weightKg} kg)</span>
                                        <span>+{new Intl.NumberFormat('fr-GN').format(weightCharge)} GNF</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-black text-gray-900 border-t pt-2 mt-1">
                                    <span>Total</span>
                                    <span className="text-green-700">{new Intl.NumberFormat('fr-GN').format(totalAmount)} GNF</span>
                                </div>
                            </div>
                        )}

                        {/* Paiement — ChaChap Pay uniquement */}
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                            🔒 <strong>Paiement sécurisé via ChaChap Pay :</strong> vous serez redirigé pour payer avec Orange Money, MTN MoMo ou votre carte. Vos fonds sont libérés au vendeur après confirmation de réception.
                        </div>

                        <button type="submit" disabled={createOrder.isPending || pay.isPending}
                            className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white font-bold py-3.5 rounded-xl transition shadow-md shadow-green-500/20 disabled:opacity-50">
                            {(createOrder.isPending || pay.isPending)
                                ? 'Traitement en cours…'
                                : `Payer ${new Intl.NumberFormat('fr-GN').format(totalAmount)} GNF`}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

// ── Skeleton loader ────────────────────────────────────────────────────────────
function Skeleton() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow h-14" />
            <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                    <div className="bg-gray-200 rounded-2xl h-72 animate-pulse" />
                    <div className="bg-white rounded-2xl shadow p-5 space-y-3">
                        <div className="h-6 bg-gray-200 rounded animate-pulse w-2/3" />
                        <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3" />
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-4/5" />
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl shadow p-5 h-28 animate-pulse" />
                    <div className="bg-white rounded-2xl shadow p-5 h-36 animate-pulse" />
                </div>
            </div>
        </div>
    )
}

// ── Carte annonce similaire ────────────────────────────────────────────────────
function SimilarCard({ listing }) {
    const cover = listing.media?.find(m => m.is_cover) || listing.media?.[0]
    return (
        <Link to={`/listings/${listing.id}`}
            className="flex-shrink-0 w-44 bg-white rounded-xl shadow hover:shadow-md transition overflow-hidden group">
            <div className="h-28 bg-gray-100 overflow-hidden relative">
                {cover
                    ? <img src={cover.file} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
                }
                {/* Badge boost masqué côté acheteur */}
                {isNew(listing.created_at) && (
                    <span className="absolute top-1.5 right-1.5 bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">Nouveau</span>
                )}
            </div>
            <div className="p-2.5">
                <p className="text-xs font-semibold text-gray-800 truncate">{listing.title}</p>
                <p className="text-green-600 font-bold text-xs mt-0.5">{formatPrice(listing.price_gnf, listing.price_type)}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">📍 {listing.city}</p>
            </div>
        </Link>
    )
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function ListingDetailPage() {
    const { id }          = useParams()
    const navigate        = useNavigate()
    const isAuthenticated = useAuthStore(s => s.isAuthenticated)
    const user            = useAuthStore(s => s.user)
    const queryClient     = useQueryClient()
    const { addListing }  = useRecentlyViewed()

    // ── TOUS les hooks au sommet (avant tout return conditionnel) ──────────────
    const [activePhoto, setActivePhoto]   = useState(0)
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [showBuyModal, setShowBuyModal] = useState(false)
    const [orderDone, setOrderDone]       = useState(false)
    const [message, setMessage]           = useState('')
    const [sending, setSending]           = useState(false)
    const [sent, setSent]                 = useState(false)
    const [boostOpen, setBoostOpen]       = useState(false)
    const [boostDays, setBoostDays]       = useState(7)
    // Boost payé via ChaChap Pay — pas de sélection de provider nécessaire
    const [favorited, setFavorited]       = useState(false)
    const [showQR, setShowQR]             = useState(false)

    const { data: listing, isLoading } = useQuery({
        queryKey: ['listing', id],
        queryFn:  () => listingsAPI.getOne(id).then(r => r.data),
    })

    // Annonces similaires
    const { data: similarData } = useQuery({
        queryKey: ['similar', listing?.category, id],
        queryFn:  () => listingsAPI.getAll({ category: listing.category, page: 1 }).then(r => r.data),
        enabled:  !!listing?.category,
        staleTime: 5 * 60 * 1000,
    })
    const similarListings = (similarData?.results ?? []).filter(l => l.id !== id).slice(0, 8)

    // Sauvegarder dans "Vu récemment"
    useEffect(() => {
        if (listing) addListing(listing)
    }, [listing?.id])

    // Sync favorited depuis l'API au chargement — DOIT être avant les early returns
    useEffect(() => {
        if (listing?.is_favorited !== undefined) setFavorited(listing.is_favorited)
    }, [listing?.is_favorited])

    const boostMutation = useMutation({
        mutationFn: () => listingsAPI.boost(listing?.id, { days: boostDays }),
        onSuccess:  (res) => {
            // Rediriger vers ChaChap Pay pour finaliser le paiement du boost
            const payUrl = res?.data?.payment_url
            if (payUrl) { window.location.href = payUrl }
            else { queryClient.invalidateQueries(['listing', id]); setBoostOpen(false) }
        },
    })

    const favMutation = useMutation({
        mutationFn: () => listingsAPI.toggleFavorite(id),
        onMutate:   () => setFavorited(v => !v),
        onSuccess:  (res) => { setFavorited(res.data.is_favorited); queryClient.invalidateQueries({ queryKey: ['favorites'] }) },
        onError:    () => setFavorited(v => !v),
    })

    const handleContact = async (e) => {
        e.preventDefault()
        if (!isAuthenticated) return navigate('/login')
        setSending(true)
        try { await messagingAPI.startConversation({ listing_id: id, message }); setSent(true); setMessage('') }
        catch {} finally { setSending(false) }
    }

    const shareOnWhatsApp = () => {
        if (!listing) return
        const url  = encodeURIComponent(window.location.href)
        const text = encodeURIComponent(`🛒 *${listing.title}* — ${formatPrice(listing.price_gnf, listing.price_type)}\n📍 ${listing.city}\nVoir sur Guimatrix :`)
        window.open(`https://wa.me/?text=${text}%20${url}`, '_blank')
    }

    // ── Early returns APRÈS tous les hooks ────────────────────────────────────
    if (isLoading) return <Skeleton />
    if (!listing)  return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <p className="text-5xl mb-4">📭</p>
                <p className="text-gray-500">Annonce introuvable</p>
                <Link to="/" className="mt-4 inline-block text-green-600 underline text-sm">Retour à l'accueil</Link>
            </div>
        </div>
    )

    // isSeller — comparaison robuste en string
    const isSeller = !!(user && String(user.id) === String(listing.seller))
    const allMedia = listing.media || []
    const images   = allMedia.filter(m => m.media_type !== 'video')
    const videos   = allMedia.filter(m => m.media_type === 'video')
    const timeAgo  = (() => {
        const diff = Date.now() - new Date(listing.created_at).getTime()
        const h = Math.floor(diff / 3600000)
        const d = Math.floor(diff / 86400000)
        if (h < 1) return 'à l\'instant'
        if (h < 24) return `il y a ${h}h`
        if (d < 7)  return `il y a ${d}j`
        return new Date(listing.created_at).toLocaleDateString('fr-FR')
    })()

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            {/* Lightbox */}
            {lightboxOpen && images.length > 0 && (
                <ImageLightbox images={images} startIndex={activePhoto} onClose={() => setLightboxOpen(false)} />
            )}

            {/* QR Code Modal */}
            {showQR && (
                <QRModal listing={listing} onClose={() => setShowQR(false)} />
            )}

            {/* Navbar */}
            <nav className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Logo back />
                    <div className="flex items-center gap-2">
                        {isAuthenticated && !isSeller && (
                            <button
                                onClick={() => favMutation.mutate()}
                                className={`w-9 h-9 rounded-full border flex items-center justify-center text-lg transition hover:scale-110 ${favorited ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 text-gray-400 hover:text-red-400'}`}
                                title={favorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                            >
                                {favorited ? '❤️' : '🤍'}
                            </button>
                        )}
                        <button onClick={shareOnWhatsApp}
                            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition">
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            Partager
                        </button>
                        <button onClick={() => setShowQR(true)}
                            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg transition"
                            title="QR Code de cette annonce">
                            📷 QR
                        </button>
                        <Link to="/" className="text-gray-500 text-sm hover:text-green-600">← Retour</Link>
                    </div>
                </div>
            </nav>

            <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* ── Colonne principale ── */}
                <div className="md:col-span-2 space-y-4">

                    {/* Galerie photos */}
                    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
                        <div className="relative h-80 bg-gray-100 cursor-zoom-in"
                            onClick={() => images.length > 0 && setLightboxOpen(true)}>
                            {images.length > 0 ? (
                                <img src={images[activePhoto]?.file} alt={listing.title}
                                    className="w-full h-full object-cover select-none" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-6xl">📦</div>
                            )}
                            {/* Badges */}
                            <div className="absolute top-3 left-3 flex gap-2">
                                {/* Badge boost — visible seulement par le vendeur */}
                                {listing.is_boosted && isSeller && (
                                    <span className="bg-amber-400 text-white text-xs font-bold px-2 py-1 rounded-full shadow">⚡ Boosté</span>
                                )}
                                {isNew(listing.created_at) && (
                                    <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow">🆕 Nouveau</span>
                                )}
                            </div>
                            {/* Hint zoom */}
                            {images.length > 0 && (
                                <div className="absolute bottom-3 right-3 bg-black/40 text-white text-xs px-2 py-1 rounded-full">
                                    🔍 Cliquez pour agrandir
                                </div>
                            )}
                            {/* Navigation photo inline */}
                            {images.length > 1 && (
                                <>
                                    <button onClick={e => { e.stopPropagation(); setActivePhoto(p => (p - 1 + images.length) % images.length) }}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white w-9 h-9 rounded-full flex items-center justify-center text-lg transition">
                                        ‹
                                    </button>
                                    <button onClick={e => { e.stopPropagation(); setActivePhoto(p => (p + 1) % images.length) }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white w-9 h-9 rounded-full flex items-center justify-center text-lg transition">
                                        ›
                                    </button>
                                </>
                            )}
                        </div>
                        {/* Thumbnails */}
                        {images.length > 1 && (
                            <div className="flex gap-2 p-3 overflow-x-auto">
                                {images.map((m, i) => (
                                    <img key={m.id || i} src={m.file} alt=""
                                        onClick={() => setActivePhoto(i)}
                                        className={`h-16 w-16 object-cover rounded-lg cursor-pointer border-2 flex-shrink-0 transition ${i === activePhoto ? 'border-green-500 scale-105' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Vidéo */}
                    {videos.length > 0 && (
                        <div className="bg-white rounded-2xl shadow p-4">
                            <h2 className="font-semibold text-gray-700 mb-3">🎥 Vidéo de l'annonce</h2>
                            <video
                                src={videos[0].file}
                                controls
                                className="w-full rounded-xl bg-black max-h-72"
                            />
                        </div>
                    )}

                    {/* Caractéristiques */}
                    {listing.attributes && Object.keys(listing.attributes).length > 0 && (
                        <div className="bg-white rounded-2xl shadow p-5">
                            <h2 className="font-semibold text-gray-700 mb-3">📋 Caractéristiques</h2>
                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(listing.attributes).map(([k, v]) => (
                                    <div key={k} className="bg-gray-50 rounded-xl p-3">
                                        <p className="text-xs text-gray-400 capitalize">{k.replace(/_/g, ' ')}</p>
                                        <p className="font-semibold text-gray-800 text-sm mt-0.5">{String(v)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Titre + description */}
                    <div className="bg-white rounded-2xl shadow p-5">
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <h1 className="text-xl font-bold text-gray-800">{listing.title}</h1>
                            <span className="flex-shrink-0 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                {CONDITION_LABELS[listing.condition] || listing.condition}
                            </span>
                        </div>
                        <p className="text-3xl font-extrabold price-tag mb-1">
                            {formatPrice(listing.price_gnf, listing.price_type)}
                            {listing.price_type === 'negotiable' && (
                                <span className="text-sm font-normal text-gray-400 ml-2">· Prix négociable</span>
                            )}
                        </p>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-400 mb-4">
                            <span>📍 {listing.city}{listing.quartier && ` · ${listing.quartier}`}</span>
                            <span>👁 {listing.view_count} vue{listing.view_count !== 1 ? 's' : ''}</span>
                            <span>🕐 {timeAgo}</span>
                            {listing.category_name && <span>📂 {listing.category_name}</span>}
                        </div>
                        {listing.view_count > 10 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 mb-4">
                                🔥 Cette annonce est populaire — {listing.view_count} personnes l'ont regardée
                            </div>
                        )}
                        <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{listing.description}</p>
                    </div>

                    {/* Mini-carte de localisation */}
                    {listing.latitude && listing.longitude && (
                        <ListingLocationMap lat={listing.latitude} lng={listing.longitude} title={listing.title} city={listing.city} />
                    )}

                    {/* Annonces similaires */}
                    {similarListings.length > 0 && (
                        <div className="bg-white rounded-2xl shadow p-5">
                            <h2 className="font-semibold text-gray-700 mb-3">🔍 Annonces similaires</h2>
                            <div className="flex gap-3 overflow-x-auto pb-1">
                                {similarListings.map(l => <SimilarCard key={l.id} listing={l} />)}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Sidebar ── */}
                <div className="space-y-4 md:sticky md:top-20">
                    {/* Vendeur */}
                    <div className="bg-white rounded-2xl shadow-card p-5">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Vendeur</p>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center text-xl font-bold text-green-700">
                                {listing.seller_name?.[0]?.toUpperCase() ?? '👤'}
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800">{listing.seller_name}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{listing.seller_phone}</p>
                            </div>
                        </div>
                    </div>

                    {/* ⚡ Boost — vendeur uniquement */}
                    {isSeller && listing.status === 'active' && (
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-gray-800">⚡ Booster cette annonce</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Mis en avant dans les résultats</p>
                                </div>
                                {listing.is_boosted && (
                                    <span className="text-xs bg-amber-400 text-white font-bold px-2 py-1 rounded-full">
                                        ⚡ Actif{listing.expires_at && ` · exp. ${new Date(listing.expires_at).toLocaleDateString('fr-FR')}`}
                                    </span>
                                )}
                            </div>
                            {!boostOpen ? (
                                <button onClick={() => setBoostOpen(true)}
                                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl text-sm transition">
                                    ⚡ {listing.is_boosted ? 'Prolonger le boost' : 'Booster maintenant'}
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        {BOOST_PLANS.map(plan => (
                                            <button key={plan.days} onClick={() => setBoostDays(plan.days)}
                                                className={`py-2.5 rounded-xl text-sm font-medium border transition relative ${boostDays === plan.days ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'}`}>
                                                {plan.popular && <span className="absolute -top-2 right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">⭐</span>}
                                                {plan.label}<br /><span className={`text-xs ${boostDays === plan.days ? 'text-amber-100' : 'text-gray-400'}`}>{plan.price}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                                        🔒 Paiement via <strong>ChaChap Pay</strong> — vous serez redirigé pour payer avec Orange Money, MTN MoMo ou votre carte.
                                    </div>
                                    {boostMutation.isError && (
                                        <p className="text-sm text-red-500">{boostMutation.error?.response?.data?.error || 'Erreur de paiement'}</p>
                                    )}
                                    <div className="flex gap-2">
                                        <button onClick={() => boostMutation.mutate()} disabled={boostMutation.isPending}
                                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl text-sm transition disabled:opacity-50">
                                            {boostMutation.isPending ? 'Traitement...' : `Payer ${BOOST_PRICES[boostDays]}`}
                                        </button>
                                        <button onClick={() => setBoostOpen(false)}
                                            className="px-4 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm transition hover:bg-gray-50">
                                            Annuler
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bouton acheter */}
                    {!isSeller && listing.status === 'active' && (
                        <div className="bg-white rounded-2xl shadow-card p-5 space-y-3">
                            {orderDone ? (
                                <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm text-center font-medium">
                                    ✅ Commande passée ! Le vendeur va confirmer sous peu.
                                </div>
                            ) : (
                                <button onClick={() => isAuthenticated ? setShowBuyModal(true) : navigate('/login')}
                                    className="btn-primary w-full py-3.5 rounded-xl text-base font-bold text-center block">
                                    🛒 Acheter maintenant
                                </button>
                            )}
                        </div>
                    )}

                    {/* Contact vendeur */}
                    {!isSeller && (
                        <div className="bg-white rounded-2xl shadow-card p-5">
                            <h2 className="font-semibold text-gray-800 mb-3">💬 Contacter le vendeur</h2>
                            {sent ? (
                                <div className="bg-green-50 text-green-700 p-3 rounded-xl text-sm text-center font-medium">✅ Message envoyé !</div>
                            ) : (
                                <form onSubmit={handleContact} className="space-y-3">
                                    <textarea rows={3} placeholder="Bonjour, est-ce encore disponible ?"
                                        value={message} onChange={e => setMessage(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" required />
                                    <button type="submit" disabled={sending}
                                        className="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-50">
                                        {sending ? 'Envoi...' : '📨 Envoyer un message'}
                                    </button>
                                    {!isAuthenticated && (
                                        <p className="text-xs text-center text-gray-400">
                                            <Link to="/login" className="text-green-600 underline">Connectez-vous</Link> pour contacter
                                        </p>
                                    )}
                                </form>
                            )}
                        </div>
                    )}

                    {/* Infos supplémentaires */}
                    <div className="bg-white rounded-2xl shadow p-5 space-y-2 text-sm text-gray-500">
                        <p>🔖 Référence : <span className="font-mono text-xs text-gray-400">{listing.id?.slice(0,8)}</span></p>
                        <p>📅 Publié {timeAgo}</p>
                        <p>👁 {listing.view_count} vue{listing.view_count !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            </div>

            {/* ── Annonces similaires ── */}
            <div className="max-w-5xl mx-auto px-4 pb-8">
                <SimilarListings listingId={listing.id} />
            </div>

            {/* ── Assistant IA flottant ── */}
            {!isSeller && (
                <ListingAssistant
                    listingId={listing.id}
                    listingTitle={listing.title}
                    listingPrice={listing.price_gnf}
                />
            )}

            {/* Modal commande */}
            {showBuyModal && (
                <OrderModal listing={listing}
                    onClose={() => setShowBuyModal(false)}
                    onSuccess={() => { setShowBuyModal(false); setOrderDone(true) }} />
            )}
        </div>
    )
}
