import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/v1`
    : 'https://api.guimatrix.com/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
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
  // Guinée — téléphone + OTP SMS
  register: (data) => api.post('/accounts/register/', data),
  verifyOTP: (data) => api.post('/accounts/verify-otp/', data),
  // Diaspora — email + OTP email
  registerEmail: (data) => api.post('/accounts/register/email/', data),
  verifyEmailOTP: (data) => api.post('/accounts/verify-otp/email/', data),
  // Commun
  login: (data) => api.post('/accounts/login/', data),
  logout: (data) => api.post('/accounts/logout/', data),
  me: () => api.get('/accounts/me/'),
  updateProfile: (data) => api.patch('/accounts/me/', data),
  resendOTP: (data) => api.post('/accounts/resend-otp/', data),
  getSubscription: () => api.get('/accounts/subscription/'),
  subscribe: (data) => api.post('/accounts/subscription/', data),
  getBadges: () => api.get('/accounts/badges/'),
}

export const listingsAPI = {
  getAll: (params) => api.get('/listings/', { params }),
  getOne: (id) => api.get(`/listings/${id}/`),
  create: (data) => api.post('/listings/', data),
  update: (id, data) => api.put(`/listings/${id}/`, data),
  delete: (id) => api.delete(`/listings/${id}/`),
  myListings: () => api.get('/listings/my/'),
  boost: (id, data) => api.post(`/listings/${id}/boost/`, data),
  categories: () => api.get('/listings/categories/'),
  categoryAttributes: (id) => api.get(`/listings/categories/${id}/attributes/`),
  banners: (position) => api.get('/listings/banners/', { params: position ? { position } : {} }),
  bannerClick: (id) => api.post(`/listings/banners/${id}/click/`),
  addFavorite: (data) => api.post('/listings/favorites/', data),
  removeFavorite: (id) => api.delete(`/listings/favorites/${id}/`),
  getFavorites: () => api.get('/listings/favorites/'),
  toggleFavorite: (listingId) => api.post(`/listings/${listingId}/favorite/`),
  sellerStats: () => api.get('/listings/my/stats/'),
}

export const shopsAPI = {
  list: (params) => api.get('/accounts/shops/', { params }),
  featured: () => api.get('/accounts/shops/', { params: { featured: true } }),
  getOne: (id) => api.get(`/accounts/shops/${id}/`),
  myShop: () => api.get('/accounts/shop/'),
  saveShop: (data) => api.post('/accounts/shop/', data),
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
  confirmReceipt: (id) => api.post(`/orders/${id}/confirm-receipt/`),
  dispute: (id) => api.post(`/orders/${id}/dispute/`),
  getPickupPoints:   (city) => api.get('/orders/pickup-points/',   { params: city ? { city } : {} }),
  getMeetingZones:   (city) => api.get('/orders/meeting-zones/',   { params: city ? { city } : {} }),
  getDeliveryZones:  (city) => api.get('/orders/delivery-zones/',  { params: city ? { city } : {} }),
  getSeller: () => api.get('/orders/received/'),
  // Livreur
  getMyAssignments:    ()        => api.get('/orders/livreur/assignments/'),
  startDelivery:       (id)      => api.post(`/orders/livreur/assignments/${id}/start/`),
  confirmDelivery:     (id, code)=> api.post(`/orders/livreur/assignments/${id}/confirm/`, { verification_code: code }),
  // Admin — livreurs
  getLivreurs:         ()        => api.get('/orders/admin/livreurs/'),
  getAllAssignments:    (params)  => api.get('/orders/admin/assignments/', { params }),
  assignLivreur:       (orderId, livreurId) => api.post(`/orders/admin/orders/${orderId}/assign/`, { livreur_id: livreurId }),
}

export const reviewsAPI = {
  // data = { order, rating, comment, reviewee (uuid, optionnel — déduit si absent) }
  create:  (data)   => api.post('/reviews/', data),
  getUser: (userId) => api.get(`/reviews/user/${userId}/`),
}

export const referralAPI = {
  getStats: () => api.get('/accounts/referral/'),
}

export default api