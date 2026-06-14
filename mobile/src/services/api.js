import axios from 'axios'
import * as SecureStore from 'expo-secure-store'

// ── Base URL — à changer selon l'env ──────────────────────────────────────────
// Dev local   : 'http://192.168.X.X:8000/api/v1'  (IP de votre machine)
// Production  : 'https://votre-app.onrender.com/api/v1'
export const BASE_URL = 'https://guineemarche.onrender.com/api/v1'

const api = axios.create({ baseURL: BASE_URL })

// Injecte le token JWT automatiquement
api.interceptors.request.use(async (config) => {
    try {
        const token = await SecureStore.getItemAsync('access_token')
        if (token) config.headers.Authorization = `Bearer ${token}`
    } catch (_) {}
    return config
})

// Refresh automatique si 401
api.interceptors.response.use(
    res => res,
    async (err) => {
        const original = err.config
        if (err.response?.status === 401 && !original._retry) {
            original._retry = true
            try {
                const refresh = await SecureStore.getItemAsync('refresh_token')
                if (!refresh) return Promise.reject(err)
                const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh })
                await SecureStore.setItemAsync('access_token', data.access)
                original.headers.Authorization = `Bearer ${data.access}`
                return api(original)
            } catch (_) {
                await SecureStore.deleteItemAsync('access_token')
                await SecureStore.deleteItemAsync('refresh_token')
            }
        }
        return Promise.reject(err)
    }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
    login:     (phone, password) => api.post('/auth/login/', { phone_number: phone, password }),
    register:  (data)            => api.post('/auth/register/', data),
    me:        ()                => api.get('/auth/me/'),
    logout:    (refresh)         => api.post('/auth/logout/', { refresh }),
}

// ── Listings ──────────────────────────────────────────────────────────────────
export const listingsAPI = {
    list:      (params)  => api.get('/listings/', { params }),
    detail:    (id)      => api.get(`/listings/${id}/`),
    create:    (data)    => api.post('/listings/', data),
    update:    (id, data)=> api.patch(`/listings/${id}/`, data),
    delete:    (id)      => api.delete(`/listings/${id}/`),
    myListings:()        => api.get('/listings/my-listings/'),
    categories:()        => api.get('/listings/categories/'),
}

// ── Messages ──────────────────────────────────────────────────────────────────
export const messagesAPI = {
    conversations: ()          => api.get('/messages/conversations/'),
    messages:      (userId)    => api.get(`/messages/${userId}/`),
    send:          (userId, text) => api.post(`/messages/${userId}/`, { content: text }),
}

// ── Commandes ─────────────────────────────────────────────────────────────────
export const ordersAPI = {
    list:      ()        => api.get('/orders/'),
    received:  ()        => api.get('/orders/received/'),
    detail:    (id)      => api.get(`/orders/${id}/`),
    create:    (data)    => api.post('/orders/', data),
    action:    (id, act) => api.post(`/orders/${id}/${act}/`),
    pay:       (id, data)=> api.post(`/orders/${id}/pay/`, data),
}

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifAPI = {
    list:      ()      => api.get('/notifications/'),
    markRead:  (id)    => api.patch(`/notifications/${id}/read/`),
    markAll:   ()      => api.post('/notifications/mark-all-read/'),
}

// ── Avis ──────────────────────────────────────────────────────────────────────
export const reviewsAPI = {
    forUser:   (userId) => api.get(`/reviews/user/${userId}/`),
    create:    (data)   => api.post('/reviews/', data),
}

export default api
