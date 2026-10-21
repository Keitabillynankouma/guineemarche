/**
 * PickupPointsPage — carte + liste des points de retrait actifs
 * Utilise Leaflet.js (CDN) via useEffect pour afficher la carte.
 */
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ordersAPI } from '../services/api'
import { VILLES } from '../constants/communes'
import NotificationBell from '../components/NotificationBell'
import useAuthStore from '../store/authStore'

export default function PickupPointsPage() {
  const [cityFilter, setCityFilter] = useState('Conakry')
  const [selected, setSelected]     = useState(null)
  const mapRef                       = useRef(null)
  const leafletMap                   = useRef(null)
  const markersRef                   = useRef([])
  const { isAuthenticated }          = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['pickup-points', cityFilter],
    queryFn:  () => ordersAPI.getPickupPoints(cityFilter).then(r => r.data),
  })
  const points = Array.isArray(data) ? data : (data?.results ?? [])

  // ── Charger Leaflet CSS + JS une fois ──────────────────────────────────
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id   = 'leaflet-css'
      link.rel  = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    if (!window.L) {
      const script  = document.createElement('script')
      script.src    = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = () => initMap()
      document.head.appendChild(script)
    } else {
      initMap()
    }
    return () => {
      if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null }
    }
  }, [])

  // ── (Re)placer les marqueurs quand les points changent ─────────────────
  useEffect(() => {
    if (!window.L || !mapRef.current) return
    if (!leafletMap.current) { initMap(); return }
    updateMarkers()
  }, [points, selected])

  function initMap() {
    if (!mapRef.current || leafletMap.current) return
    leafletMap.current = window.L.map(mapRef.current).setView([9.5370, -13.6773], 12)
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(leafletMap.current)
    updateMarkers()
  }

  function updateMarkers() {
    if (!leafletMap.current || !window.L) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const geoPoints = points.filter(p => p.latitude && p.longitude)
    geoPoints.forEach(p => {
      const icon = window.L.divIcon({
        html: `<div style="
          background:${selected?.id === p.id ? '#16a34a' : '#f97316'};
          color:white; border-radius:50%; width:32px; height:32px;
          display:flex; align-items:center; justify-content:center;
          font-size:16px; box-shadow:0 2px 6px rgba(0,0,0,.3);
          border:2px solid white;">📦</div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })
      const marker = window.L.marker([p.latitude, p.longitude], { icon })
        .addTo(leafletMap.current)
        .bindPopup(`
          <div style="min-width:180px">
            <p style="font-weight:700;margin:0 0 4px">${p.name}</p>
            <p style="color:#666;font-size:12px;margin:0 0 2px">📍 ${p.address}</p>
            ${p.phone ? `<p style="color:#666;font-size:12px;margin:0 0 2px">📞 ${p.phone}</p>` : ''}
            ${p.opening_hours ? `<p style="color:#666;font-size:12px;margin:0">🕐 ${p.opening_hours}</p>` : ''}
          </div>
        `)
        .on('click', () => setSelected(p))
      markersRef.current.push(marker)
    })

    if (geoPoints.length > 0) {
      const bounds = window.L.latLngBounds(geoPoints.map(p => [p.latitude, p.longitude]))
      leafletMap.current.fitBounds(bounds, { padding: [40, 40] })
    }
  }

  function flyTo(point) {
    setSelected(point)
    if (leafletMap.current && point.latitude && point.longitude) {
      leafletMap.current.flyTo([point.latitude, point.longitude], 15, { duration: 0.8 })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20"
        style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link to="/" className="text-gray-400 hover:text-gray-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="h-5 w-px bg-gray-200" />
            <h1 className="text-sm font-semibold text-gray-700">📦 Points de retrait</h1>
          </div>
          {isAuthenticated && <NotificationBell />}
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-4">

        {/* Filtre ville */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {['Conakry', ...VILLES.filter(v => v !== 'Conakry')].map(v => (
            <button key={v} onClick={() => setCityFilter(v)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                cityFilter === v
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-green-300'
              }`}>
              {v}
            </button>
          ))}
        </div>

        {/* Carte */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div ref={mapRef} style={{ height: 320, zIndex: 1 }} />
          {points.filter(p => p.latitude && p.longitude).length === 0 && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-2xl">
              <p className="text-sm text-gray-400">Pas de coordonnées GPS disponibles pour cette ville</p>
            </div>
          )}
        </div>

        {/* Liste */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-3">
            {isLoading ? 'Chargement…' : `${points.length} point${points.length !== 1 ? 's' : ''} à ${cityFilter}`}
          </h2>

          {isLoading && (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-gray-100" />)}
            </div>
          )}

          {!isLoading && points.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 py-14 text-center">
              <p className="text-3xl mb-3">📦</p>
              <p className="font-semibold text-gray-700 text-sm">Aucun point de retrait dans cette ville</p>
            </div>
          )}

          <div className="space-y-3">
            {points.map(p => (
              <button key={p.id} onClick={() => flyTo(p)}
                className={`w-full text-left bg-white rounded-2xl border p-4 shadow-sm transition ${
                  selected?.id === p.id
                    ? 'border-green-500 ring-2 ring-green-200'
                    : 'border-gray-100 hover:border-green-200'
                }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                    selected?.id === p.id ? 'bg-green-100' : 'bg-gray-100'
                  }`}>📦</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                      {p.latitude && p.longitude && (
                        <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">
                          📍 Sur la carte
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{p.address}{p.commune ? ` — ${p.commune}` : ''}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      {p.phone && (
                        <a href={`tel:${p.phone}`} onClick={e => e.stopPropagation()}
                          className="text-xs text-green-600 hover:underline">📞 {p.phone}</a>
                      )}
                      {p.opening_hours && (
                        <span className="text-xs text-gray-400">🕐 {p.opening_hours}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
