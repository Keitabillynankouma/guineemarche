import React, { useState, useCallback } from 'react'
import {
    View, Text, TextInput, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, RefreshControl, Linking,
} from 'react-native'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { listingsAPI } from '../services/api'
import ListingCard from '../components/ListingCard'
import { colors, spacing, radius, font } from '../theme'

const CITIES = ['Toutes', 'Conakry', 'Kindia', 'Labé', 'Kankan', 'Nzérékoré']

export default function HomeScreen({ navigation }) {
    const [search, setSearch]       = useState('')
    const [city, setCity]           = useState('')
    const [catId, setCatId]         = useState(null)
    const [showWebBanner, setShowWebBanner] = useState(true)

    // Catégories
    const { data: cats = [] } = useQuery({
        queryKey: ['categories'],
        queryFn:  () => listingsAPI.categories().then(r => r.data),
        staleTime: 60 * 60 * 1000,
    })

    const {
        data, fetchNextPage, hasNextPage,
        isFetchingNextPage, isLoading, refetch, isRefetching,
    } = useInfiniteQuery({
        queryKey: ['listings', search, city, catId],
        queryFn: ({ pageParam = 1 }) =>
            listingsAPI.list({ page: pageParam, search, city: city || undefined, category: catId || undefined }).then(r => r.data),
        getNextPageParam: (last) => last.next ? (last.next.match(/page=(\d+)/)?.[1] || undefined) : undefined,
        initialPageParam: 1,
    })

    const listings = data?.pages.flatMap(p => p.results || p) ?? []

    const renderItem = useCallback(({ item }) => (
        <ListingCard
            listing={item}
            onPress={() => navigation.navigate('ListingDetail', { id: item.id })}
        />
    ), [navigation])

    const renderFooter = () => {
        if (!isFetchingNextPage) return null
        return <ActivityIndicator style={{ marginVertical: spacing.lg }} color={colors.primary} />
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.brand}>🛒 GuinéeMarché</Text>
                <TextInput
                    style={styles.search}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Rechercher une annonce…"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                />
            </View>

            {/* Bannière version web */}
            {showWebBanner && (
                <View style={styles.webBanner}>
                    <TouchableOpacity
                        style={styles.webBannerContent}
                        onPress={() => Linking.openURL('https://guimatrix.com')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.webBannerIcon}>🌐</Text>
                        <View style={styles.webBannerTexts}>
                            <Text style={styles.webBannerTitle}>Aussi disponible sur le web</Text>
                            <Text style={styles.webBannerSub}>guimatrix.com — expérience complète</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowWebBanner(false)} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                        <Text style={styles.webBannerClose}>✕</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Filtre villes */}
            <FlatList
                data={CITIES}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={i => i}
                contentContainerStyle={styles.filterRow}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.pill, (city === '' ? item === 'Toutes' : city === item) && styles.pillActive]}
                        onPress={() => setCity(item === 'Toutes' ? '' : item)}
                    >
                        <Text style={[(city === '' ? item === 'Toutes' : city === item) ? styles.pillTextActive : styles.pillText]}>{item}</Text>
                    </TouchableOpacity>
                )}
            />

            {/* Filtre catégories */}
            {cats.length > 0 && (
                <FlatList
                    data={[{ id: null, name: 'Tout' }, ...cats]}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={i => String(i.id)}
                    contentContainerStyle={styles.filterRow}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.catPill, catId === item.id && styles.catPillActive]}
                            onPress={() => setCatId(item.id)}
                        >
                            <Text style={[styles.catText, catId === item.id && styles.catTextActive]}>
                                {item.icon ? `${item.icon} ` : ''}{item.name}
                            </Text>
                        </TouchableOpacity>
                    )}
                />
            )}

            {/* Liste */}
            {isLoading ? (
                <ActivityIndicator style={{ flex: 1 }} color={colors.primary} size="large" />
            ) : (
                <FlatList
                    data={listings}
                    renderItem={renderItem}
                    keyExtractor={i => i.id}
                    contentContainerStyle={styles.list}
                    onEndReached={() => hasNextPage && fetchNextPage()}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={renderFooter}
                    refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyIcon}>🔍</Text>
                            <Text style={styles.emptyText}>Aucune annonce trouvée</Text>
                        </View>
                    }
                />
            )}

            {/* FAB — publier */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('CreateListing')}
                activeOpacity={0.9}
            >
                <Text style={styles.fabText}>＋ Publier</Text>
            </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header:    { backgroundColor: colors.primary, padding: spacing.lg, paddingTop: spacing.xl + 8 },
    brand:     { fontSize: font.lg, fontWeight: font.bold, color: '#fff', marginBottom: spacing.sm },
    search:    { backgroundColor: '#fff', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: font.base, color: colors.text },
    filterRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    pill:      { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: colors.white },
    pillActive:{ borderColor: colors.primary, backgroundColor: colors.primaryLight },
    pillText:  { fontSize: font.sm, color: colors.textMuted },
    pillTextActive: { color: colors.primary, fontWeight: font.semi },
    catPill:   { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
    catPillActive: { backgroundColor: colors.text, borderColor: colors.text },
    catText:   { fontSize: font.sm, color: colors.textMuted },
    catTextActive: { color: '#fff', fontWeight: font.semi },
    list:      { padding: spacing.lg },
    empty:     { alignItems: 'center', marginTop: spacing.xxl * 2 },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md },
    emptyText: { fontSize: font.base, color: colors.textMuted },
    fab:       { position: 'absolute', bottom: spacing.xl, right: spacing.xl, backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, shadowColor: '#000', shadowOffset: { width:0,height:4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
    fabText:   { color: '#fff', fontWeight: font.bold, fontSize: font.base },
    // Bannière web
    webBanner:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAF4FB', borderBottomWidth: 1, borderBottomColor: '#B3D4E8', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    webBannerContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    webBannerIcon:    { fontSize: 18, marginRight: spacing.sm },
    webBannerTexts:   { flex: 1 },
    webBannerTitle:   { fontSize: font.sm, fontWeight: font.semi, color: '#1A6FA0' },
    webBannerSub:     { fontSize: font.xs ?? 11, color: '#4A8DB0' },
    webBannerClose:   { fontSize: 14, color: '#7AAABF', paddingLeft: spacing.sm },
})
