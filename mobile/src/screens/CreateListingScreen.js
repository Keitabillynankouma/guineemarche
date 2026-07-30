import React, { useState } from 'react'
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    StyleSheet, Alert, ActivityIndicator, Image, Platform,
    KeyboardAvoidingView,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listingsAPI } from '../services/api'
import { colors, spacing, radius, font } from '../theme'
import { VILLES, getCommunesByVille } from '../constants/communes'

const CONDITIONS = [
    { v: 'new',           l: '🆕 Neuf' },
    { v: 'like_new',      l: '✨ Comme neuf' },
    { v: 'good',          l: '👍 Bon état' },
    { v: 'fair',          l: '⚠️ État correct' },
    { v: 'for_parts',     l: '🔧 Pour pièces' },
]

const DELIVERY_MODES = [
    { v: 'pickup',   l: '🤝 Remise en main propre' },
    { v: 'delivery', l: '🚚 Livraison à domicile' },
    { v: 'both',     l: '🔄 Les deux' },
]

export default function CreateListingScreen({ navigation }) {
    const qc = useQueryClient()

    const [form, setForm] = useState({
        title: '',
        description: '',
        price: '',
        city: 'Conakry',
        quartier: '',
        condition: 'good',
        delivery_mode: 'pickup',
        category: '',
    })
    const [images, setImages] = useState([])   // array of { uri, base64? }

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const setCity = (city) => setForm(f => ({ ...f, city, quartier: '' }))

    const communes = getCommunesByVille(form.city)

    // Fetch categories
    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn:  () => listingsAPI.categories().then(r => r.data),
    })

    // Pick image from gallery
    const pickImage = async () => {
        if (images.length >= 5) {
            Alert.alert('Maximum atteint', 'Vous pouvez ajouter au maximum 5 photos.')
            return
        }
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (status !== 'granted') {
            Alert.alert('Permission refusée', 'Autorisez l\'accès à vos photos dans les paramètres.')
            return
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: false,
            quality: 0.7,
        })
        if (!result.canceled && result.assets?.length) {
            setImages(prev => [...prev, result.assets[0]])
        }
    }

    const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx))

    // Submit
    const mutation = useMutation({
        mutationFn: async () => {
            if (!form.title || !form.price) {
                throw new Error('Le titre et le prix sont obligatoires.')
            }
            if (isNaN(Number(form.price)) || Number(form.price) <= 0) {
                throw new Error('Le prix doit être un nombre positif.')
            }

            const data = new FormData()
            Object.entries(form).forEach(([k, v]) => {
                if (v) data.append(k, String(v))
            })
            images.forEach((img, idx) => {
                const ext = img.uri.split('.').pop() || 'jpg'
                data.append('images', {
                    uri: img.uri,
                    name: `photo_${idx}.${ext}`,
                    type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
                })
            })
            return listingsAPI.create(data)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['listings'] })
            qc.invalidateQueries({ queryKey: ['my-listings'] })
            Alert.alert('✅ Annonce publiée !', 'Votre annonce est maintenant visible.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ])
        },
        onError: (e) => {
            const msg = e.message || e.response?.data?.detail || Object.values(e.response?.data || {}).flat().join('\n') || 'Une erreur est survenue.'
            Alert.alert('Erreur', msg)
        },
    })

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: colors.bg }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Text style={styles.backIcon}>‹</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Nouvelle annonce</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Photos */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📸 Photos ({images.length}/5)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
                        {images.map((img, idx) => (
                            <View key={idx} style={styles.imgWrap}>
                                <Image source={{ uri: img.uri }} style={styles.img} />
                                <TouchableOpacity onPress={() => removeImage(idx)} style={styles.imgRemove}>
                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                        {images.length < 5 && (
                            <TouchableOpacity onPress={pickImage} style={styles.addImgBtn}>
                                <Text style={styles.addImgIcon}>+</Text>
                                <Text style={styles.addImgText}>Ajouter</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </View>

                {/* Titre */}
                <View style={styles.section}>
                    <Text style={styles.label}>Titre <Text style={{ color: colors.danger }}>*</Text></Text>
                    <TextInput
                        style={styles.input}
                        value={form.title}
                        onChangeText={v => set('title', v)}
                        placeholder="Ex : iPhone 13 Pro Max 256Go"
                        placeholderTextColor={colors.textMuted}
                        maxLength={100}
                    />

                    <Text style={styles.label}>Description</Text>
                    <TextInput
                        style={[styles.input, styles.textarea]}
                        value={form.description}
                        onChangeText={v => set('description', v)}
                        placeholder="Décrivez votre article (état, accessoires inclus, raison de la vente…)"
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                </View>

                {/* Prix */}
                <View style={styles.section}>
                    <Text style={styles.label}>Prix (GNF) <Text style={{ color: colors.danger }}>*</Text></Text>
                    <TextInput
                        style={styles.input}
                        value={form.price}
                        onChangeText={v => set('price', v)}
                        placeholder="Ex : 5000000"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                    />
                    {form.price && !isNaN(Number(form.price)) && (
                        <Text style={styles.pricePreview}>
                            ≈ {new Intl.NumberFormat('fr-GN').format(Number(form.price))} GNF
                        </Text>
                    )}
                </View>

                {/* Catégorie */}
                {categories.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.label}>Catégorie</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {categories.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    onPress={() => set('category', cat.id)}
                                    style={[styles.pill, form.category === cat.id && styles.pillActive]}
                                >
                                    <Text style={[styles.pillText, form.category === cat.id && styles.pillTextActive]}>
                                        {cat.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Ville */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📍 Localisation</Text>
                    <Text style={styles.label}>Ville</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                        {VILLES.map(v => (
                            <TouchableOpacity
                                key={v}
                                onPress={() => setCity(v)}
                                style={[styles.pill, form.city === v && styles.pillActive]}
                            >
                                <Text style={[styles.pillText, form.city === v && styles.pillTextActive]}>{v}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {communes.length > 0 && (
                        <>
                            <Text style={styles.label}>Quartier / Commune</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.xs }}>
                                {communes.map(q => (
                                    <TouchableOpacity
                                        key={q}
                                        onPress={() => set('quartier', q)}
                                        style={[styles.pill, form.quartier === q && styles.pillActive]}
                                    >
                                        <Text style={[styles.pillText, form.quartier === q && styles.pillTextActive]}>{q}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </>
                    )}
                </View>

                {/* État */}
                <View style={styles.section}>
                    <Text style={styles.label}>État de l'article</Text>
                    {CONDITIONS.map(c => (
                        <TouchableOpacity
                            key={c.v}
                            onPress={() => set('condition', c.v)}
                            style={[styles.radioRow, form.condition === c.v && styles.radioRowActive]}
                        >
                            <View style={[styles.radio, form.condition === c.v && styles.radioChecked]}>
                                {form.condition === c.v && <View style={styles.radioDot} />}
                            </View>
                            <Text style={styles.radioLabel}>{c.l}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Mode de livraison */}
                <View style={styles.section}>
                    <Text style={styles.label}>Mode de livraison</Text>
                    {DELIVERY_MODES.map(m => (
                        <TouchableOpacity
                            key={m.v}
                            onPress={() => set('delivery_mode', m.v)}
                            style={[styles.radioRow, form.delivery_mode === m.v && styles.radioRowActive]}
                        >
                            <View style={[styles.radio, form.delivery_mode === m.v && styles.radioChecked]}>
                                {form.delivery_mode === m.v && <View style={styles.radioDot} />}
                            </View>
                            <Text style={styles.radioLabel}>{m.l}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Publier */}
                <TouchableOpacity
                    style={[styles.btn, mutation.isPending && styles.btnDisabled]}
                    onPress={() => mutation.mutate()}
                    disabled={mutation.isPending}
                    activeOpacity={0.85}
                >
                    {mutation.isPending
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.btnText}>📢 Publier l'annonce</Text>
                    }
                </TouchableOpacity>

                <View style={{ height: spacing.xxl }} />
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    container:      { flexGrow: 1 },
    header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn:        { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    backIcon:       { fontSize: 28, color: colors.text, fontWeight: '300' },
    title:          { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    section:        { backgroundColor: colors.white, marginTop: spacing.sm, padding: spacing.lg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
    sectionTitle:   { fontSize: font.base, fontWeight: font.semi, color: colors.text, marginBottom: spacing.sm },
    label:          { fontSize: font.sm, fontWeight: font.semi, color: colors.textMuted, marginBottom: 6, marginTop: spacing.sm },
    input:          { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: font.base, color: colors.text, backgroundColor: colors.bg },
    textarea:       { minHeight: 100, textAlignVertical: 'top' },
    pricePreview:   { fontSize: font.sm, color: colors.primary, marginTop: 4 },
    // Images
    imgWrap:        { position: 'relative', marginRight: spacing.sm },
    img:            { width: 90, height: 90, borderRadius: radius.md },
    imgRemove:      { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
    addImgBtn:      { width: 90, height: 90, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
    addImgIcon:     { fontSize: 28, color: colors.textMuted },
    addImgText:     { fontSize: font.sm, color: colors.textMuted },
    // Pills
    pill:           { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
    pillActive:     { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    pillText:       { fontSize: font.sm, color: colors.textMuted },
    pillTextActive: { color: colors.primary, fontWeight: font.semi },
    // Radio
    radioRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md, marginBottom: 4 },
    radioRowActive: { backgroundColor: colors.primaryLight },
    radio:          { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    radioChecked:   { borderColor: colors.primary },
    radioDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    radioLabel:     { fontSize: font.base, color: colors.text },
    // Button
    btn:            { margin: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md + 2, alignItems: 'center' },
    btnDisabled:    { opacity: 0.6 },
    btnText:        { color: '#fff', fontWeight: font.bold, fontSize: font.base },
})
