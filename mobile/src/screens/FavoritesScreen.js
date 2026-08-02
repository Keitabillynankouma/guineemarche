import React, { useCallback } from 'react'
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { favoritesAPI } from '../services/api'
import ListingCard from '../components/ListingCard'
import { colors, spacing, radius, font } from '../theme'

export default function FavoritesScreen({ navigation }) {
    const qc = useQueryClient()

    const { data = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['favorites'],
        queryFn:  () => favoritesAPI.list().then(r => {
            const raw = r.data?.results ?? r.data ?? []
            // L'API retourne { id, listing } ou directement la liste d'annonces
            return raw.map(f => f.listing ?? f)
        }),
    })

    const removeMut = useMutation({
        mutationFn: (id) => favoritesAPI.toggle(id),
        onSuccess:  () => qc.invalidateQueries({ queryKey: ['favorites'] }),
        onError:    () => Alert.alert('Erreur', 'Impossible de retirer des favoris.'),
    })

    const renderItem = useCallback(({ item }) => (
        <View>
            <ListingCard
                listing={item}
                onPress={() => navigation.navigate('ListingDetail', { id: item.id })}
            />
            <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removeMut.mutate(item.id)}
            >
                <Text style={styles.removeBtnText}>♡ Retirer des favoris</Text>
            </TouchableOpacity>
        </View>
    ), [navigation])

    return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Mes favoris</Text>
                <View style={{ width: 40 }} />
            </View>

            {isLoading ? (
                <ActivityIndicator style={{ flex: 1 }} color={colors.primary} size="large" />
            ) : (
                <FlatList
                    data={data}
                    renderItem={renderItem}
                    keyExtractor={i => i.id}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyIcon}>♡</Text>
                            <Text style={styles.emptyTitle}>Aucun favori</Text>
                            <Text style={styles.emptySub}>Les annonces que vous aimez apparaîtront ici</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.browseBtn}>
                                <Text style={styles.browseBtnText}>Parcourir les annonces</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.primary, paddingTop: spacing.xl + 8 },
    backBtn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    backIcon:      { fontSize: 28, color: '#fff' },
    title:         { fontSize: font.lg, fontWeight: font.bold, color: '#fff' },
    list:          { padding: spacing.lg },
    removeBtn:     { marginHorizontal: spacing.lg, marginTop: -spacing.md, marginBottom: spacing.md, backgroundColor: '#fdf2f8', borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
    removeBtnText: { color: '#be185d', fontSize: font.sm, fontWeight: font.semi },
    empty:         { alignItems: 'center', marginTop: spacing.xxl * 2, paddingHorizontal: spacing.xl },
    emptyIcon:     { fontSize: 64, marginBottom: spacing.md, color: colors.textMuted },
    emptyTitle:    { fontSize: font.xl, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm },
    emptySub:      { fontSize: font.base, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl },
    browseBtn:     { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
    browseBtnText: { color: '#fff', fontWeight: font.bold, fontSize: font.base },
})
