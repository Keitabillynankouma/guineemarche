import React, { useState } from 'react'
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { reviewsAPI } from '../services/api'
import { colors, spacing, radius, font } from '../theme'

function Stars({ rating, size = 16 }) {
    return (
        <View style={{ flexDirection: 'row', gap: 2 }}>
            {[1, 2, 3, 4, 5].map(i => (
                <Text key={i} style={{ fontSize: size, color: i <= rating ? '#f59e0b' : '#d1d5db' }}>★</Text>
            ))}
        </View>
    )
}

function RatingBar({ count, total, note }) {
    const pct = total > 0 ? (count / total) * 100 : 0
    return (
        <View style={bar.row}>
            <Text style={bar.note}>{note}</Text>
            <Text style={{ color: '#f59e0b', fontSize: 11 }}>★</Text>
            <View style={bar.track}>
                <View style={[bar.fill, { width: `${pct}%` }]} />
            </View>
            <Text style={bar.count}>{count}</Text>
        </View>
    )
}
const bar = StyleSheet.create({
    row:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    note:  { width: 14, fontSize: 11, color: colors.textMuted, textAlign: 'right' },
    track: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
    fill:  { height: '100%', backgroundColor: '#f59e0b', borderRadius: 3 },
    count: { width: 20, fontSize: 11, color: colors.textMuted },
})

function ReviewCard({ review }) {
    const date = new Date(review.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
    })
    return (
        <View style={card.container}>
            <View style={card.header}>
                <View style={card.avatar}><Text style={{ fontSize: 18 }}>👤</Text></View>
                <View style={{ flex: 1 }}>
                    <Text style={card.name}>{review.reviewer?.full_name || 'Utilisateur'}</Text>
                    <Text style={card.date}>{date}</Text>
                </View>
                <Stars rating={review.rating} size={14} />
            </View>
            {review.comment ? <Text style={card.comment}>{review.comment}</Text> : null}
            {review.listing_title ? (
                <Text style={card.listing}>📦 {review.listing_title}</Text>
            ) : null}
        </View>
    )
}
const card = StyleSheet.create({
    container: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    header:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
    avatar:    { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
    name:      { fontSize: font.base, fontWeight: font.semi, color: colors.text },
    date:      { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    comment:   { fontSize: font.sm, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.sm },
    listing:   { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
})

export default function ReviewsScreen({ route, navigation }) {
    const { userId } = route.params
    const [filterNote, setFilterNote] = useState(0)

    const { data = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['user-reviews', userId],
        queryFn: () => reviewsAPI.forUser(userId).then(r => {
            const raw = r.data
            return Array.isArray(raw) ? raw : (raw?.results ?? [])
        }),
    })

    const total   = data.length
    const avg     = total > 0 ? (data.reduce((s, r) => s + r.rating, 0) / total).toFixed(1) : '0.0'
    const distrib = [5, 4, 3, 2, 1].map(n => ({
        note:  n,
        count: data.filter(r => r.rating === n).length,
    }))

    const filtered = filterNote > 0 ? data.filter(r => r.rating === filterNote) : data

    return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Avis</Text>
                <View style={{ width: 40 }} />
            </View>

            {isLoading ? (
                <ActivityIndicator style={{ flex: 1 }} color={colors.primary} size="large" />
            ) : (
                <FlatList
                    data={filtered}
                    renderItem={({ item }) => <ReviewCard review={item} />}
                    keyExtractor={i => i.id?.toString()}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
                    ListHeaderComponent={() => (
                        <View>
                            {/* Résumé */}
                            <View style={styles.summaryCard}>
                                <View style={styles.avgBlock}>
                                    <Text style={styles.avgNum}>{avg}</Text>
                                    <Stars rating={Math.round(parseFloat(avg))} size={18} />
                                    <Text style={styles.totalText}>{total} avis</Text>
                                </View>
                                <View style={styles.barsBlock}>
                                    {distrib.map(d => (
                                        <RatingBar key={d.note} note={d.note} count={d.count} total={total} />
                                    ))}
                                </View>
                            </View>

                            {/* Filtres */}
                            <View style={styles.filters}>
                                {[0, 5, 4, 3, 2, 1].map(n => (
                                    <TouchableOpacity key={n}
                                        onPress={() => setFilterNote(n)}
                                        style={[styles.filterPill, filterNote === n && styles.filterPillActive]}>
                                        <Text style={[styles.filterText, filterNote === n && styles.filterTextActive]}>
                                            {n === 0 ? 'Tous' : `${n}★`}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={() => (
                        <View style={styles.empty}>
                            <Text style={styles.emptyIcon}>⭐</Text>
                            <Text style={styles.emptyTitle}>Aucun avis</Text>
                            <Text style={styles.emptySub}>Les avis apparaîtront ici après des transactions confirmées</Text>
                        </View>
                    )}
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primary, padding: spacing.lg, paddingTop: spacing.xl + 8 },
    backBtn:         { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    backIcon:        { fontSize: 28, color: '#fff' },
    headerTitle:     { fontSize: font.lg, fontWeight: font.bold, color: '#fff' },
    list:            { padding: spacing.md, paddingTop: 0 },
    summaryCard:     { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, margin: spacing.md, flexDirection: 'row', gap: spacing.lg, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
    avgBlock:        { alignItems: 'center', justifyContent: 'center', minWidth: 72 },
    avgNum:          { fontSize: 40, fontWeight: font.bold, color: colors.text, lineHeight: 48 },
    totalText:       { fontSize: font.sm, color: colors.textMuted, marginTop: 4 },
    barsBlock:       { flex: 1, justifyContent: 'center' },
    filters:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
    filterPill:      { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 5 },
    filterPillActive:{ borderColor: colors.primary, backgroundColor: colors.primaryLight },
    filterText:      { fontSize: font.sm, color: colors.textMuted },
    filterTextActive:{ color: colors.primary, fontWeight: font.semi },
    empty:           { alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
    emptyIcon:       { fontSize: 52, marginBottom: spacing.md },
    emptyTitle:      { fontSize: font.xl, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm },
    emptySub:        { fontSize: font.base, color: colors.textMuted, textAlign: 'center' },
})
