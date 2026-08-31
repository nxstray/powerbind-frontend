// Handles all AI agent API calls — text chat, vision, and voice transcription
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8045'

function getHeaders() {
  const token = localStorage.getItem('accessToken')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// parse one buffered chunk of raw SSE text into complete events, returning
// the leftover (incomplete) tail so the caller can prepend it to the next chunk.
// an SSE event ends with a blank line ("\n\n") — splitting on a single "\n"
// breaks whenever the payload's own content contains a newline (e.g. markdown).
function extractSseEvents(buffer) {
  const events = []
  let sepIndex

  while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
    const rawEvent = buffer.slice(0, sepIndex)
    buffer = buffer.slice(sepIndex + 2)

    // an event can have multiple "data:" lines — join them per the SSE spec
    const content = rawEvent
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5)) // drop "data:" only — Spring's writer emits "data:<content>" with no space,
      // so a leading space here is part of the actual content, not an SSE separator
      .join('\n')

    if (content) events.push(content)
  }

  return { events, remainder: buffer }
}

// read an SSE response body, calling onChunk for each non-[DONE] payload
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

const agentService = {
  // stream text chat via SSE fetch
  async streamChat(message, history = [], onChunk, onDone, onError) {
    try {
      const response = await fetch(`${BASE_URL}/api/agent/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message, history }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      await consumeSseStream(response, onChunk)
      onDone()
    } catch (err) {
      onError(err)
    }
  },

  // stream vision chat — image file + text prompt
  async streamVision(prompt, imageFile, onChunk, onDone, onError) {
    try {
      const token = localStorage.getItem('accessToken')
      const formData = new FormData()
      formData.append('prompt', prompt)
      formData.append('image', imageFile)

      const response = await fetch(`${BASE_URL}/api/agent/vision`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      await consumeSseStream(response, onChunk)
      onDone()
    } catch (err) {
      onError(err)
    }
  },

  // transcribe voice via Whisper
  async transcribe(audioBlob) {
    const token = localStorage.getItem('accessToken')
    const formData = new FormData()
    formData.append('file', audioBlob, 'voice.webm')

    const res = await fetch(`${BASE_URL}/api/agent/transcribe`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    })

    if (!res.ok) throw new Error(`Transcription failed: ${res.status}`)
    const data = await res.json()
    return data?.data?.text || ''
  },

  // Fetch this user's persisted chat history
    async getHistory() {
    const res = await fetch(`${BASE_URL}/api/agent/history`, { headers: getHeaders() })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data?.data || []
  },

  // Clear this user's persisted chat history
  async clearHistory() {
    await fetch(`${BASE_URL}/api/agent/history`, { method: 'DELETE', headers: getHeaders() })
  },
}

export default agentService