import React, { useState, useEffect, useRef } from 'react'
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    StyleSheet, ActivityIndicator, Alert, Modal, RefreshControl, Switch,
} from 'react-native'
import * as Location from 'expo-location'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersAPI, authAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { colors, spacing, radius, font } from '../theme'

const PROVIDERS = [
    { v: 'orange_money', l: '🟠 Orange Money' },
    { v: 'mtn_momo',     l: '🟡 MTN MoMo' },
]

const fmt = n => new Intl.NumberFormat('fr-GN').format(n || 0) + ' GNF'

// ── Modal configuration compte de paiement ─────────────────────────────────
function PayoutModal({ visible, onClose, user }) {
    const qc = useQueryClient()
    const [phone, setPhone] = useState(user?.payout_phone || '')
    const [provider, setProvider] = useState(user?.payout_provider || 'orange_money')

    useEffect(() => {
        if (visible) {
            setPhone(user?.payout_phone || '')
            setProvider(user?.payout_provider || 'orange_money')
        }
    }, [visible, user])

    const saveMut = useMutation({
        mutationFn: () => ordersAPI.updateLivreurPayoutInfo({ payout_phone: phone, payout_provider: provider }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['me'] })
            Alert.alert('✅ Enregistré', 'Compte de paiement mis à jour.')
            onClose()
        },
        onError: (e) => Alert.alert('Erreur', e.response?.data?.detail || 'Enregistrement échoué.'),
    })

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.modal}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>💰 Compte de paiement</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Text style={{ fontSize: 22, color: colors.textMuted }}>✕</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.modalDesc}>
                    Configurez le numéro Mobile Money pour recevoir vos paiements hebdomadaires.
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
                    style={[styles.btn, (saveMut.isPending || !phone) && styles.btnDisabled]}
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

// ── Modal saisie code de vérification ──────────────────────────────────────
function VerifyCodeModal({ visible, onClose, onConfirm }) {
    const [code, setCode] = useState('')
    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.codeModal}>
                    <Text style={styles.modalTitle}>Code de vérification</Text>
                    <Text style={styles.modalDesc}>Demandez le code à l'acheteur pour confirmer la livraison.</Text>
                    <TextInput
                        style={[styles.input, { textAlign: 'center', fontSize: font.xl, letterSpacing: 8 }]}
                        value={code}
                        onChangeText={setCode}
                        placeholder="XXXXXX"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                        maxLength={6}
                    />
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <TouchableOpacity onPress={onClose} style={[styles.btn, { flex: 1, backgroundColor: colors.border }]}>
                            <Text style={[styles.btnText, { color: colors.text }]}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { onConfirm(code); setCode('') }} style={[styles.btn, { flex: 1 }]} disabled={code.length < 4}>
                            <Text style={styles.btnText}>Confirmer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    )
}

// ── Carte d'une mission ─────────────────────────────────────────────────────
function AssignmentCard({ assignment, onStart, onConfirm }) {
    const st = assignment.status
    const statusColor = {
        assigned:    { color: '#2563eb', bg: '#dbeafe', label: 'Assigné' },
        in_progress: { color: '#f59e0b', bg: '#fef3c7', label: 'En cours' },
        delivered:   { color: '#16a34a', bg: '#dcfce7', label: 'Livré' },
    }[st] || { color: colors.textMuted, bg: colors.border, label: st }

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                        {assignment.order?.listing?.title || 'Commande'}
                    </Text>
                    <Text style={styles.cardMeta}>🛍️ {assignment.order?.buyer?.full_name}</Text>
                    <Text style={styles.cardMeta}>📍 {assignment.order?.delivery_address || assignment.order?.buyer?.city}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                    <Text style={[styles.statusText, { color: statusColor.color }]}>{statusColor.label}</Text>
                </View>
            </View>

            <View style={styles.amountRow}>
                <Text style={styles.feeLabel}>Votre rémunération</Text>
                <Text style={styles.feeAmount}>{fmt(assignment.delivery_fee_gnf)}</Text>
            </View>

            {st === 'assigned' && (
                <TouchableOpacity onPress={() => onStart(assignment.id)} style={styles.btnPrimary}>
                    <Text style={styles.btnPrimaryText}>🚀 Démarrer la livraison</Text>
                </TouchableOpacity>
            )}
            {st === 'in_progress' && (
                <TouchableOpacity onPress={() => onConfirm(assignment.id)} style={[styles.btnPrimary, { backgroundColor: '#16a34a' }]}>
                    <Text style={styles.btnPrimaryText}>✅ Confirmer livraison</Text>
                </TouchableOpacity>
            )}
        </View>
    )
}

