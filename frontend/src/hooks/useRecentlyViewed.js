/**
 * useRecentlyViewed — sauvegarde les 10 dernières annonces vues en localStorage.
 */
import { useState } from 'react'

const KEY = 'gm_recently_viewed'
const MAX = 10

export function useRecentlyViewed() {
  const [viewed, setViewed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') }
    catch { return [] }
  })

  const addListing = (listing) => {
    if (!listing?.id) return
    const mini = {
      id:         listing.id,
      title:      listing.title,
      price_gnf:  listing.price_gnf,
      price_type: listing.price_type,
      city:       listing.city,
      cover:      listing.media?.find(m => m.is_cover)?.file || listing.media?.[0]?.file || null,
      is_boosted: listing.is_boosted,
      created_at: listing.created_at,
    }
    setViewed(prev => {
      const next = [mini, ...prev.filter(l => l.id !== listing.id)].slice(0, MAX)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const getViewed = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') }
    catch { return [] }
  }

  return { viewed, addListing, getViewed }
}
