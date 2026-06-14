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
        await SecureStore.setItemAsync('access_token',  data.access)
        await SecureStore.setItemAsync('refresh_token', data.refresh)
        set({ token: data.access, isAuthenticated: true, loading: false })
        await get().fetchMe()
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
