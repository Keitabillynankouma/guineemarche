/**
 * SimilarListings — Carousel "Vous aimerez aussi"
 * Utilise GET /api/v1/listings/{id}/similar/
 */
import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

function formatPrice(price, type) {
  if (type === 'free') return 'Gratuit'
  if (!price) return '—'
  return new Intl.NumberFormat('fr-GN').format(price) + ' GNF'
}

export default function SimilarListings({ listingId }) {
  const [listings, setListings] = useState([])
  const [loading, setLoading]   = useState(true)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!listingId) return
    setLoading(true)
    api.get(`/listings/${listingId}/similar/`)
      .then(({ data }) => setListings(data.results || []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false))
  }, [listingId])

  function scroll(dir) {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * 260, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="mt-8">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Vous aimerez aussi</h3>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex-shrink-0 w-52 bg-gray-100 rounded-2xl h-64 animate-pulse"/>
          ))}
        </div>
      </div>
    )
  }

  if (!listings.length) return null

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span>✨</span> Vous aimerez aussi
        </h3>
        <div className="flex gap-2">
          <button onClick={() => scroll(-1)}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-lg transition">
            ‹
          </button>
          <button onClick={() => scroll(1)}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-lg transition">
            ›
          </button>
        </div>
      </div>

      <div ref={scrollRef}
           className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
           style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {listings.map(listing => (
          <Link
            key={listing.id}
            to={`/listings/${listing.id}`}
            className="flex-shrink-0 w-52 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all group overflow-hidden"
          >
            {/* Image */}
            <div className="relative h-36 bg-gray-100 overflow-hidden">
              {listing.media?.[0]?.file ? (
                <img
                  src={listing.media[0].file}
                  alt={listing.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">📦</div>
              )}
              {listing.is_boosted && (
                <span className="absolute top-2 left-2 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full">
                  ⚡ Boost
                </span>
              )}
            </div>

            {/* Infos */}
            <div className="p-3">
              <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug group-hover:text-emerald-600 transition-colors">
                {listing.title}
              </p>
              <p className="mt-1.5 text-emerald-600 font-bold text-sm">
                {formatPrice(listing.price_gnf, listing.price_type)}
              </p>
              {listing.price_type === 'negotiable' && (
                <span className="text-xs text-gray-400">À débattre</span>
              )}
              <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                <span>📍</span>{listing.city}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
