import React from 'react'
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, ActivityIndicator, Alert, Share, Clipboard,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from '../store/authStore'
import { authAPI, referralAPI } from '../services/api'
import { colors, spacing, radius, font } from '../theme'

export default function ProfileScreen({ navigation }) {
    const { user, logout, isAuthenticated } = useAuthStore()

    const { data: sub } = useQuery({
        queryKey: ['subscription'],
        queryFn:  () => authAPI.getSubscription?.().then(r => r.data),
        enabled:  isAuthenticated,
    })

    const { data: referral } = useQuery({
        queryKey: ['referral-stats'],
        queryFn:  () => referralAPI.getStats().then(r => r.data),
        enabled:  isAuthenticated,
    })

    const handleLogout = () => {
        Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
            { text: 'Déconnecter', style: 'destructive', onPress: logout },
            { text: 'Annuler', style: 'cancel' },
        ])
    }

    if (!isAuthenticated) {
        return (
            <View style={styles.guestContainer}>
                <Text style={styles.guestIcon}>👤</Text>
                <Text style={styles.guestTitle}>Connectez-vous</Text>
                <Text style={styles.guestSub}>Pour accéder à votre profil et gérer vos annonces</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Auth')} style={styles.loginBtn}>
                    <Text style={styles.loginBtnText}>Se connecter</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Auth', { screen: 'Register' })} style={styles.registerBtn}>
                    <Text style={styles.registerBtnText}>Créer un compte</Text>
                </TouchableOpacity>
            </View>
        )
    }

    if (!user) return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} size="large" />
        </View>
    )

    const progress = Math.min(100, ((sub?.listings_used ?? 0) / 5) * 100)

    return (
        <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>
            {/* Header profil */}
            <View style={styles.profileHeader}>
                <View style={styles.avatarWrap}>
                    <Text style={{ fontSize: 36 }}>👤</Text>
                </View>
                <Text style={styles.userName}>{user.full_name}</Text>
                <Text style={styles.userPhone}>{String(user.phone_number)}</Text>
                <Text style={styles.userCity}>📍 {user.city}</Text>

                {user.profile && (
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Reviews', { userId: user.id })}
                        style={styles.ratingRow}
                    >
                        <Text style={styles.stars}>{'★'.repeat(Math.round(user.profile.rating_avg || 0))}</Text>
                        <Text style={styles.ratingText}>
                            {user.profile.rating_avg?.toFixed(1) || '0.0'} · {user.profile.total_ratings} avis
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Abonnement */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Mon abonnement</Text>
                {sub?.is_pro ? (
                    <View style={styles.proCard}>
                        <Text style={styles.proIcon}>💎</Text>
                        <View>
                            <Text style={styles.proLabel}>Plan Pro actif</Text>
                            {sub.valid_until && (
                                <Text style={styles.proSub}>Expire le {new Date(sub.valid_until).toLocaleDateString('fr-FR')}</Text>
                            )}
                        </View>
                    </View>
                ) : (
                    <View style={styles.freeCard}>
                        <View style={styles.freeHeader}>
                            <Text style={styles.freeLabel}>Annonces gratuites</Text>
                            <Text style={[styles.freeCount, sub?.remaining_free === 0 && { color: colors.danger }]}>
                                {sub?.listings_used ?? '…'} / 5
                            </Text>
                        </View>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, {
                                width: `${progress}%`,
                                backgroundColor: sub?.remaining_free === 0 ? colors.danger : colors.primary,
                            }]} />
                        </View>
                        <TouchableOpacity onPress={() => Alert.alert('Plan Pro', 'Contactez-nous via guimatrix.com pour activer le plan Pro.')} style={styles.upgradeBtn}>
                            <Text style={styles.upgradeBtnText}>💎 Passer au plan Pro</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Menu */}
            <View style={styles.section}>
                {[
                    { icon: '📋', label: 'Mes annonces',  screen: 'MyListings' },
                    { icon: '🛍️', label: 'Mes commandes', screen: 'Orders' },
                    { icon: '💬', label: 'Messages',       screen: 'Messages' },
                ].map(item => (
                    <TouchableOpacity key={item.screen}
                        onPress={() => navigation.navigate(item.screen)}
                        style={styles.menuItem}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.menuIcon}>{item.icon}</Text>
                        <Text style={styles.menuLabel}>{item.label}</Text>
                        <Text style={styles.menuArrow}>›</Text>
                    </TouchableOpacity>
                ))}

                {/* Lien gains vendeur */}
                {user.role === 'seller' && (
                    <TouchableOpacity onPress={() => navigation.navigate('SellerEarnings')} style={styles.menuItem} activeOpacity={0.7}>
                        <Text style={styles.menuIcon}>💰</Text>
                        <Text style={styles.menuLabel}>Mes gains</Text>
                        <Text style={styles.menuArrow}>›</Text>
                    </TouchableOpacity>
                )}

                {/* Lien tableau de bord livreur */}
                {user.role === 'livreur' && (
                    <TouchableOpacity onPress={() => navigation.navigate('LivreurDashboard')} style={[styles.menuItem, styles.livreurItem]} activeOpacity={0.7}>
                        <Text style={styles.menuIcon}>🚚</Text>
                        <Text style={[styles.menuLabel, { color: '#0369a1' }]}>Tableau de bord livreur</Text>
                        <Text style={[styles.menuArrow, { color: '#0369a1' }]}>›</Text>
                    </TouchableOpacity>
                )}

                {user.role === 'admin' && (
                    <TouchableOpacity onPress={() => Alert.alert('Admin', 'Accédez à l\'administration via guimatrix.com/admin')} style={[styles.menuItem, styles.adminItem]}>
                        <Text style={styles.menuIcon}>🛡️</Text>
                        <Text style={[styles.menuLabel, { color: '#dc2626' }]}>Administration</Text>
                        <Text style={[styles.menuArrow, { color: '#dc2626' }]}>›</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Parrainage */}
            {referral && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🎁 Programme de parrainage</Text>
                    <View style={{ padding: spacing.lg }}>
                        {/* Stats */}
                        <View style={styles.referralStats}>
                            <View style={styles.referralStat}>
                                <Text style={[styles.referralStatNum, { color: colors.primary }]}>{referral.referral_count}</Text>
                                <Text style={styles.referralStatLabel}>Filleuls actifs</Text>
                            </View>
                            <View style={styles.referralStat}>
                                <Text style={[styles.referralStatNum, { color: '#3b82f6' }]}>+{referral.reward_per_ref}</Text>
                                <Text style={styles.referralStatLabel}>Annonces / filleul</Text>
                            </View>
                            <View style={styles.referralStat}>
                                <Text style={[styles.referralStatNum, { color: '#7c3aed' }]}>+{referral.total_bonus}</Text>
                                <Text style={styles.referralStatLabel}>Slots gagnés</Text>
                            </View>
                        </View>

                        {/* Description */}
                        <Text style={styles.referralDesc}>
                            Partage ton lien. Chaque filleul qui passe sa 1ère commande te rapporte{' '}
                            <Text style={{ fontWeight: font.bold, color: colors.primary }}>{referral.reward_per_ref} annonces gratuites</Text> supplémentaires.
                        </Text>

                        {/* Code */}
                        <View style={styles.referralCodeRow}>
                            <View>
                                <Text style={styles.referralCodeLabel}>Ton code</Text>
                                <Text style={styles.referralCode}>{referral.referral_code}</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.copyBtn}
                                onPress={() => {
                                    Clipboard.setString(referral.referral_url)
                                    Alert.alert('Copié !', 'Lien de parrainage copié dans le presse-papier.')
                                }}
                            >
                                <Text style={styles.copyBtnText}>📋 Copier le lien</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Partage */}
                        <TouchableOpacity
                            style={styles.shareBtn}
                            onPress={() => Share.share({
                                message: `🛒 Rejoins-moi sur Guinée Marché — la marketplace #1 en Guinée !\nInscris-toi avec mon code et on gagne tous les deux des annonces gratuites : ${referral.referral_url}`,
                            })}
                        >
                            <Text style={styles.shareBtnText}>📤 Partager via WhatsApp / SMS</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                <Text style={styles.logoutText}>🚪 Se déconnecter</Text>
            </TouchableOpacity>

            <View style={{ height: spacing.xxl }} />
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    // Guest
    guestContainer: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    guestIcon:      { fontSize: 64, marginBottom: spacing.lg },
    guestTitle:     { fontSize: font.xl, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm },
    guestSub:       { fontSize: font.base, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl },
    loginBtn:       { width: '100%', backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
    loginBtnText:   { color: '#fff', fontWeight: font.bold, fontSize: font.base },
    registerBtn:    { width: '100%', borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
    registerBtnText:{ color: colors.primary, fontWeight: font.semi, fontSize: font.base },
    // Profile header
    profileHeader:  { backgroundColor: colors.primary, padding: spacing.xl, alignItems: 'center' },
    avatarWrap:     { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
    userName:       { fontSize: font.xl, fontWeight: font.bold, color: '#fff', marginBottom: 4 },
    userPhone:      { fontSize: font.sm, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
    userCity:       { fontSize: font.sm, color: 'rgba(255,255,255,0.7)', marginBottom: spacing.md },
    ratingRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6 },
    stars:          { color: colors.accent, fontSize: font.base },
    ratingText:     { color: '#fff', fontSize: font.sm },
    // Sections
    section:        { backgroundColor: colors.white, margin: spacing.lg, marginBottom: 0, borderRadius: radius.xl, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    sectionTitle:   { fontSize: font.base, fontWeight: font.bold, color: colors.text, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    // Pro card
    proCard:        { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: '#f0fdf4' },
    proIcon:        { fontSize: 32 },
    proLabel:       { fontSize: font.base, fontWeight: font.bold, color: colors.primary },
    proSub:         { fontSize: font.sm, color: colors.textMuted },
    // Free card
    freeCard:       { padding: spacing.lg },
    freeHeader:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    freeLabel:      { fontSize: font.sm, color: colors.textMuted },
    freeCount:      { fontSize: font.sm, fontWeight: font.bold, color: colors.text },
    progressBar:    { height: 6, backgroundColor: colors.border, borderRadius: 3, marginBottom: spacing.md },
    progressFill:   { height: '100%', borderRadius: 3 },
    upgradeBtn:     { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
    upgradeBtnText: { color: '#fff', fontWeight: font.semi, fontSize: font.sm },
    // Menu
    menuItem:       { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    menuIcon:       { fontSize: 20, width: 28, textAlign: 'center' },
    menuLabel:      { flex: 1, fontSize: font.base, color: colors.text },
    menuArrow:      { fontSize: font.lg, color: colors.textMuted },
    adminItem:      { backgroundColor: '#fff5f5' },
    livreurItem:    { backgroundColor: '#f0f9ff' },
    // Parrainage
    referralStats:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
    referralStat:       { flex: 1, alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.sm, marginHorizontal: 3 },
    referralStatNum:    { fontSize: font.xl, fontWeight: font.bold },
    referralStatLabel:  { fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
    referralDesc:       { fontSize: font.sm, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.md },
    referralCodeRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
    referralCodeLabel:  { fontSize: 10, color: colors.textMuted, marginBottom: 2 },
    referralCode:       { fontSize: font.lg, fontWeight: font.bold, color: colors.primary, fontVariant: ['tabular-nums'], letterSpacing: 2 },
    copyBtn:            { backgroundColor: colors.primary + '15', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    copyBtnText:        { fontSize: font.sm, color: colors.primary, fontWeight: font.semi },
    shareBtn:           { backgroundColor: '#25D366', borderRadius: radius.md, padding: spacing.sm + 2, alignItems: 'center' },
    shareBtnText:       { color: '#fff', fontWeight: font.semi, fontSize: font.sm },
    // Logout
    logoutBtn:      { margin: spacing.lg, backgroundColor: '#fee2e2', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
    logoutText:     { color: colors.danger, fontWeight: font.semi, fontSize: font.base },
})
