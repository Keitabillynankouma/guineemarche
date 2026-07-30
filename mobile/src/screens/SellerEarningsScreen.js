import React, { useState } from 'react'
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    StyleSheet, ActivityIndicator, Alert, RefreshControl, Modal,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { colors, spacing, radius, font } from '../theme'

const PAYOUT_STATUS = {
    pending:    { label: 'En attente',  color: '#f59e0b', bg: '#fef3c7' },
    processing: { label: 'En cours',    color: '#2563eb', bg: '#dbeafe' },
    completed:  { label: 'Versé',       color: '#16a34a', bg: '#dcfce7' },
    failed:     { label: 'Échec',       color: '#ef4444', bg: '#fee2e2' },
}

const PROVIDERS = [
    { v: 'orange_money', l: '🟠 Orange Money' },
    { v: 'mtn_momo',     l: '🟡 MTN MoMo' },
]

const fmt = n => new Intl.NumberFormat('fr-GN').format(n || 0) + ' GNF'

function PayoutInfoModal({ visible, onClose, user }) {
    const qc = useQueryClient()
    const [phone, setPhone] = useState(user?.payout_phone || '')
    const [provider, setProvider] = useState(user?.payout_provider || 'orange_money')

    const saveMut = useMutation({
        mutationFn: () => ordersAPI.updatePayoutInfo({ payout_phone: phone, payout_provider: provider }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['me'] })
            Alert.alert('✅ Enregistré', 'Votre compte de paiement a été mis à jour.')
            onClose()
        },
        onError: (e) => Alert.alert('Erreur', e.response?.data?.detail || 'Enregistrement échoué.'),
    })

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.modal}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>💰 Compte de réception</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Text style={{ fontSize: 22, color: colors.textMuted }}>✕</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.modalDesc}>
                    Configurez le numéro Mobile Money sur lequel vous souhaitez recevoir vos paiements.
                </Text>

                <Text style={styles.label}>Opérateur</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                    {PROVIDERS.map(p => (
                        <TouchableOpacity
                            key={p.v}
                            onPress={() => setProvider(p.v)}
                            style={[styles.pill, provider === p.v && styles.pillActive, { flex: 1, justifyContent: 'center' }]}
                        >
                            <Text style={[styles.pillText, provider === p.v && styles.pillTextActive]}>{p.l}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.label}>Numéro Mobile Money</Text>
                <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+224 6XX XX XX XX"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                />

                <TouchableOpacity
                    style={[styles.btn, saveMut.isPending && styles.btnDisabled]}
                    onPress={() => saveMut.mutate()}
                    disabled={saveMut.isPending || !phone}
                    activeOpacity={0.85}
                >
                    {saveMut.isPending
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.btnText}>Enregistrer</Text>
                    }
                </TouchableOpacity>
            </View>
        </Modal>
    )
}

