import { describe, it, expect } from 'vitest'

import { SUGGESTIONS_MARKER, splitSuggestions, appendAgentChunk } from '@/utils/suggestions'

describe('suggestions', () => {
  it('melewatkan chunk biasa tanpa perubahan', () => {
    expect(splitSuggestions('Halo dunia')).toEqual({ text: 'Halo dunia', suggestions: null })
  })

  it('memisahkan trailer suggestions dari teks jawaban', () => {
    const chunk = 'Tips hemat.\n' + SUGGESTIONS_MARKER + '["Tips hemat AC?","Cek konsumsi hari ini?"]'
    const { text, suggestions } = splitSuggestions(chunk)

    expect(text).toBe('Tips hemat.')
    expect(suggestions).toEqual(['Tips hemat AC?', 'Cek konsumsi hari ini?'])
  })

  it('mengembalikan teks utuh saat payload trailer bukan JSON valid', () => {
    const chunk = 'Jawaban.\n' + SUGGESTIONS_MARKER + 'bukan-json'
    const { text, suggestions } = splitSuggestions(chunk)

    expect(text).toBe('Jawaban.')
    expect(suggestions).toBeNull()
  })

  it('appendAgentChunk menaruh teks ke content dan chips ke suggestions', () => {
    const msg = { content: '', suggestions: [] }
    appendAgentChunk(msg, 'Halo ')
    appendAgentChunk(msg, 'dunia\n' + SUGGESTIONS_MARKER + '["A?","B?","C?","D?"]')

    expect(msg.content).toBe('Halo dunia')
    expect(msg.suggestions).toEqual(['A?', 'B?', 'C?'])
  })
})
