import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import agentService from '@/services/agentService'

// Helper: build a fake fetch response with an SSE body readable via
// reader.read() — similar to the real ReadableStream from a streaming fetch.
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

describe('agentService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('SSE parsing lewat consumeSseStream', () => {
    // OUR BACKEND CONTRACT: the Spring SSE writer writes 'data:' WITHOUT a
    // delimiter space — so the space after 'data:' is part of the AI token
    // (word-boundary) and MUST be preserved, not stripped.
    it('memecah chunk menurut blank line (\\n\\n) dan mengirim tiap event ke onChunk', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          sseResponse([
            new TextEncoder().encode('data: Saya\n\ndata: adalah\n\ndata:[DONE]\n\n'),
          ]),
        ),
      )
      const onChunk = vi.fn()
      const onDone = vi.fn()

      await agentService.streamChat('pesan', onChunk, onDone, vi.fn())

      // Leading spaces are preserved (word-boundary tokens) — this is what
      // gives the chat text spaces between words; the [DONE] sentinel is not forwarded.
      expect(onChunk.mock.calls.map((c) => c[0])).toEqual([' Saya', ' adalah'])
      expect(onDone).toHaveBeenCalledTimes(1)
    })

    // Multiline payload = multiple 'data:' lines joined with '\n'.
    // Lines WITHOUT the 'data:' prefix are dropped by the filter.
    it('menangani multiline payload (beberapa baris data:) sebagai satu event', async () => {
      const sse = 'data: baris satu\ndata: baris dua\n\ndata: selesai\n\n'
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(sseResponse([new TextEncoder().encode(sse)])),
      )
      const onChunk = vi.fn()

      await agentService.streamChat('pesan', onChunk, vi.fn(), vi.fn())

      expect(onChunk.mock.calls.map((c) => c[0])).toEqual([
        ' baris satu\n baris dua',
        ' selesai',
      ])
    })

    it('menggabungkan event yang terpotong di batas chunk (buffer/remainder)', async () => {
      const encoder = new TextEncoder()
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          sseResponse([
            encoder.encode('data: potong'), // event not yet complete — no \n\n
            encoder.encode('an\n\ndata:[DONE]\n\n'), // sisa + sentinel akhir stream
          ]),
        ),
      )
      const onChunk = vi.fn()

      await agentService.streamChat('pesan', onChunk, vi.fn(), vi.fn())

      // The truncated event is still merged whole as one event, with its leading
      // space intact; the [DONE] sentinel (backend format: no space) doesn't leak.
      expect(onChunk.mock.calls.map((c) => c[0])).toEqual([' potongan'])
    })

    // The [DONE] sentinel only matches the backend format: 'data:[DONE]' (no
    // space — the Spring SSE writer adds none). The 'data: [DONE]' format
    // (with space) is NOT filtered and would be forwarded as content
    // ' [DONE]' — that never happens from our backend, so we deliberately
    // don't strip spaces to preserve AI token word boundaries.
    it('melewati sentinel [DONE] tanpa memanggil onChunk (format backend)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          sseResponse([new TextEncoder().encode('data:[DONE]\n\n')]),
        ),
      )
      const onChunk = vi.fn()

      await agentService.streamChat('pesan', onChunk, vi.fn(), vi.fn())

      expect(onChunk).not.toHaveBeenCalled()
    })
  })

  describe('streamChat', () => {
    it('mengirim POST dengan Bearer token dari localStorage', async () => {
      localStorage.setItem('accessToken', 'token-agent')
      const fetchMock = vi.fn().mockResolvedValue(sseResponse([]))
      vi.stubGlobal('fetch', fetchMock)

      await agentService.streamChat('hai', vi.fn(), vi.fn(), vi.fn(), { history: [{ role: 'user', content: 'hai' }], conversationId: 'conv-1' })

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/agent/chat'),
        expect.objectContaining({ method: 'POST' }),
      )
      const options = fetchMock.mock.calls[0][1]
      expect(options.headers.Authorization).toBe('Bearer token-agent')
      expect(JSON.parse(options.body)).toEqual({
        message: 'hai',
        history: [{ role: 'user', content: 'hai' }],
        conversationId: 'conv-1',
      })
    })

    it('memanggil onError saat response tidak ok (mis. HTTP 500)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse([], { ok: false, status: 500 })))
      const onError = vi.fn()
      const onDone = vi.fn()

      await agentService.streamChat('hai', vi.fn(), onDone, onError)

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'HTTP 500' }))
      expect(onDone).not.toHaveBeenCalled()
    })

    it('memanggil onError saat fetch gagal (network down)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
      const onError = vi.fn()

      await agentService.streamChat('hai', vi.fn(), vi.fn(), onError)

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'network down' }))
    })
  })

  describe('streamDocument / streamVision', () => {
    it('streamDocument mengirim file via FormData tanpa Content-Type manual', async () => {
      localStorage.setItem('accessToken', 'token-doc')
      const fetchMock = vi.fn().mockResolvedValue(sseResponse([]))
      vi.stubGlobal('fetch', fetchMock)
      const file = new File(['isi'], 'laporan.pdf')

      await agentService.streamDocument('ringkas', file, null, vi.fn(), vi.fn(), vi.fn())

      const options = fetchMock.mock.calls[0][1]
      expect(fetchMock.mock.calls[0][0]).toContain('/api/agent/document')
      expect(options.headers.Authorization).toBe('Bearer token-doc')
      expect(options.body).toBeInstanceOf(FormData)
      expect(options.body.get('file')).toBe(file)
      expect(options.body.get('message')).toBe('ringkas')
    })

    it('streamDocument menyertakan conversationId di FormData kalau ada', async () => {
      const fetchMock = vi.fn().mockResolvedValue(sseResponse([]))
      vi.stubGlobal('fetch', fetchMock)
      const file = new File(['isi'], 'laporan.pdf')

      await agentService.streamDocument('ringkas', file, 'conv-9', vi.fn(), vi.fn(), vi.fn())

      expect(fetchMock.mock.calls[0][1].body.get('conversationId')).toBe('conv-9')
    })

    it('streamVision mengirim prompt & image via FormData ke /api/agent/vision', async () => {
      localStorage.setItem('accessToken', 'token-vision')
      const fetchMock = vi.fn().mockResolvedValue(
        sseResponse([new TextEncoder().encode('data: Ada\n\ndata:[DONE]\n\n')]),
      )
      vi.stubGlobal('fetch', fetchMock)
      const image = new File(['png'], 'foto.png')
      const onChunk = vi.fn()
      const onDone = vi.fn()

      await agentService.streamVision('gambar ini apa?', image, onChunk, onDone, vi.fn())

      const options = fetchMock.mock.calls[0][1]
      expect(fetchMock.mock.calls[0][0]).toContain('/api/agent/vision')
      expect(options.headers.Authorization).toBe('Bearer token-vision')
      expect(options.body).toBeInstanceOf(FormData)
      expect(options.body.get('prompt')).toBe('gambar ini apa?')
      expect(options.body.get('image')).toBe(image)
      expect(onChunk).toHaveBeenCalledWith(' Ada')
      expect(onDone).toHaveBeenCalledTimes(1)
    })

    it('streamVision memanggil onError saat response tidak ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse([], { ok: false, status: 400 })))
      const onError = vi.fn()

      await agentService.streamVision('x', new File(['p'], 'p.png'), vi.fn(), vi.fn(), onError)

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'HTTP 400' }))
    })
  })

  describe('streamQuickAsk', () => {
    // Q&A ephemeral Metrics overlay — metrics & hours harus sampai ke backend
    // agar jawaban AI dibangun dari data Prometheus nyata.
    it('mengirim message, metrics, dan hours ke /api/agent/quick-ask', async () => {
      localStorage.setItem('accessToken', 'token-qa')
      const fetchMock = vi.fn().mockResolvedValue(
        sseResponse([new TextEncoder().encode('data: Mem 108 MiB\n\ndata:[DONE]\n\n')]),
      )
      vi.stubGlobal('fetch', fetchMock)
      const metrics = ['jvm_memory_used_bytes', 'powerbind_room_power_watts']
      const onChunk = vi.fn()
      const onDone = vi.fn()

      await agentService.streamQuickAsk('berapa memory?', metrics, 1, onChunk, onDone, vi.fn())

      const options = fetchMock.mock.calls[0][1]
      expect(fetchMock.mock.calls[0][0]).toContain('/api/agent/quick-ask')
      expect(options.method).toBe('POST')
      expect(options.headers.Authorization).toBe('Bearer token-qa')
      expect(JSON.parse(options.body)).toEqual({
        message: 'berapa memory?',
        metrics,
        hours: 1,
      })
      expect(onChunk).toHaveBeenCalledWith(' Mem 108 MiB')
      expect(onDone).toHaveBeenCalledTimes(1)
    })

    it('memanggil onError saat response tidak ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse([], { ok: false, status: 502 })))
      const onError = vi.fn()

      await agentService.streamQuickAsk('q', ['x'], 1, vi.fn(), vi.fn(), onError)

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'HTTP 502' }))
    })
  })

  describe('transcribe', () => {
    it('mengirim audio blob sebagai file dan mengembalikan hasil teks', async () => {
      localStorage.setItem('accessToken', 'token-voice')
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { text: 'nyalakan lampu' } }),
      })
      vi.stubGlobal('fetch', fetchMock)
      const blob = new Blob(['audio'], { type: 'audio/webm' })

      const text = await agentService.transcribe(blob)

      const options = fetchMock.mock.calls[0][1]
      expect(fetchMock.mock.calls[0][0]).toContain('/api/agent/transcribe')
      expect(options.headers.Authorization).toBe('Bearer token-voice')
      // jsdom wraps the appended Blob in a File — check type & filename instead
      // of object identity.
      expect(options.body.get('file')).toBeInstanceOf(File)
      expect(options.body.get('file').name).toBe('voice.webm')
      expect(text).toBe('nyalakan lampu')
    })

    it('melempar Error saat transkripsi gagal (HTTP 500)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
      )

      await expect(agentService.transcribe(new Blob(['a']))).rejects.toThrow('Transcription failed: 500')
    })

    it('mengembalikan string kosong kalau hasil teks tidak ada', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: {} }) }),
      )

      expect(await agentService.transcribe(new Blob(['a']))).toBe('')
    })
  })

  describe('conversations', () => {
    it('getConversations mengirim Bearer token dan mengembalikan data.data', async () => {
      localStorage.setItem('accessToken', 'token-conv')
      const convs = [{ id: 'c1', title: 'Obrolan 1' }]
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: convs }) })
      vi.stubGlobal('fetch', fetchMock)

      const result = await agentService.getConversations()

      const options = fetchMock.mock.calls[0][1]
      expect(fetchMock.mock.calls[0][0]).toContain('/api/agent/conversations')
      expect(options.headers.Authorization).toBe('Bearer token-conv')
      expect(result).toBe(convs)
    })

    it('getConversations melempar Error saat response tidak ok', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
      )

      await expect(agentService.getConversations()).rejects.toThrow('HTTP 500')
    })

    it('getConversationMessages mengembalikan pesan per conversation', async () => {
      const msgs = [{ id: 'm1', role: 'user', content: 'hai' }]
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: msgs }) }),
      )

      const result = await agentService.getConversationMessages('c1')

      expect(fetch.mock.calls[0][0]).toContain('/api/agent/conversations/c1')
      expect(result).toBe(msgs)
    })

    it('getConversationMessages mengembalikan [] kalau data null', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: null }) }),
      )

      expect(await agentService.getConversationMessages('c1')).toEqual([])
    })

    it('renameConversation mengirim PATCH dengan title di body', async () => {
      localStorage.setItem('accessToken', 'token-rename')
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
      vi.stubGlobal('fetch', fetchMock)

      await agentService.renameConversation('c1', 'Judul baru')

      const options = fetchMock.mock.calls[0][1]
      expect(fetchMock.mock.calls[0][0]).toContain('/api/agent/conversations/c1')
      expect(options.method).toBe('PATCH')
      expect(options.headers.Authorization).toBe('Bearer token-rename')
      expect(JSON.parse(options.body)).toEqual({ title: 'Judul baru' })
    })

    it('renameConversation melempar Error saat gagal', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) }),
      )

      await expect(agentService.renameConversation('c1', 'x')).rejects.toThrow('HTTP 400')
    })

    it('deleteConversation mengirim DELETE dengan Bearer token', async () => {
      localStorage.setItem('accessToken', 'token-del')
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      vi.stubGlobal('fetch', fetchMock)

      await agentService.deleteConversation('c1')

      const options = fetchMock.mock.calls[0][1]
      expect(fetchMock.mock.calls[0][0]).toContain('/api/agent/conversations/c1')
      expect(options.method).toBe('DELETE')
      expect(options.headers.Authorization).toBe('Bearer token-del')
    })
  })
})

