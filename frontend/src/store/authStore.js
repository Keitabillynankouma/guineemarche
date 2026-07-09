import { create } from 'zustand'
import { authAPI } from '../services/api'

const useAuthStore = create((set) => ({
    user: null,
    isLoading: false,
    isAuthenticated: !!localStorage.getItem('access_token'),

    // identifier = numéro de téléphone (Guinée) ou email (diaspora)
    login: async (identifier, password) => {
        set({ isLoading: true })
        const isEmail = identifier.includes('@')
        const payload = isEmail
            ? { email: identifier, password }
            : { phone_number: identifier, password }
        const res = await authAPI.login(payload)
        const { tokens, user } = res.data
        localStorage.setItem('access_token', tokens.access)
        localStorage.setItem('refresh_token', tokens.refresh)
        set({ user, isAuthenticated: true, isLoading: false })
        return user
    },

    logout: async () => {
        const refresh = localStorage.getItem('refresh_token')
        try { await authAPI.logout({ refresh }) } catch { }
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, isAuthenticated: false })
    },

    fetchMe: async () => {
        try {
            const res = await authAPI.me()
            set({ user: res.data })
            return res.data
        } catch (e) {
            if (e.response?.status === 401) {
                localStorage.removeItem('access_token')
                localStorage.removeItem('refresh_token')
                set({ user: null, isAuthenticated: false })
            }
            return null
        }
    },

    setUser: (user) => set({ user }),
}))

export default useAuthStore