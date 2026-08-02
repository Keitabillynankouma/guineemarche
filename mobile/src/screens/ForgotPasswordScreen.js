import React, { useState, useRef } from 'react'
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { authAPI } from '../services/api'
import { colors, spacing, radius, font } from '../theme'

function OTPInput({ value, onChange }) {
    const refs = Array.from({ length: 6 }, () => useRef(null))
    const digits = Array.from({ length: 6 }, (_, i) => value[i] || '')
    const handleChange = (i, v) => {
        v = v.replace(/\D/g, '').slice(-1)
        onChange(digits.map((d, idx) => (idx === i ? v : d)).join(''))
        if (v && i < 5) refs[i + 1].current?.focus()
    }
    const handleKey = (i, e) => {
        if (e.nativeEvent.key === 'Backspace' && !digits[i] && i > 0) refs[i - 1].current?.focus()
    }
    return (
        <View style={otpS.row}>
            {digits.map((d, i) => (
                <TextInput key={i} ref={refs[i]} style={[otpS.box, d && otpS.filled]}
                    value={d} onChangeText={v => handleChange(i, v)} onKeyPress={e => handleKey(i, e)}
                    keyboardType="numeric" maxLength={1} textAlign="center" selectTextOnFocus />
            ))}
        </View>
    )
}
const otpS = StyleSheet.create({
    row:    { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginVertical: spacing.lg },
    box:    { width: 46, height: 54, borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, fontSize: 22, fontWeight: '700', color: colors.text, backgroundColor: colors.bg, textAlignVertical: 'center' },
    filled: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
})

export default function ForgotPasswordScreen({ navigation }) {
    const [step, setStep]         = useState(1)   // 1=phone, 2=otp+newpwd
    const [phone, setPhone]       = useState('')
    const [otp, setOtp]           = useState('')
    const [newPwd, setNewPwd]     = useState('')
    const [newPwd2, setNewPwd2]   = useState('')
    const [showPwd, setShowPwd]   = useState(false)
    const [loading, setLoading]   = useState(false)

    // Étape 1 : envoyer OTP
    const handleSend = async () => {
        if (!phone.trim()) { Alert.alert('Erreur', 'Entrez votre numéro de téléphone.'); return }
        setLoading(true)
        try {
            await authAPI.forgotPassword({ phone_number: phone.trim() })
            setStep(2)
        } catch (e) {
            Alert.alert('Erreur', e.response?.data?.error || e.response?.data?.detail || 'Numéro introuvable.')
        } finally { setLoading(false) }
    }

    // Étape 2 : vérifier OTP + nouveau mot de passe
    const handleReset = async () => {
        if (otp.length < 6) { Alert.alert('Code incomplet', 'Entrez les 6 chiffres du code SMS.'); return }
        if (!newPwd || newPwd.length < 6) { Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères.'); return }
        if (newPwd !== newPwd2) { Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.'); return }
        setLoading(true)
        try {
            await authAPI.resetPassword({ phone_number: phone.trim(), code: otp, new_password: newPwd })
            Alert.alert('✅ Mot de passe réinitialisé', 'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.', [
                { text: 'Se connecter', onPress: () => navigation.replace('Login') },
            ])
        } catch (e) {
            Alert.alert('Erreur', e.response?.data?.error || e.response?.data?.detail || 'Code invalide ou expiré.')
        } finally { setLoading(false) }
    }

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backIcon}>‹</Text>
                </TouchableOpacity>

                <View style={styles.header}>
                    <Text style={styles.headerIcon}>{step === 1 ? '🔑' : '📱'}</Text>
                    <Text style={styles.title}>{step === 1 ? 'Mot de passe oublié' : 'Nouveau mot de passe'}</Text>
                    <Text style={styles.subtitle}>
                        {step === 1
                            ? 'Entrez votre numéro de téléphone pour recevoir un code de réinitialisation'
                            : `Code envoyé au ${phone}\nEntrez le code et votre nouveau mot de passe`
                        }
                    </Text>
                </View>

                <View style={styles.card}>
                    {step === 1 ? (
                        <>
                            <Text style={styles.label}>Numéro de téléphone</Text>
                            <TextInput style={styles.input} value={phone} onChangeText={setPhone}
                                placeholder="+224 622 00 00 00" placeholderTextColor={colors.textMuted}
                                keyboardType="phone-pad" autoFocus />

                            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]}
                                onPress={handleSend} disabled={loading} activeOpacity={0.85}>
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Envoyer le code</Text>}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <Text style={styles.sectionLabel}>Code reçu par SMS</Text>
                            <OTPInput value={otp} onChange={setOtp} />

                            <Text style={styles.label}>Nouveau mot de passe</Text>
                            <View style={styles.pwdWrap}>
                                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={newPwd}
                                    onChangeText={setNewPwd} placeholder="Min. 6 caractères"
                                    placeholderTextColor={colors.textMuted} secureTextEntry={!showPwd} />
                                <TouchableOpacity onPress={() => setShowPwd(p => !p)} style={styles.eyeBtn}>
                                    <Text>{showPwd ? '🙈' : '👁️'}</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.label}>Confirmer le nouveau mot de passe</Text>
                            <TextInput style={styles.input} value={newPwd2} onChangeText={setNewPwd2}
                                placeholder="Répétez le mot de passe" placeholderTextColor={colors.textMuted}
                                secureTextEntry={!showPwd} />

                            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]}
                                onPress={handleReset} disabled={loading} activeOpacity={0.85}>
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Réinitialiser le mot de passe</Text>}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleSend} style={styles.linkWrap}>
                                <Text style={styles.link}>Pas reçu ? <Text style={styles.linkBold}>Renvoyer le code</Text></Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    container:    { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xl },
    backBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
    backIcon:     { fontSize: 30, color: colors.text, fontWeight: '300' },
    header:       { alignItems: 'center', marginBottom: spacing.xl },
    headerIcon:   { fontSize: 52, marginBottom: spacing.sm },
    title:        { fontSize: font.xl, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm },
    subtitle:     { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
    card:         { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
    sectionLabel: { fontSize: font.sm, fontWeight: font.semi, color: colors.textMuted, textAlign: 'center' },
    label:        { fontSize: font.sm, fontWeight: font.semi, color: colors.textMuted, marginBottom: 4, marginTop: spacing.sm },
    input:        { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, fontSize: font.base, color: colors.text, backgroundColor: colors.bg },
    pwdWrap:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.bg, marginBottom: spacing.sm, paddingRight: spacing.sm },
    eyeBtn:       { padding: spacing.sm },
    btn:          { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
    btnDisabled:  { opacity: 0.6 },
    btnText:      { color: '#fff', fontWeight: font.bold, fontSize: font.base },
    linkWrap:     { marginTop: spacing.md, alignItems: 'center' },
    link:         { fontSize: font.sm, color: colors.textMuted },
    linkBold:     { color: colors.primary, fontWeight: font.semi },
})
