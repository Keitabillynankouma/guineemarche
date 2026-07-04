/**
 * AISearchBar — Barre de recherche intelligente Guimatrix
 * Utilise POST /api/v1/listings/ai-search/
 */
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function AISearchBar({ onResults, placeholder = 'Rechercher en langage naturel…', className = '' }) {
  const [query, setQuery]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [hint, setHint]         = useState('')
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const examples = [
    'iPhone moins de 3 millions à Conakry',
    'voiture Toyota occasion bon état',
    'appartement 2 pièces Kipé',
    'télé Samsung neuf pas cher',
    'moto Yamaha négociable',
  ]

  async function search(q) {
    const text = (q || query).trim()
    if (!text) return
    setLoading(true)
    setHint('')
    try {
      const { data } = await api.post('/listings/ai-search/', { query: text })
      if (onResults) {
        onResults(data)
      } else {
        // Si pas de callback, naviguer vers la page de résultats
        navigate('/search', { state: { aiResults: data, query: text } })
      }
      if (data.interpretation) {
        setHint(data.interpretation)
      }
    } catch (err) {
      console.error('AI search error:', err)
      setHint('Erreur de recherche. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') search()
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Barre principale */}
      <div className="relative flex items-center bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Icône IA */}
        <div className="pl-4 pr-2 flex-shrink-0">
          {loading ? (
            <svg className="w-5 h-5 text-emerald-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          ) : (
            <span className="text-xl">✨</span>
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          disabled={loading}
          className="flex-1 py-4 px-2 text-gray-800 placeholder-gray-400 bg-transparent outline-none text-sm md:text-base"
        />

        <button
          onClick={() => search()}
          disabled={loading || !query.trim()}
          className="m-1.5 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-semibold text-sm transition-colors flex-shrink-0"
        >
          {loading ? 'Recherche…' : 'Rechercher'}
        </button>
      </div>

      {/* Interprétation IA */}
      {hint && (
        <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
          <span>🤖</span>
          <span>{hint}</span>
        </p>
      )}

      {/* Suggestions d'exemples */}
      {!query && !loading && (
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => { setQuery(ex); search(ex) }}
              className="text-xs px-3 py-1.5 bg-white/80 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 text-gray-600 hover:text-emerald-700 rounded-full transition-all"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
