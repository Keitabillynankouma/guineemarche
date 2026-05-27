import { create } from 'zustand'
import { authAPI } from '../services/api'

const useAuthStore = create((set) => ({
    user: null,
    isLoading: false,
    isAuthenticated: !!localStorage.getItem('access_token'),

    login: async (phone_number, password) => {
        set({ isLoading: true })
        const res = await authAPI.login({ phone_number, password })
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
        const res = await authAPI.me()
        set({ user: res.data })
        return res.data
    },

    setUser: (user) => set({ user }),
}))

export default useAuthStore