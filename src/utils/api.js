import axios from 'axios'

// Base axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8045',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle errors and push to backend LogController
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 1. Fire the error to the backend (except when the failing request is the log endpoint itself)
    if (error.config && error.config.url !== '/api/logs') {
      const status = error.response?.status || 'Network Error'
      const msg = `API Error [${status}] on ${error.config.url}: ${error.message}`
      
      // Send silently in the background
      api.post('/api/logs', { level: 'ERROR', message: msg }).catch(() => {})
    }

    // 2. Handle 401 — clear token and redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      window.location.href = '/login'
    }
    
    return Promise.reject(error)
  },
)

export default api