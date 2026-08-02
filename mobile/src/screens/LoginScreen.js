import React, { useState } from 'react'
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import useAuthStore from '../store/authStore'
import { colors, spacing, radius, font } from '../theme'

export default function LoginScreen({ navigation }) {
    const [phone, setPhone]       = useState('')
    const [password, setPassword] = useState('')
    const [showPwd, setShowPwd]   = useState(false)
    const { login, loading }      = useAuthStore()

    const handleLogin = async () => {
        if (!phone || !password) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs.')
            return
        }
        try {
            await login(phone, password)
        } catch (e) {
            const d = e.response?.data
            const msg = d?.detail
                || d?.non_field_errors?.[0]
                || d?.phone_number?.[0]
                || d?.password?.[0]
                || 'Identifiants incorrects.'
            Alert.alert('Connexion échouée', msg)
        }
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: colors.bg }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.logoWrap}>
                    <Text style={styles.logo}>🛒</Text>
                    <Text style={styles.appName}>GuinéeMarché</Text>
                    <Text style={styles.tagline}>La marketplace de confiance en Guinée</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.title}>Connexion</Text>

                    <Text style={styles.label}>Numéro de téléphone</Text>
                    <TextInput
                        style={styles.input}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="Ex : +224 622 00 00 00"
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        placeholderTextColor={colors.textMuted}
                    />

                    <Text style={styles.label}>Mot de passe</Text>
                    <View style={styles.pwdWrap}>
                        <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Votre mot de passe"
                            secureTextEntry={!showPwd}
                            placeholderTextColor={colors.textMuted}
                        />
                        <TouchableOpacity onPress={() => setShowPwd(p => !p)} style={styles.eyeBtn}>
                            <Text style={styles.eyeIcon}>{showPwd ? '🙈' : '👁️'}</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        onPress={() => navigation.navigate('ForgotPassword')}
                        style={{ alignSelf: 'flex-end', marginBottom: spacing.md }}
                    >
                        <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btn, loading && styles.btnDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.btnText}>Se connecter</Text>
                        }
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkWrap}>
                        <Text style={styles.link}>Pas encore de compte ? <Text style={styles.linkBold}>S'inscrire</Text></Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    container:   { flexGrow: 1, padding: spacing.xl, justifyContent: 'center' },
    logoWrap:    { alignItems: 'center', marginBottom: spacing.xxl },
    logo:        { fontSize: 64, marginBottom: spacing.sm },
    appName:     { fontSize: font.xxl, fontWeight: font.bold, color: colors.primary },
    tagline:     { fontSize: font.sm, color: colors.textMuted, marginTop: 4 },
    card:        { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
    title:       { fontSize: font.xl, fontWeight: font.bold, color: colors.text, marginBottom: spacing.lg },
    label:       { fontSize: font.sm, fontWeight: font.semi, color: colors.textMuted, marginBottom: 4 },
    input:       { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, fontSize: font.base, color: colors.text, backgroundColor: colors.bg },
    pwdWrap:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.bg, marginBottom: spacing.sm, paddingRight: spacing.sm },
    eyeBtn:      { padding: spacing.sm },
    eyeIcon:     { fontSize: 18 },
    forgotText:  { fontSize: font.sm, color: colors.primary, fontWeight: font.semi },
    btn:         { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
    btnDisabled: { opacity: 0.6 },
    btnText:     { color: '#fff', fontWeight: font.bold, fontSize: font.base },
    linkWrap:    { marginTop: spacing.lg, alignItems: 'center' },
    link:        { fontSize: font.sm, color: colors.textMuted },
    linkBold:    { color: colors.primary, fontWeight: font.semi },
})
