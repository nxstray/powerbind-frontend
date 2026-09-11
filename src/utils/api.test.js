import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock axios sebelum import api.js supaya axios.create() mengembalikan instance
// tiruan yang bisa kita intip interceptor-nya (tanpa request jaringan sungguhan).
// Dibuat lewat vi.hoisted supaya objek yang SAMA dipakai oleh setiap evaluasi
// factory vi.mock (module runner Vitest 5 bisa mengevaluasi factory lebih dari
// sekali — tanpa ini, salinan axios di test dan di api.js bisa berbeda).
const { instance, axiosMock } = vi.hoisted(() => {
  const mockedInstance = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    post: vi.fn(),
  }
  return { instance: mockedInstance, axiosMock: { create: vi.fn(() => mockedInstance) } }
})

vi.mock('axios', () => ({ default: axiosMock }))

import api from '@/utils/api'

// Ambil handler interceptor yang terdaftar saat modul api.js dieksekusi.
const requestHandler = instance.interceptors.request.use.mock.calls[0][0]
const responseHandler = instance.interceptors.response.use.mock.calls[0][0]
const responseErrorHandler = instance.interceptors.response.use.mock.calls[0][1]

describe('request interceptor api.js', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('menyematkan header Authorization Bearer kalau ada token di localStorage', () => {
    localStorage.setItem('accessToken', 'token-rahasia')

    const config = requestHandler({ headers: {} })

    expect(config.headers.Authorization).toBe('Bearer token-rahasia')
  })

  it('tidak menyematkan header Authorization kalau token tidak ada', () => {
    const config = requestHandler({ headers: {} })

    expect(config.headers.Authorization).toBeUndefined()
  })

  it('mengembalikan config yang sama untuk dilempar ke handler berikutnya', () => {
    const config = { headers: {} }

    expect(requestHandler(config)).toBe(config)
  })
})

describe('response interceptor api.js', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal(
      'window',
      Object.assign(Object.create(Object.getPrototypeOf(window)), window, {
        location: { href: '' },
      }),
    )
    instance.post.mockReset()
    instance.post.mockResolvedValue({})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('melewatkan response sukses tanpa diubah', () => {
    const response = { data: { data: 'ok' } }

    expect(responseHandler(response)).toBe(response)
  })

  it('mengirim log error ke backend kalau request gagal (bukan endpoint log)', async () => {
    const error = {
      config: { url: '/api/rooms' },
      response: { status: 500 },
      message: 'Internal Server Error',
    }

    await expect(responseErrorHandler(error)).rejects.toBe(error)

    expect(instance.post).toHaveBeenCalledTimes(1)
    expect(instance.post).toHaveBeenCalledWith('/api/logs', {
      level: 'ERROR',
      message: 'API Error [500] on /api/rooms: Internal Server Error',
    })
  })

  it('menggunakan "Network Error" sebagai status kalau response tidak ada', async () => {
    const error = {
      config: { url: '/api/rooms' },
      response: undefined,
      message: 'Network Error',
    }

    await expect(responseErrorHandler(error)).rejects.toBe(error)

    expect(instance.post).toHaveBeenCalledWith('/api/logs', {
      level: 'ERROR',
      message: 'API Error [Network Error] on /api/rooms: Network Error',
    })
  })

  it('tidak mengirim ulang log kalau request yang gagal adalah endpoint log sendiri', async () => {
    const error = {
      config: { url: '/api/logs' },
      response: { status: 500 },
      message: 'Internal Server Error',
    }

    await expect(responseErrorHandler(error)).rejects.toBe(error)

    expect(instance.post).not.toHaveBeenCalled()
  })

  it('kalau status 401: hapus kedua token dari localStorage dan redirect ke /login', async () => {
    localStorage.setItem('accessToken', 'at')
    localStorage.setItem('refreshToken', 'rt')

    const error = {
      config: { url: '/api/rooms' },
      response: { status: 401 },
      message: 'Unauthorized',
    }

    await expect(responseErrorHandler(error)).rejects.toBe(error)

    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('kalau status 401 pada endpoint log: tetap redirect tapi tidak log ulang', async () => {
    const error = {
      config: { url: '/api/logs' },
      response: { status: 401 },
      message: 'Unauthorized',
    }

    await expect(responseErrorHandler(error)).rejects.toBe(error)

    expect(instance.post).not.toHaveBeenCalled()
    expect(window.location.href).toBe('/login')
  })

  it('kalau status bukan 401: token tidak disentuh dan tidak redirect', async () => {
    localStorage.setItem('accessToken', 'at')
    localStorage.setItem('refreshToken', 'rt')

    const error = {
      config: { url: '/api/rooms' },
      response: { status: 403 },
      message: 'Forbidden',
    }

    await expect(responseErrorHandler(error)).rejects.toBe(error)

    expect(localStorage.getItem('accessToken')).toBe('at')
    expect(localStorage.getItem('refreshToken')).toBe('rt')
    expect(window.location.href).toBe('')
  })

  it('gagal mengirim log tidak membuat handler melempar error tambahan', async () => {
    instance.post.mockRejectedValue(new Error('log endpoint down'))

    const error = {
      config: { url: '/api/rooms' },
      response: { status: 503 },
      message: 'Service Unavailable',
    }

    await expect(responseErrorHandler(error)).rejects.toBe(error)
    expect(instance.post).toHaveBeenCalledTimes(1)
  })
})
