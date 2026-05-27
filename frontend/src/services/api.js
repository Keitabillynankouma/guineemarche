import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/v1`
    : '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  register: (data) => api.post('/accounts/register/', data),
  verifyOTP: (data) => api.post('/accounts/verify-otp/', data),
  login: (data) => api.post('/accounts/login/', data),
  logout: (data) => api.post('/accounts/logout/', data),
  me: () => api.get('/accounts/me/'),
  resendOTP: (data) => api.post('/accounts/resend-otp/', data),
}

export const listingsAPI = {
  getAll: (params) => api.get('/listings/', { params }),
  getOne: (id) => api.get(`/listings/${id}/`),
  create: (data) => api.post('/listings/', data),
  update: (id, data) => api.put(`/listings/${id}/`, data),
  delete: (id) => api.delete(`/listings/${id}/`),
  myListings: () => api.get('/listings/my/'),
  categories: () => api.get('/listings/categories/'),
  addFavorite: (data) => api.post('/listings/favorites/', data),
  removeFavorite: (id) => api.delete(`/listings/favorites/${id}/`),
  getFavorites: () => api.get('/listings/favorites/'),
}

export const messagingAPI = {
  getConversations: () => api.get('/messaging/'),
  startConversation: (data) => api.post('/messaging/start/', data),
  getMessages: (id) => api.get(`/messaging/${id}/messages/`),
  sendMessage: (id, data) => api.post(`/messaging/${id}/send/`, data),
}

export const ordersAPI = {
  getAll: () => api.get('/orders/'),
  create: (data) => api.post('/orders/', data),
  getOne: (id) => api.get(`/orders/${id}/`),
  updateStatus: (id, action) => api.post(`/orders/${id}/${action}/`),
  pay: (id, data) => api.post(`/orders/${id}/pay/`, data),
}

export default api