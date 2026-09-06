<template>
  <div class="min-h-screen flex transition-colors duration-1000 ease-in-out" :class="themeClass">
    <div v-if="sidebarOpen" class="fixed inset-0 bg-black/40 z-20 md:hidden" @click="sidebarOpen = false" />

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
          </template>
        </div>
      </div>
    </aside>

    <div class="flex-1 flex flex-col min-w-0 h-screen">
      <!-- Logs volume — no card wrapper, spans the full canvas width -->
      <div class="shrink-0 px-4 md:px-6 pt-3" :class="isDark ? 'bg-black/20' : 'bg-white/80'">
        <div class="flex items-center gap-3 mb-1 md:hidden">
          <button @click="sidebarOpen = true" :class="isDark ? 'text-white/70' : 'text-gray-500'">
            <MenuIcon :size="20" />
          </button>
        </div>
        <LogsVolumeChart :logs="logs" :range="range" :is-dark="isDark" />
      </div>

      <!-- Boundary row, raised up to sit right above the panels: levels + range dropdown live here now -->
      <div
        class="shrink-0 flex flex-wrap items-center gap-2 px-4 md:px-6 py-2.5 border-b backdrop-blur-md"
        :class="isDark ? 'bg-black/20 border-white/10' : 'bg-white/80 border-gray-100'"
      >
        <button
          v-for="lvl in LEVEL_KEYS"
          :key="lvl"
          @click="toggleLevel(lvl)"
          class="text-xs font-medium px-2.5 py-1.5 rounded-md border transition"
          :class="activeLevels.has(lvl) ? [chipActiveClass, LEVEL_TEXT[lvl]] : chipInactiveClass"
        >
          {{ lvl }}
        </button>

        <!-- Range dropdown — same trigger/panel/chevron animation pattern as the Power Usage chart on the dashboard -->
        <div class="relative ml-auto" ref="rangeDropdownRef">
          <button
            @click="rangeDropdownOpen = !rangeDropdownOpen"
            class="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition"
            :class="isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:border-zinc-500' : 'bg-white border-gray-200 text-gray-600 hover:border-[#0f8cd5]'"
          >
            {{ rangeOptions.find((o) => o.value === range)?.label }}
            <ChevronLeftIcon :size="12" :class="rangeDropdownOpen ? 'rotate-90' : '-rotate-90'" class="transition-transform" />
          </button>
          <div
            v-if="rangeDropdownOpen"
            class="absolute right-0 top-full mt-1 w-32 rounded-md shadow-lg z-10 overflow-hidden border"
            :class="isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-100'"
          >
            <button
              v-for="opt in rangeOptions"
              :key="opt.value"
              @click="selectRange(opt.value)"
              class="w-full text-left px-3 py-2 text-xs transition"
              :class="range === opt.value ? (isDark ? 'bg-white/10 text-white' : 'bg-[#0f8cd5]/10 text-[#0f8cd5]') : (isDark ? 'text-zinc-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50')"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- panels: fills all remaining viewport height, no page-level scroll — each panel scrolls internally -->
      <div class="flex-1 min-h-0 p-4 sm:p-5 grid gap-3" :class="focused ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'">
        <LogPanel
          v-for="key in visibleSources"
          :key="key"
          :source-key="key"
          :logs="filteredBySource(key)"
          :is-dark="isDark"
          :is-live="true"
          :focused="focused === key"
          @focus="focused = key"
          @unfocus="focused = null"
        />
      </div>

      <p v-if="loadError" class="text-center text-xs text-red-400 pb-3 shrink-0">
        Gagal mengambil log dari /api/admin/logs. Pastikan Loki jalan dan kamu login sebagai admin.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import adminService from '@/services/adminService'

import HomeIcon from '@/components/icons/HomeIcon.vue'
import SparklesIcon from '@/components/icons/SparklesIcon.vue'
import DatabaseIcon from '@/components/icons/DatabaseIcon.vue'
import TerminalIcon from '@/components/icons/TerminalIcon.vue'
import ChevronLeftIcon from '@/components/icons/ChevronLeftIcon.vue'
import MenuIcon from '@/components/icons/MenuIcon.vue'
import LogPanel from '@/components/LogPanel.vue'
import LogsVolumeChart from '@/components/LogsVolumeChart.vue'

