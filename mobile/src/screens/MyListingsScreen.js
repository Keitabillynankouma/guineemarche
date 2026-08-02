import React, { useCallback } from 'react'
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listingsAPI } from '../services/api'
import ListingCard from '../components/ListingCard'
import { colors, spacing, radius, font } from '../theme'

export default function MyListingsScreen({ navigation }) {
    const qc = useQueryClient()

    const { data = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['my-listings'],
        queryFn:  () => listingsAPI.myListings().then(r => r.data?.results ?? r.data ?? []),
    })

    const deleteMut = useMutation({
        mutationFn: (id) => listingsAPI.delete?.(id) ?? Promise.resolve(),
        onSuccess:  () => qc.invalidateQueries({ queryKey: ['my-listings'] }),
        onError:    (e) => Alert.alert('Erreur', e.response?.data?.detail || 'Impossible de supprimer.'),
    })

    const handleDelete = (id, title) => {
        Alert.alert('Supprimer l\'annonce', `Voulez-vous supprimer « ${title} » ?`, [
            { text: 'Supprimer', style: 'destructive', onPress: () => deleteMut.mutate(id) },
            { text: 'Annuler', style: 'cancel' },
        ])
    }

    const renderItem = useCallback(({ item }) => (
        <View>
            <ListingCard
                listing={item}
                onPress={() => navigation.navigate('ListingDetail', { id: item.id })}
            />
            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => navigation.navigate('CreateListing', { listing: item })}
                >
                    <Text style={styles.editBtnText}>✏️ Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item.id, item.title)}
                >
                    <Text style={styles.deleteBtnText}>🗑️ Supprimer</Text>
                </TouchableOpacity>
            </View>
        </View>
    ), [navigation])

    return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Mes annonces</Text>
                <TouchableOpacity
                    onPress={() => navigation.navigate('CreateListing')}
                    style={styles.addBtn}
                >
                    <Text style={styles.addBtnText}>＋</Text>
                </TouchableOpacity>
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
                            <Text style={styles.emptyIcon}>📋</Text>
                            <Text style={styles.emptyTitle}>Aucune annonce</Text>
                            <Text style={styles.emptySub}>Publiez votre première annonce</Text>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('CreateListing')}
                                style={styles.createBtn}
                            >
                                <Text style={styles.createBtnText}>＋ Créer une annonce</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.primary, paddingTop: spacing.xl + 8 },
    backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    backIcon:     { fontSize: 28, color: '#fff' },
    title:        { fontSize: font.lg, fontWeight: font.bold, color: '#fff' },
    addBtn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.md },
    addBtnText:   { fontSize: 22, color: '#fff', lineHeight: 24 },
    list:         { padding: spacing.lg },
    actions:      { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: -spacing.md, marginBottom: spacing.md },
    editBtn:      { flex: 1, backgroundColor: '#eff6ff', borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
    editBtnText:  { color: '#2563eb', fontSize: font.sm, fontWeight: font.semi },
    deleteBtn:    { flex: 1, backgroundColor: '#fee2e2', borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
    deleteBtnText:{ color: '#dc2626', fontSize: font.sm, fontWeight: font.semi },
    empty:        { alignItems: 'center', marginTop: spacing.xxl * 2, paddingHorizontal: spacing.xl },
    emptyIcon:    { fontSize: 56, marginBottom: spacing.md },
    emptyTitle:   { fontSize: font.xl, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm },
    emptySub:     { fontSize: font.base, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl },
    createBtn:    { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
    createBtnText:{ color: '#fff', fontWeight: font.bold, fontSize: font.base },
})