// ── Écran principal ─────────────────────────────────────────────────────────
export default function LivreurDashboardScreen({ navigation }) {
    const { user, fetchMe } = useAuthStore()
    const qc = useQueryClient()

    const [showPayoutModal, setShowPayoutModal] = useState(false)
    const [showCodeModal, setShowCodeModal] = useState(false)
    const [activeAssignmentId, setActiveAssignmentId] = useState(null)
    const [isAvailable, setIsAvailable] = useState(user?.is_available ?? false)
    const locationInterval = useRef(null)

    // Fetch assignments
    const { data: assignments = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['livreur-assignments'],
        queryFn:  () => ordersAPI.myAssignments().then(r => r.data),
        refetchInterval: 30_000,
    })

    // GPS — envoyer la position toutes les 30s si une livraison est en cours
    useEffect(() => {
        const inProgress = assignments.find(a => a.status === 'in_progress')
        if (inProgress) {
            startTracking(inProgress.id)
        } else {
            stopTracking()
        }
        return () => stopTracking()
    }, [assignments])

    const startTracking = async (assignmentId) => {
        if (locationInterval.current) return
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') return

        locationInterval.current = setInterval(async () => {
            try {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
                await ordersAPI.updatePosition(assignmentId, loc.coords.latitude, loc.coords.longitude)
            } catch (_) {}
        }, 30_000)
    }

    const stopTracking = () => {
        if (locationInterval.current) {
            clearInterval(locationInterval.current)
            locationInterval.current = null
        }
    }

    // Disponibilité
    const toggleMut = useMutation({
        mutationFn: () => authAPI.toggleAvailability(),
        onSuccess: (res) => {
            const newVal = res.data?.is_available ?? !isAvailable
            setIsAvailable(newVal)
            fetchMe()
        },
        onError: () => Alert.alert('Erreur', 'Impossible de changer votre statut.'),
    })

    // Démarrer livraison
    const startMut = useMutation({
        mutationFn: (id) => ordersAPI.startDelivery(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['livreur-assignments'] }),
        onError: (e) => Alert.alert('Erreur', e.response?.data?.error || 'Impossible de démarrer.'),
    })

    // Confirmer livraison (avec code)
    const confirmMut = useMutation({
        mutationFn: ({ id, code }) => ordersAPI.confirmDelivery(id, code),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['livreur-assignments'] })
            Alert.alert('🎉 Livraison confirmée !', 'Votre rémunération sera créditée lors du prochain versement.')
        },
        onError: (e) => Alert.alert('Code invalide', e.response?.data?.error || 'Code incorrect.'),
    })

    const handleStart = (id) => {
        Alert.alert('Démarrer la livraison', 'Confirmez-vous le début de cette livraison ?', [
            { text: 'Oui', onPress: () => startMut.mutate(id) },
            { text: 'Annuler', style: 'cancel' },
        ])
    }

    const handleConfirm = (id) => {
        setActiveAssignmentId(id)
        setShowCodeModal(true)
    }

    const handleCodeSubmit = (code) => {
        setShowCodeModal(false)
        if (activeAssignmentId) confirmMut.mutate({ id: activeAssignmentId, code })
    }

    const pending     = assignments.filter(a => a.status === 'assigned')
    const inProgress  = assignments.filter(a => a.status === 'in_progress')
    const completed   = assignments.filter(a => a.status === 'delivered')

    return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Tableau de bord livreur</Text>
                <TouchableOpacity onPress={() => setShowPayoutModal(true)}>
                    <Text style={{ fontSize: 20 }}>💰</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={{ padding: spacing.lg }}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
            >
                {/* Statut disponibilité */}
                <View style={styles.availCard}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.availTitle}>
                            {isAvailable ? '🟢 Disponible' : '🔴 Indisponible'}
                        </Text>
                        <Text style={styles.availDesc}>
                            {isAvailable ? 'Vous pouvez recevoir des missions.' : 'Vous ne recevez pas de missions pour l\'instant.'}
                        </Text>
                    </View>
                    <Switch
                        value={isAvailable}
                        onValueChange={() => toggleMut.mutate()}
                        trackColor={{ false: '#d1d5db', true: colors.primaryLight }}
                        thumbColor={isAvailable ? colors.primary : '#9ca3af'}
                        disabled={toggleMut.isPending}
                    />
                </View>

                {/* Compte paiement */}
                {!user?.payout_phone ? (
                    <TouchableOpacity onPress={() => setShowPayoutModal(true)} style={styles.warningBanner}>
                        <Text style={styles.warningText}>
                            ⚠️ Configurez votre compte Mobile Money pour recevoir vos paiements automatiquement.
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.payoutInfoCard}>
                        <Text style={styles.payoutInfoLabel}>Compte de paiement</Text>
                        <Text style={styles.payoutInfoPhone}>
                            {user.payout_provider === 'orange_money' ? '🟠' : '🟡'} {user.payout_phone}
                        </Text>
                        <TouchableOpacity onPress={() => setShowPayoutModal(true)}>
                            <Text style={styles.editLink}>Modifier</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {isLoading ? (
                    <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
                ) : (
                    <>
                        {/* En cours */}
                        {inProgress.length > 0 && (
                            <>
                                <Text style={styles.sectionTitle}>🚚 En cours ({inProgress.length})</Text>
                                {inProgress.map(a => (
                                    <AssignmentCard key={a.id} assignment={a} onStart={handleStart} onConfirm={handleConfirm} />
                                ))}
                            </>
                        )}

                        {/* À faire */}
                        {pending.length > 0 && (
                            <>
                                <Text style={styles.sectionTitle}>📋 À faire ({pending.length})</Text>
                                {pending.map(a => (
                                    <AssignmentCard key={a.id} assignment={a} onStart={handleStart} onConfirm={handleConfirm} />
                                ))}
                            </>
                        )}

                        {/* Terminées */}
                        {completed.length > 0 && (
                            <>
                                <Text style={styles.sectionTitle}>✅ Terminées ({completed.length})</Text>
                                {completed.map(a => (
                                    <AssignmentCard key={a.id} assignment={a} onStart={handleStart} onConfirm={handleConfirm} />
                                ))}
                            </>
                        )}

                        {assignments.length === 0 && (
                            <View style={styles.empty}>
                                <Text style={styles.emptyIcon}>🚴</Text>
                                <Text style={styles.emptyText}>Aucune mission pour l'instant</Text>
                                <Text style={styles.emptyDesc}>
                                    {isAvailable
                                        ? 'Restez disponible, les nouvelles missions apparaîtront ici.'
                                        : 'Activez votre disponibilité pour recevoir des missions.'}
                                </Text>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>

            <PayoutModal visible={showPayoutModal} onClose={() => setShowPayoutModal(false)} user={user} />
            <VerifyCodeModal visible={showCodeModal} onClose={() => setShowCodeModal(false)} onConfirm={handleCodeSubmit} />
        </View>
    )
}

const styles = StyleSheet.create({
    header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn:          { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    backIcon:         { fontSize: 28, color: colors.text, fontWeight: '300' },
    headerTitle:      { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    availCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
    availTitle:       { fontSize: font.base, fontWeight: font.bold, color: colors.text, marginBottom: 2 },
    availDesc:        { fontSize: font.sm, color: colors.textMuted },
    warningBanner:    { backgroundColor: '#fff7ed', borderRadius: radius.md, borderWidth: 1, borderColor: '#fed7aa', padding: spacing.md, marginBottom: spacing.md },
    warningText:      { fontSize: font.sm, color: '#92400e', lineHeight: 18 },
    payoutInfoCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f9ff', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, gap: spacing.md },
    payoutInfoLabel:  { fontSize: font.sm, color: '#0369a1', marginBottom: 2 },
    payoutInfoPhone:  { fontSize: font.base, fontWeight: font.semi, color: '#0c4a6e', flex: 1 },
    editLink:         { color: colors.primary, fontSize: font.sm, fontWeight: font.semi },
    sectionTitle:     { fontSize: font.base, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm },
    card:             { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
    cardHeader:       { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
    cardTitle:        { fontSize: font.base, fontWeight: font.semi, color: colors.text, marginBottom: 4 },
    cardMeta:         { fontSize: font.sm, color: colors.textMuted, marginBottom: 2 },
    statusBadge:      { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
    statusText:       { fontSize: font.sm, fontWeight: font.semi },
    amountRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
    feeLabel:         { fontSize: font.sm, color: colors.textMuted },
    feeAmount:        { fontSize: font.md, fontWeight: font.bold, color: colors.primary },
    btnPrimary:       { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm + 2, alignItems: 'center', marginTop: spacing.sm },
    btnPrimaryText:   { color: '#fff', fontWeight: font.semi, fontSize: font.sm },
    empty:            { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
    emptyIcon:        { fontSize: 48, marginBottom: spacing.md },
    emptyText:        { fontSize: font.base, fontWeight: font.semi, color: colors.text, marginBottom: spacing.sm },
    emptyDesc:        { fontSize: font.sm, color: colors.textMuted, textAlign: 'center' },
    // Modal paiement
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
    // Modal code
    overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    codeModal:        { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, margin: spacing.lg },
})
