import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { authAPI } from '../services/api'

const useAuthStore = create((set, get) => ({
    user:            null,
    token:           null,
    isAuthenticated: false,
    loading:         false,

    login: async (phone, password) => {
        set({ loading: true })
        const { data } = await authAPI.login(phone, password)
        // Le backend renvoie { tokens: { access, refresh }, user }
        const access  = data.tokens?.access  || data.access
        const refresh = data.tokens?.refresh || data.refresh
        await SecureStore.setItemAsync('access_token',  access)
        await SecureStore.setItemAsync('refresh_token', refresh)
        set({ token: access, user: data.user || null, isAuthenticated: true, loading: false })
    },

    fetchMe: async () => {
        try {
            const { data } = await authAPI.me()
            set({ user: data })
        } catch (_) {}
    },

    logout: async () => {
        try {
            const refresh = await SecureStore.getItemAsync('refresh_token')
            if (refresh) await authAPI.logout(refresh)
        } catch (_) {}
        await SecureStore.deleteItemAsync('access_token')
        await SecureStore.deleteItemAsync('refresh_token')
        set({ user: null, token: null, isAuthenticated: false })
    },

    restoreSession: async () => {
        try {
            const token = await SecureStore.getItemAsync('access_token')
            if (token) {
                set({ token, isAuthenticated: true })
                await get().fetchMe()
            }
        } catch (_) {}
    },
}))

export default useAuthStore
