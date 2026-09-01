// Handles all AI agent API calls — text chat, vision, document, voice, and conversation history
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8045'

function getHeaders() {
  const token = localStorage.getItem('accessToken')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function authOnlyHeaders() {
  const token = localStorage.getItem('accessToken')
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
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

    const content = rawEvent
      .split('\n')
      .filter((l) => l.startsWith('data:'))
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

const agentService = {
  // stream text chat via SSE fetch — conversationId is null for a new thread
  async streamChat(message, history = [], conversationId, onChunk, onDone, onError) {
    try {
      const response = await fetch(`${BASE_URL}/api/agent/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message, history, conversationId }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      await consumeSseStream(response, onChunk)
      onDone()
    } catch (err) {
      onError(err)
    }
  },

  // stream document chat — PDF/DOCX/TXT file + text prompt
  async streamDocument(message, file, conversationId, onChunk, onDone, onError) {
    try {
      const formData = new FormData()
      formData.append('message', message)
      formData.append('file', file)
      if (conversationId) formData.append('conversationId', conversationId)

      const response = await fetch(`${BASE_URL}/api/agent/document`, {
        method: 'POST',
        headers: authOnlyHeaders(),
        body: formData,
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
      const formData = new FormData()
      formData.append('prompt', prompt)
      formData.append('image', imageFile)

      const response = await fetch(`${BASE_URL}/api/agent/vision`, {
        method: 'POST',
        headers: authOnlyHeaders(),
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
    const formData = new FormData()
    formData.append('file', audioBlob, 'voice.webm')

    const res = await fetch(`${BASE_URL}/api/agent/transcribe`, {
      method: 'POST',
      headers: authOnlyHeaders(),
      body: formData,
    })

    if (!res.ok) throw new Error(`Transcription failed: ${res.status}`)
    const data = await res.json()
    return data?.data?.text || ''
  },

  // List all conversations for the dropdown, most recent first
  async getConversations() {
    const res = await fetch(`${BASE_URL}/api/agent/conversations`, { headers: getHeaders() })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data?.data || []
  },

  // Fetch all messages within a single conversation
  async getConversationMessages(conversationId) {
    const res = await fetch(`${BASE_URL}/api/agent/conversations/${conversationId}`, { headers: getHeaders() })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data?.data || []
  },

  // Delete a conversation
  async deleteConversation(conversationId) {
    await fetch(`${BASE_URL}/api/agent/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
  },
}

export default agentService