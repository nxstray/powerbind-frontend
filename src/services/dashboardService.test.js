import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Same axios-mocking pattern as api.test.js (vi.hoisted → one shared instance).
const { instance, axiosMock } = vi.hoisted(() => {
  const mockedInstance = Object.assign(vi.fn(), {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    patch: vi.fn(),
  })
  return { instance: mockedInstance, axiosMock: { create: vi.fn(() => mockedInstance) } }
})

vi.mock('axios', () => ({ default: axiosMock }))

import dashboardService from '@/services/dashboardService'

describe('dashboardService', () => {
  beforeEach(() => {
    instance.get.mockReset()
    instance.patch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getSummary memanggil GET /api/dashboard/summary dan mengembalikan data.data', async () => {
    instance.get.mockResolvedValue({ data: { data: { totalRooms: 4, onlineRooms: 2 } } })

    const result = await dashboardService.getSummary()

    expect(instance.get).toHaveBeenCalledWith('/api/dashboard/summary')
    expect(result).toEqual({ totalRooms: 4, onlineRooms: 2 })
  })

  it('getPowerHistory memakai default hours=24 tanpa param eksplisit', async () => {
    instance.get.mockResolvedValue({ data: { data: [] } })

    await dashboardService.getPowerHistory()

    expect(instance.get).toHaveBeenCalledWith('/api/dashboard/power-history', { params: { hours: 24 } })
  })

  it('getPowerHistory meneruskan custom hours ke query params', async () => {
    instance.get.mockResolvedValue({ data: { data: [] } })

    await dashboardService.getPowerHistory(6)

    expect(instance.get).toHaveBeenCalledWith('/api/dashboard/power-history', { params: { hours: 6 } })
  })

  it('getRooms memanggil GET /api/rooms dan mengembalikan daftar room', async () => {
    const rooms = [{ id: 1, name: 'Ruang Tamu', relayOn: false }]
    instance.get.mockResolvedValue({ data: { data: rooms } })

    const result = await dashboardService.getRooms()

    expect(instance.get).toHaveBeenCalledWith('/api/rooms')
    expect(result).toBe(rooms)
  })

  it('setRoomRelay mengirim PATCH /api/rooms/{id}/relay dengan relayOn di body', async () => {
    instance.patch.mockResolvedValue({ data: { data: { id: 7, relayOn: true } } })

    const result = await dashboardService.setRoomRelay(7, true)

    expect(instance.patch).toHaveBeenCalledWith('/api/rooms/7/relay', { relayOn: true })
    expect(result).toEqual({ id: 7, relayOn: true })
  })

  it('setRoomRelay(false) mengirim relayOn false untuk pemadaman relay', async () => {
    instance.patch.mockResolvedValue({ data: { data: { id: 7, relayOn: false } } })

    await dashboardService.setRoomRelay(7, false)

    expect(instance.patch).toHaveBeenCalledWith('/api/rooms/7/relay', { relayOn: false })
  })
})
