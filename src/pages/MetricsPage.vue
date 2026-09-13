<template>
  <div class="min-h-screen flex transition-colors duration-1000 ease-in-out" :class="themeClass" :style="{ '--accent-color': accentColor }">
    <!-- Mobile overlay -->
    <div v-if="sidebarOpen" class="fixed inset-0 bg-black/40 z-20 md:hidden" @click="sidebarOpen = false" />

    <!-- Sidebar — same pattern as LogPage -->
    <aside
      :class="[
        'fixed md:sticky top-0 h-screen z-30 flex flex-col transition-all duration-500',
        'bg-linear-to-br to-[#d5e2de]',
        sidebarColor,
        sidebarCollapsed ? 'w-16' : 'w-60',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      ]"
    >
      <nav class="custom-scroll flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <button
          v-for="item in navItems"
          :key="item.name"
          @click="$router.push(item.to); sidebarOpen = false"
          :class="[
            'w-full flex items-center rounded-xl text-sm font-medium transition group',
            sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
            $route.name === item.routeName ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white',
          ]"
          :title="sidebarCollapsed ? item.name : ''"
        >
          <component :is="item.icon" :size="17" class="shrink-0" />
          <span v-if="!sidebarCollapsed" class="relative top-px">{{ item.name }}</span>
        </button>
      </nav>

      <div class="px-2 pb-2 hidden md:block shrink-0">
        <button
          @click="sidebarCollapsed = !sidebarCollapsed"
          class="w-full flex items-center justify-center py-2 rounded-xl transition"
          :class="isDark ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-gray-800/70 hover:text-gray-900 hover:bg-black/10'"
        >
          <ChevronLeftIcon :size="16" :class="sidebarCollapsed ? 'rotate-180' : ''" class="transition-transform duration-300" />
        </button>
      </div>

      <div class="border-t border-white/10 px-2 py-3 shrink-0">
        <div :class="['flex items-center gap-2.5 px-2 py-2', sidebarCollapsed ? 'justify-center' : '']">
          <div class="w-7 h-7 rounded-full bg-[#ECECBB] flex items-center justify-center text-xs font-bold text-gray-700 shrink-0">
            {{ userInitial }}
          </div>
          <template v-if="!sidebarCollapsed">
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-white truncate">{{ authStore.user?.displayName || 'Admin' }}</p>
              <p class="text-[10px] text-white/50 truncate">{{ authStore.user?.username || 'admin' }}</p>
            </div>
            <AppTooltip text="Logout" position="right">
              <button
                @click="askLogout"
                class="transition shrink-0"
                :class="isDark ? 'text-white/40 hover:text-white' : 'text-gray-800/70 hover:text-gray-900'"
              >
                <LogOutIcon :size="15" />
              </button>
            </AppTooltip>
          </template>
        </div>
      </div>
    </aside>

    <div class="flex-1 flex flex-col min-w-0 h-screen">
      <!-- Header -->
      <div class="px-4 sm:px-6 pt-4 pb-2 flex items-center gap-3">
        <button
          @click="sidebarOpen = true"
          class="md:hidden transition"
          :class="isDark ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-700'"
        >
          <MenuIcon :size="20" />
        </button>
        <h1 class="text-lg font-bold" :class="isDark ? 'text-white' : 'text-gray-800'">System Metrics</h1>
        <span v-if="lastUpdated" class="text-[10px]" :class="isDark ? 'text-zinc-500' : 'text-gray-400'">updated {{ lastUpdated }}</span>

        <!-- Range dropdown -->
        <div class="relative ml-auto" data-range-dd>
          <button
            @click="rangeOpen = !rangeOpen"
            class="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition"
            :class="isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:border-zinc-500' : 'bg-white border-gray-200 text-gray-600 hover:border-[#0f8cd5]'"
          >
            {{ rangeOptions.find((o) => o.value === hours)?.label }}
            <ChevronLeftIcon :size="12" :class="rangeOpen ? 'rotate-90' : '-rotate-90'" class="transition-transform" />
          </button>
          <div
            v-if="rangeOpen"
            class="absolute right-0 top-full mt-1 w-28 rounded-md shadow-lg z-10 overflow-hidden border"
            :class="isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-100'"
          >
            <button
              v-for="opt in rangeOptions"
              :key="opt.value"
              @click="selectRange(opt.value)"
              class="w-full text-left px-3 py-2 text-xs transition"
              :class="hours === opt.value ? (isDark ? 'bg-white/10 text-white' : 'bg-[#0f8cd5]/10 text-[#0f8cd5]') : (isDark ? 'text-zinc-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50')"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Charts — scroll internal dengan custom-scroll (warna thumb mengikuti --accent-color tema) -->
      <main class="custom-scroll flex-1 overflow-y-auto px-4 sm:px-6 pb-6 space-y-3">
        <div v-if="error" class="rounded-md border border-red-200 bg-red-50 text-red-600 text-xs px-3 py-2">{{ error }}</div>

        <!-- Panels Grafana — dark card permanen dengan header title + query -->
        <MetricsChart
          :series="memorySeries"
          format="bytes"
          title="JVM Memory Used"
          subtitle="jvm_memory_used_bytes"
        />

        <MetricsChart :series="cpuSeries" format="ratio" title="Process CPU Usage" subtitle="process_cpu_usage" />

        <div class="rounded-lg border border-[#2c3235] bg-[#181b1f] overflow-hidden">
          <div class="flex items-center gap-2 px-3 py-1.5 border-b border-[#2c3235]">
            <p class="text-[12px] font-semibold text-zinc-200 truncate">Custom metric</p>
            <p v-if="customMetric" class="text-[10px] font-mono text-zinc-500 truncate hidden sm:block">{{ customMetric }}</p>
            <select
              v-model="customMetric"
              class="ml-auto shrink-0 text-[10px] rounded border border-[#41474d] bg-[#22252b] text-zinc-300 px-1.5 py-1 outline-none focus:border-[#3d71d9] max-w-60"
            >
              <option value="" disabled>— pilih metrik —</option>
              <option v-for="n in metricNames" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>
          <div class="p-2">
            <MetricsChart v-if="customMetric" :series="customSeries" />
            <p v-else class="text-[10px] text-zinc-500 p-2">Pilih metrik dari dropdown untuk melihat grafiknya.</p>
          </div>
        </div>
      </main>
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

    <!-- Validation: logout -->
    <ConfirmDialog
      :open="logoutConfirm.open"
      :loading="logoutConfirm.loading"
      danger
      title="Keluar dari Akun"
      message="Kamu akan keluar dari sesi ini. Lanjutkan?"
      confirm-text="Keluar"
      cancel-text="Batal"
      @confirm="confirmLogout"
      @cancel="cancelLogout"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import metricsService from '@/services/metricsService'
