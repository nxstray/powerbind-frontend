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
      <header
        class="shrink-0 backdrop-blur-md border-b px-4 md:px-6 pt-3 pb-3"
        :class="isDark ? 'bg-black/20 border-white/10' : 'bg-white/80 border-gray-100'"
      >
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-3">
            <button @click="sidebarOpen = true" class="md:hidden" :class="isDark ? 'text-white/70' : 'text-gray-500'">
              <MenuIcon :size="20" />
            </button>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-sm font-bold" :class="isDark ? 'text-white' : 'text-gray-900'">Log Sistem</h1>
                <span
                  class="flex items-center gap-1 text-[10.5px] font-medium rounded-full px-2 py-0.5 border"
                  :class="isDark ? 'bg-white/10 border-white/10 text-white/70' : 'bg-gray-100 border-gray-200 text-gray-500'"
                >
                  <LockIcon :size="10" /> Khusus admin
                </span>
              </div>
              <p class="text-xs mt-0.5" :class="isDark ? 'text-white/40' : 'text-gray-400'">
                Backend, Frontend, dan IoT dipisah per panel, tapi berjalan di jam yang sama
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <div class="hidden sm:flex items-center gap-3 text-xs" :class="isDark ? 'text-white/50' : 'text-gray-500'">
              <span><span class="font-semibold text-red-400">{{ totals.ERROR }}</span> error</span>
              <span><span class="font-semibold text-amber-400">{{ totals.WARN }}</span> warn</span>
            </div>
            <button
              @click="isLive = !isLive"
              class="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition"
              :class="isLive ? 'bg-red-50 border-red-200 text-red-600' : (isDark ? 'bg-white/10 border-white/10 text-white/70' : 'bg-gray-50 border-gray-200 text-gray-600')"
            >
              <span v-if="isLive" class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              {{ isLive ? 'Live' : 'Lanjutkan' }}
            </button>
          </div>
        </div>

        <!-- filters -->
        <div class="flex flex-wrap items-center gap-2 mt-3">
          <button
            v-for="lvl in LEVEL_KEYS"
            :key="lvl"
            @click="toggleLevel(lvl)"
            class="text-xs font-medium px-2.5 py-1.5 rounded-xl border transition"
            :class="activeLevels.has(lvl) ? LEVEL_CHIP[lvl] : chipInactiveClass"
          >
            {{ lvl }}
          </button>

          <div class="relative ml-auto">
            <select
              v-model="range"
              class="text-xs font-medium px-2.5 py-1.5 rounded-xl border appearance-none pr-6"
              :class="isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-white border-gray-200 text-gray-600'"
            >
              <option value="15m">15 menit</option>
              <option value="1h">1 jam</option>
              <option value="6h">6 jam</option>
              <option value="24h">24 jam</option>
            </select>
          </div>

          <input
            v-model="query"
            placeholder="Cari pesan log..."
            class="text-xs px-3 py-1.5 rounded-xl border w-44"
            :class="isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500' : 'bg-white border-gray-200 text-gray-700 placeholder:text-gray-400'"
          />
        </div>
      </header>

      <!-- panels -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-5 grid gap-3" :class="focused ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'">
        <LogPanel
          v-for="key in visibleSources"
          :key="key"
          :source-key="key"
          :logs="filteredBySource(key)"
          :is-dark="isDark"
          :is-live="isLive"
          :focused="focused === key"
          :height-class="focused ? 'h-[440px]' : 'h-[360px]'"
          @focus="focused = key"
          @unfocus="focused = null"
        />
      </div>

      <p v-if="loadError" class="text-center text-xs text-red-400 pb-3">
        Gagal mengambil log dari /api/admin/logs. Pastikan Loki jalan dan kamu login sebagai admin.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, h } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import adminService from '@/services/adminService'

import HomeIcon from '@/components/icons/HomeIcon.vue'
import SparklesIcon from '@/components/icons/SparklesIcon.vue'
import DatabaseIcon from '@/components/icons/DatabaseIcon.vue'
import TerminalIcon from '@/components/icons/TerminalIcon.vue'
import ChevronLeftIcon from '@/components/icons/ChevronLeftIcon.vue'
import MenuIcon from '@/components/icons/MenuIcon.vue'
import LogPanel from '@/components/LogPanel.vue'

const iconFactory = (paths) => (props) =>
  h(
    'svg',
    { xmlns: 'http://www.w3.org/2000/svg', width: props.size || 24, height: props.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    paths,
  )
const LockIcon = iconFactory([h('rect', { x: 3, y: 11, width: 18, height: 11, rx: 2 }), h('path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' })])

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

const chipInactiveClass = computed(() =>
  isDark.value ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-white border-gray-200 text-gray-400',
)

// ---- filters & data ----------------------------------------------------------
const LEVEL_KEYS = ['ERROR', 'WARN', 'INFO', 'DEBUG']
const LEVEL_CHIP = {
  ERROR: 'bg-red-50 border-red-300 text-red-700',
  WARN: 'bg-amber-50 border-amber-300 text-amber-700',
  INFO: 'bg-sky-50 border-sky-300 text-sky-700',
  DEBUG: 'bg-zinc-100 border-zinc-300 text-zinc-600',
}
const activeLevels = reactive(new Set(LEVEL_KEYS))
function toggleLevel(key) {
  if (activeLevels.has(key)) {
    if (activeLevels.size > 1) activeLevels.delete(key)
  } else {
    activeLevels.add(key)
  }
}

const query = ref('')
const range = ref('1h')
const isLive = ref(true)
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
  const q = query.value.trim().toLowerCase()
  return logs.value.filter(
    (l) => l.source === source && activeLevels.has(l.level) && (!q || l.message.toLowerCase().includes(q)),
  )
}

const totals = computed(() => {
  const c = { ERROR: 0, WARN: 0 }
  for (const l of logs.value) if (c[l.level] !== undefined) c[l.level]++
  return c
})

function startPolling() {
  stopPolling()
  fetchLogs()
  pollTimer = setInterval(fetchLogs, 3000)
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

watch(isLive, (live) => (live ? startPolling() : stopPolling()))
watch(range, fetchLogs)

onMounted(() => {
  fetchWeather()
  startPolling()
})
onUnmounted(stopPolling)
</script>
