import api from '@/utils/api'

// Handles all dashboard and room API calls
const dashboardService = {
  async getSummary() {
    const res = await api.get('/api/dashboard/summary')
    return res.data.data
  },

  async getPowerHistory(hours = 24) {
    const res = await api.get('/api/dashboard/power-history', { params: { hours } })
    return res.data.data
  },

  async getRooms() {
    const res = await api.get('/api/rooms')
    return res.data.data
  },

  // Manual relay control — called only after the user confirms via the
  // validation dialog on the dashboard.
  async setRoomRelay(roomId, relayOn) {
    const res = await api.patch(`/api/rooms/${roomId}/relay`, { relayOn })
    return res.data.data
  },
}

export default dashboardService