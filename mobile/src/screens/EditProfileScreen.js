import React, { useState } from 'react'
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import useAuthStore from '../store/authStore'
import { authAPI } from '../services/api'
import { colors, spacing, radius, font } from '../theme'

const CITIES = ['Conakry', 'Kindia', 'Labé', 'Kankan', 'Nzérékoré', 'Mamou', 'Faranah', 'Boké', 'Siguiri', 'Guékédou']

const PAYOUT_PROVIDERS = [
    { v: 'orange_money', l: 'Orange Money' },
    { v: 'mtn_momo',     l: 'MTN MoMo' },
    { v: 'paycard',      l: 'PayCard' },
]

export default function EditProfileScreen({ navigation }) {
    const { user, setUser } = useAuthStore()
    const qc = useQueryClient()

    const [fullName,     setFullName]     = useState(user?.full_name     || '')
    const [email,        setEmail]        = useState(user?.email          || '')
    const [city,         setCity]         = useState(user?.city           || '')
    const [quartier,     setQuartier]     = useState(user?.quartier       || '')
    const [payoutPhone,  setPayoutPhone]  = useState(user?.payout_phone   || user?.phone_number || '')
    const [payoutProv,   setPayoutProv]   = useState(user?.payout_provider || 'orange_money')

    const isSeller = user?.role === 'seller' || user?.role === 'livreur'

    const mutation = useMutation({
        mutationFn: (data) => authAPI.updateMe(data),
        onSuccess: (res) => {
            setUser?.(res.data)
            qc.invalidateQueries({ queryKey: ['me'] })
            Alert.alert('✅ Profil mis à jour', 'Vos informations ont été enregistrées.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ])
        },
        onError: (e) => {
            const msg = e.response?.data?.detail
                || Object.values(e.response?.data || {}).flat().join('\n')
                || 'Impossible de sauvegarder le profil.'
            Alert.alert('Erreur', msg)
        },
    })

    const handleSave = () => {
        if (!fullName.trim()) { Alert.alert('Erreur', 'Le nom est requis.'); return }
        if (!city) { Alert.alert('Erreur', 'Choisissez votre ville.'); return }

        const payload = {
            full_name: fullName.trim(),
            email:     email.trim() || undefined,
            city,
            quartier: quartier.trim() || undefined,
        }

        if (isSeller) {
            if (!payoutPhone.trim()) { Alert.alert('Erreur', 'Entrez un numéro de paiement.'); return }
            payload.payout_phone    = payoutPhone.trim()
            payload.payout_provider = payoutProv
        }

        mutation.mutate(payload)
    }

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Modifier le profil</Text>
                <TouchableOpacity onPress={handleSave} disabled={mutation.isPending} style={styles.saveBtn}>
                    {mutation.isPending
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.saveBtnText}>Enregistrer</Text>
                    }
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                {/* Infos personnelles */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Informations personnelles</Text>

                    <Text style={styles.label}>Nom complet *</Text>
                    <TextInput style={styles.input} value={fullName} onChangeText={setFullName}
                        placeholder="Prénom Nom" placeholderTextColor={colors.textMuted} />

                    <Text style={styles.label}>Adresse e-mail</Text>
                    <TextInput style={styles.input} value={email} onChangeText={setEmail}
                        placeholder="exemple@gmail.com" placeholderTextColor={colors.textMuted}
                        keyboardType="email-address" autoCapitalize="none" />

                    <Text style={styles.label}>Ville *</Text>
                    <View style={styles.pills}>
                        {CITIES.map(c => (
                            <TouchableOpacity key={c} onPress={() => setCity(c)}
                                style={[styles.pill, city === c && styles.pillActive]}>
                                <Text style={[styles.pillText, city === c && styles.pillTextActive]}>{c}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.label}>Quartier</Text>
                    <TextInput style={styles.input} value={quartier} onChangeText={setQuartier}
                        placeholder="Ex : Ratoma, Dixinn, Kaloum…" placeholderTextColor={colors.textMuted} />
                </View>

                {/* Infos de reversement (vendeur/livreur) */}
                {isSeller && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>💳 Informations de paiement</Text>
                        <Text style={styles.cardSub}>
                            Numéro sur lequel vous recevrez vos gains après chaque commande confirmée.
                        </Text>

                        <Text style={styles.label}>Opérateur</Text>
                        <View style={styles.pills}>
                            {PAYOUT_PROVIDERS.map(p => (
                                <TouchableOpacity key={p.v} onPress={() => setPayoutProv(p.v)}
                                    style={[styles.pill, payoutProv === p.v && styles.pillActive]}>
                                    <Text style={[styles.pillText, payoutProv === p.v && styles.pillTextActive]}>{p.l}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Numéro de paiement *</Text>
                        <TextInput style={styles.input} value={payoutPhone} onChangeText={setPayoutPhone}
                            placeholder="+224 622 00 00 00" placeholderTextColor={colors.textMuted}
                            keyboardType="phone-pad" />

                        <View style={styles.infoBox}>
                            <Text style={styles.infoText}>
                                ℹ️ Ce numéro est utilisé uniquement pour les reversements. Il ne remplace pas votre numéro de connexion.
                            </Text>
                        </View>
                    </View>
                )}

                <TouchableOpacity onPress={handleSave} disabled={mutation.isPending}
                    style={[styles.saveBottomBtn, mutation.isPending && { opacity: 0.6 }]}>
                    {mutation.isPending
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.saveBottomBtnText}>💾 Enregistrer les modifications</Text>
                    }
                </TouchableOpacity>

                <View style={{ height: spacing.xxl }} />
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    header:          { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, padding: spacing.lg, paddingTop: spacing.xl + 8, gap: spacing.sm },
    backBtn:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backIcon:        { fontSize: 28, color: '#fff' },
    headerTitle:     { flex: 1, fontSize: font.lg, fontWeight: font.bold, color: '#fff' },
    saveBtn:         { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 6 },
    saveBtnText:     { color: '#fff', fontWeight: font.semi, fontSize: font.sm },
    container:       { padding: spacing.lg },
    card:            { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
    cardTitle:       { fontSize: font.base, fontWeight: font.bold, color: colors.text, marginBottom: 4 },
    cardSub:         { fontSize: font.sm, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.md },
    label:           { fontSize: font.sm, fontWeight: font.semi, color: colors.textMuted, marginBottom: 4, marginTop: spacing.sm },
    input:           { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: font.base, color: colors.text, backgroundColor: colors.bg },
    pills:           { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
    pill:            { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6 },
    pillActive:      { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    pillText:        { fontSize: font.sm, color: colors.textMuted },
    pillTextActive:  { color: colors.primary, fontWeight: font.semi },
    infoBox:         { backgroundColor: '#eff6ff', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
    infoText:        { fontSize: font.sm, color: '#1d4ed8', lineHeight: 18 },
    saveBottomBtn:   { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md + 2, alignItems: 'center' },
    saveBottomBtnText:{ color: '#fff', fontWeight: font.bold, fontSize: font.base },
})
