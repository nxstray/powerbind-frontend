<template>
  <div class="markdown-body" v-html="rendered" ref="containerEl"></div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps({
  content: { type: String, default: '' },
})

const rendered = ref('')
const containerEl = ref(null)

// Configure marked for GFM tables + line breaks
marked.setOptions({ gfm: true, breaks: true })

let mermaidCounter = 0
let mermaidPromise = null

// Lazy-load mermaid only when a ```mermaid block actually appears. The library
// is huge (dragging in marked/dompurify-adjacent weight would bloat the agent
// chunk), so we fetch it on first diagram and cache the promise afterwards.
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid')
      .then((m) => {
        const mermaid = m.default
        // suppressErrorRendering stops Mermaid from injecting its own "bomb" error SVG
        // directly into document.body when a diagram fails to parse — we already show
        // our own inline error message in the catch block below.
        mermaid.initialize({ startOnLoad: false, theme: 'neutral', suppressErrorRendering: true })
        return mermaid
      })
      .catch((err) => {
        // Reset so a transient network failure can be retried on the next render.
        mermaidPromise = null
        throw err
      })
  }
  return mermaidPromise
}

// Prefetch mermaid as soon as an OPEN fence (```mermaid) shows up in the
// content — while streaming, the fence is written seconds before the closing
// fence arrives, so the chunk download overlaps with the text still streaming
// in and the diagram renders without extra wait. False positives are
// near-zero: an opened mermaid fence almost always precedes a real diagram.
// Fire-and-forget; the promise is cached, so renderMermaidBlocks later just
// awaits the same promise (no double download).
const MERMAID_HINT = /```mermaid/
const PREFETCH_RETRY_MS = 30_000
let lastPrefetchAttempt = 0

function maybePrefetchMermaid(text) {
  if (!text || !MERMAID_HINT.test(text)) return
  const now = Date.now()
  if (now - lastPrefetchAttempt < PREFETCH_RETRY_MS) return
  lastPrefetchAttempt = now
  // Throttled so a failure (e.g. offline while streaming) isn't retried on
  // every token; the real render path re-raises errors when it matters.
  loadMermaid().catch(() => {})
}

function processContent(text) {
  if (!text) return { html: '', mermaidBlocks: [] }

  // Extract mermaid code blocks and replace with placeholder divs
  const mermaidBlocks = []
  const withoutMermaid = text.replace(/```mermaid\n([\s\S]*?)```/g, (match, code) => {
    const id = `mermaid-${Date.now()}-${mermaidCounter++}`
    mermaidBlocks.push({ id, code: code.trim() })
    return `<div class="mermaid-container" id="${id}"></div>`
  })

  const rawHtml = marked.parse(withoutMermaid)
  // Sanitize before rendering via v-html
  const html = DOMPurify.sanitize(rawHtml)
  return { html, mermaidBlocks }
}

async function renderMermaidBlocks(blocks) {
  await nextTick()
  let mermaid
  try {
    mermaid = await loadMermaid()
  } catch {
    for (const block of blocks) {
      const el = document.getElementById(block.id)
      if (el) el.innerHTML = `<p class="text-xs text-red-400">Diagram error: unable to render</p>`
    }
    return
  }
  for (const block of blocks) {
    const el = document.getElementById(block.id)
    if (!el) continue
    try {
      const { svg } = await mermaid.render(`${block.id}-svg`, block.code)
      el.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } })
    } catch {
      el.innerHTML = `<p class="text-xs text-red-400">Diagram error: unable to render</p>`
    }
  }
}

async function update() {
  maybePrefetchMermaid(props.content)
  const { html, mermaidBlocks } = processContent(props.content)
  rendered.value = html
  if (mermaidBlocks.length > 0) {
    await renderMermaidBlocks(mermaidBlocks)
  }
}

onMounted(update)
watch(() => props.content, update)
</script>

<style scoped>
.markdown-body :deep(p) {
  margin-bottom: 0.5rem;
}
.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}
.markdown-body :deep(strong) {
  font-weight: 700;
}
.markdown-body :deep(code) {
  /* Derived from the inherited text color instead of a fixed black tint, so
     it stays legible against any weather-theme background (sore/malam/etc). */
  background: color-mix(in srgb, currentColor 10%, transparent);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.85em;
  font-family: ui-monospace, monospace;
}
.markdown-body :deep(pre) {
  background: #1e293b;
  color: #e2e8f0;
  padding: 0.75rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin: 0.5rem 0;
}
.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  color: inherit;
}
.markdown-body :deep(ul), .markdown-body :deep(ol) {
  padding-left: 1.25rem;
  margin: 0.4rem 0;
}
.markdown-body :deep(li) {
  margin-bottom: 0.2rem;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5rem 0;
  font-size: 0.85em;
}
.markdown-body :deep(th), .markdown-body :deep(td) {
  /* Grid line color now scales with the current text color (currentColor)
     instead of a fixed light gray — this keeps it visible on light-ish
     theme backgrounds like "sore" (orange/peach) as well as dark ones. */
  border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
  padding: 0.4rem 0.6rem;
  text-align: left;
}
.markdown-body :deep(th) {
  background: color-mix(in srgb, currentColor 12%, transparent);
  font-weight: 600;
}
.markdown-body :deep(tr:nth-child(even) td) {
  background: color-mix(in srgb, currentColor 5%, transparent);
}
.markdown-body :deep(a) {
  color: #0f8cd5;
  text-decoration: underline;
}
.markdown-body :deep(.mermaid-container) {
  display: flex;
  justify-content: center;
  margin: 0.75rem 0;
  overflow-x: auto;
}
.markdown-body :deep(h1), .markdown-body :deep(h2), .markdown-body :deep(h3) {
  font-weight: 700;
  margin: 0.5rem 0 0.25rem;
}
.markdown-body :deep(blockquote) {
  border-left: 3px solid #0f8cd5;
  padding-left: 0.75rem;
  color: color-mix(in srgb, currentColor 70%, transparent);
  margin: 0.5rem 0;
}
</style>