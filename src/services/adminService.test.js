import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Same axios-mocking pattern as api.test.js (vi.hoisted → one shared instance).
const { instance, axiosMock } = vi.hoisted(() => {
  const mockedInstance = Object.assign(vi.fn(), {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
  })
  return { instance: mockedInstance, axiosMock: { create: vi.fn(() => mockedInstance) } }
})

vi.mock('axios', () => ({ default: axiosMock }))

import adminService from '@/services/adminService'

// Helper: fake fetch response with an SSE body readable via reader.read()
// (same pattern as agentService.test.js).
function sseResponse(chunks, { ok = true, status = 200 } = {}) {
  let index = 0
  return {
    ok,
    status,
    body: {
      getReader() {
        return {
          async read() {
            if (index < chunks.length) return { done: false, value: chunks[index++] }
            return { done: true, value: undefined }
          },
        }
      },
    },
  }
}

describe('adminService — axios endpoints', () => {
  beforeEach(() => {
    instance.get.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getErdSchema memanggil GET /api/admin/erd dan mengembalikan data.data', async () => {
    const schema = { tables: [{ name: 'users' }], relations: [] }
    instance.get.mockResolvedValue({ data: { data: schema } })

    const result = await adminService.getErdSchema()

    expect(instance.get).toHaveBeenCalledWith('/api/admin/erd')
    expect(result).toBe(schema)
  })

  it('getErdTableCode meng-encode nama tabel di URL', async () => {
    instance.get.mockResolvedValue({ data: { data: { className: 'User', code: 'class User {}' } } })

    const result = await adminService.getErdTableCode('user_roles')

    expect(instance.get).toHaveBeenCalledWith('/api/admin/erd/user_roles/code')
    expect(result).toEqual({ className: 'User', code: 'class User {}' })
  })

  it('getErdTableRows mengirim params page & size (default 0/50)', async () => {
    instance.get.mockResolvedValue({ data: { data: { rows: [], total: 0 } } })

    await adminService.getErdTableRows('users')

    expect(instance.get).toHaveBeenCalledWith('/api/admin/erd/users/rows', {
      params: { page: 0, size: 50 },
    })
  })

  it('getErdTableRows meneruskan page & size kustom', async () => {
    instance.get.mockResolvedValue({ data: { data: { rows: [], total: 0 } } })

    await adminService.getErdTableRows('users', 2, 10)

    expect(instance.get).toHaveBeenCalledWith('/api/admin/erd/users/rows', {
      params: { page: 2, size: 10 },
    })
  })

  it('queryLogs memakai default source=ALL, since=1h, limit=300', async () => {
    instance.get.mockResolvedValue({ data: { data: [] } })

    await adminService.queryLogs()

    expect(instance.get).toHaveBeenCalledWith('/api/admin/logs', {
      params: { source: 'ALL', level: undefined, search: undefined, since: '1h', limit: 300 },
    })
  })

  it('queryLogs meneruskan filter kustom', async () => {
    instance.get.mockResolvedValue({ data: { data: [] } })

    await adminService.queryLogs({ source: 'BACKEND', level: 'ERROR', search: 'mqtt', since: '24h', limit: 50 })

    expect(instance.get).toHaveBeenCalledWith('/api/admin/logs', {
      params: { source: 'BACKEND', level: 'ERROR', search: 'mqtt', since: '24h', limit: 50 },
    })
  })
})

describe('adminService — streamErdExplain (SSE)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('mengirim POST dengan Bearer token, payload JSON, dan meneruskan token AI ke onChunk', async () => {
    localStorage.setItem('accessToken', 'token-erd')
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([new TextEncoder().encode('data: Kolom\n\ndata: id_users\n\ndata:[DONE]\n\n')]),
    )
    vi.stubGlobal('fetch', fetchMock)
    const onChunk = vi.fn()
    const onDone = vi.fn()

    await adminService.streamErdExplain(
      { table: 'users', column: 'id', type: 'BIGINT', primaryKey: true, foreignKey: false, relations: [] },
      onChunk,
      onDone,
      vi.fn(),
    )

    expect(fetchMock.mock.calls[0][0]).toContain('/api/admin/erd/explain')
    const options = fetchMock.mock.calls[0][1]
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer token-erd')
    expect(JSON.parse(options.body)).toEqual({
      table: 'users',
      column: 'id',
      type: 'BIGINT',
      primaryKey: true,
      foreignKey: false,
      relations: [],
    })
    // 'data:' tanpa spasi dari backend — konten diteruskan apa adanya, [DONE] tersaring
    expect(onChunk.mock.calls.map((c) => c[0])).toEqual([' Kolom', ' id_users'])
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('memanggil onError saat response tidak ok (mis. HTTP 403)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse([], { ok: false, status: 403 })))
    const onError = vi.fn()
    const onDone = vi.fn()

    await adminService.streamErdExplain({ table: 't', column: 'c' }, vi.fn(), onDone, onError)

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'HTTP 403' }))
    expect(onDone).not.toHaveBeenCalled()
  })

  it('memanggil onError saat fetch gagal (network down)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const onError = vi.fn()

    await adminService.streamErdExplain({ table: 't', column: 'c' }, vi.fn(), vi.fn(), onError)

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'network down' }))
  })
})
