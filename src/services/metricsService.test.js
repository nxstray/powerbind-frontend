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

import metricsService from '@/services/metricsService'

describe('metricsService', () => {
  beforeEach(() => {
    instance.get.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getNames memanggil GET /api/admin/metrics/names dan mengembalikan daftar nama metrik', async () => {
    const names = ['jvm_memory_used_bytes', 'powerbind_room_power_watts']
    instance.get.mockResolvedValue({ data: { data: names } })

    const result = await metricsService.getNames()

    expect(instance.get).toHaveBeenCalledWith('/api/admin/metrics/names')
    expect(result).toBe(names)
  })

  it('query memakai default agg=sum, hours=1, step=60 dan meneruskan metric & groupBy', async () => {
    instance.get.mockResolvedValue({ data: { data: { query: 'sum(x)', series: [] } } })

    await metricsService.query({ metric: 'jvm_memory_used_bytes', groupBy: 'area' })

    expect(instance.get).toHaveBeenCalledWith('/api/admin/metrics/query', {
      params: { metric: 'jvm_memory_used_bytes', groupBy: 'area', agg: 'sum', hours: 1, step: 60 },
    })
  })

  it('query meneruskan semua parameter kustom tanpa diubah', async () => {
    instance.get.mockResolvedValue({ data: { data: { query: 'max(x)', series: [] } } })

    await metricsService.query({ metric: 'cpu_usage', groupBy: null, agg: 'max', hours: 6, step: 120 })

    expect(instance.get).toHaveBeenCalledWith('/api/admin/metrics/query', {
      params: { metric: 'cpu_usage', groupBy: null, agg: 'max', hours: 6, step: 120 },
    })
  })

  it('query mengembalikan payload series dari backend (bukan response mentah)', async () => {
    const payload = {
      query: 'sum by (area) (jvm_memory_used_bytes)',
      series: [{ name: 'old gen', points: [{ t: 1, v: 2 }] }],
    }
    instance.get.mockResolvedValue({ data: { data: payload } })

    const result = await metricsService.query({ metric: 'jvm_memory_used_bytes' })

    expect(result).toBe(payload)
  })
})
