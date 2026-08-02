import React from 'react'
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { shopsAPI, listingsAPI } from '../services/api'
import ListingCard from '../components/ListingCard'
import { colors, spacing, radius, font } from '../theme'

export default function SellerShopScreen({ route, navigation }) {
    const { sellerId } = route.params   // on passe sellerId depuis ListingDetailScreen

    const { data: listings = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['seller-listings', sellerId],
        queryFn: () => listingsAPI.list({ seller: sellerId }).then(r => {
            const d = r.data
            return Array.isArray(d) ? d : (d?.results ?? [])
        }),
        enabled: !!sellerId,
    })

    const seller = listings[0]?.seller

    return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {seller?.full_name || 'Boutique vendeur'}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            {!isLoading && seller && (
                <View style={styles.sellerCard}>
                    <View style={styles.sellerAvatar}><Text style={{ fontSize: 28 }}>👤</Text></View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.sellerName}>{seller.full_name}</Text>
                        <Text style={styles.sellerMeta}>📍 {seller.city}</Text>
                        {seller.profile?.rating_avg > 0 && (
                            <Text style={styles.sellerMeta}>⭐ {seller.profile.rating_avg?.toFixed(1)} · {seller.profile.total_ratings} avis</Text>
                        )}
                    </View>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Reviews', { userId: sellerId })}
                        style={styles.reviewsBtn}
                    >
                        <Text style={styles.reviewsBtnText}>Voir les avis</Text>
                    </TouchableOpacity>
                </View>
            )}

            {isLoading ? (
                <ActivityIndicator style={{ flex: 1 }} color={colors.primary} size="large" />
            ) : (
                <FlatList
                    data={listings}
                    renderItem={({ item }) => (
                        <ListingCard
                            listing={item}
                            onPress={() => navigation.navigate('ListingDetail', { id: item.id })}
                        />
                    )}
                    keyExtractor={i => i.id?.toString()}
                    contentContainerStyle={styles.list}
                    numColumns={2}
                    columnWrapperStyle={{ gap: spacing.sm }}
                    refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
                    ListHeaderComponent={() => (
                        <Text style={styles.listHeader}>
                            {listings.length} annonce{listings.length !== 1 ? 's' : ''}
                        </Text>
                    )}
                    ListEmptyComponent={() => (
                        <View style={styles.empty}>
                            <Text style={styles.emptyIcon}>📦</Text>
                            <Text style={styles.emptyTitle}>Aucune annonce</Text>
                            <Text style={styles.emptySub}>Ce vendeur n'a pas encore publié d'annonce</Text>
                        </View>
                    )}
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primary, padding: spacing.lg, paddingTop: spacing.xl + 8 },
    backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    backIcon:     { fontSize: 28, color: '#fff' },
    headerTitle:  { fontSize: font.lg, fontWeight: font.bold, color: '#fff', flex: 1, textAlign: 'center' },
    sellerCard:   { backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    sellerAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
    sellerName:   { fontSize: font.base, fontWeight: font.bold, color: colors.text },
    sellerMeta:   { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
    reviewsBtn:   { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 4 },
    reviewsBtnText:{ fontSize: font.sm, color: colors.primary },
    list:         { padding: spacing.md },
    listHeader:   { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.sm },
    empty:        { alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
    emptyIcon:    { fontSize: 52, marginBottom: spacing.md },
    emptyTitle:   { fontSize: font.xl, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm },
    emptySub:     { fontSize: font.base, color: colors.textMuted, textAlign: 'center' },
})
