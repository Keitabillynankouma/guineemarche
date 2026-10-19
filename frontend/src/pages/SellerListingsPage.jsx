import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listingsAPI } from '../services/api'
import SellerLayout from '../layouts/SellerLayout'

const STATUS = {
  active:   { label: 'Active',        color: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  pending:  { label: 'En attente',    color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
  rejected: { label: 'Refusée',       color: 'bg-red-100 text-red-700',      dot: 'bg-red-500'   },
  expired:  { label: 'Expirée',       color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400'  },
  inactive: { label: 'Désactivée',    color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400'  },
}

function fmt(price, type) {
  if (type === 'free') return 'Gratuit'
  return price ? new Intl.NumberFormat('fr-FR').format(price) + ' GNF' : '—'
}

export default function SellerListingsPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => listingsAPI.myListings().then(r => r.data),
  })

  const listings = Array.isArray(data) ? data : (data?.results ?? [])

  const deleteMutation = useMutation({
    mutationFn: (id) => listingsAPI.delete(id),
    onSuccess: () => qc.invalidateQueries(['my-listings']),
  })

  return (
    <SellerLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Mes annonces</h1>
            <p className="text-sm text-gray-500">{listings.length} annonce{listings.length !== 1 ? 's' : ''}</p>
          </div>
          <Link to="/create"
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-md shadow-orange-500/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
            </svg>
            Nouvelle annonce
          </Link>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-gray-100" />)}
          </div>
        )}

        {!isLoading && listings.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <p className="text-5xl mb-4">📋</p>
            <p className="font-black text-gray-900 text-lg mb-1">Aucune annonce</p>
            <p className="text-sm text-gray-500 mb-5">Publiez votre premier article dès maintenant.</p>
            <Link to="/create" className="bg-orange-500 text-white text-sm font-bold px-6 py-3 rounded-xl hover:bg-orange-600 transition-colors">
              Publier une annonce
            </Link>
          </div>
        )}

        {!isLoading && listings.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {listings.map(listing => {
              const st = STATUS[listing.status] ?? STATUS.inactive
              return (
                <div key={listing.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                    {listing.images?.[0]
                      ? <img src={listing.images[0].image} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{listing.title}</p>
                    <p className="text-xs text-gray-400">{listing.category?.name ?? '—'} · {fmt(listing.price, listing.price_type)}</p>
                    {listing.rejection_reason && (
                      <p className="text-xs text-red-600 mt-0.5">Motif : {listing.rejection_reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${st.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                    <Link to={`/listings/${listing.id}`}
                      className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                      Voir
                    </Link>
                    <button
                      onClick={() => { if (confirm('Supprimer cette annonce ?')) deleteMutation.mutate(listing.id) }}
                      className="text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                      Supprimer
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SellerLayout>
  )
}
