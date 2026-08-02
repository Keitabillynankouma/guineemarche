import React, { useState } from 'react'
import {
    View, Text, Image, ScrollView, TouchableOpacity,
    StyleSheet, Alert, ActivityIndicator,
    Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listingsAPI, ordersAPI, favoritesAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { colors, spacing, radius, font } from '../theme'

const { width: SCREEN_W } = Dimensions.get('window')

const DELIVERY_MODES = [
    { v: 'meeting_point',  l: '🤝 Main propre',         sub: 'Rencontre physique' },
    { v: 'pickup_point',   l: '🏪 Point de retrait',    sub: 'Dans notre réseau' },
    { v: 'home_delivery',  l: '🚗 Livraison domicile',  sub: 'Livraison chez vous' },
]

const PAYMENT_METHODS = [
    { v: 'chachap', l: '📱 Mobile Money', sub: 'Orange · MTN MoMo · PayCard', badge: '🔒 Paiement sécurisé escrow', color: colors.primary },
    { v: 'cash',    l: '💵 En espèces',   sub: 'Paiement à la remise',        badge: '⚠️ Sans protection escrow',  color: '#d97706' },
]

// ── Modal commande ────────────────────────────────────────────────────────────
function OrderModal({ listing, visible, onClose, onOrder }) {
    const isNegotiable = listing.price_type === 'negotiable'
    const [deliveryMode, setDeliveryMode]   = useState('meeting_point')
    const [paymentMethod, setPaymentMethod] = useState('chachap')
    const [meetLocation, setMeetLocation]   = useState('')
    const [deliveryAddress, setDeliveryAddress] = useState('')
    const [negotiatedPrice, setNegotiatedPrice] = useState(String(listing.price_gnf))
    const [loading, setLoading] = useState(false)

    const fmt = n => new Intl.NumberFormat('fr-GN').format(n) + ' GNF'

    const handleConfirm = async () => {
        if (deliveryMode === 'meeting_point' && !meetLocation.trim()) {
            Alert.alert('Erreur', 'Précisez le lieu de rencontre.'); return
        }
        if (deliveryMode === 'home_delivery' && !deliveryAddress.trim()) {
            Alert.alert('Erreur', 'Précisez votre adresse de livraison.'); return
        }
        if (isNegotiable) {
            const p = parseInt(negotiatedPrice)
            if (!p || p <= 0) { Alert.alert('Erreur', 'Entrez un prix négocié valide.'); return }
        }
        setLoading(true)
        try {
            await onOrder({
                deliveryMode,
                paymentMethod,
                meetLocation: deliveryMode === 'meeting_point' ? meetLocation : '',
                deliveryAddress: deliveryMode === 'home_delivery' ? deliveryAddress : '',
                negotiatedPrice: isNegotiable ? parseInt(negotiatedPrice) : undefined,
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={modal.overlay}>
                    <View style={modal.sheet}>
                        <View style={modal.drag} />
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <Text style={modal.title}>Passer commande</Text>
                            <Text style={modal.listingTitle} numberOfLines={2}>{listing.title}</Text>
                            <Text style={modal.price}>{fmt(isNegotiable ? parseInt(negotiatedPrice) || listing.price_gnf : listing.price_gnf)}</Text>

                            {/* Prix négocié */}
                            {isNegotiable && (
                                <View style={modal.field}>
                                    <Text style={modal.label}>Prix négocié (GNF)</Text>
                                    <TextInput
                                        style={modal.input}
                                        value={negotiatedPrice}
                                        onChangeText={setNegotiatedPrice}
                                        keyboardType="numeric"
                                        placeholder="Entrez votre offre"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>
                            )}

                            {/* Mode de livraison */}
                            <Text style={modal.sectionTitle}>Mode de livraison</Text>
                            {DELIVERY_MODES.map(d => (
                                <TouchableOpacity key={d.v} onPress={() => setDeliveryMode(d.v)}
                                    style={[modal.optionCard, deliveryMode === d.v && modal.optionCardActive]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={modal.optionLabel}>{d.l}</Text>
                                        <Text style={modal.optionSub}>{d.sub}</Text>
                                    </View>
                                    {deliveryMode === d.v && <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text>}
                                </TouchableOpacity>
                            ))}

                            {deliveryMode === 'meeting_point' && (
                                <View style={modal.field}>
                                    <Text style={modal.label}>Lieu de rencontre</Text>
                                    <TextInput style={modal.input} value={meetLocation} onChangeText={setMeetLocation}
                                        placeholder="Ex : Marché Madina, face à la banque" placeholderTextColor={colors.textMuted} />
                                </View>
                            )}
                            {deliveryMode === 'home_delivery' && (
                                <View style={modal.field}>
                                    <Text style={modal.label}>Adresse de livraison</Text>
                                    <TextInput style={[modal.input, { minHeight: 72, textAlignVertical: 'top' }]}
                                        value={deliveryAddress} onChangeText={setDeliveryAddress} multiline
                                        placeholder="Quartier, rue, repère…" placeholderTextColor={colors.textMuted} />
                                </View>
                            )}

                            {/* Mode de paiement */}
                            <Text style={modal.sectionTitle}>Mode de paiement</Text>
                            {PAYMENT_METHODS.map(p => (
                                <TouchableOpacity key={p.v} onPress={() => setPaymentMethod(p.v)}
                                    style={[modal.optionCard, paymentMethod === p.v && modal.optionCardActive]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={modal.optionLabel}>{p.l}</Text>
                                        <Text style={modal.optionSub}>{p.sub}</Text>
                                        <Text style={[modal.optionBadge, { color: p.color }]}>{p.badge}</Text>
                                    </View>
                                    {paymentMethod === p.v && <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text>}
                                </TouchableOpacity>
                            ))}

                            <TouchableOpacity
                                style={[modal.btn, loading && { opacity: 0.6 }]}
                                onPress={handleConfirm} disabled={loading}
                            >
                                {loading
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={modal.btnText}>
                                        {paymentMethod === 'cash' ? '✅ Confirmer la commande' : `💳 Payer ${fmt(isNegotiable ? parseInt(negotiatedPrice) || listing.price_gnf : listing.price_gnf)}`}
                                    </Text>
                                }
                            </TouchableOpacity>

                            <TouchableOpacity onPress={onClose} style={{ alignItems: 'center', padding: spacing.md }}>
                                <Text style={{ color: colors.textMuted, fontSize: font.sm }}>Annuler</Text>
                            </TouchableOpacity>
                            <View style={{ height: spacing.xl }} />
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    )
}

const modal = StyleSheet.create({
    overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet:           { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '92%' },
    drag:            { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
    title:           { fontSize: font.xl, fontWeight: font.bold, color: colors.text, marginBottom: 4 },
    listingTitle:    { fontSize: font.base, color: colors.textMuted, marginBottom: 4 },
    price:           { fontSize: font.lg, fontWeight: font.bold, color: colors.primary, marginBottom: spacing.lg },
    sectionTitle:    { fontSize: font.sm, fontWeight: font.bold, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
    field:           { marginTop: spacing.sm },
    label:           { fontSize: font.sm, color: colors.textMuted, marginBottom: 4 },
    input:           { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: font.base, color: colors.text, backgroundColor: colors.bg },
    optionCard:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
    optionCardActive:{ borderColor: colors.primary, backgroundColor: colors.primaryLight },
    optionLabel:     { fontSize: font.base, fontWeight: font.semi, color: colors.text },
    optionSub:       { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
    optionBadge:     { fontSize: 11, marginTop: 3 },
    btn:             { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md + 2, alignItems: 'center', marginTop: spacing.lg },
    btnText:         { color: '#fff', fontWeight: font.bold, fontSize: font.base },
})

// ── Écran principal ───────────────────────────────────────────────────────────
export default function ListingDetailScreen({ route, navigation }) {
    const { id } = route.params
    const { user, isAuthenticated } = useAuthStore()
    const qc = useQueryClient()
    const [imgIdx, setImgIdx]       = useState(0)
    const [showModal, setShowModal] = useState(false)
    const [isFav, setIsFav]         = useState(false)

    const { data: listing, isLoading } = useQuery({
        queryKey: ['listing', id],
        queryFn: () => listingsAPI.detail(id).then(r => {
            const d = r.data
            setIsFav(d.is_favorited ?? false)
            return d
        }),
    })

    const favMut = useMutation({
        mutationFn: () => favoritesAPI.toggle(id),
        onSuccess:  () => {
            setIsFav(p => !p)
            qc.invalidateQueries({ queryKey: ['favorites'] })
        },
    })

    const orderMut = useMutation({
        mutationFn: async ({ deliveryMode, paymentMethod, meetLocation, deliveryAddress, negotiatedPrice }) => {
            const payload = {
                listing: id,
                delivery_mode:    deliveryMode,
                meet_location:    meetLocation || '',
                delivery_address: deliveryAddress || '',
            }
            if (negotiatedPrice) payload.negotiated_price = negotiatedPrice
            const order = await ordersAPI.create(payload)
            const orderId = order.data?.id
            if (!orderId) throw new Error('Commande non créée.')

            if (paymentMethod === 'cash') {
                await ordersAPI.pay(orderId, { provider: 'cash' })
                return { cash: true }
            }
            return { orderId }
        },
        onSuccess: (res) => {
            setShowModal(false)
            qc.invalidateQueries({ queryKey: ['orders-buyer'] })
            if (res.cash) {
                Alert.alert('✅ Commande confirmée !', 'Votre commande est enregistrée. Le paiement se fera à la remise.', [
                    { text: 'Voir mes commandes', onPress: () => navigation.navigate('Orders') },
                ])
            } else {
                navigation.navigate('Payment', { orderId: res.orderId })
            }
        },
        onError: (e) => {
            Alert.alert('Erreur', e.response?.data?.detail || e.response?.data?.error || e.message || 'Impossible de créer la commande.')
        },
    })

    const handleOrder = (params) => orderMut.mutateAsync(params)

    const handleMessage = () => {
        if (!isAuthenticated) { navigation.navigate('Auth'); return }
        navigation.navigate('Messages', { userId: listing?.seller?.id, name: listing?.seller?.full_name })
    }

    const handleFav = () => {
        if (!isAuthenticated) { navigation.navigate('Auth'); return }
        favMut.mutate()
    }

    if (isLoading) return (
        <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>
    )
    if (!listing) return null

    const media  = listing.media || listing.images || []
    const fmt    = n => new Intl.NumberFormat('fr-GN').format(n) + ' GNF'
    const isMine = user?.id === listing.seller?.id

    const CONDITION_LABEL = {
        new: '🆕 Neuf', like_new: '✨ Comme neuf', good: '👍 Bon état',
        fair: '⚠️ État correct', for_parts: '🔧 Pour pièces',
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Images */}
                <View style={styles.imgContainer}>
                    {media.length > 0 ? (
                        <>
                            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                                onMomentumScrollEnd={e => setImgIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}>
                                {media.map((img, i) => (
                                    <Image key={i} source={{ uri: img.file || img.image_url }} style={styles.img} resizeMode="cover" />
                                ))}
                            </ScrollView>
                            {media.length > 1 && (
                                <View style={styles.dots}>
                                    {media.map((_, i) => (
                                        <View key={i} style={[styles.dot, i === imgIdx && styles.dotActive]} />
                                    ))}
                                </View>
                            )}
                        </>
                    ) : (
                        <View style={[styles.img, styles.noImg]}><Text style={{ fontSize: 48 }}>📷</Text></View>
                    )}
                    {listing.is_boosted && (
                        <View style={styles.boostBadge}><Text style={styles.boostText}>⚡ Annonce boostée</Text></View>
                    )}
                    {/* Bouton favori */}
                    {!isMine && (
                        <TouchableOpacity onPress={handleFav} style={styles.favBtn}>
                            <Text style={styles.favIcon}>{isFav ? '❤️' : '🤍'}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.body}>
                    {/* Prix & titre */}
                    <View style={styles.priceRow}>
                        <Text style={styles.price}>
                            {listing.price_type === 'negotiable' ? `À partir de ${fmt(listing.price_gnf)}` : fmt(listing.price_gnf)}
                        </Text>
                        {listing.price_type === 'negotiable' && (
                            <View style={styles.negoBadge}><Text style={styles.negoText}>Prix négociable</Text></View>
                        )}
                    </View>
                    <Text style={styles.listingTitle}>{listing.title}</Text>

                    <View style={styles.metaRow}>
                        <Text style={styles.meta}>📍 {listing.city}{listing.quartier ? ` · ${listing.quartier}` : ''}</Text>
                        {listing.condition && <Text style={styles.meta}>{CONDITION_LABEL[listing.condition] || listing.condition}</Text>}
                        <Text style={styles.meta}>👁 {listing.view_count || 0} vues</Text>
                    </View>

                    {/* Description */}
                    {listing.description ? (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Description</Text>
                            <Text style={styles.desc}>{listing.description}</Text>
                        </View>
                    ) : null}

                    {/* Vendeur */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Vendeur</Text>
                        <TouchableOpacity
                            style={styles.sellerRow}
                            onPress={() => navigation.navigate('SellerShop', { sellerId: listing.seller?.id })}
                            activeOpacity={0.75}
                        >
                            <View style={styles.avatar}><Text style={{ fontSize: 22 }}>👤</Text></View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.sellerName}>{listing.seller?.full_name}</Text>
                                <Text style={styles.sellerMeta}>📍 {listing.seller?.city}</Text>
                                {listing.seller?.profile?.rating_avg > 0 && (
                                    <Text style={styles.sellerMeta}>⭐ {listing.seller.profile.rating_avg?.toFixed(1)} · Voir les avis ›</Text>
                                )}
                            </View>
                            <TouchableOpacity onPress={handleMessage} style={styles.msgBtn}>
                                <Text style={styles.msgBtnText}>💬 Message</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Footer CTA */}
            {!isMine && (
                <View style={styles.footer}>
                    <TouchableOpacity onPress={handleMessage} style={styles.footerSecBtn}>
                        <Text style={styles.footerSecText}>💬</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => {
                            if (!isAuthenticated) { navigation.navigate('Auth'); return }
                            setShowModal(true)
                        }}
                        style={styles.footerBtn}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.footerBtnText}>🛒 Commander</Text>
                    </TouchableOpacity>
                </View>
            )}

            {listing && (
                <OrderModal
                    listing={listing}
                    visible={showModal}
                    onClose={() => setShowModal(false)}
                    onOrder={handleOrder}
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    loading:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
    imgContainer:     { position: 'relative' },
    img:              { width: SCREEN_W, height: 280, backgroundColor: colors.bg },
    noImg:            { alignItems: 'center', justifyContent: 'center' },
    dots:             { flexDirection: 'row', justifyContent: 'center', position: 'absolute', bottom: 12, width: '100%', gap: 6 },
    dot:              { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
    dotActive:        { backgroundColor: '#fff', width: 16 },
    boostBadge:       { position: 'absolute', top: 12, left: 12, backgroundColor: '#f59e0b', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    boostText:        { color: '#fff', fontSize: font.sm, fontWeight: font.bold },
    favBtn:           { position: 'absolute', top: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
    favIcon:          { fontSize: 20 },
    body:             { padding: spacing.lg },
    priceRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
    price:            { fontSize: font.xxl, fontWeight: font.bold, color: colors.primary },
    negoBadge:        { backgroundColor: '#fef3c7', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
    negoText:         { fontSize: 11, color: '#92400e', fontWeight: font.semi },
    listingTitle:     { fontSize: font.xl, fontWeight: font.semi, color: colors.text, marginBottom: spacing.sm },
    metaRow:          { gap: 4, marginBottom: spacing.sm },
    meta:             { fontSize: font.sm, color: colors.textMuted },
    section:          { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
    sectionTitle:     { fontSize: font.base, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm },
    desc:             { fontSize: font.base, color: colors.textMuted, lineHeight: 22 },
    sellerRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    avatar:           { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
    sellerName:       { fontSize: font.base, fontWeight: font.semi, color: colors.text },
    sellerMeta:       { fontSize: font.sm, color: colors.textMuted },
    msgBtn:           { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 6 },
    msgBtnText:       { color: colors.primary, fontSize: font.sm, fontWeight: font.semi },
    footer:           { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
    footerSecBtn:     { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    footerSecText:    { fontSize: 20 },
    footerBtn:        { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', height: 48 },
    footerBtnText:    { color: '#fff', fontWeight: font.bold, fontSize: font.base },
})
