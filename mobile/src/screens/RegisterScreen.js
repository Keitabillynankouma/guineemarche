import React, { useState } from 'react'
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { authAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { colors, spacing, radius, font } from '../theme'

const CITIES = ['Conakry', 'Kindia', 'Labé', 'Kankan', 'Nzérékoré', 'Mamou', 'Boké', 'Faranah', 'Siguiri']

export default function RegisterScreen({ navigation }) {
    const [form, setForm] = useState({ full_name: '', phone_number: '', password: '', city: 'Conakry', role: 'buyer' })
    const [loading, setLoading] = useState(false)
    const { login } = useAuthStore()

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const handleRegister = async () => {
        if (!form.full_name || !form.phone_number || !form.password) {
            Alert.alert('Erreur', 'Tous les champs sont obligatoires.')
            return
        }
        setLoading(true)
        try {
            await authAPI.register(form)
            await login(form.phone_number, form.password)
        } catch (e) {
            const err = e.response?.data
            const msg = typeof err === 'string' ? err : Object.values(err || {}).flat().join('\n')
            Alert.alert('Erreur d\'inscription', msg || 'Une erreur est survenue.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: colors.bg }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Text style={styles.logo}>🛒</Text>
                    <Text style={styles.title}>Créer un compte</Text>
                </View>

                <View style={styles.card}>
                    {[
                        { key: 'full_name',    label: 'Nom complet',       placeholder: 'Mamadou Diallo', kb: 'default' },
                        { key: 'phone_number', label: 'Téléphone',         placeholder: '+224 622 00 00 00', kb: 'phone-pad' },
                        { key: 'password',     label: 'Mot de passe',      placeholder: '••••••••', secure: true },
                    ].map(f => (
                        <View key={f.key}>
                            <Text style={styles.label}>{f.label}</Text>
                            <TextInput
                                style={styles.input}
                                value={form[f.key]}
                                onChangeText={v => set(f.key, v)}
                                placeholder={f.placeholder}
                                placeholderTextColor={colors.textMuted}
                                keyboardType={f.kb || 'default'}
                                secureTextEntry={f.secure}
                            />
                        </View>
                    ))}

                    <Text style={styles.label}>Ville</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                        {CITIES.map(c => (
                            <TouchableOpacity key={c} onPress={() => set('city', c)}
                                style={[styles.pill, form.city === c && styles.pillActive]}>
                                <Text style={[styles.pillText, form.city === c && styles.pillTextActive]}>{c}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <Text style={styles.label}>Je suis…</Text>
                    <View style={styles.roleRow}>
                        {[{ v: 'buyer', l: '🛍️ Acheteur' }, { v: 'seller', l: '🏪 Vendeur' }].map(r => (
                            <TouchableOpacity key={r.v} onPress={() => set('role', r.v)}
                                style={[styles.roleBtn, form.role === r.v && styles.roleBtnActive]}>
                                <Text style={[styles.roleText, form.role === r.v && styles.roleTextActive]}>{r.l}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={[styles.btn, loading && styles.btnDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.btnText}>Créer mon compte</Text>
                        }
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.linkWrap}>
                        <Text style={styles.link}>Déjà un compte ? <Text style={styles.linkBold}>Se connecter</Text></Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: spacing.xl },
    header:    { alignItems: 'center', marginVertical: spacing.xl },
    logo:      { fontSize: 48, marginBottom: spacing.sm },
    title:     { fontSize: font.xl, fontWeight: font.bold, color: colors.text },
    card:      { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, shadowColor: '#000', shadowOffset: { width:0,height:2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
    label:     { fontSize: font.sm, fontWeight: font.semi, color: colors.textMuted, marginBottom: 4 },
    input:     { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, fontSize: font.base, color: colors.text, backgroundColor: colors.bg },
    pill:      { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
    pillActive:{ borderColor: colors.primary, backgroundColor: colors.primaryLight },
    pillText:  { fontSize: font.sm, color: colors.textMuted },
    pillTextActive: { color: colors.primary, fontWeight: font.semi },
    roleRow:   { flexDirection: 'row', gap: 8, marginBottom: spacing.lg },
    roleBtn:   { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
    roleBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    roleText:  { fontSize: font.sm, color: colors.textMuted },
    roleTextActive: { color: colors.primary, fontWeight: font.semi },
    btn:       { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
    btnDisabled: { opacity: 0.6 },
    btnText:   { color: '#fff', fontWeight: font.bold, fontSize: font.base },
    linkWrap:  { marginTop: spacing.lg, alignItems: 'center' },
    link:      { fontSize: font.sm, color: colors.textMuted },
    linkBold:  { color: colors.primary, fontWeight: font.semi },
})
