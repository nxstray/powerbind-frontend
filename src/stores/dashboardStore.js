import { defineStore } from 'pinia'
import { ref } from 'vue'
import dashboardService from '@/services/dashboardService'

export const useDashboardStore = defineStore('dashboard', () => {
  const summary = ref(null)
  const powerHistory = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function fetchSummary() {
    try {
      loading.value = true
      error.value = null
      summary.value = await dashboardService.getSummary()
    } catch (e) {
      error.value = 'Failed to load dashboard data'
      summary.value = null
    } finally {
      loading.value = false
    }
  }

  async function fetchPowerHistory(hours = 24) {
    try {
      powerHistory.value = await dashboardService.getPowerHistory(hours)
    } catch (e) {
      powerHistory.value = []
    }
  }

  // Update room status from WebSocket push — works even if summary was just loaded
  function updateRoomStatus(status) {
    if (!summary.value || !summary.value.rooms) return
    const idx = summary.value.rooms.findIndex((r) => r.id === status.id)
    if (idx !== -1) {
      // Replace room object to trigger Vue reactivity
      summary.value.rooms[idx] = {
        ...summary.value.rooms[idx],
        presenceDetected: status.presenceDetected,
        relayOn: status.relayOn,
      }
    }
    // Recalculate counts
    summary.value.occupiedRooms = summary.value.rooms.filter((r) => r.presenceDetected).length
    summary.value.activeDevices = summary.value.rooms.filter((r) => r.relayOn).length
  }

  // Update current watts from WebSocket push
  function updateCurrentWatts(watts) {
    if (summary.value) {
      summary.value.currentWatts = watts
    }
  }

  return {
    summary,
    powerHistory,
    loading,
    error,
    fetchSummary,
    fetchPowerHistory,
    updateRoomStatus,
    updateCurrentWatts,
  }
})