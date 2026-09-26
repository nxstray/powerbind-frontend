<template>
  <div class="min-h-screen flex transition-colors duration-1000 ease-in-out" :class="themeClass" :style="{ '--accent-color': accentColor }">
    <!-- Mobile overlay -->
    <div v-if="sidebarOpen" class="fixed inset-0 bg-black/40 z-20 md:hidden" @click="sidebarOpen = false" />

    <!-- Sidebar — same pattern as LogPage -->
    <aside
      aria-label="Navigasi samping"
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
          <component :is="item.icon" :size="17" class="shrink-0 transition-all duration-300 group-hover:animate-pulse" />
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

    <!-- Main column + Ask Gemono panel are full-height siblings in the SAME row, so the
         panel spans the entire viewport height (top to bottom) instead of only the strip
         below the header. Keeping the header inside the shrinking left column also means
         it (and the dropdowns in it) gets pushed/reflowed automatically when the panel
         opens, with no extra logic needed. -->
    <div class="flex-1 flex min-w-0 relative overflow-hidden h-screen">
      <!-- Left column: pinned topbar + independently scrollable chart area -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Topbar — styled and pinned like DashboardPage's header: fixed height, sits
             OUTSIDE the scrollable <main> below, so it never moves/scrolls with the charts. -->
        <header
          class="h-14 md:h-16 shrink-0 border-b flex items-center gap-3 px-4 sm:px-6"
          :class="isDark ? 'border-white/10' : 'border-gray-100'"
        >
          <button
            @click="sidebarOpen = true"
            class="md:hidden transition"
            :class="isDark ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-700'"
          >
            <MenuIcon :size="20" />
          </button>
          <h1 class="text-lg font-bold" :class="isDark ? 'text-white' : 'text-gray-800'">System Metrics</h1>
          <span v-if="lastUpdated" class="text-[10px] relative top-1" :class="isDark ? 'text-zinc-500' : 'text-gray-400'">updated {{ lastUpdated }}</span>

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

          <!-- Ask Gemono trigger — hidden while the panel is open (the panel itself has
               a close button), so the header never shows two "Ask Gemono" entry points. -->
          <button
            v-if="!askOpen"
            @click="askOpen = true"
            class="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition"
            :class="[
              askOpen
                ? (isDark ? 'bg-zinc-800 text-zinc-100 border-zinc-700' : 'bg-white text-slate-700 border-gray-200')
                : (isDark ? 'bg-zinc-800 text-amber-400 border-zinc-700 hover:border-zinc-500' : 'bg-amber-400 text-slate-800 border-amber-400 hover:bg-amber-300'),
            ]"
          >
            <GemonoIcon :size="14" variant="white" class="rounded-sm" />
            Ask Gemono
          </button>
        </header>

        <!-- Charts — this is the ONLY scrollable region on the page now, so there is
             never a stray page-level scrollbar fighting with the panel/topbar. -->
        <main class="custom-scroll flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-3 space-y-3">
          <div v-if="error" class="rounded-md border border-red-200 bg-red-50 text-red-600 text-xs px-3 py-2">{{ error }}</div>

          <!-- Two containers only: memory (fixed) + metric explorer (dropdown + search) -->
          <MetricsChart :series="memorySeries" format="bytes" title="jvm_memory_used_bytes" :is-dark="isDark" hide-legend-scrollbar />

          <MetricsChart :series="cpuSeries" format="ratio" :title="selectedMetric" :is-dark="isDark">
            <template #actions>
              <div class="relative" data-metric-dd>
                <button
                  @click="metricOpen = !metricOpen"
                  class="flex items-center gap-1.5 text-[10px] font-medium rounded border px-2 py-1 transition max-w-60"
                  :class="isDark ? 'border-[#41474d] bg-[#22252b] text-zinc-300 hover:border-zinc-500' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-[#0f8cd5]'"
                >
                  <span class="truncate">{{ selectedMetric }}</span>
                  <ChevronLeftIcon :size="11" :class="metricOpen ? 'rotate-90' : '-rotate-90'" class="transition-transform shrink-0" />
                </button>
                <div
                  v-if="metricOpen"
                  class="absolute right-0 top-full mt-1 w-72 rounded-md shadow-lg z-10 overflow-hidden border"
                  :class="isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-100'"
                >
                  <div class="p-1.5 border-b" :class="isDark ? 'border-zinc-700' : 'border-gray-100'">
                    <label for="metric-search" class="sr-only">Cari metrik</label>
                    <input
                      id="metric-search"
                      v-model="metricSearch"
                      placeholder="Cari metrik…"
                      class="w-full text-[10px] rounded border px-2 py-1 outline-none"
                      :class="isDark ? 'border-zinc-600 bg-zinc-900/60 text-zinc-200 placeholder-zinc-500 focus:border-zinc-400' : 'border-gray-200 bg-gray-50 text-gray-700 placeholder-gray-400 focus:border-[#0f8cd5]'"
                    />
                  </div>
                  <div class="max-h-52 overflow-y-auto custom-scroll">
                    <button
                      v-for="n in filteredMetrics"
                      :key="n"
                      @click="selectMetric(n)"
                      class="w-full text-left px-3 py-1.5 text-[10px] font-mono transition"
                      :class="selectedMetric === n ? (isDark ? 'bg-white/10 text-white' : 'bg-[#0f8cd5]/10 text-[#0f8cd5]') : (isDark ? 'text-zinc-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50')"
                    >
                      {{ n }}
                    </button>
                    <p v-if="!filteredMetrics.length" class="px-3 py-2 text-[10px]" :class="isDark ? 'text-zinc-500' : 'text-gray-400'">Tidak ada metrik yang cocok.</p>
                  </div>
                </div>
              </div>
            </template>
          </MetricsChart>
        </main>
      </div>

      <!-- Ask Gemono panel wrapper — full viewport height (top to bottom). The
           width-animated <aside> does the clipping of the fixed 320px panel content,
           keeping the panel flush against the chart column with no gap and no stray
           scrollbar around it. -->
      <div class="relative shrink-0 h-full">
        <!-- Ask Gemono side panel — width animates 0 -> 320px, pushing the chart column left -->
        <aside
          aria-label="Panel Ask Gemono"
          class="h-full overflow-hidden transition-[width] duration-300 ease-out border-l"
          :class="askOpen
            ? (isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-200')
            : 'border-transparent'"
          :style="{ width: askOpen ? '320px' : '0px' }"
        >
          <div class="flex h-full w-80 flex-col">
            <div class="flex items-center gap-1.5 px-3 py-2 border-b shrink-0" :class="isDark ? 'border-white/10' : 'border-gray-100'">
              <GemonoIcon :size="14" :variant="isDark ? 'white' : 'dark'" class="rounded-sm" />
              <p class="text-xs font-semibold" :class="isDark ? 'text-zinc-100' : 'text-gray-800'">Ask Gemono</p>
              <button @click="askOpen = false" class="ml-auto p-0.5 rounded transition" :class="isDark ? 'text-zinc-400 hover:text-white hover:bg-white/5' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'">
                <CloseIcon :size="13" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto custom-scroll px-3 py-2.5 text-xs space-y-2" :class="isDark ? 'text-zinc-300' : 'text-gray-700'">
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
              <!-- Empty state — typewriter greeting like AgentPage (font Doto) -->
              <div v-else class="h-full flex items-center justify-center">
                <h2 class="text-base font-bold font-doto text-center" :class="isDark ? 'text-white' : 'text-gray-800'">
                  {{ typedGreeting }}<span class="typewriter-cursor" aria-hidden="true">|</span>
                </h2>
              </div>
            </div>

            <form @submit.prevent="sendAsk" class="flex items-center gap-1.5 px-3 py-2 border-t shrink-0" :class="isDark ? 'border-white/10' : 'border-gray-100'">
              <label for="ask-gemono-input" class="sr-only">Tanya Gemono soal grafik</label>
              <input
                id="ask-gemono-input"
                v-model="askInput"
                placeholder="Explain the memory chart…"
                class="flex-1 text-xs rounded-md border px-2 py-1.5 outline-none focus:border-[#0f8cd5]"
                :class="isDark ? 'border-zinc-600 bg-zinc-900/60 text-zinc-200 placeholder-zinc-500' : 'border-gray-200 bg-white text-gray-700 placeholder-gray-400'"
              />
              <button type="submit" :disabled="!askInput.trim() || askStreaming" class="text-[#0f8cd5] disabled:opacity-30">
                <SendIcon :size="14" />
              </button>
            </form>
          </div>
        </aside>
      </div>
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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
import CloseIcon from '@/components/icons/CloseIcon.vue'
import SendIcon from '@/components/icons/SendIcon.vue'

// 30s polling — Prometheus itself scrapes every 15s; polling faster than that
// yields no new data. Interval is cleared in onUnmounted (AgentPage SSE pattern).
const POLL_MS = 30_000
const DEFAULT_METRIC = 'jvm_memory_used_bytes'
const CPU_METRIC = 'process_cpu_usage'

const rangeOptions = [
  { label: 'Last 1 hour', value: 1 },
  { label: 'Last 6 hours', value: 6 },
  { label: 'Last 24 hours', value: 24 },
]
const hours = ref(1)
// Step size per range — a lookup keeps the value readable and avoids the nested
// ternaries SonarQube flags (javascript:S3358). Unknown ranges fall back to 900s.
const STEP_BY_HOURS = { 1: 60, 6: 240, 24: 900 }
const stepFor = (h) => STEP_BY_HOURS[h] ?? 900 // ~240 points per chart

const memorySeries = ref([])
const cpuSeries = ref([])
const metricNames = ref([])
const metricSearch = ref('')
const error = ref(null)
const lastUpdated = ref('')
const rangeOpen = ref(false)
const metricOpen = ref(false)

// Second container = metric explorer — displays any metric from the dropdown
// (default: process_cpu_usage). The dropdown search filters this list.
const selectedMetric = ref(CPU_METRIC)

const filteredMetrics = computed(() => {
  const q = metricSearch.value.trim().toLowerCase()
  return q ? metricNames.value.filter((n) => n.toLowerCase().includes(q)) : metricNames.value
})

function selectRange(v) {
  hours.value = v
  rangeOpen.value = false
  fetchAll()
}

function selectMetric(n) {
  selectedMetric.value = n
  metricOpen.value = false
  metricSearch.value = ''
  fetchAll()
}

async function fetchChart(metric, groupBy, agg) {
  return metricsService.query({
    metric, groupBy, agg, hours: hours.value, step: stepFor(hours.value),
  })
}

async function fetchAll() {
  try {
    const [mem, sel] = await Promise.all([
      fetchChart(DEFAULT_METRIC, null, 'sum'),
      fetchChart(selectedMetric.value, null, 'avg'),
    ])
    memorySeries.value = mem.series
    cpuSeries.value = sel.series
    error.value = null
    lastUpdated.value = new Date().toLocaleTimeString()
  } catch {
    error.value = 'Gagal mengambil metrik. Pastikan backend dan Prometheus jalan.'
  }
}

async function fetchNames() {
  try {
    const names = await metricsService.getNames()
    // Filter to relevant runtime metrics — the dropdown doesn't become a list of 1000+ names
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

// ---- Sidebar (same pattern as LogPage) ---------------------------------------
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

// ---- automatic weather/time theme — thresholds & palette identical to DashboardPage
// (rain → gray, night → dark navy, 15–18 → orange afternoon, otherwise → default blue).
// accentColor is also set so the custom-scroll in main.css follows the theme. -----------
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

// ---- typewriter greeting (same as AgentPage's empty state) --------------------
const typedGreeting = ref('')
let typeTimer = null
const greetingFull = computed(() => `Halo, ${authStore.user?.displayName || 'Administrator'}`)

function startTypewriter() {
  clearInterval(typeTimer)
  typedGreeting.value = ''
  const text = greetingFull.value
  let i = 0
  typeTimer = setInterval(() => {
    i++
    typedGreeting.value = text.slice(0, i)
    if (i >= text.length) clearInterval(typeTimer)
  }, 55)
}

// ---- Q&A overlay (ephemeral — not stored in the AgentPage history) ----
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
    [DEFAULT_METRIC, selectedMetric.value],
    hours.value,
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

// Close the range & metric dropdowns on outside click (trigger + panel marked data-*-dd)
function onGlobalClick(e) {
  if (!rangeOpen.value && !metricOpen.value) return
  if (e.target.closest && e.target.closest('[data-range-dd]')) return
  if (e.target.closest && e.target.closest('[data-metric-dd]')) return
  rangeOpen.value = false
  metricOpen.value = false
}

let pollTimer = null

// Replay the typewriter greeting every time the panel is opened — the animation
// plays inside the panel's empty state (before any message is sent).
watch(askOpen, (open) => {
  if (open && !askMessages.value.length) startTypewriter()
})

onMounted(() => {
  fetchWeather()
  fetchAll()
  fetchNames()
  pollTimer = setInterval(fetchAll, POLL_MS)
  document.addEventListener('click', onGlobalClick)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  clearInterval(typeTimer)
  document.removeEventListener('click', onGlobalClick)
})
</script>