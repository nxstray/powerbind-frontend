import api from '@/utils/api'

// Proxied metric queries — the backend polls Prometheus, the browser never
// touches Prometheus or its URL directly.
const metricsService = {
  // All metric names in the TSDB — feeds the custom-metric dropdown
  async getNames() {
    const res = await api.get('/api/admin/metrics/names')
    return res.data.data
  },

  // Range data for one metric: { query, series: [{ name, points: [{ t, v }] }] }
  async query({ metric, groupBy, agg = 'sum', hours = 1, step = 60 }) {
    const res = await api.get('/api/admin/metrics/query', {
      params: { metric, groupBy, agg, hours, step },
    })
    return res.data.data
  },
}

export default metricsService