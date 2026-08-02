import React, { useCallback } from 'react'
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifAPI } from '../services/api'
import { colors, spacing, radius, font } from '../theme'

function NotifCard({ notif, onPress }) {
    const date = new Date(notif.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
    return (
        <TouchableOpacity
            onPress={onPress}
            style={[styles.card, !notif.is_read && styles.cardUnread]}
            activeOpacity={0.75}
        >
            <View style={styles.cardInner}>
                {!notif.is_read && <View style={styles.dot} />}
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{notif.title}</Text>
                    {notif.body ? <Text style={styles.cardBody} numberOfLines={2}>{notif.body}</Text> : null}
                    <Text style={styles.cardDate}>{date}</Text>
                </View>
            </View>
        </TouchableOpacity>
    )
}

export default function NotificationsScreen({ navigation }) {
    const qc = useQueryClient()

    const { data = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['notifications'],
        queryFn:  () => notifAPI.list().then(r => r.data?.results ?? r.data ?? []),
    })

    const markRead = useMutation({
        mutationFn: (id) => notifAPI.markRead(id),
        onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    })

    const markAll = useMutation({
        mutationFn: () => notifAPI.markAll(),
        onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    })

    const unreadCount = data.filter(n => !n.is_read).length

    const renderItem = useCallback(({ item }) => (
        <NotifCard
            notif={item}
            onPress={() => {
                if (!item.is_read) markRead.mutate(item.id)
                // Naviguer vers la commande si possible
                if (item.data?.order_id) {
                    navigation.navigate('Orders')
                }
            }}
        />
    ), [navigation])

    return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>
                    Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
                </Text>
                {unreadCount > 0 ? (
                    <TouchableOpacity onPress={() => markAll.mutate()} style={styles.markAllBtn}>
                        <Text style={styles.markAllText}>Tout lire</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 60 }} />
                )}
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
                            <Text style={styles.emptyIcon}>🔔</Text>
                            <Text style={styles.emptyTitle}>Aucune notification</Text>
                            <Text style={styles.emptySub}>Vos alertes commandes et messages apparaîtront ici</Text>
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
    title:        { fontSize: font.lg, fontWeight: font.bold, color: '#fff', flex: 1, textAlign: 'center' },
    markAllBtn:   { paddingHorizontal: spacing.sm, paddingVertical: 4 },
    markAllText:  { fontSize: font.sm, color: 'rgba(255,255,255,0.85)', fontWeight: font.semi },
    list:         { padding: spacing.md },
    card:         { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    cardUnread:   { borderLeftWidth: 3, borderLeftColor: colors.primary },
    cardInner:    { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 5, flexShrink: 0 },
    cardTitle:    { fontSize: font.base, fontWeight: font.semi, color: colors.text, marginBottom: 2 },
    cardBody:     { fontSize: font.sm, color: colors.textMuted, lineHeight: 18, marginBottom: 4 },
    cardDate:     { fontSize: 11, color: colors.textMuted },
    empty:        { alignItems: 'center', marginTop: spacing.xxl * 2, paddingHorizontal: spacing.xl },
    emptyIcon:    { fontSize: 56, marginBottom: spacing.md },
    emptyTitle:   { fontSize: font.xl, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm },
    emptySub:     { fontSize: font.base, color: colors.textMuted, textAlign: 'center' },
})
