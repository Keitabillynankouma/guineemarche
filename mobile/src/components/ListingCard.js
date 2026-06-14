import React from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, spacing, radius, font } from '../theme'

export default function ListingCard({ listing, onPress }) {
    const img = listing.images?.[0]?.image_url || listing.thumbnail_url
    const price = new Intl.NumberFormat('fr-GN').format(listing.price_gnf) + ' GNF'

    return (
        <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.85}>
            <View style={styles.imgWrap}>
                {img
                    ? <Image source={{ uri: img }} style={styles.img} resizeMode="cover" />
                    : <View style={[styles.img, styles.placeholder]}><Text style={styles.noImg}>📷</Text></View>
                }
                {listing.is_boosted && (
                    <View style={styles.boostBadge}><Text style={styles.boostText}>⚡ Boosté</Text></View>
                )}
            </View>
            <View style={styles.body}>
                <Text style={styles.title} numberOfLines={2}>{listing.title}</Text>
                <Text style={styles.price}>{price}</Text>
                <Text style={styles.meta} numberOfLines={1}>📍 {listing.city}{listing.quartier ? ` · ${listing.quartier}` : ''}</Text>
            </View>
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.white,
        borderRadius: radius.lg,
        marginBottom: spacing.md,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
    },
    imgWrap: { position: 'relative' },
    img:  { width: '100%', height: 180, backgroundColor: colors.bg },
    placeholder: { alignItems: 'center', justifyContent: 'center' },
    noImg: { fontSize: 32, color: colors.border },
    boostBadge: {
        position: 'absolute', top: 8, right: 8,
        backgroundColor: '#f59e0b', borderRadius: radius.full,
        paddingHorizontal: 8, paddingVertical: 3,
    },
    boostText: { color: '#fff', fontSize: font.sm, fontWeight: font.bold },
    body: { padding: spacing.md },
    title: { fontSize: font.base, fontWeight: font.semi, color: colors.text, marginBottom: 4 },
    price: { fontSize: font.md, fontWeight: font.bold, color: colors.primary, marginBottom: 4 },
    meta:  { fontSize: font.sm, color: colors.textMuted },
})