const authStore = useAuthStore()
const sidebarCollapsed = ref(false)
const sidebarOpen = ref(false)

const navItems = [
  { name: 'Dashboard', routeName: 'dashboard', to: '/', icon: HomeIcon },
  { name: 'Gemono', routeName: 'agent', to: '/agent', icon: SparklesIcon },
  { name: 'ERD', routeName: 'erd', to: '/erd', icon: DatabaseIcon },
  { name: 'Log', routeName: 'log', to: '/log', icon: TerminalIcon },
]

const userInitial = computed(() => {
  const name = authStore.user?.displayName || authStore.user?.username || 'A'
  return name.charAt(0).toUpperCase()
})

// ---- automatic weather/time theme — identical thresholds to DashboardPage --
const themeClass = ref('bg-[#f0f2f5]')
const sidebarColor = ref('from-[#0f8cd5]')
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

    if (isRain) {
      themeClass.value = 'bg-[#e5e7eb]'; sidebarColor.value = 'from-[#64748b]'; isDark.value = false
    } else if (curr.is_day === 0) {
      themeClass.value = 'bg-[#1e293b]'; sidebarColor.value = 'from-[#1e1b4b]'; isDark.value = true
    } else if (hour >= 15 && hour < 18) {
      themeClass.value = 'bg-[#fed7aa]'; sidebarColor.value = 'from-[#f97316]'; isDark.value = false
    } else {
      themeClass.value = 'bg-[#f0f2f5]'; sidebarColor.value = 'from-[#0f8cd5]'; isDark.value = false
    }
  } catch (error) {
    console.error('Failed to fetch weather data:', error)
  }
}

// ---- level filter chips — one neutral chip style for every level; only the label
// text is tinted, so the row doesn't read as "colorful" at a glance --------------
const LEVEL_KEYS = ['ERROR', 'WARN', 'INFO', 'DEBUG']
const LEVEL_TEXT = {
  ERROR: 'text-red-500',
  WARN: 'text-amber-500',
  INFO: 'text-sky-500',
  DEBUG: 'text-zinc-500',
}
const chipActiveClass = computed(() =>
  isDark.value ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200',
)
const chipInactiveClass = computed(() =>
  isDark.value ? 'bg-zinc-800/40 border-zinc-800 text-zinc-600' : 'bg-gray-50 border-gray-100 text-gray-300',
)
const activeLevels = reactive(new Set(LEVEL_KEYS))
function toggleLevel(key) {
  if (activeLevels.has(key)) {
    if (activeLevels.size > 1) activeLevels.delete(key)
  } else {
    activeLevels.add(key)
  }
}

// ---- range dropdown (custom, animated chevron — same pattern as the dashboard's
// Power Usage hour-range dropdown) ------------------------------------------------
const rangeOptions = [
  { value: '15m', label: '15 menit' },
  { value: '1h', label: '1 jam' },
  { value: '6h', label: '6 jam' },
  { value: '24h', label: '24 jam' },
]
const range = ref('1h')
const rangeDropdownOpen = ref(false)
const rangeDropdownRef = ref(null)
function selectRange(value) {
  range.value = value
  rangeDropdownOpen.value = false
  fetchLogs()
}
function onDocClick(e) {
  if (rangeDropdownRef.value && !rangeDropdownRef.value.contains(e.target)) {
    rangeDropdownOpen.value = false
  }
}

const focused = ref(null) // null | 'BACKEND' | 'FRONTEND' | 'IOT'
const visibleSources = computed(() => (focused.value ? [focused.value] : ['BACKEND', 'FRONTEND', 'IOT']))

const logs = ref([])
const loadError = ref(false)
let pollTimer = null

async function fetchLogs() {
  try {
    const data = await adminService.queryLogs({ source: 'ALL', since: range.value, limit: 400 })
    logs.value = data
    loadError.value = false
  } catch (e) {
    loadError.value = true
  }
}

function filteredBySource(source) {
  return logs.value.filter((l) => l.source === source && activeLevels.has(l.level))
}

onMounted(() => {
  fetchWeather()
  fetchLogs()
  pollTimer = setInterval(fetchLogs, 3000)
  document.addEventListener('click', onDocClick)
})
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  document.removeEventListener('click', onDocClick)
})
</script>