import agentService from '@/services/agentService'

import MetricsChart from '@/components/MetricsChart.vue'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import AppTooltip from '@/components/AppTooltip.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import HomeIcon from '@/components/icons/HomeIcon.vue'
import GemonoIcon from '@/components/icons/GemonoIcon.vue'
import DatabaseIcon from '@/components/icons/DatabaseIcon.vue'
import TerminalIcon from '@/components/icons/TerminalIcon.vue'
import TrendingUpIcon from '@/components/icons/TrendingUpIcon.vue'
import ChevronLeftIcon from '@/components/icons/ChevronLeftIcon.vue'
import MenuIcon from '@/components/icons/MenuIcon.vue'
import LogOutIcon from '@/components/icons/LogOutIcon.vue'
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
      fetchChart(DEFAULT_METRIC, null, 'sum'),
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

// ---- Sidebar (pola sama dengan LogPage) ---------------------------------------
const router = useRouter()
const authStore = useAuthStore()
const sidebarCollapsed = ref(false)
const sidebarOpen = ref(false)

const navItems = [
  { name: 'Dashboard', routeName: 'dashboard', to: '/', icon: HomeIcon },
  { name: 'Gemono', routeName: 'agent', to: '/agent', icon: GemonoIcon },
  { name: 'ERD', routeName: 'erd', to: '/erd', icon: DatabaseIcon },
  { name: 'Log', routeName: 'log', to: '/log', icon: TerminalIcon },
  { name: 'Metrics', routeName: 'metrics', to: '/metrics', icon: TrendingUpIcon },
]

const userInitial = computed(() => {
  const name = authStore.user?.displayName || authStore.user?.username || 'A'
  return name.charAt(0).toUpperCase()
})

// ---- logout (same confirm-dialog flow as DashboardPage/AgentPage) --------------
const logoutConfirm = ref({ open: false, loading: false })
function askLogout() {
  logoutConfirm.value = { open: true, loading: false }
}
async function confirmLogout() {
  logoutConfirm.value.loading = true
  await authStore.logout()
  router.push({ name: 'login' })
}
function cancelLogout() {
  if (logoutConfirm.value.loading) return
  logoutConfirm.value = { open: false, loading: false }
}

// ---- automatic weather/time theme — thresholds & palet identik dengan DashboardPage
// (hujan → abu, malam → navy gelap, 15–18 → oren sore, sisanya → biru default).
// accentColor ikut diset supaya custom-scroll di main.css mengikuti tema. -----------
const themeClass = ref('bg-[#f0f2f5]')
const sidebarColor = ref('from-[#0f8cd5]')
const accentColor = ref('#0f8cd5')
const isDark = ref(false)

async function fetchWeather() {
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=-6.4025&longitude=106.9600&current=temperature_2m,weather_code,is_day&timezone=Asia/Jakarta',
    )
    const data = await res.json()
    const curr = data.current
    const hour = new Date().getHours()
    const isRain = curr.weather_code >= 51 && curr.weather_code <= 99

    let bg = 'bg-[#f0f2f5]'
    let sidebar = 'from-[#0f8cd5]'
    let accent = '#0f8cd5'
    let dark = false

    if (isRain) {
      bg = 'bg-[#e5e7eb]'; sidebar = 'from-[#64748b]'; accent = '#64748b'
    } else if (curr.is_day === 0) {
      bg = 'bg-[#1e293b]'; sidebar = 'from-[#1e1b4b]'; accent = '#4338ca'; dark = true
    } else if (hour >= 15 && hour < 18) {
      bg = 'bg-[#fed7aa]'; sidebar = 'from-[#f97316]'; accent = '#f97316'
    }

    themeClass.value = bg
    sidebarColor.value = sidebar
    accentColor.value = accent
    isDark.value = dark
  } catch (error) {
    console.error('Failed to fetch weather data:', error)
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
  fetchWeather()
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