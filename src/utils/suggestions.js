// Follow-up suggestion chips for Gemono answers (AgentPage + Ask Gemono panel).
// The backend appends "__SUGGESTIONS__:[...]" as the LAST SSE text chunk; this helper
// splits it off so the marker never lands inside the visible answer bubble.
export const SUGGESTIONS_MARKER = '__SUGGESTIONS__:'

// Split one SSE text chunk into { text, suggestions }.
// Returns suggestions: null when the chunk carries no trailer.
export function splitSuggestions(chunk) {
  if (typeof chunk !== 'string') return { text: chunk, suggestions: null }
  const at = chunk.indexOf(SUGGESTIONS_MARKER)
  if (at === -1) return { text: chunk, suggestions: null }
  let suggestions = null
  try {
    const parsed = JSON.parse(chunk.slice(at + SUGGESTIONS_MARKER.length))
    if (Array.isArray(parsed)) suggestions = parsed.filter((s) => typeof s === 'string').slice(0, 3)
  } catch {
    suggestions = null
  }
  return { text: chunk.slice(0, at).replace(/\n+$/, ''), suggestions }
}

// Append one SSE chunk to an assistant message object:
// visible text goes to .content, the trailer (if any) goes to .suggestions.
export function appendAgentChunk(msg, chunk) {
  const { text, suggestions } = splitSuggestions(chunk)
  if (text) msg.content += text
  if (suggestions && suggestions.length > 0) msg.suggestions = suggestions
  return msg
}
