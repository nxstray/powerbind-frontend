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
// --- Silent refresh (401 → coba refresh sebelum logout) ---
// Access token berumur 1 jam (jwt.expiration); refresh token 7 hari dan
// ROTATING — response refresh berisi token pair BARU, jadi KEDUANYA harus
// disimpan. Single-flight: concurrent 401 memakai satu refreshPromise yang
// sama, jadi /api/auth/refresh hanya dipanggil sekali per ganti token.
let refreshPromise = null

// URL yang tidak boleh trigger refresh-retry:
// - login: 401 = password salah, bukan token expired
// - refresh: kalau refresh-nya sendiri 401, jangan refresh lagi (infinite loop)
// - logs: konsisten dengan aturan "jangan log ulang /api/logs"
function isRefreshExcluded(url) {
  return (
    !url ||
    url.startsWith('/api/auth/login') ||
    url.startsWith('/api/auth/refresh') ||
    url.startsWith('/api/logs')
  )
}

function clearSession() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  window.location.href = '/login'
}

async function trySilentRefresh(originalError) {
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) {
    clearSession()
    return Promise.reject(originalError)
  }

  try {
    if (!refreshPromise) {
      refreshPromise = api
        .post('/api/auth/refresh', { refreshToken })
        .finally(() => {
          refreshPromise = null
        })
    }
    const res = await refreshPromise
    const { accessToken, refreshToken: newRefreshToken } = res.data.data
    // Simpan KEDUA token — refresh token lama sudah di-revoke backend
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', newRefreshToken)
    return accessToken
  } catch {
    // Refresh token expired/habis → barulah benar-benar logout
    clearSession()
    return Promise.reject(originalError)
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config
    const status = error.response?.status

    // 1. Fire the error to the backend (except when the failing request is the log endpoint itself)
    if (config && config.url !== '/api/logs') {
      const logStatus = status || 'Network Error'
      const msg = `API Error [${logStatus}] on ${config.url}: ${error.message}`

      // Send silently in the background
      api.post('/api/logs', { level: 'ERROR', message: msg }).catch(() => {})
    }

    // 2. 401 → coba silent refresh SEKALI per request, lalu ulangi request asli
    if (status === 401 && config && !isRefreshExcluded(config.url) && !config._retry) {
      config._retry = true
      try {
        const accessToken = await trySilentRefresh(error)
        // Ulangi request asli — request interceptor akan menyematkan token
        // terbaru dari localStorage, tapi tetap set di sini untuk keamanan.
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${accessToken}`
        return api(config)
      } catch (e) {
        // trySilentRefresh sudah clearSession (refresh gagal / token absen)
        return Promise.reject(e)
      }
    }

    // 3. 401 di endpoint auth/logs atau request yang sudah pernah di-retry —
    //    perilaku lama: bersihkan token + redirect
    if (status === 401) {
      clearSession()
    }

    return Promise.reject(error)
  },
)

export default api