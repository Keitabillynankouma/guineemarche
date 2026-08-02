import React, { useState, useRef } from 'react'
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { authAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { colors, spacing, radius, font } from '../theme'
import { VILLES, getCommunesByVille } from '../constants/communes'

// ── Saisie OTP 6 cases ────────────────────────────────────────────────────────
function OTPInput({ value, onChange }) {
    const refs = Array.from({ length: 6 }, () => useRef(null))
    const digits = Array.from({ length: 6 }, (_, i) => value[i] || '')

    const handleChange = (i, v) => {
        v = v.replace(/\D/g, '').slice(-1)
        const next = digits.map((d, idx) => (idx === i ? v : d)).join('')
        onChange(next)
        if (v && i < 5) refs[i + 1].current?.focus()
    }

    const handleKey = (i, e) => {
        if (e.nativeEvent.key === 'Backspace' && !digits[i] && i > 0) {
            refs[i - 1].current?.focus()
        }
    }

    return (
        <View style={otpStyles.row}>
            {digits.map((d, i) => (
                <TextInput
                    key={i}
                    ref={refs[i]}
                    style={[otpStyles.box, d && otpStyles.boxFilled]}
                    value={d}
                    onChangeText={v => handleChange(i, v)}
                    onKeyPress={e => handleKey(i, e)}
                    keyboardType="numeric"
                    maxLength={1}
                    textAlign="center"
                    selectTextOnFocus
                />
            ))}
        </View>
    )
}

const otpStyles = StyleSheet.create({
    row:      { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginVertical: spacing.lg },
    box:      { width: 46, height: 54, borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, fontSize: 22, fontWeight: '700', color: colors.text, backgroundColor: colors.bg, textAlignVertical: 'center' },
    boxFilled:{ borderColor: colors.primary, backgroundColor: colors.primaryLight },
})

// ── Écran principal ───────────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }) {
    const [step, setStep]   = useState(1)   // 1 = form, 2 = OTP
    const [loading, setLoading] = useState(false)
    const [showPwd, setShowPwd] = useState(false)
    const [showPwd2, setShowPwd2] = useState(false)
    const [otp, setOtp]     = useState('')
    const [acceptedAntiVol, setAcceptedAntiVol] = useState(false)
    const [acceptedTerms, setAcceptedTerms]     = useState(false)
    const { login } = useAuthStore()

    const [form, setForm] = useState({
        full_name:     '',
        phone_number:  '',
        password:      '',
        password2:     '',
        city:          'Conakry',
        quartier:      '',
        role:          'buyer',
        referral_code: '',
    })

    const set     = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const setCity = (city)  => setForm(f => ({ ...f, city, quartier: '' }))
    const communes = getCommunesByVille(form.city)

    // ── Étape 1 : inscription ─────────────────────────────────────────────────
    const handleRegister = async () => {
        if (!form.full_name || !form.phone_number || !form.password) {
            Alert.alert('Erreur', 'Nom, téléphone et mot de passe sont obligatoires.')
            return
        }
        if (form.password.length < 6) {
            Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères.')
            return
        }
        if (form.password !== form.password2) {
            Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.')
            return
        }
        if (!acceptedTerms) {
            Alert.alert('Conditions requises', 'Veuillez accepter les conditions d\'utilisation.')
            return
        }
        if (!acceptedAntiVol) {
            Alert.alert('Déclaration obligatoire', 'Vous devez certifier que vos articles ne sont pas volés.')
            return
        }
        setLoading(true)
        try {
            await authAPI.register({
                full_name:     form.full_name,
                phone_number:  form.phone_number,
                password:      form.password,
                password2:     form.password2,
                city:          form.city,
                quartier:      form.quartier || undefined,
                role:          form.role,
                referral_code: form.referral_code || undefined,
            })
            setStep(2)
        } catch (e) {
            const err = e.response?.data
            const msg = err?.error || err?.detail || err?.non_field_errors?.[0]
                || (typeof err === 'object' ? Object.values(err).flat().join('\n') : null)
                || 'Une erreur est survenue.'
            Alert.alert('Erreur d\'inscription', msg)
        } finally {
            setLoading(false)
        }
    }

    // ── Étape 2 : vérification OTP ────────────────────────────────────────────
    const handleVerify = async () => {
        if (otp.length < 6) {
            Alert.alert('Code incomplet', 'Entrez les 6 chiffres du code reçu par SMS.')
            return
        }
        setLoading(true)
        try {
            await authAPI.verifyOTP({ phone_number: form.phone_number, otp })
            await login(form.phone_number, form.password)
        } catch (e) {
            const msg = e.response?.data?.error || e.response?.data?.detail || 'Code invalide.'
            Alert.alert('Code incorrect', msg)
        } finally {
            setLoading(false)
        }
    }

    const resendOTP = async () => {
        try {
            await authAPI.resendOTP({ phone_number: form.phone_number })
            Alert.alert('Code envoyé', 'Un nouveau code SMS vous a été envoyé.')
        } catch (e) {
            Alert.alert('Erreur', 'Impossible de renvoyer le code.')
        }
    }

    // ── Rendu étape OTP ───────────────────────────────────────────────────────
    if (step === 2) {
        return (
            <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                    <View style={styles.header}>
                        <Text style={styles.logo}>📱</Text>
                        <Text style={styles.title}>Vérification</Text>
                        <Text style={styles.subtitle}>
                            Un code à 6 chiffres a été envoyé au{'\n'}
                            <Text style={{ fontWeight: font.bold, color: colors.primary }}>{form.phone_number}</Text>
                        </Text>
                    </View>

                    <View style={styles.card}>
                        <OTPInput value={otp} onChange={setOtp} />

                        <TouchableOpacity
                            style={[styles.btn, (loading || otp.length < 6) && styles.btnDisabled]}
                            onPress={handleVerify}
                            disabled={loading || otp.length < 6}
                        >
                            {loading
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.btnText}>Vérifier et continuer</Text>
                            }
                        </TouchableOpacity>

                        <TouchableOpacity onPress={resendOTP} style={styles.linkWrap}>
                            <Text style={styles.link}>Pas reçu ? <Text style={styles.linkBold}>Renvoyer le code</Text></Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setStep(1)} style={styles.linkWrap}>
                            <Text style={styles.link}>‹ Modifier mon numéro</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        )
    }

    // ── Rendu étape formulaire ────────────────────────────────────────────────
    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Text style={styles.logo}>🛒</Text>
                    <Text style={styles.title}>Créer un compte</Text>
                    <Text style={styles.subtitle}>Rejoignez GuinéeMarché gratuitement</Text>
                </View>

                <View style={styles.card}>
                    {/* Nom complet */}
                    <Text style={styles.label}>Nom complet</Text>
                    <TextInput style={styles.input} value={form.full_name} onChangeText={v => set('full_name', v)}
                        placeholder="Mamadou Diallo" placeholderTextColor={colors.textMuted} />

                    {/* Téléphone */}
                    <Text style={styles.label}>Téléphone <Text style={styles.req}>*</Text></Text>
                    <TextInput style={styles.input} value={form.phone_number} onChangeText={v => set('phone_number', v)}
                        placeholder="+224 622 00 00 00" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />

                    {/* Mot de passe */}
                    <Text style={styles.label}>Mot de passe <Text style={styles.req}>*</Text></Text>
                    <View style={styles.pwdWrap}>
                        <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={form.password}
                            onChangeText={v => set('password', v)} placeholder="Min. 6 caractères"
                            placeholderTextColor={colors.textMuted} secureTextEntry={!showPwd} />
                        <TouchableOpacity onPress={() => setShowPwd(p => !p)} style={styles.eyeBtn}>
                            <Text style={styles.eyeIcon}>{showPwd ? '🙈' : '👁️'}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Confirmation mot de passe */}
                    <Text style={styles.label}>Confirmer le mot de passe <Text style={styles.req}>*</Text></Text>
                    <View style={styles.pwdWrap}>
                        <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={form.password2}
                            onChangeText={v => set('password2', v)} placeholder="Répétez votre mot de passe"
                            placeholderTextColor={colors.textMuted} secureTextEntry={!showPwd2} />
                        <TouchableOpacity onPress={() => setShowPwd2(p => !p)} style={styles.eyeBtn}>
                            <Text style={styles.eyeIcon}>{showPwd2 ? '🙈' : '👁️'}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Rôle */}
                    <Text style={styles.label}>Je suis</Text>
                    <View style={styles.roleRow}>
                        {[{ v: 'buyer', l: '🛍️ Acheteur' }, { v: 'seller', l: '🏪 Vendeur' }].map(r => (
                            <TouchableOpacity key={r.v} onPress={() => set('role', r.v)}
                                style={[styles.roleBtn, form.role === r.v && styles.roleBtnActive]}>
                                <Text style={[styles.roleBtnText, form.role === r.v && styles.roleBtnTextActive]}>{r.l}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Ville */}
                    <Text style={styles.label}>Ville</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                        {VILLES.map(v => (
                            <TouchableOpacity key={v} onPress={() => setCity(v)}
                                style={[styles.pill, form.city === v && styles.pillActive]}>
                                <Text style={[styles.pillText, form.city === v && styles.pillTextActive]}>{v}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Quartier */}
                    {communes.length > 0 && (
                        <>
                            <Text style={styles.label}>Quartier</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                                {communes.map(q => (
                                    <TouchableOpacity key={q} onPress={() => set('quartier', q)}
                                        style={[styles.pill, form.quartier === q && styles.pillActive]}>
                                        <Text style={[styles.pillText, form.quartier === q && styles.pillTextActive]}>{q}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </>
                    )}

                    {/* Code parrainage */}
                    <Text style={styles.label}>Code parrainage (optionnel)</Text>
                    <TextInput style={styles.input} value={form.referral_code} onChangeText={v => set('referral_code', v.toUpperCase())}
                        placeholder="Ex : ABC12345" placeholderTextColor={colors.textMuted} autoCapitalize="characters" />

                    {/* Checkboxes */}
                    <TouchableOpacity onPress={() => setAcceptedTerms(p => !p)} style={styles.checkRow}>
                        <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                            {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.checkLabel}>
                            J'accepte les <Text style={styles.linkBold}>conditions d'utilisation</Text> de GuinéeMarché
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setAcceptedAntiVol(p => !p)} style={styles.checkRow}>
                        <View style={[styles.checkbox, acceptedAntiVol && styles.checkboxChecked]}>
                            {acceptedAntiVol && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.checkLabel}>
                            Je certifie que les articles que je vendrai m'appartiennent légalement et ne sont pas volés ou d'origine illicite
                        </Text>
                    </TouchableOpacity>

                    {/* Bouton inscription */}
                    <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]}
                        onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.btnText}>Créer mon compte →</Text>
                        }
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkWrap}>
                        <Text style={styles.link}>Déjà un compte ? <Text style={styles.linkBold}>Se connecter</Text></Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: spacing.xxl }} />
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    container:        { flexGrow: 1, padding: spacing.lg },
    header:           { alignItems: 'center', marginBottom: spacing.xl, paddingTop: spacing.xl },
    logo:             { fontSize: 52, marginBottom: spacing.sm },
    title:            { fontSize: font.xxl, fontWeight: font.bold, color: colors.text },
    subtitle:         { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 20 },
    card:             { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
    label:            { fontSize: font.sm, fontWeight: font.semi, color: colors.textMuted, marginBottom: 4, marginTop: spacing.sm },
    req:              { color: colors.danger },
    input:            { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, fontSize: font.base, color: colors.text, backgroundColor: colors.bg },
    pwdWrap:          { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.bg, marginBottom: spacing.sm, paddingRight: spacing.sm },
    eyeBtn:           { padding: spacing.sm },
    eyeIcon:          { fontSize: 18 },
    roleRow:          { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    roleBtn:          { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
    roleBtnActive:    { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    roleBtnText:      { fontSize: font.sm, color: colors.textMuted, fontWeight: font.semi },
    roleBtnTextActive:{ color: colors.primary },
    pill:             { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
    pillActive:       { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    pillText:         { fontSize: font.sm, color: colors.textMuted },
    pillTextActive:   { color: colors.primary, fontWeight: font.semi },
    checkRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md },
    checkbox:         { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
    checkboxChecked:  { backgroundColor: colors.primary, borderColor: colors.primary },
    checkmark:        { color: '#fff', fontSize: 13, fontWeight: '700' },
    checkLabel:       { flex: 1, fontSize: font.sm, color: colors.textMuted, lineHeight: 18 },
    btn:              { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
    btnDisabled:      { opacity: 0.6 },
    btnText:          { color: '#fff', fontWeight: font.bold, fontSize: font.base },
    linkWrap:         { marginTop: spacing.md, alignItems: 'center' },
    link:             { fontSize: font.sm, color: colors.textMuted },
    linkBold:         { color: colors.primary, fontWeight: font.semi },
})
