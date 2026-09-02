<template>
  <div class="markdown-body" v-html="rendered" ref="containerEl"></div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { marked } from 'marked'
import mermaid from 'mermaid'

const props = defineProps({
  content: { type: String, default: '' },
})

const rendered = ref('')
const containerEl = ref(null)

// Configure marked for GFM tables + line breaks
marked.setOptions({ gfm: true, breaks: true })

// suppressErrorRendering stops Mermaid from injecting its own "bomb" error SVG
// directly into document.body when a diagram fails to parse — we already show
// our own inline error message in the catch block below.
mermaid.initialize({ startOnLoad: false, theme: 'neutral', suppressErrorRendering: true })

let mermaidCounter = 0

function processContent(text) {
  if (!text) return { html: '', mermaidBlocks: [] }

  // Extract mermaid code blocks and replace with placeholder divs
  const mermaidBlocks = []
  const withoutMermaid = text.replace(/```mermaid\n([\s\S]*?)```/g, (match, code) => {
    const id = `mermaid-${Date.now()}-${mermaidCounter++}`
    mermaidBlocks.push({ id, code: code.trim() })
    return `<div class="mermaid-container" id="${id}"></div>`
  })

  const html = marked.parse(withoutMermaid)
  return { html, mermaidBlocks }
}

async function renderMermaidBlocks(blocks) {
  await nextTick()
  for (const block of blocks) {
    const el = document.getElementById(block.id)
    if (!el) continue
    try {
      const { svg } = await mermaid.render(`${block.id}-svg`, block.code)
      el.innerHTML = svg
    } catch (e) {
      el.innerHTML = `<p class="text-xs text-red-400">Diagram error: unable to render</p>`
    }
  }
}

async function update() {
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
  background: rgba(0,0,0,0.06);
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
  border: 1px solid #e5e7eb;
  padding: 0.4rem 0.6rem;
  text-align: left;
}
.markdown-body :deep(th) {
  background: rgba(0,0,0,0.04);
  font-weight: 600;
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
  color: #6b7280;
  margin: 0.5rem 0;
}
</style>