<template>
  <div class="min-h-screen bg-[#f0f2f5] text-gray-800">
    <!-- Header -->
    <div class="px-4 sm:px-6 pt-4 pb-2 flex items-center gap-3">
      <button
        @click="$router.push('/log')"
        class="flex items-center gap-1 text-xs text-gray-500 hover:text-[#0f8cd5] transition"
      >
        <ArrowLeftIcon :size="14" />
        Log
      </button>
      <h1 class="text-lg font-bold">System Metrics</h1>
      <span v-if="lastUpdated" class="text-[10px] text-gray-400">updated {{ lastUpdated }}</span>

      <!-- Range dropdown -->
      <div class="relative ml-auto" data-range-dd>
        <button
          @click="rangeOpen = !rangeOpen"
          class="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition bg-white border-gray-200 text-gray-600 hover:border-[#0f8cd5]"
        >
          {{ rangeOptions.find((o) => o.value === hours)?.label }}
          <ChevronLeftIcon :size="12" :class="rangeOpen ? 'rotate-90' : '-rotate-90'" class="transition-transform" />
        </button>
        <div
          v-if="rangeOpen"
          class="absolute right-0 top-full mt-1 w-28 rounded-md shadow-lg z-10 overflow-hidden border bg-white border-gray-100"
        >
          <button
            v-for="opt in rangeOptions"
            :key="opt.value"
            @click="selectRange(opt.value)"
            class="w-full text-left px-3 py-2 text-xs transition"
            :class="hours === opt.value ? 'bg-[#0f8cd5]/10 text-[#0f8cd5]' : 'text-gray-600 hover:bg-gray-50'"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Charts -->
    <div class="px-4 sm:px-6 pb-6 space-y-3">
      <div v-if="error" class="rounded-md border border-red-200 bg-red-50 text-red-600 text-xs px-3 py-2">{{ error }}</div>

      <div class="rounded-lg border border-gray-200 bg-white p-3">
        <p class="text-xs font-semibold mb-0.5">JVM Memory Used</p>
        <p class="text-[10px] text-gray-400 font-mono mb-2">sum by (area) (jvm_memory_used_bytes)</p>
        <MetricsChart :series="memorySeries" format="bytes" />
      </div>

      <div class="rounded-lg border border-gray-200 bg-white p-3">
        <p class="text-xs font-semibold mb-0.5">Process CPU Usage</p>
        <p class="text-[10px] text-gray-400 font-mono mb-2">process_cpu_usage</p>
        <MetricsChart :series="cpuSeries" format="ratio" />
      </div>

      <div class="rounded-lg border border-gray-200 bg-white p-3">
        <div class="flex items-center justify-between mb-0.5">
          <p class="text-xs font-semibold">{{ customMetric || 'Custom metric' }}</p>
          <select
            v-model="customMetric"
            class="text-[10px] rounded border border-gray-200 bg-gray-50 text-gray-600 px-1.5 py-1 outline-none focus:border-[#0f8cd5] max-w-60"
          >
            <option value="" disabled>— pilih metrik —</option>
            <option v-for="n in metricNames" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
        <p class="text-[10px] text-gray-400 font-mono mb-2">{{ customMetric || '—' }}</p>
        <MetricsChart v-if="customMetric" :series="customSeries" />
        <p v-else class="text-[10px] text-gray-400">Pilih metrik dari dropdown untuk melihat grafiknya.</p>
      </div>
    </div>

    <!-- Agent overlay — collapsed ke strip kecil di pojok kanan atas -->
    <button
      v-if="!askOpen"
      @click="askOpen = true"
      class="fixed right-4 top-4 z-40 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-md transition bg-white border border-gray-200 text-gray-600 hover:text-[#0f8cd5] hover:border-[#0f8cd5]"
    >
      <SparklesIcon :size="13" />
      Ask Gemono
    </button>

    <div
      v-if="askOpen"
      class="fixed right-4 top-4 z-40 w-80 max-h-[70vh] rounded-lg border border-gray-200 bg-white shadow-xl flex flex-col"
    >
      <div class="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 shrink-0">
        <SparklesIcon :size="13" class="text-[#0f8cd5]" />
        <p class="text-xs font-semibold">Ask Gemono — metric explained</p>
        <button @click="askOpen = false" class="ml-auto text-gray-400 hover:text-gray-700 transition">
          <CloseIcon :size="13" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto custom-scroll px-3 py-2.5 text-xs space-y-2">
        <template v-if="askMessages.length">
          <div v-for="(m, i) in askMessages" :key="i" :class="m.role === 'user' ? 'text-right' : ''">
            <p
              v-if="m.role === 'user'"
              class="inline-block rounded-lg bg-[#0f8cd5] text-white px-2.5 py-1.5 text-left max-w-[85%]"
            >{{ m.content }}</p>
            <div v-else class="text-left">
              <MarkdownRenderer :content="m.content" />
              <span v-if="m.streaming" class="inline-block w-1.5 h-3 bg-[#0f8cd5] animate-pulse align-text-bottom" />
            </div>
          </div>
        </template>
        <p v-else class="text-gray-400 text-[11px]">Tanyakan apa arti grafik di halaman ini.</p>
      </div>

      <form @submit.prevent="sendAsk" class="flex items-center gap-1.5 px-3 py-2 border-t border-gray-100 shrink-0">
        <input
          v-model="askInput"
          placeholder="Explain the memory chart…"
          class="flex-1 text-xs rounded-md border border-gray-200 px-2 py-1.5 outline-none focus:border-[#0f8cd5]"
        />
        <button type="submit" :disabled="!askInput.trim() || askStreaming" class="text-[#0f8cd5] disabled:opacity-30">
          <SendIcon :size="14" />
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import metricsService from '@/services/metricsService'
import agentService from '@/services/agentService'

