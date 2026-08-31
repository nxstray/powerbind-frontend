import api from '@/utils/api'

// Handles all authentication API calls
const authService = {
  async login(username, password) {
    const res = await api.post('/api/auth/login', { username, password })
    return res.data.data
  },

  async getProfile() {
    const res = await api.get('/api/auth/me')
    return res.data.data
  },

  async logout(refreshToken) {
    await api.post('/api/auth/logout', { refreshToken })
  },
}

export default authService