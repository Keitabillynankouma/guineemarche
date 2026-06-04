import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersAPI } from '../services/api'

const STATUS = {
    pending:   { label: 'En attente',  color: 'bg-yellow-100 text-yellow-700' },
    confirmed: { label: 'Confirmée',   color: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Terminée',    color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Annulée',     color: 'bg-gray-100 text-gray-500' },
    disputed:  { label: 'Litige',      color: 'bg-red-100 text-red-600' },
}

const DELIVERY = {
    meeting_point: '🤝 Main propre',
    pickup_point:  '📦 Point retrait',
    home_delivery: '🚗 Livraison domicile',
}

function fmt(n) {
    return new Intl.NumberFormat('fr-GN').format(n) + ' GNF'
}

export default function OrdersPage() {
    const qc = useQueryClient()
    const [active, setActive] = useState('buyer')

    const { data, isLoading } = useQuery({
        queryKey: ['orders'],
        queryFn: () => ordersAPI.getAll().then(r => r.data),
    })

    const orders = Array.isArray(data) ? data : (data?.results ?? [])

    const confirmMutation = useMutation({
        mutationFn: (id) => ordersAPI.confirmReceipt(id),
        onSuccess: () => qc.invalidateQueries(['orders']),
    })
    const disputeMutation = useMutation({
        mutationFn: (id) => ordersAPI.dispute(id),
        onSuccess: () => qc.invalidateQueries(['orders']),
    })

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
                    <Link to="/profile" className="text-green-700 font-bold text-lg">←</Link>
                    <h1 className="font-bold text-gray-800">Mes commandes</h1>
                </div>
            </nav>

            <div className="max-w-2xl mx-auto px-4 py-6">
                {/* Tabs */}
                <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
                    {[['buyer', '🛍️ Mes achats'], ['seller', '🏪 Mes ventes']].map(([key, label]) => (
                        <button key={key} onClick={() => setActive(key)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                                active === key ? 'bg-white shadow text-green-700' : 'text-gray-500'
                            }`}>
                            {label}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl h-28 animate-pulse" />)}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <p className="text-5xl mb-4">📭</p>
                        <p>Aucune commande pour le moment</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {orders.map(order => {
                            const st = STATUS[order.status] || STATUS.pending
                            const isBuyer = active === 'buyer'
                            const canConfirm = isBuyer && order.status === 'confirmed'
                            const canDispute = isBuyer && ['pending', 'confirmed'].includes(order.status)

                            return (
                                <div key={order.id} className="bg-white rounded-xl shadow p-4 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-semibold text-gray-800">{order.listing_title}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {isBuyer ? `Vendeur : ${order.seller_name}` : `Acheteur : ${order.buyer_name}`}
                                            </p>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.color}`}>
                                            {st.label}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500">{DELIVERY[order.delivery_mode]}</span>
                                        <span className="font-bold text-green-700">{fmt(order.amount_gnf)}</span>
                                    </div>

                                    {/* Commission (visible côté vendeur si commande terminée) */}
                                    {!isBuyer && order.status === 'completed' && order.seller_payout_gnf > 0 && (
                                        <div className="bg-green-50 rounded-lg p-2 text-xs text-green-700 space-y-0.5">
                                            <div className="flex justify-between">
                                                <span>Montant total</span>
                                                <span>{fmt(order.amount_gnf)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-500">
                                                <span>Commission plateforme (5%)</span>
                                                <span>- {fmt(order.commission_gnf)}</span>
                                            </div>
                                            <div className="flex justify-between font-bold border-t pt-1 mt-1">
                                                <span>Votre gain net</span>
                                                <span>{fmt(order.seller_payout_gnf)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions acheteur */}
                                    {(canConfirm || canDispute) && (
                                        <div className="flex gap-2 pt-1">
                                            {canConfirm && (
                                                <button
                                                    onClick={() => confirmMutation.mutate(order.id)}
                                                    disabled={confirmMutation.isPending}
                                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-lg transition disabled:opacity-50">
                                                    ✅ Confirmer la réception
                                                </button>
                                            )}
                                            {canDispute && (
                                                <button
                                                    onClick={() => disputeMutation.mutate(order.id)}
                                                    disabled={disputeMutation.isPending}
                                                    className="px-3 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium py-2 rounded-lg transition disabled:opacity-50">
                                                    ⚠️ Litige
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <p className="text-xs text-gray-400">
                                        {new Date(order.created_at).toLocaleDateString('fr-FR', {
                                            day: 'numeric', month: 'long', year: 'numeric'
                                        })}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
