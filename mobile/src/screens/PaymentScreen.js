import React, { useState, useRef } from 'react'
import {
    View, Text, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, SafeAreaView,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersAPI } from '../services/api'
import { colors, spacing, radius, font } from '../theme'

/**
 * PaymentScreen
 * Reçoit en paramètre : orderId
 * Étapes :
 *   method  → l'acheteur choisit Mobile Money ou En espèces
 *   init    → initiation du paiement (ChaChap ou cash)
 *   webview → page de paiement ChaChap (Mobile Money uniquement)
 *   success → confirmation
 *   failed  → échec / annulation
 */
export default function PaymentScreen({ route, navigation }) {
    const { orderId } = route.params || {}
    const qc = useQueryClient()
    const webViewRef = useRef(null)

    const [step, setStep]             = useState('method')  // method | init | webview | success | failed
    const [provider, setProvider]     = useState(null)      // 'chachap' | 'cash'
    const [checkoutUrl, setCheckoutUrl] = useState(null)
    const [webViewLoading, setWebViewLoading] = useState(false)

    // ── Initiation du paiement ────────────────────────────────────────────────
    const initMutation = useMutation({
        mutationFn: (selectedProvider) => ordersAPI.pay(orderId, { provider: selectedProvider }),
        onSuccess: (res) => {
            if (res.data?.cash) {
                // Paiement en espèces — pas de redirection
                setStep('success')
                qc.invalidateQueries({ queryKey: ['orders-buyer'] })
                qc.invalidateQueries({ queryKey: ['orders-seller'] })
            } else {
                const url = res.data?.checkout_url || res.data?.payment_url
                if (url) {
                    setCheckoutUrl(url)
                    setStep('webview')
                } else {
                    // Mode test sans URL de checkout
                    setStep('success')
                    qc.invalidateQueries({ queryKey: ['orders-buyer'] })
                }
            }
        },
        onError: (e) => {
            const msg = e.response?.data?.error || e.response?.data?.detail || 'Impossible d\'initier le paiement.'
            Alert.alert('Erreur de paiement', msg)
        },
    })

    const handlePay = (selectedProvider) => {
        setProvider(selectedProvider)
        setStep('init')
        initMutation.mutate(selectedProvider)
    }

    // Surveille les URLs de retour depuis la WebView
    const handleNavigationChange = (navState) => {
        const url = navState.url
        if (url.includes('/payment/success') || url.includes('payment_success=1') || (url.includes('/orders/') && url.includes('paid'))) {
            setStep('success')
            qc.invalidateQueries({ queryKey: ['orders-buyer'] })
            qc.invalidateQueries({ queryKey: ['orders-seller'] })
        }
        if (url.includes('/payment/cancel') || url.includes('payment_cancel=1')) {
            setStep('failed')
        }
    }

    // ── En-tête commun ────────────────────────────────────────────────────────
    const Header = ({ title, onBack }) => (
        <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
            <View style={{ width: 40 }} />
        </View>
    )

    // ── Choix du mode de paiement ─────────────────────────────────────────────
    if (step === 'method') {
        return (
            <SafeAreaView style={styles.container}>
                <Header title="Mode de paiement" onBack={() => navigation.goBack()} />

                <View style={styles.body}>
                    <Text style={styles.secureIcon}>💳</Text>
                    <Text style={styles.secureTitle}>Choisissez votre mode de paiement</Text>
                    <Text style={styles.secureDesc}>
                        Sélectionnez comment vous souhaitez régler votre commande.
                    </Text>

                    {/* Mobile Money */}
                    <TouchableOpacity
                        style={styles.methodCard}
                        onPress={() => handlePay('chachap')}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.methodIcon}>📱</Text>
                        <View style={styles.methodInfo}>
                            <Text style={styles.methodTitle}>Mobile Money</Text>
                            <Text style={styles.methodDesc}>Orange Money · MTN MoMo · PayCard</Text>
                            <Text style={styles.methodBadge}>🔒 Paiement sécurisé par escrow</Text>
                        </View>
                        <Text style={styles.methodArrow}>›</Text>
                    </TouchableOpacity>

                    {/* En espèces */}
                    <TouchableOpacity
                        style={styles.methodCard}
                        onPress={() => handlePay('cash')}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.methodIcon}>💵</Text>
                        <View style={styles.methodInfo}>
                            <Text style={styles.methodTitle}>En espèces</Text>
                            <Text style={styles.methodDesc}>Paiement à la livraison ou au retrait</Text>
                            <Text style={styles.methodBadge}>⚠️ Sans protection escrow</Text>
                        </View>
                        <Text style={styles.methodArrow}>›</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelLink}>
                        <Text style={styles.cancelText}>Annuler</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        )
    }

    // ── Initiation en cours ───────────────────────────────────────────────────
    if (step === 'init') {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: spacing.md, color: colors.textMuted, fontSize: font.sm }}>
                    {provider === 'cash' ? 'Confirmation en cours…' : 'Connexion au paiement…'}
                </Text>
            </SafeAreaView>
        )
    }

    // ── WebView ChaChap ───────────────────────────────────────────────────────
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
                    style={{ flex: 1 }}
                />
            </SafeAreaView>
        )
    }

    // ── Succès ────────────────────────────────────────────────────────────────
    if (step === 'success') {
        const isCash = provider === 'cash'
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: spacing.xl }]}>
                <Text style={{ fontSize: 72, marginBottom: spacing.lg }}>✅</Text>
                <Text style={styles.resultTitle}>
                    {isCash ? 'Commande confirmée !' : 'Paiement réussi !'}
                </Text>
                <Text style={styles.resultDesc}>
                    {isCash
                        ? 'Votre commande est confirmée. Le paiement en espèces sera effectué lors de la remise de l\'article.'
                        : 'Votre paiement a été reçu. Les fonds sont conservés en séquestre jusqu\'à confirmation de la réception.'
                    }
                </Text>
                <TouchableOpacity
                    onPress={() => navigation.navigate('Orders')}
                    style={[styles.payBtn, { marginTop: spacing.xl }]}
                >
                    <Text style={styles.payBtnText}>Voir mes commandes</Text>
                </TouchableOpacity>
            </SafeAreaView>
        )
    }

    // ── Échec / annulation ────────────────────────────────────────────────────
    return (
        <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: spacing.xl }]}>
            <Text style={{ fontSize: 72, marginBottom: spacing.lg }}>❌</Text>
            <Text style={styles.resultTitle}>Paiement annulé</Text>
            <Text style={styles.resultDesc}>
                Le paiement n'a pas abouti. Aucun montant n'a été débité.
            </Text>
            <TouchableOpacity
                onPress={() => setStep('method')}
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
    methodCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, width: '100%', marginBottom: spacing.md, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
    methodIcon:        { fontSize: 32, marginRight: spacing.md },
    methodInfo:        { flex: 1 },
    methodTitle:       { fontSize: font.base, fontWeight: font.bold, color: colors.text, marginBottom: 2 },
    methodDesc:        { fontSize: font.sm, color: colors.textMuted, marginBottom: 4 },
    methodBadge:       { fontSize: 11, color: colors.primary },
    methodArrow:       { fontSize: 22, color: colors.textMuted, marginLeft: spacing.sm },
    payBtn:            { width: '100%', backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md + 2, alignItems: 'center' },
    payBtnText:        { color: '#fff', fontWeight: font.bold, fontSize: font.base },
    cancelLink:        { marginTop: spacing.md, padding: spacing.sm },
    cancelText:        { color: colors.textMuted, fontSize: font.sm },
    webViewLoader:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(249,250,251,0.95)', zIndex: 10, gap: spacing.md },
    webViewLoaderText: { fontSize: font.sm, color: colors.textMuted },
    resultTitle:       { fontSize: font.xl, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
    resultDesc:        { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
})
