import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/services/authService', () => ({
  default: {
    login: vi.fn(),
    getProfile: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
  },
}))

import authService from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('isLoggedIn true kalau sudah ada accessToken dari localStorage saat store dibuat', () => {
    localStorage.setItem('accessToken', 'token-lama')

    const store = useAuthStore()

    expect(store.isLoggedIn).toBe(true)
    expect(store.accessToken).toBe('token-lama')
  })

  it('state awal kosong kalau localStorage bersih', () => {
    const store = useAuthStore()

    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.user).toBeNull()
    expect(store.isLoggedIn).toBe(false)
    expect(store.mustChangePassword).toBe(false)
  })

  describe('login', () => {
    it('menyimpan token ke state + localStorage dan update mustChangePassword', async () => {
      authService.login.mockResolvedValue({
        accessToken: 'at-baru',
        refreshToken: 'rt-baru',
        mustChangePassword: true,
      })

      const store = useAuthStore()
      await store.login('admin', 'password')

      expect(authService.login).toHaveBeenCalledWith('admin', 'password')
      expect(store.accessToken).toBe('at-baru')
      expect(store.refreshToken).toBe('rt-baru')
      expect(store.mustChangePassword).toBe(true)
      expect(store.isLoggedIn).toBe(true)
      expect(localStorage.getItem('accessToken')).toBe('at-baru')
      expect(localStorage.getItem('refreshToken')).toBe('rt-baru')
    })

    it('melempar error lagi kalau service login gagal tanpa menyimpan token', async () => {
      authService.login.mockRejectedValue(new Error('401 Unauthorized'))

      const store = useAuthStore()

      await expect(store.login('admin', 'salah')).rejects.toThrow('401 Unauthorized')
      expect(store.accessToken).toBeNull()
      expect(store.isLoggedIn).toBe(false)
      expect(localStorage.getItem('accessToken')).toBeNull()
    })
  })

  describe('fetchProfile', () => {
    it('mengisi user dan mustChangePassword dari response profile', async () => {
      authService.getProfile.mockResolvedValue({
        username: 'admin',
        mustChangePassword: true,
      })

      const store = useAuthStore()
      await store.fetchProfile()

      expect(authService.getProfile).toHaveBeenCalledTimes(1)
      expect(store.user).toEqual({ username: 'admin', mustChangePassword: true })
      expect(store.mustChangePassword).toBe(true)
    })
  })

  describe('changePassword', () => {
    it('memanggil service dengan kredensial lama/baru lalu menandai mustChangePassword false', async () => {
      authService.changePassword.mockResolvedValue({})

      const store = useAuthStore()
      store.mustChangePassword = true

      await store.changePassword('lama', 'baru')

      expect(authService.changePassword).toHaveBeenCalledWith('lama', 'baru')
      expect(store.mustChangePassword).toBe(false)
    })

    it('mustChangePassword tetap true kalau service gagal', async () => {
      authService.changePassword.mockRejectedValue(new Error('wrong password'))

      const store = useAuthStore()
      store.mustChangePassword = true

      await expect(store.changePassword('lama', 'baru')).rejects.toThrow('wrong password')
      expect(store.mustChangePassword).toBe(true)
    })
  })

  describe('logout', () => {
    it('memanggil service logout dengan refreshToken lalu membersihkan state + localStorage', async () => {
      authService.logout.mockResolvedValue()

      const store = useAuthStore()
      store.accessToken = 'at'
      store.refreshToken = 'rt'
      store.user = { username: 'admin' }
      store.mustChangePassword = true
      localStorage.setItem('accessToken', 'at')
      localStorage.setItem('refreshToken', 'rt')

      await store.logout()

      expect(authService.logout).toHaveBeenCalledWith('rt')
      expect(store.accessToken).toBeNull()
      expect(store.refreshToken).toBeNull()
      expect(store.user).toBeNull()
      expect(store.mustChangePassword).toBe(false)
      expect(store.isLoggedIn).toBe(false)
      expect(localStorage.getItem('accessToken')).toBeNull()
      expect(localStorage.getItem('refreshToken')).toBeNull()
    })

    it('state dan localStorage tetap dibersihkan walau service logout gagal', async () => {
      authService.logout.mockRejectedValue(new Error('network down'))

      const store = useAuthStore()
      store.accessToken = 'at'
      store.refreshToken = 'rt'
      localStorage.setItem('accessToken', 'at')
      localStorage.setItem('refreshToken', 'rt')

      await expect(store.logout()).resolves.toBeUndefined()

      expect(store.accessToken).toBeNull()
      expect(store.refreshToken).toBeNull()
      expect(localStorage.getItem('accessToken')).toBeNull()
      expect(localStorage.getItem('refreshToken')).toBeNull()
    })

    it('tidak memanggil service logout kalau refreshToken tidak ada', async () => {
      const store = useAuthStore()

      await store.logout()

      expect(authService.logout).not.toHaveBeenCalled()
    })
  })
})
