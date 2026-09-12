import api from '@/utils/api'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8045'

// SSE helpers — same implementation as agentService.js (kept local so this
// service stays standalone; axios can't stream a response in the browser,
// so streams are consumed with fetch + ReadableStream)
function extractSseEvents(buffer) {
  const events = []
  let sepIndex

  while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
    const rawEvent = buffer.slice(0, sepIndex)
    buffer = buffer.slice(sepIndex + 2)

    const content = rawEvent
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      // KONTRAK BACKEND KITA: Spring SSE writer (AdminController) menulis
      // 'data:' langsung diikuti konten — TANPA spasi delimiter. Spasi setelah
      // 'data:' adalah bagian dari token AI itu sendiri (word-boundary
      // tokenizer) — JANGAN dibuang, kalau tidak kata-kata menyatu.
      .map((l) => l.slice(5))
      .join('\n')

    if (content) events.push(content)
  }

  return { events, remainder: buffer }
}

async function consumeSseStream(response, onChunk) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const { events, remainder } = extractSseEvents(buffer)
    buffer = remainder

    for (const content of events) {
      if (content !== '[DONE]') onChunk(content)
    }
  }
}

// Handles the admin-only API calls: the auto-generated ERD schema, the AI
// column explanation stream, and the merged Backend/Frontend/IoT log stream.
const adminService = {
  async getErdSchema() {
    const res = await api.get('/api/admin/erd')
    return res.data.data
  },

  // Stream an AI explanation of a single ERD PK/FK column via SSE.
  // payload: { table, column, type, primaryKey, foreignKey, relations }
  async streamErdExplain(payload, onChunk, onDone, onError, signal) {
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`${BASE_URL}/api/admin/erd/explain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      await consumeSseStream(response, onChunk)
      onDone()
    } catch (err) {
      onError(err)
    }
  },

  // Reconstructed Java entity code for one ERD table (reflection-based)
  async getErdTableCode(table) {
    const res = await api.get(`/api/admin/erd/${encodeURIComponent(table)}/code`)
    return res.data.data
  },

  // Read-only paginated preview of a table's rows (pgAdmin-style)
  async getErdTableRows(table, page = 0, size = 50) {
    const res = await api.get(`/api/admin/erd/${encodeURIComponent(table)}/rows`, {
      params: { page, size },
    })
    return res.data.data
  },

  async queryLogs({ source = 'ALL', level, search, since = '1h', limit = 300 } = {}) {
    const res = await api.get('/api/admin/logs', {
      params: { source, level, search, since, limit },
    })
    return res.data.data
  },
}

export default adminService