export default function SellerEarningsScreen({ navigation }) {
    const { user } = useAuthStore()
    const [showModal, setShowModal] = useState(false)

    const { data, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['seller-earnings'],
        queryFn:  () => ordersAPI.sellerEarnings().then(r => r.data),
    })

    const summary  = data?.summary  || {}
    const payouts  = data?.payouts  || []

    return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Mes gains</Text>
                <TouchableOpacity onPress={() => setShowModal(true)} style={styles.settingsBtn}>
                    <Text style={{ fontSize: 20 }}>⚙️</Text>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <ActivityIndicator style={{ flex: 1 }} color={colors.primary} size="large" />
            ) : (
                <ScrollView
                    contentContainerStyle={{ padding: spacing.lg }}
                    refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
                >
                    {/* Avertissement si pas de compte configuré */}
                    {!user?.payout_phone && (
                        <TouchableOpacity onPress={() => setShowModal(true)} style={styles.warningBanner}>
                            <Text style={styles.warningText}>
                                ⚠️ Aucun compte de paiement configuré. Appuyez ici pour en ajouter un.
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Cartes résumé */}
                    <View style={styles.summaryRow}>
                        <View style={[styles.summaryCard, { borderTopColor: colors.primary }]}>
                            <Text style={styles.summaryValue}>{fmt(summary.total_versé)}</Text>
                            <Text style={styles.summaryLabel}>Versé</Text>
                        </View>
                        <View style={[styles.summaryCard, { borderTopColor: colors.accent }]}>
                            <Text style={[styles.summaryValue, { color: '#92400e' }]}>{fmt(summary.total_en_attente)}</Text>
                            <Text style={styles.summaryLabel}>En attente</Text>
                        </View>
                    </View>
                    <View style={styles.summaryCardWide}>
                        <Text style={styles.summaryValue}>{fmt(summary.total_ventes)}</Text>
                        <Text style={styles.summaryLabel}>Ventes totales (brut)</Text>
                    </View>

                    {/* Compte configuré */}
                    {user?.payout_phone && (
                        <View style={styles.accountCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.accountLabel}>Compte de réception</Text>
                                <Text style={styles.accountPhone}>
                                    {user.payout_provider === 'orange_money' ? '🟠' : '🟡'} {user.payout_phone}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowModal(true)} style={styles.editBtn}>
                                <Text style={styles.editBtnText}>Modifier</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Liste des versements */}
                    <Text style={styles.sectionTitle}>Historique des versements</Text>

                    {payouts.length === 0 ? (
                        <View style={styles.empty}>
                            <Text style={styles.emptyIcon}>💸</Text>
                            <Text style={styles.emptyText}>Aucun versement pour l'instant</Text>
                        </View>
                    ) : (
                        payouts.map(p => {
                            const st = PAYOUT_STATUS[p.status] || PAYOUT_STATUS.pending
                            return (
                                <View key={p.id} style={styles.payoutCard}>
                                    <View style={styles.payoutHeader}>
                                        <Text style={styles.payoutAmount}>{fmt(p.amount_gnf)}</Text>
                                        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                                            <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.payoutMeta}>
                                        📅 {new Date(p.created_at).toLocaleDateString('fr-FR')}
                                    </Text>
                                    {p.payout_phone && (
                                        <Text style={styles.payoutMeta}>📱 {p.payout_phone}</Text>
                                    )}
                                    {p.processed_at && (
                                        <Text style={styles.payoutMeta}>
                                            ✅ Versé le {new Date(p.processed_at).toLocaleDateString('fr-FR')}
                                        </Text>
                                    )}
                                </View>
                            )
                        })
                    )}
                </ScrollView>
            )}

            <PayoutInfoModal visible={showModal} onClose={() => setShowModal(false)} user={user} />
        </View>
    )
}

const styles = StyleSheet.create({
    header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn:          { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    backIcon:         { fontSize: 28, color: colors.text, fontWeight: '300' },
    headerTitle:      { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    settingsBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    warningBanner:    { backgroundColor: '#fff7ed', borderRadius: radius.md, borderWidth: 1, borderColor: '#fed7aa', padding: spacing.md, marginBottom: spacing.md },
    warningText:      { fontSize: font.sm, color: '#92400e', lineHeight: 18 },
    summaryRow:       { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
    summaryCard:      { flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, borderTopWidth: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    summaryCardWide:  { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, borderTopWidth: 3, borderTopColor: '#8b5cf6', marginBottom: spacing.md, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    summaryValue:     { fontSize: font.md, fontWeight: font.bold, color: colors.text, marginBottom: 4 },
    summaryLabel:     { fontSize: font.sm, color: colors.textMuted },
    accountCard:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    accountLabel:     { fontSize: font.sm, color: colors.textMuted, marginBottom: 4 },
    accountPhone:     { fontSize: font.base, fontWeight: font.semi, color: colors.text },
    editBtn:          { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 6 },
    editBtnText:      { color: colors.primary, fontSize: font.sm, fontWeight: font.semi },
    sectionTitle:     { fontSize: font.base, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm },
    payoutCard:       { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 2 },
    payoutHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    payoutAmount:     { fontSize: font.md, fontWeight: font.bold, color: colors.text },
    statusBadge:      { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
    statusText:       { fontSize: font.sm, fontWeight: font.semi },
    payoutMeta:       { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
    empty:            { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
    emptyIcon:        { fontSize: 40, marginBottom: spacing.md },
    emptyText:        { fontSize: font.base, color: colors.textMuted },
    // Modal
    modal:            { flex: 1, padding: spacing.xl, backgroundColor: colors.bg },
    modalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    modalTitle:       { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    modalDesc:        { fontSize: font.sm, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.lg },
    label:            { fontSize: font.sm, fontWeight: font.semi, color: colors.textMuted, marginBottom: 6 },
    input:            { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, fontSize: font.base, color: colors.text, backgroundColor: colors.white },
    pill:             { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
    pillActive:       { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    pillText:         { fontSize: font.sm, color: colors.textMuted },
    pillTextActive:   { color: colors.primary, fontWeight: font.semi },
    btn:              { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
    btnDisabled:      { opacity: 0.6 },
    btnText:          { color: '#fff', fontWeight: font.bold, fontSize: font.base },
})
