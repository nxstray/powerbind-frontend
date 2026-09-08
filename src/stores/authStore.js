import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import authService from '@/services/authService'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref(localStorage.getItem('accessToken') || null)
  const refreshToken = ref(localStorage.getItem('refreshToken') || null)
  const user = ref(null)
  // True until the user replaces the shared default password from .env.
  // Read from login/profile response so it survives page refreshes too.
  const mustChangePassword = ref(false)

  const isLoggedIn = computed(() => !!accessToken.value)

  async function login(username, password) {
    const data = await authService.login(username, password)
    accessToken.value = data.accessToken
    refreshToken.value = data.refreshToken
    mustChangePassword.value = data.mustChangePassword
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
  }

  async function fetchProfile() {
    user.value = await authService.getProfile()
    mustChangePassword.value = user.value.mustChangePassword
  }

  // Called from the mandatory change-password modal. The backend revokes
  // every refresh token for this user (including this session's), but the
  // current access token stays valid until it naturally expires — so this
  // session keeps working without forcing an immediate re-login, while any
  // other device using the old password gets logged out on its next refresh.
  async function changePassword(currentPassword, newPassword) {
    await authService.changePassword(currentPassword, newPassword)
    mustChangePassword.value = false
  }

  async function logout() {
    try {
      if (refreshToken.value) {
        await authService.logout(refreshToken.value)
      }
    } finally {
      accessToken.value = null
      refreshToken.value = null
      user.value = null
      mustChangePassword.value = false
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    }
  }

  return {
    accessToken,
    refreshToken,
    user,
    isLoggedIn,
    mustChangePassword,
    login,
    fetchProfile,
    changePassword,
    logout,
  }
})