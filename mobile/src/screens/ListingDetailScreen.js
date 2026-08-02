import React, { useState } from 'react'
import {
    View, Text, Image, ScrollView, TouchableOpacity,
    StyleSheet, Linking, Alert, ActivityIndicator,
    Dimensions,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listingsAPI, ordersAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { colors, spacing, radius, font } from '../theme'

const { width: SCREEN_W } = Dimensions.get('window')

export default function ListingDetailScreen({ route, navigation }) {
    const { id } = route.params
    const { user, isAuthenticated } = useAuthStore()
    const qc = useQueryClient()
    const [imgIdx, setImgIdx] = useState(0)
    const [delivery, setDelivery] = useState('pickup')

    const { data: listing, isLoading } = useQuery({
        queryKey: ['listing', id],
        queryFn: () => listingsAPI.detail(id).then(r => r.data),
    })

    const orderMut = useMutation({
        mutationFn: () => ordersAPI.create({ listing: id, delivery_mode: delivery }),
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ['orders'] })
            const orderId = res.data?.id
            if (orderId) {
                // Naviguer vers l'écran de paiement ChaChap Pay
                navigation.navigate('Payment', { orderId })
            } else {
                Alert.alert('✅ Commande créée !', 'Votre commande a été envoyée.', [
                    { text: 'Voir mes commandes', onPress: () => navigation.navigate('Orders') },
                ])
            }
        },
        onError: (e) => {
            Alert.alert('Erreur', e.response?.data?.detail || 'Impossible de créer la commande.')
        },
    })

    const handleOrder = () => {
        if (!isAuthenticated) {
            Alert.alert('Connexion requise', 'Connectez-vous pour passer une commande.', [
                { text: 'Se connecter', onPress: () => navigation.navigate('Auth') },
                { text: 'Annuler', style: 'cancel' },
            ])
            return
        }
        if (listing?.seller?.id === user?.id) {
            Alert.alert('Erreur', 'Vous ne pouvez pas acheter votre propre annonce.')
            return
        }
        const modeLabel = delivery === 'delivery' ? 'Livraison à domicile' : 'Retrait en main propre'
        Alert.alert(
            'Confirmer la commande',
            `${listing.title}\n${modeLabel}\n\nVous serez redirigé vers ChaChap Pay pour le paiement.`,
            [
                { text: 'Confirmer et payer', onPress: () => orderMut.mutate() },
                { text: 'Annuler', style: 'cancel' },
            ]
        )
    }

    const handleMessage = () => {
        if (!isAuthenticated) {
            navigation.navigate('Auth')
            return
        }
        navigation.navigate('Messages', { userId: listing?.seller?.id, name: listing?.seller?.full_name })
    }

    if (isLoading) return (
        <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>
    )
    if (!listing) return null

    const images = listing.images || []
    const fmt    = n => new Intl.NumberFormat('fr-GN').format(n) + ' GNF'
    const isMine = user?.id === listing.seller?.id

    return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Images */}
                <View style={styles.imgContainer}>
                    {images.length > 0 ? (
                        <>
                            <ScrollView
                                horizontal pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onMomentumScrollEnd={e => setImgIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
                            >
                                {images.map((img, i) => (
                                    <Image key={i} source={{ uri: img.image_url }} style={styles.img} resizeMode="cover" />
                                ))}
                            </ScrollView>
                            {images.length > 1 && (
                                <View style={styles.dots}>
                                    {images.map((_, i) => (
                                        <View key={i} style={[styles.dot, i === imgIdx && styles.dotActive]} />
                                    ))}
                                </View>
                            )}
                        </>
                    ) : (
                        <View style={[styles.img, styles.noImg]}>
                            <Text style={{ fontSize: 48 }}>📷</Text>
                        </View>
                    )}
                    {listing.is_boosted && (
                        <View style={styles.boostBadge}><Text style={styles.boostText}>⚡ Annonce boostée</Text></View>
                    )}
                </View>

                <View style={styles.body}>
                    {/* Prix & titre */}
                    <Text style={styles.price}>{fmt(listing.price_gnf)}</Text>
                    <Text style={styles.title}>{listing.title}</Text>
                    <Text style={styles.meta}>📍 {listing.city}{listing.quartier ? ` · ${listing.quartier}` : ''}</Text>
                    <Text style={styles.meta}>👁 {listing.view_count || 0} vues</Text>

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
                        <View style={styles.sellerRow}>
                            <View style={styles.avatar}>
                                <Text style={{ fontSize: 22 }}>👤</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.sellerName}>{listing.seller?.full_name}</Text>
                                <Text style={styles.sellerMeta}>📍 {listing.seller?.city}</Text>
                            </View>
                            <TouchableOpacity onPress={handleMessage} style={styles.msgBtn}>
                                <Text style={styles.msgBtnText}>💬 Message</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Mode livraison */}
                    {!isMine && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Mode de livraison</Text>
                            <View style={styles.deliveryRow}>
                                {[
                                    { v: 'pickup',   l: '🤝 Retrait en main propre' },
                                    { v: 'delivery', l: '🚚 Livraison à domicile' },
                                ].map(d => (
                                    <TouchableOpacity key={d.v} onPress={() => setDelivery(d.v)}
                                        style={[styles.deliveryBtn, delivery === d.v && styles.deliveryBtnActive]}>
                                        <Text style={[styles.deliveryText, delivery === d.v && styles.deliveryTextActive]}>{d.l}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Footer CTA */}
            {!isMine && (
                <View style={styles.footer}>
                    <TouchableOpacity onPress={handleMessage} style={styles.footerSecBtn}>
                        <Text style={styles.footerSecText}>💬</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleOrder}
                        style={[styles.footerBtn, orderMut.isPending && { opacity: 0.6 }]}
                        disabled={orderMut.isPending}
                    >
                        {orderMut.isPending
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.footerBtnText}>Commander</Text>
                        }
                    </TouchableOpacity>
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    loading:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
    imgContainer: { position: 'relative' },
    img:          { width: SCREEN_W, height: 280, backgroundColor: colors.bg },
    noImg:        { alignItems: 'center', justifyContent: 'center' },
    dots:         { flexDirection: 'row', justifyContent: 'center', position: 'absolute', bottom: 12, width: '100%', gap: 6 },
    dot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
    dotActive:    { backgroundColor: '#fff', width: 16 },
    boostBadge:   { position: 'absolute', top: 12, left: 12, backgroundColor: colors.accent, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    boostText:    { color: '#fff', fontSize: font.sm, fontWeight: font.bold },
    body:         { padding: spacing.lg },
    price:        { fontSize: font.xxl, fontWeight: font.bold, color: colors.primary, marginBottom: 4 },
    title:        { fontSize: font.xl, fontWeight: font.semi, color: colors.text, marginBottom: spacing.sm },
    meta:         { fontSize: font.sm, color: colors.textMuted, marginBottom: 4 },
    section:      { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
    sectionTitle: { fontSize: font.base, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm },
    desc:         { fontSize: font.base, color: colors.textMuted, lineHeight: 22 },
    sellerRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    avatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
    sellerName:   { fontSize: font.base, fontWeight: font.semi, color: colors.text },
    sellerMeta:   { fontSize: font.sm, color: colors.textMuted },
    msgBtn:       { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 6 },
    msgBtnText:   { color: colors.primary, fontSize: font.sm, fontWeight: font.semi },
    deliveryRow:  { gap: spacing.sm },
    deliveryBtn:  { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
    deliveryBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    deliveryText:     { fontSize: font.sm, color: colors.textMuted },
    deliveryTextActive: { color: colors.primary, fontWeight: font.semi },
    footer:       { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
    footerSecBtn: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    footerSecText:{ fontSize: 20 },
    footerBtn:    { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', height: 48 },
    footerBtnText:{ color: '#fff', fontWeight: font.bold, fontSize: font.base },
})
