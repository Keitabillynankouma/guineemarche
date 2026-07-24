import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { shopsAPI, listingsAPI } from '../services/api'

function fmt(price, type) {
    if (type === 'free') return 'Gratuit'
    return new Intl.NumberFormat('fr-GN').format(price) + ' GNF'
}

function SkeletonCard() {
    return (
        <div className="bg-white rounded-2xl overflow-hidden animate-pulse border border-gray-100">
            <div className="h-36 bg-gray-200" />
            <div className="p-3 space-y-2">
                <div className="h-3 bg-gray-200 rounded-full w-3/4" />
                <div className="h-4 bg-gray-100 rounded-full w-1/2" />
            </div>
        </div>
    )
}

export default function ShopPage() {
    const { id } = useParams()

    const { data: shop, isLoading: shopLoading } = useQuery({
        queryKey: ['shop', id],
        queryFn: () => shopsAPI.getOne(id).then(r => r.data),
    })

    const { data: listingsData, isLoading: listingsLoading } = useQuery({
        queryKey: ['shop-listings', shop?.owner],
        queryFn: () => listingsAPI.getAll({ seller: shop.owner }).then(r => r.data),
        enabled: !!shop?.owner,
    })
    const listings = Array.isArray(listingsData) ? listingsData : (listingsData?.results || [])

    if (shopLoading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-green-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400 font-medium">Chargement de la boutique…</p>
            </div>
        </div>
    )

    if (!shop) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
                <p className="text-5xl mb-4">🏪</p>
                <p className="text-gray-700 font-bold text-lg mb-1">Boutique introuvable</p>
                <p className="text-gray-400 text-sm mb-5">Cette boutique n'existe pas ou a été supprimée.</p>
                <Link to="/" className="text-green-600 font-semibold hover:underline text-sm">← Retour à l'accueil</Link>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Nav */}
            <nav className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20" style={{boxShadow:'0 1px 0 rgba(0,0,0,0.05)'}}>
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Link to="/" className="text-gray-400 hover:text-gray-600 transition">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </Link>
                        <div className="h-5 w-px bg-gray-200" />
                        <span className="text-sm font-bold text-gray-800 truncate max-w-48">{shop.name}</span>
                        {shop.is_verified && (
                            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                ✅ Vérifiée
                            </span>
                        )}
                    </div>
                    {shop.whatsapp && (
                        <a
                            href={`https://wa.me/${shop.whatsapp.replace(/\D/g, '')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 hover:bg-green-700 transition shadow-sm">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.127 1.534 5.868L.057 23.875l6.178-1.62A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.838 0-3.569-.474-5.079-1.307l-.364-.217-3.667.962.979-3.577-.235-.377A9.938 9.938 0 012 12c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10z"/>
                            </svg>
                            WhatsApp
                        </a>
                    )}
                </div>
            </nav>

            {/* Cover / Hero boutique */}
            <div className="bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/5 rounded-full pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />

                <div className="max-w-4xl mx-auto px-4 py-10 relative z-10">
                    <div className="flex items-end gap-5">
                        {/* Logo boutique */}
                        <div className="w-24 h-24 rounded-2xl bg-white shadow-xl border-4 border-white/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                            {shop.logo_url
                                ? <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
                                : <span className="text-5xl">🏪</span>
                            }
                        </div>

                        <div className="text-white mb-1">
                            <h1 className="text-2xl font-black tracking-tight">{shop.name}</h1>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                <span className="flex items-center gap-1 text-sm text-green-100">
                                    📍 {shop.city}{shop.address ? ` · ${shop.address}` : ''}
                                </span>
                                {shop.is_verified && (
                                    <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                                        ✅ Boutique vérifiée
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 -mt-4 space-y-5 pb-10">

                {/* Carte info boutique */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <div className="grid grid-cols-3 divide-x divide-gray-100 mb-4">
                        {[
                            { val: shop.listing_count ?? 0, label: 'Annonce' + (shop.listing_count !== 1 ? 's' : '') },
                            { val: shop.plan === 'pro' ? 'Pro' : 'Standard', label: 'Plan' },
                            { val: shop.created_at ? new Date(shop.created_at).getFullYear() : '—', label: 'Membre depuis' },
                        ].map(s => (
                            <div key={s.label} className="text-center px-3">
                                <p className="text-xl font-black text-gray-900">{s.val}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {shop.description && (
                        <p className="text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4">{shop.description}</p>
                    )}

                    {/* Liens de contact */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                        {shop.phone && (
                            <a href={`tel:${shop.phone}`}
                                className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-xl transition">
                                📞 {shop.phone}
                            </a>
                        )}
                        {shop.whatsapp && (
                            <a href={`https://wa.me/${shop.whatsapp.replace(/\D/g, '')}`}
                                target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 bg-green-100 hover:bg-green-200 text-green-700 text-xs font-semibold px-3 py-2 rounded-xl transition">
                                💬 WhatsApp
                            </a>
                        )}
                        {shop.website && (
                            <a href={shop.website} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-semibold px-3 py-2 rounded-xl transition">
                                🌐 Site web
                            </a>
                        )}
                    </div>
                </div>

                {/* Annonces */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-black text-gray-900 text-base">
                            Annonces de {shop.name}
                            {!listingsLoading && listings.length > 0 && (
                                <span className="ml-2 text-sm font-normal text-gray-400">({listings.length})</span>
                            )}
                        </h2>
                    </div>

                    {listingsLoading ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    ) : listings.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
                            <p className="text-4xl mb-3">📭</p>
                            <p className="text-gray-700 font-semibold text-sm">Aucune annonce pour le moment</p>
                            <p className="text-gray-400 text-xs mt-1">Cette boutique n'a pas encore publié d'annonces</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {listings.map(l => {
                                const cover = l.media?.find(m => m.is_cover) || l.media?.[0]
                                return (
                                    <Link key={l.id} to={`/listings/${l.id}`}
                                        className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group shadow-sm">
                                        <div className="h-36 bg-gray-100 overflow-hidden relative">
                                            {cover
                                                ? <img src={cover.file} alt={l.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                : <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
                                            }
                                            {/* Badge boost masqué côté acheteur */}
                                        </div>
                                        <div className="p-3">
                                            <p className="font-bold text-sm text-gray-900 truncate leading-snug">{l.title}</p>
                                            <p className="text-emerald-700 font-black text-sm mt-1">{fmt(l.price_gnf, l.price_type)}</p>
                                            {l.city && <p className="text-xs text-gray-400 mt-1">📍 {l.city}</p>}
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
