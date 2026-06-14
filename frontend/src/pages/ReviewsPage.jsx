import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

function Stars({ rating, size = 'md' }) {
    const cls = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-xs' : 'text-base'
    return (
        <span className={cls}>
            {[1, 2, 3, 4, 5].map(i => (
                <span key={i} className={i <= rating ? 'text-amber-400' : 'text-gray-300'}>★</span>
            ))}
        </span>
    )
}

function RatingBar({ count, total, note }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="w-4 text-gray-500 text-right">{note}</span>
            <span className="text-amber-400 text-xs">★</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }} />
            </div>
            <span className="w-6 text-gray-400 text-xs">{count}</span>
        </div>
    )
}

export default function ReviewsPage() {
    const { userId } = useParams()
    const [filterNote, setFilterNote] = useState(0)

    const { data: reviewsData, isLoading } = useQuery({
        queryKey: ['user-reviews', userId],
        queryFn: () => api.get(`/reviews/user/${userId}/`).then(r => r.data),
    })

    const allReviews = Array.isArray(reviewsData) ? reviewsData : (reviewsData?.results ?? [])

    // Statistiques
    const total    = allReviews.length
    const avg      = total > 0 ? (allReviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1) : '0.0'
    const distrib  = [5, 4, 3, 2, 1].map(n => ({
        note:  n,
        count: allReviews.filter(r => r.rating === n).length,
    }))

    const filtered = filterNote > 0
        ? allReviews.filter(r => r.rating === filterNote)
        : allReviews

    function dateLabel(str) {
        return new Date(str).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
                    <button onClick={() => history.back()} className="text-green-700 font-bold text-lg">←</button>
                    <h1 className="font-bold text-gray-800">Avis reçus</h1>
                </div>
            </nav>

            <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

                {/* Résumé global */}
                <div className="bg-white rounded-2xl shadow p-5">
                    <div className="flex items-center gap-6">
                        <div className="text-center">
                            <p className="text-5xl font-bold text-gray-800">{avg}</p>
                            <Stars rating={Math.round(parseFloat(avg))} size="lg" />
                            <p className="text-xs text-gray-400 mt-1">{total} avis</p>
                        </div>
                        <div className="flex-1 space-y-1.5">
                            {distrib.map(d => (
                                <RatingBar key={d.note} note={d.note} count={d.count} total={total} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Filtres par note */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                    <button onClick={() => setFilterNote(0)}
                        className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition
                            ${filterNote === 0 ? 'bg-green-600 text-white' : 'bg-white text-gray-600 shadow-sm hover:bg-gray-50'}`}>
                        Tous ({total})
                    </button>
                    {[5, 4, 3, 2, 1].map(n => {
                        const c = allReviews.filter(r => r.rating === n).length
                        if (c === 0) return null
                        return (
                            <button key={n} onClick={() => setFilterNote(n)}
                                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition
                                    ${filterNote === n ? 'bg-amber-400 text-white' : 'bg-white text-gray-600 shadow-sm hover:bg-gray-50'}`}>
                                {n} ★ ({c})
                            </button>
                        )
                    })}
                </div>

                {/* Liste avis */}
                {isLoading ? (
                    <div className="space-y-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl h-28 animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <p className="text-5xl mb-3">⭐</p>
                        <p>{filterNote > 0 ? `Aucun avis à ${filterNote} étoile${filterNote > 1 ? 's' : ''}` : 'Aucun avis pour le moment'}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(review => (
                            <div key={review.id} className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center font-bold text-green-700 flex-shrink-0">
                                            {review.reviewer_name?.[0] ?? '?'}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800 text-sm">
                                                {review.reviewer_name || 'Utilisateur'}
                                            </p>
                                            <Stars rating={review.rating} size="sm" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400 flex-shrink-0">{dateLabel(review.created_at)}</p>
                                </div>
                                {review.comment && (
                                    <p className="text-sm text-gray-600 leading-relaxed pl-13 ml-13">
                                        "{review.comment}"
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
