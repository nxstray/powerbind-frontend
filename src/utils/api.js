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
// --- Silent refresh (401 → try refresh before logout) ---
// Access token lives 1 hour (jwt.expiration); refresh token is 7 days and
// ROTATING — the refresh response contains a NEW token pair, so BOTH must
// be stored. Single-flight: concurrent 401s share one refreshPromise,
// so /api/auth/refresh is called only once per token rotation.
let refreshPromise = null

// URLs that must not trigger a refresh-retry:
// - login: 401 = wrong password, not an expired token
// - refresh: if the refresh itself 401s, don't refresh again (infinite loop)
// - logs: consistent with the "never re-log /api/logs" rule
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
    // Store BOTH tokens — the old refresh token has been revoked by the backend
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', newRefreshToken)
    return accessToken
  } catch {
    // Refresh token expired/used up → only now do we truly log out
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

    // 2. 401 → try a silent refresh ONCE per request, then replay the original request
    if (status === 401 && config && !isRefreshExcluded(config.url) && !config._retry) {
      config._retry = true
      try {
        const accessToken = await trySilentRefresh(error)
        // Replay the original request — the request interceptor will attach the
        // latest token from localStorage, but set it here anyway for safety.
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${accessToken}`
        return api(config)
      } catch (e) {
        // trySilentRefresh already called clearSession (refresh failed / token missing)
        return Promise.reject(e)
      }
    }

    // 3. 401 on auth/logs endpoints or a request that was already retried —
    //    old behavior: clear tokens + redirect
    if (status === 401) {
      clearSession()
    }

    return Promise.reject(error)
  },
)

export default api