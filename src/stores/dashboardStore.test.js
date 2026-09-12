import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/services/dashboardService', () => ({
  default: {
    getSummary: vi.fn(),
    getPowerHistory: vi.fn(),
    getRooms: vi.fn(),
    setRoomRelay: vi.fn(),
  },
}))

import dashboardService from '@/services/dashboardService'
import { useDashboardStore } from '@/stores/dashboardStore'

// Room dummy — bentuknya mengikuti response /api/dashboard/summary
const ROOMS = [
  { id: 1, name: 'Lab A', presenceDetected: true, relayOn: true },
  { id: 2, name: 'Lab B', presenceDetected: false, relayOn: false },
]

describe('dashboardStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('fetchSummary', () => {
    it('mengisi summary, loading false, error null saat sukses', async () => {
      dashboardService.getSummary.mockResolvedValue({
        rooms: ROOMS,
        occupiedRooms: 1,
        activeDevices: 1,
        currentWatts: 120,
      })

      const store = useDashboardStore()
      await store.fetchSummary()

      expect(dashboardService.getSummary).toHaveBeenCalledTimes(1)
      expect(store.summary.occupiedRooms).toBe(1)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('mengisi error dan mengosongkan summary saat request gagal', async () => {
      dashboardService.getSummary.mockRejectedValue(new Error('network down'))

      const store = useDashboardStore()
      await store.fetchSummary()

      expect(store.error).toBe('Failed to load dashboard data')
      expect(store.summary).toBeNull()
      expect(store.loading).toBe(false)
    })

    it('loading true selama request berjalan lalu false di akhir', async () => {
      let resolveGet
      dashboardService.getSummary.mockImplementation(
        () => new Promise((resolve) => (resolveGet = resolve)),
      )

      const store = useDashboardStore()
      const pending = store.fetchSummary()
      expect(store.loading).toBe(true)

      resolveGet({ rooms: [] })
      await pending
      expect(store.loading).toBe(false)
    })
  })

  describe('fetchPowerHistory', () => {
    it('memanggil service dengan jumlah hours lalu mengisi powerHistory', async () => {
      dashboardService.getPowerHistory.mockResolvedValue([{ watts: 100 }])

      const store = useDashboardStore()
      await store.fetchPowerHistory(6)

      expect(dashboardService.getPowerHistory).toHaveBeenCalledWith(6)
      expect(store.powerHistory).toEqual([{ watts: 100 }])
    })

    it('mengosongkan powerHistory saat request gagal', async () => {
      dashboardService.getPowerHistory.mockRejectedValue(new Error('fail'))

      const store = useDashboardStore()
      await store.fetchPowerHistory()

      expect(store.powerHistory).toEqual([])
    })
  })

  describe('updateRoomStatus', () => {
    it('mengupdate relayOn + presenceDetected room yang cocok dan recount', async () => {
      dashboardService.getSummary.mockResolvedValue({
        rooms: [...ROOMS],
        occupiedRooms: 1,
        activeDevices: 1,
      })

      const store = useDashboardStore()
      await store.fetchSummary()
      store.updateRoomStatus({ id: 2, presenceDetected: true, relayOn: true })

      expect(store.summary.rooms[1].presenceDetected).toBe(true)
      expect(store.summary.rooms[1].relayOn).toBe(true)
      expect(store.summary.occupiedRooms).toBe(2)
      expect(store.summary.activeDevices).toBe(2)
    })

    it('tidak crash saat WebSocket push datang sebelum summary terisi', () => {
      const store = useDashboardStore()

      expect(() => store.updateRoomStatus({ id: 1, presenceDetected: true })).not.toThrow()
      expect(store.summary).toBeNull()
    })

    it('id yang tidak ada di rooms tetap aman (tidak crash)', async () => {
      dashboardService.getSummary.mockResolvedValue({
        rooms: [...ROOMS],
        occupiedRooms: 1,
        activeDevices: 1,
      })

      const store = useDashboardStore()
      await store.fetchSummary()

      expect(() => store.updateRoomStatus({ id: 99, presenceDetected: true, relayOn: true })).not.toThrow()
    })
  })

  describe('updateCurrentWatts', () => {
    it('mengupdate currentWatts saat summary ada', async () => {
      dashboardService.getSummary.mockResolvedValue({ rooms: ROOMS, currentWatts: 50 })

      const store = useDashboardStore()
      await store.fetchSummary()
      store.updateCurrentWatts(200)

      expect(store.summary.currentWatts).toBe(200)
    })

    it('tidak crash saat summary masih null (WebSocket push sebelum fetch)', () => {
      const store = useDashboardStore()

      expect(() => store.updateCurrentWatts(99)).not.toThrow()
    })
  })

  describe('setRoomRelay', () => {
    it('menggabungkan hasil API ke room yang cocok dan recount activeDevices', async () => {
      dashboardService.getSummary.mockResolvedValue({
        rooms: [...ROOMS],
        occupiedRooms: 1,
        activeDevices: 1,
      })
      dashboardService.setRoomRelay.mockResolvedValue({ relayOn: true })

      const store = useDashboardStore()
      await store.fetchSummary()
      const updated = await store.setRoomRelay(2, true)

      expect(dashboardService.setRoomRelay).toHaveBeenCalledWith(2, true)
      expect(store.summary.rooms[1].relayOn).toBe(true)
      expect(store.summary.activeDevices).toBe(2)
      expect(updated).toEqual({ relayOn: true })
    })
  })
})
