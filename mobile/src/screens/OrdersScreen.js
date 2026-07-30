import React, { useState } from 'react'
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersAPI } from '../services/api'
import { colors, spacing, radius, font } from '../theme'

const STATUS_LABEL = {
    pending:   { label: 'En attente',  color: '#f59e0b', bg: '#fef3c7' },
    confirmed: { label: 'Confirmée',   color: '#2563eb', bg: '#dbeafe' },
    completed: { label: 'Terminée',    color: '#16a34a', bg: '#dcfce7' },
    cancelled: { label: 'Annulée',     color: '#ef4444', bg: '#fee2e2' },
    disputed:  { label: 'Litige',      color: '#7c3aed', bg: '#ede9fe' },
}

function OrderCard({ order, onAction }) {
    const st = STATUS_LABEL[order.status] || STATUS_LABEL.pending
    const fmt = n => new Intl.NumberFormat('fr-GN').format(n) + ' GNF'

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.listingTitle} numberOfLines={2}>{order.listing?.title}</Text>
                    <Text style={styles.orderMeta}>
                        Vendeur : {order.seller?.full_name}
                    </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                </View>
            </View>

            <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Montant</Text>
                <Text style={styles.amount}>{fmt(order.amount_gnf)}</Text>
            </View>

            <Text style={styles.orderDate}>
                📅 {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
            <Text style={styles.orderMeta}>
                🚚 {order.delivery_mode === 'delivery' ? 'Livraison à domicile' : 'Retrait en main propre'}
            </Text>

            {/* Actions */}
            <View style={styles.actions}>
                {order.status === 'confirmed' && (
                    <TouchableOpacity onPress={() => onAction(order.id, 'confirm-receipt')} style={styles.btnPrimary}>
                        <Text style={styles.btnPrimaryText}>✅ Confirmer réception</Text>
                    </TouchableOpacity>
                )}
                {order.status === 'pending' && (
                    <TouchableOpacity onPress={() => onAction(order.id, 'cancel')} style={styles.btnDanger}>
                        <Text style={styles.btnDangerText}>✕ Annuler</Text>
                    </TouchableOpacity>
                )}
                {order.status === 'confirmed' && !order.payments?.length && (
                    <TouchableOpacity onPress={() => onAction(order.id, 'pay')} style={styles.btnAccent}>
                        <Text style={styles.btnAccentText}>💳 Payer</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    )
}

export default function OrdersScreen({ navigation }) {
    const [tab, setTab] = useState('buyer')
    const qc = useQueryClient()

    const { data: buyerOrders = [], isLoading: lb, refetch: rb, isRefetching: rib } = useQuery({
        queryKey: ['orders-buyer'],
        queryFn:  () => ordersAPI.list().then(r => r.data),
    })

    const { data: sellerOrders = [], isLoading: ls, refetch: rs, isRefetching: ris } = useQuery({
        queryKey: ['orders-seller'],
        queryFn:  () => ordersAPI.received().then(r => r.data),
    })

    const actionMut = useMutation({
        mutationFn: ({ id, action }) => {
            if (action === 'confirm-receipt') return ordersAPI.confirmReceipt(id)
            if (action === 'cancel')          return ordersAPI.action(id, 'cancel')
            return ordersAPI.action(id, action)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['orders-buyer'] })
            qc.invalidateQueries({ queryKey: ['orders-seller'] })
        },
        onError: (e) => Alert.alert('Erreur', e.response?.data?.error || 'Action échouée.'),
    })

    const handleAction = (id, action) => {
        if (action === 'cancel') {
            Alert.alert('Annuler la commande', 'Voulez-vous vraiment annuler cette commande ?', [
                { text: 'Oui, annuler', style: 'destructive', onPress: () => actionMut.mutate({ id, action }) },
                { text: 'Non', style: 'cancel' },
            ])
        } else if (action === 'pay') {
            navigation.navigate('Payment', { orderId: id })
        } else if (action === 'confirm-receipt') {
            Alert.alert('Confirmer la réception', 'Avez-vous bien reçu cet article ?', [
                { text: 'Oui, confirmé', onPress: () => actionMut.mutate({ id, action }) },
                { text: 'Annuler', style: 'cancel' },
            ])
        } else {
            actionMut.mutate({ id, action })
        }
    }

    const orders  = tab === 'buyer' ? buyerOrders : sellerOrders
    const isLoading = tab === 'buyer' ? lb : ls
    const refetch = tab === 'buyer' ? rb : rs
    const isRefetching = tab === 'buyer' ? rib : ris

    return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={styles.header}>
                <Text style={styles.title}>Mes commandes</Text>
                <View style={styles.tabs}>
                    {[{ v: 'buyer', l: '🛍️ Achats' }, { v: 'seller', l: '🏪 Ventes' }].map(t => (
                        <TouchableOpacity key={t.v} onPress={() => setTab(t.v)}
                            style={[styles.tab, tab === t.v && styles.tabActive]}>
                            <Text style={[styles.tabText, tab === t.v && styles.tabTextActive]}>{t.l}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {isLoading ? (
                <ActivityIndicator style={{ flex: 1 }} color={colors.primary} size="large" />
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={i => i.id}
                    renderItem={({ item }) => <OrderCard order={item} onAction={handleAction} />}
                    contentContainerStyle={{ padding: spacing.lg }}
                    refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyIcon}>📦</Text>
                            <Text style={styles.emptyText}>Aucune commande pour l'instant</Text>
                        </View>
                    }
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    header:          { backgroundColor: colors.white, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    title:           { fontSize: font.xl, fontWeight: font.bold, color: colors.text, marginBottom: spacing.md },
    tabs:            { flexDirection: 'row', gap: spacing.sm },
    tab:             { flex: 1, padding: spacing.sm, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
    tabActive:       { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText:         { fontSize: font.sm, color: colors.textMuted, fontWeight: font.semi },
    tabTextActive:   { color: '#fff' },
    card:            { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
    cardHeader:      { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
    listingTitle:    { fontSize: font.base, fontWeight: font.semi, color: colors.text },
    statusBadge:     { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
    statusText:      { fontSize: font.sm, fontWeight: font.semi },
    amountRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: spacing.sm },
    amountLabel:     { fontSize: font.sm, color: colors.textMuted },
    amount:          { fontSize: font.md, fontWeight: font.bold, color: colors.primary },
    orderDate:       { fontSize: font.sm, color: colors.textMuted, marginBottom: 4 },
    orderMeta:       { fontSize: font.sm, color: colors.textMuted },
    actions:         { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    btnPrimary:      { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
    btnPrimaryText:  { color: '#fff', fontWeight: font.semi, fontSize: font.sm },
    btnDanger:       { flex: 1, backgroundColor: '#fee2e2', borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
    btnDangerText:   { color: colors.danger, fontWeight: font.semi, fontSize: font.sm },
    btnAccent:       { flex: 1, backgroundColor: '#fef3c7', borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
    btnAccentText:   { color: '#92400e', fontWeight: font.semi, fontSize: font.sm },
    empty:           { alignItems: 'center', marginTop: spacing.xxl * 2 },
    emptyIcon:       { fontSize: 48, marginBottom: spacing.md },
    emptyText:       { fontSize: font.base, color: colors.textMuted },
})
