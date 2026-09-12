import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import agentService from '@/services/agentService'

// Helper: bikin response fetch palsu dengan body SSE yang bisa dibaca lewat
// reader.read() — mirip ReadableStream asli dari fetch streaming.
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
    // KONTRAK BACKEND KITA: Spring SSE writer menulis 'data:' TANPA spasi
    // delimiter — jadi spasi setelah 'data:' adalah bagian dari token AI
    // (word-boundary) dan HARUS dipertahankan, tidak dibuang.
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

      await agentService.streamChat('pesan', [], null, onChunk, onDone, vi.fn())

      // Spasi leading dipertahankan (word-boundary token) — inilah yang
      // membuat teks chat punya spasi antar-kata; sentinel [DONE] tidak diteruskan.
      expect(onChunk.mock.calls.map((c) => c[0])).toEqual([' Saya', ' adalah'])
      expect(onDone).toHaveBeenCalledTimes(1)
    })

    // Multiline payload = beberapa baris 'data:' yang di-join pakai '\n'.
    // Baris TANPA prefix 'data:' di-dropping oleh filter.
    it('menangani multiline payload (beberapa baris data:) sebagai satu event', async () => {
      const sse = 'data: baris satu\ndata: baris dua\n\ndata: selesai\n\n'
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(sseResponse([new TextEncoder().encode(sse)])),
      )
      const onChunk = vi.fn()

      await agentService.streamChat('pesan', [], null, onChunk, vi.fn(), vi.fn())

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
            encoder.encode('data: potong'), // event belum selesai — tanpa \n\n
            encoder.encode('an\n\ndata:[DONE]\n\n'), // sisa + sentinel akhir stream
          ]),
        ),
      )
      const onChunk = vi.fn()

      await agentService.streamChat('pesan', [], null, onChunk, vi.fn(), vi.fn())

      // Event terpotong tetap tergabung utuh sebagai satu event, dengan spasi
      // leadingnya utuh; sentinel [DONE] (format backend: tanpa spasi) tidak bocor.
      expect(onChunk.mock.calls.map((c) => c[0])).toEqual([' potongan'])
    })

    // Sentinel [DONE] hanya cocok untuk format backend: 'data:[DONE]' (tanpa
    // spasi — Spring SSE writer tidak menambah spasi). Format 'data: [DONE]'
    // (dengan spasi) TIDAK dipfilter dan akan diteruskan sebagai konten
    // ' [DONE]' — itu tidak pernah terjadi dari backend kita, jadi kita sengaja
    // tidak strip spasi demi menjaga word-boundary token AI.
    it('melewati sentinel [DONE] tanpa memanggil onChunk (format backend)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          sseResponse([new TextEncoder().encode('data:[DONE]\n\n')]),
        ),
      )
      const onChunk = vi.fn()

      await agentService.streamChat('pesan', [], null, onChunk, vi.fn(), vi.fn())

      expect(onChunk).not.toHaveBeenCalled()
    })
  })

  describe('streamChat', () => {
    it('mengirim POST dengan Bearer token dari localStorage', async () => {
      localStorage.setItem('accessToken', 'token-agent')
      const fetchMock = vi.fn().mockResolvedValue(sseResponse([]))
      vi.stubGlobal('fetch', fetchMock)

      await agentService.streamChat('hai', [{ role: 'user', content: 'hai' }], 'conv-1', vi.fn(), vi.fn(), vi.fn())

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

      await agentService.streamChat('hai', [], null, vi.fn(), onDone, onError)

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'HTTP 500' }))
      expect(onDone).not.toHaveBeenCalled()
    })

    it('memanggil onError saat fetch gagal (network down)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
      const onError = vi.fn()

      await agentService.streamChat('hai', [], null, vi.fn(), vi.fn(), onError)

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
  })
})
