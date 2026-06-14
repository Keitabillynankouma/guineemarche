import React, { useState, useRef, useEffect } from 'react'
import {
    View, Text, FlatList, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, ScrollView,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { messagesAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { colors, spacing, radius, font } from '../theme'

const QUICK_MSGS = [
    'Bonjour, l\'article est-il toujours disponible ?',
    'Quel est votre dernier prix ?',
    'Où se trouve l\'article exactement ?',
    'Peut-on se retrouver à Kaloum ?',
    'Je suis intéressé(e) par votre annonce.',
    'Livraison possible à Ratoma ?',
    'Je peux passer aujourd\'hui, vous êtes disponible ?',
]

function ConvItem({ conv, isActive, onPress }) {
    const other = conv.other_user
    const unread = conv.unread_count || 0
    return (
        <TouchableOpacity onPress={onPress}
            style={[styles.convItem, isActive && styles.convItemActive]}
            activeOpacity={0.8}>
            <View style={styles.convAvatar}>
                <Text style={{ fontSize: 22 }}>👤</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.convHeader}>
                    <Text style={styles.convName} numberOfLines={1}>{other?.full_name}</Text>
                    {conv.last_message?.created_at && (
                        <Text style={styles.convTime}>
                            {new Date(conv.last_message.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    )}
                </View>
                <View style={styles.convFooter}>
                    <Text style={styles.convPreview} numberOfLines={1}>
                        {conv.last_message?.content || 'Démarrer la conversation'}
                    </Text>
                    {unread > 0 && (
                        <View style={styles.badge}><Text style={styles.badgeText}>{unread}</Text></View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    )
}

function ChatMessage({ msg, myId }) {
    const isMe = msg.sender === myId
    return (
        <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{msg.content}</Text>
                <Text style={[styles.bubbleTime, isMe && { color: 'rgba(255,255,255,0.7)' }]}>
                    {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        </View>
    )
}

export default function MessagesScreen({ route }) {
    const { user } = useAuthStore()
    const qc = useQueryClient()
    const [activeUserId, setActiveUserId] = useState(route?.params?.userId || null)
    const [activeName, setActiveName]     = useState(route?.params?.name || '')
    const [showChat, setShowChat]         = useState(!!route?.params?.userId)
    const [text, setText]                 = useState('')
    const [showQuick, setShowQuick]       = useState(false)
    const listRef = useRef(null)

    const { data: convList = [], isLoading: loadingConvs } = useQuery({
        queryKey: ['conversations'],
        queryFn:  () => messagesAPI.conversations().then(r => r.data),
        refetchInterval: 8000,
    })

    const { data: messages = [] } = useQuery({
        queryKey: ['messages', activeUserId],
        queryFn:  () => messagesAPI.messages(activeUserId).then(r => r.data),
        enabled:  !!activeUserId,
        refetchInterval: 5000,
    })

    const sendMut = useMutation({
        mutationFn: (content) => messagesAPI.send(activeUserId, content),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['messages', activeUserId] })
            qc.invalidateQueries({ queryKey: ['conversations'] })
            setText('')
            setShowQuick(false)
        },
    })

    const send = (content) => {
        const msg = content || text.trim()
        if (!msg || !activeUserId) return
        sendMut.mutate(msg)
    }

    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
        }
    }, [messages])

    // ── Liste des conversations ────────────────────────────────────────────────
    const ConvList = () => (
        <View style={styles.convPanel}>
            <View style={styles.convListHeader}>
                <Text style={styles.convListTitle}>Messages</Text>
            </View>
            {loadingConvs
                ? <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
                : <FlatList
                    data={convList}
                    keyExtractor={i => String(i.other_user?.id)}
                    renderItem={({ item }) => (
                        <ConvItem
                            conv={item}
                            isActive={item.other_user?.id === activeUserId}
                            onPress={() => {
                                setActiveUserId(item.other_user?.id)
                                setActiveName(item.other_user?.full_name || '')
                                setShowChat(true)
                            }}
                        />
                    )}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyIcon}>💬</Text>
                            <Text style={styles.emptyText}>Aucun message pour l'instant</Text>
                            <Text style={styles.emptySub}>Contactez un vendeur depuis une annonce</Text>
                        </View>
                    }
                />
            }
        </View>
    )

    // ── Zone de chat ──────────────────────────────────────────────────────────
    const ChatArea = () => (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={88}
        >
            {/* Header chat */}
            <View style={styles.chatHeader}>
                <TouchableOpacity onPress={() => setShowChat(false)} style={styles.backBtn}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <View style={styles.chatAvatar}><Text style={{ fontSize: 18 }}>👤</Text></View>
                <Text style={styles.chatName}>{activeName}</Text>
            </View>

            {/* Messages */}
            <ScrollView
                ref={listRef}
                style={{ flex: 1, backgroundColor: '#f0f4f8' }}
                contentContainerStyle={{ padding: spacing.md }}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            >
                {messages.map(msg => (
                    <ChatMessage key={msg.id} msg={msg} myId={user?.id} />
                ))}
            </ScrollView>

            {/* Messages rapides */}
            {showQuick && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    style={styles.quickScroll}
                    contentContainerStyle={{ padding: spacing.sm, gap: 8 }}>
                    {QUICK_MSGS.map((q, i) => (
                        <TouchableOpacity key={i} onPress={() => send(q)} style={styles.quickChip}>
                            <Text style={styles.quickChipText}>{q}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Input */}
            <View style={styles.inputRow}>
                <TouchableOpacity onPress={() => setShowQuick(v => !v)} style={styles.quickBtn}>
                    <Text style={styles.quickBtnText}>⚡</Text>
                </TouchableOpacity>
                <TextInput
                    style={styles.input}
                    value={text}
                    onChangeText={setText}
                    placeholder="Votre message…"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={500}
                />
                <TouchableOpacity
                    onPress={() => send()}
                    style={[styles.sendBtn, (!text.trim() || sendMut.isPending) && styles.sendBtnDisabled]}
                    disabled={!text.trim() || sendMut.isPending}
                >
                    {sendMut.isPending
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.sendText}>↑</Text>
                    }
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    )

    return (
        <View style={{ flex: 1 }}>
            {showChat ? <ChatArea /> : <ConvList />}
        </View>
    )
}

const styles = StyleSheet.create({
    // Conv list
    convPanel:      { flex: 1, backgroundColor: colors.white },
    convListHeader: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    convListTitle:  { fontSize: font.xl, fontWeight: font.bold, color: colors.text },
    convItem:       { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    convItemActive: { backgroundColor: colors.primaryLight },
    convAvatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
    convHeader:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    convName:       { fontSize: font.base, fontWeight: font.semi, color: colors.text, flex: 1 },
    convTime:       { fontSize: font.sm, color: colors.textMuted },
    convFooter:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    convPreview:    { fontSize: font.sm, color: colors.textMuted, flex: 1 },
    badge:          { backgroundColor: colors.primary, borderRadius: radius.full, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
    badgeText:      { color: '#fff', fontSize: 11, fontWeight: font.bold },
    empty:          { alignItems: 'center', padding: spacing.xxl },
    emptyIcon:      { fontSize: 48, marginBottom: spacing.md },
    emptyText:      { fontSize: font.base, fontWeight: font.semi, color: colors.text, marginBottom: 4 },
    emptySub:       { fontSize: font.sm, color: colors.textMuted, textAlign: 'center' },
    // Chat
    chatHeader:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn:        { padding: spacing.xs },
    backText:       { fontSize: font.xl, color: colors.primary, fontWeight: font.bold },
    chatAvatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
    chatName:       { fontSize: font.base, fontWeight: font.semi, color: colors.text, flex: 1 },
    // Messages
    msgRow:         { marginBottom: spacing.sm, alignItems: 'flex-start' },
    msgRowMe:       { alignItems: 'flex-end' },
    bubble:         { maxWidth: '80%', borderRadius: radius.lg, padding: spacing.md },
    bubbleMe:       { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
    bubbleThem:     { backgroundColor: colors.white, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    bubbleText:     { fontSize: font.base, color: colors.text },
    bubbleTextMe:   { color: '#fff' },
    bubbleTime:     { fontSize: 10, color: colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
    // Quick
    quickScroll:    { backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, maxHeight: 80 },
    quickChip:      { backgroundColor: colors.primaryLight, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8 },
    quickChipText:  { fontSize: font.sm, color: colors.primary },
    // Input
    inputRow:       { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'flex-end' },
    quickBtn:       { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
    quickBtnText:   { fontSize: 18 },
    input:          { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.sm, fontSize: font.base, color: colors.text, maxHeight: 100 },
    sendBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    sendBtnDisabled:{ opacity: 0.4 },
    sendText:       { color: '#fff', fontSize: font.md, fontWeight: font.bold },
})
