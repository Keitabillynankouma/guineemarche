import React, { useState, useRef } from 'react'
import {
    View, Text, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, SafeAreaView,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersAPI, BASE_URL } from '../services/api'
import { colors, spacing, radius, font } from '../theme'

/**
 * PaymentScreen
 * Reçoit en paramètre : orderId
 * 1. Crée une session de paiement via POST /orders/:id/pay/
 * 2. Affiche l'URL de paiement ChaChaP dans une WebView
 * 3. Écoute les URLs de retour (success/cancel) et navigue en conséquence
 */
export default function PaymentScreen({ route, navigation }) {
    const { orderId } = route.params || {}
    const qc = useQueryClient()
    const webViewRef = useRef(null)

    const [checkoutUrl, setCheckoutUrl] = useState(null)
    const [webViewLoading, setWebViewLoading] = useState(false)
    const [step, setStep] = useState('init')  // init | webview | success | failed

    // Crée la session de paiement
    const initMutation = useMutation({
        mutationFn: () => ordersAPI.pay(orderId, { provider: 'chachap' }),
        onSuccess: (res) => {
            const url = res.data?.checkout_url || res.data?.payment_url
            if (url) {
                setCheckoutUrl(url)
                setStep('webview')
            } else {
                // Paiement simulé en dev (pas d'URL de checkout)
                Alert.alert(
                    '💰 Paiement simulé',
                    'Mode test : le paiement est enregistré comme effectué.',
                    [{ text: 'OK', onPress: () => { qc.invalidateQueries({ queryKey: ['orders-buyer'] }); navigation.goBack() } }]
                )
            }
        },
        onError: (e) => {
            const msg = e.response?.data?.error || e.response?.data?.detail || 'Impossible d\'initier le paiement.'
            Alert.alert('Erreur de paiement', msg)
        },
    })

    // Surveillez les URLs de retour depuis la WebView
    const handleNavigationChange = (navState) => {
        const url = navState.url

        // URL succès — ChaChaP redirige vers notre domaine après paiement confirmé
        if (url.includes('/payment/success') || url.includes('payment_success=1') || url.includes('/orders/') && url.includes('paid')) {
            setStep('success')
            qc.invalidateQueries({ queryKey: ['orders-buyer'] })
            qc.invalidateQueries({ queryKey: ['orders-seller'] })
        }

        // URL annulation
        if (url.includes('/payment/cancel') || url.includes('payment_cancel=1')) {
            setStep('failed')
        }
    }

    // ── Écran initial : résumé + bouton payer ──
    if (step === 'init') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Text style={styles.backIcon}>‹</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Paiement sécurisé</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.body}>
                    <Text style={styles.secureIcon}>🔒</Text>
                    <Text style={styles.secureTitle}>Paiement sécurisé</Text>
                    <Text style={styles.secureDesc}>
                        Votre paiement est sécurisé par ChaChaP Pay, plateforme agréée BCRG.
                        Vos fonds sont conservés en séquestre jusqu'à confirmation de réception.
                    </Text>

                    <View style={styles.infoCard}>
                        <Text style={styles.infoRow}>🛡️ Commande protégée par escrow</Text>
                        <Text style={styles.infoRow}>💸 Paiement via Orange Money / MTN MoMo</Text>
                        <Text style={styles.infoRow}>✅ Remboursement si litige</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.payBtn, initMutation.isPending && styles.payBtnDisabled]}
                        onPress={() => initMutation.mutate()}
                        disabled={initMutation.isPending}
                        activeOpacity={0.85}
                    >
                        {initMutation.isPending
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.payBtnText}>💳 Procéder au paiement</Text>
                        }
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelLink}>
                        <Text style={styles.cancelText}>Annuler</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        )
    }

    // ── WebView ChaChaP ──
    if (step === 'webview' && checkoutUrl) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => Alert.alert('Annuler le paiement ?', 'Voulez-vous vraiment quitter le paiement ?', [
                            { text: 'Oui, annuler', style: 'destructive', onPress: () => navigation.goBack() },
                            { text: 'Continuer', style: 'cancel' },
                        ])}
                        style={styles.backBtn}
                    >
                        <Text style={styles.backIcon}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>🔒 Paiement sécurisé</Text>
                    <View style={{ width: 40 }} />
                </View>

                {webViewLoading && (
                    <View style={styles.webViewLoader}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.webViewLoaderText}>Chargement du paiement…</Text>
                    </View>
                )}

                <WebView
                    ref={webViewRef}
                    source={{ uri: checkoutUrl }}
                    onLoadStart={() => setWebViewLoading(true)}
                    onLoadEnd={() => setWebViewLoading(false)}
                    onNavigationStateChange={handleNavigationChange}
                    javaScriptEnabled
                    domStorageEnabled
                    startInLoadingState={false}
                    style={{ flex: 1 }}
                />
            </SafeAreaView>
        )
    }

    // ── Succès ──
    if (step === 'success') {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 72, marginBottom: spacing.lg }}>✅</Text>
                <Text style={styles.resultTitle}>Paiement réussi !</Text>
                <Text style={styles.resultDesc}>
                    Votre paiement a été reçu. Les fonds sont conservés en séquestre jusqu'à ce que vous confirmiez la réception de votre article.
                </Text>
                <TouchableOpacity
                    onPress={() => { navigation.navigate('Orders') }}
                    style={[styles.payBtn, { marginTop: spacing.xl }]}
                >
                    <Text style={styles.payBtnText}>Voir mes commandes</Text>
                </TouchableOpacity>
            </SafeAreaView>
        )
    }

    // ── Échec / annulation ──
    return (
        <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ fontSize: 72, marginBottom: spacing.lg }}>❌</Text>
            <Text style={styles.resultTitle}>Paiement annulé</Text>
            <Text style={styles.resultDesc}>
                Le paiement n'a pas abouti. Aucun montant n'a été débité.
            </Text>
            <TouchableOpacity
                onPress={() => setStep('init')}
                style={[styles.payBtn, { marginTop: spacing.xl }]}
            >
                <Text style={styles.payBtnText}>Réessayer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelLink}>
                <Text style={styles.cancelText}>Retour</Text>
            </TouchableOpacity>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container:         { flex: 1, backgroundColor: colors.bg },
    header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn:           { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    backIcon:          { fontSize: 26, color: colors.text },
    headerTitle:       { fontSize: font.base, fontWeight: font.semi, color: colors.text },
    body:              { flex: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center' },
    secureIcon:        { fontSize: 56, marginBottom: spacing.md },
    secureTitle:       { fontSize: font.xl, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
    secureDesc:        { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl },
    infoCard:          { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, width: '100%', marginBottom: spacing.xl, gap: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    infoRow:           { fontSize: font.sm, color: colors.text },
    payBtn:            { width: '100%', backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md + 2, alignItems: 'center' },
    payBtnDisabled:    { opacity: 0.6 },
    payBtnText:        { color: '#fff', fontWeight: font.bold, fontSize: font.base },
    cancelLink:        { marginTop: spacing.md, padding: spacing.sm },
    cancelText:        { color: colors.textMuted, fontSize: font.sm },
    webViewLoader:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(249,250,251,0.95)', zIndex: 10, gap: spacing.md },
    webViewLoaderText: { fontSize: font.sm, color: colors.textMuted },
    resultTitle:       { fontSize: font.xl, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
    resultDesc:        { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.lg },
})
