import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock axios sebelum import api.js supaya axios.create() mengembalikan instance
// tiruan yang bisa kita intip interceptor-nya (tanpa request jaringan sungguhan).
// Dibuat lewat vi.hoisted supaya objek yang SAMA dipakai oleh setiap evaluasi
// factory vi.mock (module runner Vitest 5 bisa mengevaluasi factory lebih dari
// sekali — tanpa ini, salinan axios di test dan di api.js bisa berbeda).
const { instance, axiosMock } = vi.hoisted(() => {
  // Instance harus CALLABLE: interceptor refresh di api.js mengulang request
  // asli lewat api(config) → memanggil instance(config) langsung.
  const mockedInstance = Object.assign(vi.fn(), {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    post: vi.fn(),
  })
  return { instance: mockedInstance, axiosMock: { create: vi.fn(() => mockedInstance) } }
})

vi.mock('axios', () => ({ default: axiosMock }))

// Side-effect import: mengeksekusi modul api.js agar interceptor-nya
// terdaftar — binding `api` sendiri tidak dipakai test (handler diintip
// lewat mock instance).
import '@/utils/api'

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
    instance.mockReset()
    instance.mockResolvedValue({ data: { data: 'ok' } })
    // Module-level state refreshPromise di api.js harus bersih antar test —
    // cukup dengan mockReset di atas karena promise selesai di setiap test.
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

  it('401 + refresh sukses: simpan token pair BARU lalu ulangi request asli tanpa redirect', async () => {
    localStorage.setItem('accessToken', 'at-lama')
    localStorage.setItem('refreshToken', 'rt-lama')
    // instance.post: /api/logs (error log) → {}; /api/auth/refresh → token pair baru
    instance.post.mockImplementation((url) => {
      if (url === '/api/auth/refresh') {
        return Promise.resolve({
          data: { data: { accessToken: 'at-baru', refreshToken: 'rt-baru' } },
        })
      }
      return Promise.resolve({})
    })
    instance.mockResolvedValue({ data: { data: 'ok' } }) // jawaban retry request asli

    const error = {
      config: { url: '/api/rooms', headers: {} },
      response: { status: 401 },
      message: 'Unauthorized',
    }

    await responseErrorHandler(error)

    // Refresh dipanggil dengan refreshToken lama
    expect(instance.post).toHaveBeenCalledWith('/api/auth/refresh', {
      refreshToken: 'rt-lama',
    })
    // ROTATING: KEDUA token baru tersimpan
    expect(localStorage.getItem('accessToken')).toBe('at-baru')
    expect(localStorage.getItem('refreshToken')).toBe('rt-baru')
    // Request asli diulang dengan token baru, tanpa redirect
    expect(instance).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/rooms' }),
    )
    expect(error.config.headers.Authorization).toBe('Bearer at-baru')
    expect(window.location.href).toBe('')
  })

  it('401 + refresh gagal (refresh token expired): bersihkan token lalu redirect', async () => {
    localStorage.setItem('accessToken', 'at')
    localStorage.setItem('refreshToken', 'rt-mati')
    instance.post.mockImplementation((url) => {
      if (url === '/api/auth/refresh') {
        return Promise.reject({ response: { status: 401 } })
      }
      return Promise.resolve({})
    })

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

  it('401 tanpa refreshToken di localStorage: langsung clear + redirect tanpa refresh', async () => {
    localStorage.setItem('accessToken', 'at')

    const error = {
      config: { url: '/api/rooms' },
      response: { status: 401 },
      message: 'Unauthorized',
    }

    await expect(responseErrorHandler(error)).rejects.toBe(error)

    const refreshCalls = instance.post.mock.calls.filter(
      ([url]) => url === '/api/auth/refresh',
    )
    expect(refreshCalls).toHaveLength(0)
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('401 di /api/auth/login (password salah): tidak refresh, langsung clear + redirect', async () => {
    localStorage.setItem('accessToken', 'at')
    localStorage.setItem('refreshToken', 'rt')

    const error = {
      config: { url: '/api/auth/login' },
      response: { status: 401 },
      message: 'Bad credentials',
    }

    await expect(responseErrorHandler(error)).rejects.toBe(error)

    const refreshCalls = instance.post.mock.calls.filter(
      ([url]) => url === '/api/auth/refresh',
    )
    expect(refreshCalls).toHaveLength(0)
    expect(localStorage.getItem('refreshToken')).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('401 di /api/auth/refresh sendiri: tidak refresh ulang (anti infinite loop)', async () => {
    localStorage.setItem('refreshToken', 'rt')

    const error = {
      config: { url: '/api/auth/refresh' },
      response: { status: 401 },
      message: 'Invalid refresh token',
    }

    await expect(responseErrorHandler(error)).rejects.toBe(error)

    const refreshCalls = instance.post.mock.calls.filter(
      ([url]) => url === '/api/auth/refresh',
    )
    expect(refreshCalls).toHaveLength(0)
    expect(localStorage.getItem('refreshToken')).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('dua 401 bersamaan: refresh hanya dipanggil SEKALI (single-flight), keduanya retry', async () => {
    localStorage.setItem('accessToken', 'at-lama')
    localStorage.setItem('refreshToken', 'rt-lama')
    instance.post.mockImplementation((url) => {
      if (url === '/api/auth/refresh') {
        return Promise.resolve({
          data: { data: { accessToken: 'at-baru', refreshToken: 'rt-baru' } },
        })
      }
      return Promise.resolve({})
    })
    instance.mockResolvedValue({ data: { data: 'ok' } })

    const e1 = {
      config: { url: '/api/rooms', headers: {} },
      response: { status: 401 },
      message: 'Unauthorized',
    }
    const e2 = {
      config: { url: '/api/dashboard/summary', headers: {} },
      response: { status: 401 },
      message: 'Unauthorized',
    }

    await Promise.allSettled([responseErrorHandler(e1), responseErrorHandler(e2)])

    const refreshCalls = instance.post.mock.calls.filter(
      ([url]) => url === '/api/auth/refresh',
    )
    expect(refreshCalls).toHaveLength(1)
    // Kedua request asli diulang dengan token baru
    expect(e1.config.headers.Authorization).toBe('Bearer at-baru')
    expect(e2.config.headers.Authorization).toBe('Bearer at-baru')
    expect(localStorage.getItem('refreshToken')).toBe('rt-baru')
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