import MetricsChart from '@/components/MetricsChart.vue'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import ArrowLeftIcon from '@/components/icons/ArrowLeftIcon.vue'
import ChevronLeftIcon from '@/components/icons/ChevronLeftIcon.vue'
import SparklesIcon from '@/components/icons/SparklesIcon.vue'
import CloseIcon from '@/components/icons/CloseIcon.vue'
import SendIcon from '@/components/icons/SendIcon.vue'

// Polling 30 detik — Prometheus sendiri scrape 15s, lebih cepat dari itu
// tidak ada data baru. Interval dibersihkan di onUnmounted (pola SSE AgentPage).
const POLL_MS = 30_000
const DEFAULT_METRIC = 'jvm_memory_used_bytes'
const CPU_METRIC = 'process_cpu_usage'

const rangeOptions = [
  { label: 'Last 1 hour', value: 1 },
  { label: 'Last 6 hours', value: 6 },
  { label: 'Last 24 hours', value: 24 },
]
const hours = ref(1)
const stepFor = (h) => (h === 1 ? 60 : h === 6 ? 240 : 900) // ~240 titik per chart

const memorySeries = ref([])
const cpuSeries = ref([])
const customSeries = ref([])
const metricNames = ref([])
const customMetric = ref('')
const error = ref(null)
const lastUpdated = ref('')
const rangeOpen = ref(false)

function selectRange(v) {
  hours.value = v
  rangeOpen.value = false
  fetchAll()
}

async function fetchChart(metric, groupBy, agg) {
  return metricsService.query({
    metric, groupBy, agg, hours: hours.value, step: stepFor(hours.value),
  })
}

async function fetchAll() {
  try {
    const [mem, cpu] = await Promise.all([
      fetchChart(DEFAULT_METRIC, 'area', 'sum'),
      fetchChart(CPU_METRIC, null, 'avg'),
    ])
    memorySeries.value = mem.series
    cpuSeries.value = cpu.series
    if (customMetric.value) {
      customSeries.value = (await fetchChart(customMetric.value, null, 'avg')).series
    }
    error.value = null
    lastUpdated.value = new Date().toLocaleTimeString()
  } catch (e) {
    error.value = 'Gagal mengambil metrik. Pastikan backend dan Prometheus jalan.'
  }
}

async function fetchNames() {
  try {
    const names = await metricsService.getNames()
    // Filter ke metrik runtime yang relevan — dropdown tidak jadi daftar 1000+ nama
    metricNames.value = names.filter(
      (n) =>
        /^(jvm_|process_|http_|system_|logback_|executor_)/.test(n) &&
        !n.endsWith('_seconds_count') &&
        !n.endsWith('_seconds_sum'),
    )
  } catch {
    metricNames.value = []
  }
}

// ---- Overlay Q&A (ephemeral — tidak masuk riwayat AgentPage) ----
const askOpen = ref(false)
const askInput = ref('')
const askStreaming = ref(false)
const askMessages = ref([])

function sendAsk() {
  const text = askInput.value.trim()
  if (!text || askStreaming.value) return

  askMessages.value.push({ role: 'user', content: text })
  askInput.value = ''
  const reply = { role: 'assistant', content: '', streaming: true }
  askMessages.value.push(reply)
  askStreaming.value = true

  agentService.streamQuickAsk(
    text,
    (chunk) => {
      reply.content += chunk
    },
    () => {
      reply.streaming = false
      askStreaming.value = false
    },
    (err) => {
      reply.content +=
        (reply.content ? '\n\n' : '') + 'Maaf, terjadi kendala: ' + (err?.message || 'AI unavailable')
      reply.streaming = false
      askStreaming.value = false
    },
  )
}

// Tutup dropdown range saat klik di luar (dropdown & trigger ditandai data-range-dd)
function onGlobalClick(e) {
  if (!rangeOpen.value) return
  if (e.target.closest && e.target.closest('[data-range-dd]')) return
  rangeOpen.value = false
}

let pollTimer = null

onMounted(() => {
  fetchAll()
  fetchNames()
  pollTimer = setInterval(fetchAll, POLL_MS)
  document.addEventListener('click', onGlobalClick)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  document.removeEventListener('click', onGlobalClick)
})
</script>