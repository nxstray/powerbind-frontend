import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Same axios-mocking pattern as api.test.js: vi.hoisted keeps ONE shared mock
// instance across module evaluations, so authService's imported `api` and the
// instance we assert on are guaranteed to be the same object.
const { instance, axiosMock } = vi.hoisted(() => {
  const mockedInstance = Object.assign(vi.fn(), {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  })
  return { instance: mockedInstance, axiosMock: { create: vi.fn(() => mockedInstance) } }
})

vi.mock('axios', () => ({ default: axiosMock }))

import authService from '@/services/authService'

describe('authService', () => {
  beforeEach(() => {
    instance.get.mockReset()
    instance.post.mockReset()
    instance.put.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('login mengirim POST /api/auth/login dengan username & password dan mengembalikan data.data', async () => {
    instance.post.mockResolvedValue({ data: { data: { accessToken: 'at', refreshToken: 'rt' } } })

    const result = await authService.login('admin', 'rahasia')

    expect(instance.post).toHaveBeenCalledWith('/api/auth/login', { username: 'admin', password: 'rahasia' })
    expect(result).toEqual({ accessToken: 'at', refreshToken: 'rt' })
  })

  it('getProfile memanggil GET /api/auth/me dan mengembalikan data.data', async () => {
    instance.get.mockResolvedValue({ data: { data: { username: 'admin', role: 'ADMIN' } } })

    const result = await authService.getProfile()

    expect(instance.get).toHaveBeenCalledWith('/api/auth/me')
    expect(result).toEqual({ username: 'admin', role: 'ADMIN' })
  })

  it('refresh mengirim POST /api/auth/refresh dengan refreshToken dan mengembalikan pasangan token baru', async () => {
    instance.post.mockResolvedValue({
      data: { data: { accessToken: 'at-baru', refreshToken: 'rt-baru', mustChangePassword: false } },
    })

    const result = await authService.refresh('rt-lama')

    expect(instance.post).toHaveBeenCalledWith('/api/auth/refresh', { refreshToken: 'rt-lama' })
    expect(result).toEqual({ accessToken: 'at-baru', refreshToken: 'rt-baru', mustChangePassword: false })
  })

  it('logout mengirim POST /api/auth/logout dengan refreshToken (tanpa nilai balik)', async () => {
    instance.post.mockResolvedValue({})

    await authService.logout('rt-lama')

    expect(instance.post).toHaveBeenCalledWith('/api/auth/logout', { refreshToken: 'rt-lama' })
  })

  it('changePassword mengirim PUT /api/auth/change-password dengan password lama & baru', async () => {
    instance.put.mockResolvedValue({ data: { data: { message: 'ok' } } })

    const result = await authService.changePassword('lama', 'baru')

    expect(instance.put).toHaveBeenCalledWith('/api/auth/change-password', {
      currentPassword: 'lama',
      newPassword: 'baru',
    })
    expect(result).toEqual({ message: 'ok' })
  })
})
