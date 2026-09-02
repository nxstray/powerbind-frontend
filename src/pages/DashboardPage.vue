<template>
  <div class="min-h-screen flex transition-colors duration-1000 ease-in-out" :class="themeClass">

    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-black/40 z-20 md:hidden"
      @click="sidebarOpen = false"
    />

        <!-- Sidebar -->
    <aside
      :class="[
        'fixed md:sticky top-0 h-screen z-30 flex flex-col transition-all duration-500',
        'bg-linear-to-br to-[#d5e2de]',
        weatherData.sidebarColor || 'from-[#0f8cd5]',
        sidebarCollapsed ? 'w-16' : 'w-60',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      ]"
    >

      <nav class="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <button
          v-for="item in navItems"
          :key="item.name"
          @click="$router.push(item.to); sidebarOpen = false"
          :class="[
            'w-full flex items-center rounded-xl text-sm font-medium transition group',
            sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
            $route.name === item.routeName
              ? 'bg-white/20 text-white'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          ]"
          :title="sidebarCollapsed ? item.name : ''"
        >
          <!-- Icon animation logic: scale for all, rotation for sparkle, door opening for home -->
          <component 
            :is="item.icon" 
            :size="17" 
            class="shrink-0 transition-all duration-300"
            :class="item.name === 'Gemono' ? 'group-hover:animate-pulse' : ''"
          />
          <span v-if="!sidebarCollapsed">{{ item.name }}</span>
        </button>
      </nav>

      <div class="px-2 pb-2 hidden md:block shrink-0">
        <button
          @click="sidebarCollapsed = !sidebarCollapsed"
          class="w-full flex items-center justify-center py-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition"
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
            <button @click="handleLogout" class="text-white/40 hover:text-white transition shrink-0" title="Logout">
              <LogOutIcon :size="15" />
            </button>
          </template>
        </div>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex-1 flex flex-col min-w-0 relative overflow-hidden">
      
      <!-- Giant background logo -->
      <div class="absolute inset-0 pointer-events-none flex items-center justify-center z-0 opacity-5">
        <img src="/logo.png" alt="Background Logo" class="w-[800] object-contain -rotate-12 scale-150" />
      </div>

      <!-- Topbar -->
      <header class="h-14 md:h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 md:px-6 shrink-0 relative z-10">
        <div class="flex items-center gap-3">
          <button @click="sidebarOpen = true" class="md:hidden text-gray-500 hover:text-gray-700">
            <MenuIcon :size="20" />
          </button>
          <div>
            <h1 class="text-sm md:text-base font-bold text-gray-900">Overview</h1>
            <p class="text-[10px] md:text-xs text-gray-400 hidden sm:block">{{ currentDate }}</p>
          </div>
        </div>
        
        <!-- Smart Weather Widget -->
                <div class="flex items-center gap-3">
                  <div 
                    class="flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-sm border border-gray-100 transition-colors"
                    :class="weatherData.themeWidget"
                  >
            <component :is="weatherData.icon" :size="14" />
            <span class="text-xs font-bold">{{ weatherData.temp }}°C</span>
            <span class="text-[10px] opacity-80 hidden sm:block">{{ weatherData.condition }}</span>
          </div>

          <!-- Offline indicator -->
          <span v-if="!wsConnected" class="bg-red-100 text-red-500 text-[10px] px-2 py-1 rounded-full font-semibold">
            Offline
          </span>
        </div>
      </header>

      <!-- Content -->
      <main class="flex-1 p-4 md:p-6 overflow-auto space-y-4 md:space-y-5 relative z-10">

        <!-- Loading state -->
        <div v-if="store.loading" class="flex items-center justify-center h-64">
          <div class="flex flex-col items-center gap-3">
            <div class="w-8 h-8 border-2 border-[#0f8cd5] border-t-transparent rounded-full animate-spin" />
            <p class="text-xs text-gray-400">Loading dashboard...</p>
          </div>
        </div>

        <!-- Error state -->
        <div v-else-if="store.error && !store.summary" class="flex items-center justify-center h-64">
          <div class="text-center">
            <p class="text-sm text-gray-500">{{ store.error }}</p>
            <button
              @click="store.fetchSummary()"
              class="mt-3 text-xs text-[#0f8cd5] hover:underline"
            >
              Try again
            </button>
          </div>
        </div>

        <!-- Dashboard content -->
        <template v-else-if="store.summary">

          <!-- Stat Cards -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">

            <!-- Rooms -->
            <LiquidCard
              label="Rooms"
              :value="store.summary.totalRooms"
              sub="registered"
              color="#0f8cd5"
              :fill="(store.summary.totalRooms / 10) * 100"
            >
              <HomeIcon :size="14" class="text-[#0f8cd5]" />
            </LiquidCard>

            <!-- Occupied -->
            <LiquidCard
              label="Occupied"
              :value="store.summary.occupiedRooms"
              sub="with people"
              color="#7ADAA5"
              :fill="store.summary.totalRooms > 0 ? (store.summary.occupiedRooms / store.summary.totalRooms) * 100 : 0"
            >
              <UsersIcon :size="14" class="text-[#16a34a]" />
            </LiquidCard>

            <!-- Devices -->
            <LiquidCard
              label="Devices"
              :value="store.summary.activeDevices"
              sub="relays on"
              color="#ECECBB"
              :fill="store.summary.totalRooms > 0 ? (store.summary.activeDevices / store.summary.totalRooms) * 100 : 0"
            >
              <PowerIcon :size="14" class="text-[#a08c00]" />
            </LiquidCard>

            <!-- Power — dark variant -->
            <LiquidCard
              label="Power"
              :value="`${(store.summary.currentWatts || 0).toFixed(0)} W`"
              sub="current usage"
              color="#0f8cd5"
              :fill="Math.min((store.summary.currentWatts || 0) / 10, 100)"
              :dark="true"
              class="dark-card"
            >
              <TrendingUpIcon :size="14" class="text-white" />
            </LiquidCard>

          </div>

          <!-- Row 2: Chart + Donut -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2 bg-white rounded-2xl border border-gray-100 p-4 md:p-5">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h2 class="text-sm font-bold text-gray-900">Power Usage</h2>
                  <p class="text-xs text-gray-400 mt-0.5">Watt consumption over time</p>
                </div>
                <div class="relative" ref="dropdownRef">
                  <button
                    @click="dropdownOpen = !dropdownOpen"
                    class="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 hover:border-[#0f8cd5] transition bg-white"
                  >
                    {{ hourOptions.find(o => o.value === selectedHours)?.label }}
                    <ChevronLeftIcon :size="12" :class="dropdownOpen ? 'rotate-90' : '-rotate-90'" class="transition-transform" />
                  </button>
                  <div
                    v-if="dropdownOpen"
                    class="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-100 rounded-xl shadow-lg z-10 overflow-hidden"
                  >
                    <button
                      v-for="opt in hourOptions"
                      :key="opt.value"
                      @click="selectHours(opt.value)"
                      :class="selectedHours === opt.value ? 'bg-[#0f8cd5]/10 text-[#0f8cd5]' : 'text-gray-600 hover:bg-gray-50'"
                      class="w-full text-left px-3 py-2 text-xs transition"
                    >
                      {{ opt.label }}
                    </button>
                  </div>
                </div>
              </div>
              <PowerChart :data="store.powerHistory" />
            </div>

            <div class="bg-white rounded-2xl border border-gray-100 p-4 md:p-5 flex flex-col">
              <div>
                <h2 class="text-sm font-bold text-gray-900">Today's Energy</h2>
                <p class="text-xs text-gray-400 mt-0.5">Consumption summary</p>
              </div>
              <div class="flex-1 flex items-center justify-center py-2">
                <EnergyDonut :kwh="store.summary.todayKwh || 0" :maxKwh="10" :size="160" />
              </div>
              <div class="space-y-2.5">
                <div class="flex justify-between items-center">
                  <span class="text-xs text-gray-400">Consumption</span>
                  <span class="text-sm font-bold text-gray-900">{{ (store.summary.todayKwh || 0).toFixed(2) }} kWh</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-xs text-gray-400">Est. Cost Today</span>
                  <span class="text-sm font-bold text-gray-900">Rp {{ formatCost(store.summary.estimatedCostToday || 0) }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-xs text-gray-400">Monthly Est.</span>
                  <span class="text-sm font-bold text-[#0f8cd5]">Rp {{ formatCost((store.summary.estimatedCostToday || 0) * 30) }}</span>
                </div>
              </div>
            </div>
          </div>

                    <!-- Row 3: Room cards + Activity -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2 bg-white rounded-2xl border border-gray-100 p-4 md:p-5">
              <h2 class="text-sm font-bold text-gray-900 mb-3">Room Status</h2>
              <div class="grid grid-cols-2 gap-3">
                <RoomCard
                  v-for="room in store.summary.rooms"
                  :key="room.id"
                  :room="room"
                />
              </div>
            </div>

            <div class="bg-white rounded-2xl border border-gray-100 p-4 md:p-5">
              <h2 class="text-sm font-bold text-gray-900 mb-1">Room Activity</h2>
              <p class="text-xs text-gray-400 mb-4">Detection count today</p>
              <div class="space-y-3">
                <div v-for="room in roomActivity" :key="room.name">
                  <div class="flex justify-between mb-1.5">
                    <span class="text-xs text-gray-600 font-medium">{{ room.name }}</span>
                    <span class="text-xs text-gray-400">{{ room.count }}x</span>
                  </div>
                  <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-700"
                      :style="{ width: `${(room.count / maxActivity) * 100}%`, backgroundColor: room.color }"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </template>

      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, markRaw } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useDashboardStore } from '@/stores/dashboardStore'
import { useAuthStore } from '@/stores/authStore'

import LiquidCard from '@/components/LiquidCard.vue'
import PowerChart from '@/components/PowerChart.vue'
import EnergyDonut from '@/components/EnergyDonut.vue'
import RoomCard from '@/components/RoomCard.vue'

import BoltIcon from '@/components/icons/BoltIcon.vue'
import HomeIcon from '@/components/icons/HomeIcon.vue'
import UsersIcon from '@/components/icons/UsersIcon.vue'
import PowerIcon from '@/components/icons/PowerIcon.vue'
import TrendingUpIcon from '@/components/icons/TrendingUpIcon.vue'
import LogOutIcon from '@/components/icons/LogOutIcon.vue'
import ChevronLeftIcon from '@/components/icons/ChevronLeftIcon.vue'
import MenuIcon from '@/components/icons/MenuIcon.vue'
import SparklesIcon from '@/components/icons/SparklesIcon.vue'

// Weather Icons
import SunIcon from '@/components/icons/SunIcon.vue'
import MoonIcon from '@/components/icons/MoonIcon.vue'
import CloudRainIcon from '@/components/icons/CloudRainIcon.vue'
import CloudIcon from '@/components/icons/CloudIcon.vue'

const router = useRouter()
const route = useRoute()
const store = useDashboardStore()
const authStore = useAuthStore()

const sidebarCollapsed = ref(false)
const sidebarOpen = ref(false)
const dropdownOpen = ref(false)
const dropdownRef = ref(null)
const selectedHours = ref(24)
const wsConnected = ref(false)
let stompClient = null

// Smart weather state
const weatherData = ref({ 
  temp: 0, 
  condition: 'Checking...', 
  icon: markRaw(SunIcon),
  themeWidget: 'bg-white text-gray-700',
  sidebarColor: 'from-[#0f8cd5]'
})
const themeClass = ref('bg-[#f0f2f5]')

// Fetch weather from Open-Meteo for Cileungsi
async function fetchWeather() {
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-6.4025&longitude=106.9600&current=temperature_2m,weather_code,is_day&timezone=Asia/Jakarta')
    const data = await res.json()
    const curr = data.current
    
    const hour = new Date().getHours()
    const isRain = curr.weather_code >= 51 && curr.weather_code <= 99
    
        let icon = SunIcon
    let conditionText = 'Clear'
    let bgTheme = 'bg-[#f0f2f5]' 
    let widgetTheme = 'bg-blue-50 text-blue-600'
    let sidebarColor = 'from-[#0f8cd5]'

    if (isRain) {
      icon = CloudRainIcon
      conditionText = 'Rain'
      bgTheme = 'bg-[#e5e7eb]'
      widgetTheme = 'bg-gray-200 text-gray-700'
      sidebarColor = 'from-[#64748b]'
    } else if (curr.is_day === 0) {
      icon = MoonIcon
      conditionText = 'Night'
      bgTheme = 'bg-[#1e293b]'
      widgetTheme = 'bg-indigo-900 text-indigo-200'
      sidebarColor = 'from-[#1e1b4b]'
    } else if (hour >= 15 && hour < 18) {
      icon = SunIcon
      conditionText = 'Afternoon'
      bgTheme = 'bg-[#fed7aa]'
      widgetTheme = 'bg-orange-100 text-orange-600'
      sidebarColor = 'from-[#f97316]'
    } else {
      icon = hour < 10 ? SunIcon : CloudIcon
      conditionText = hour < 10 ? 'Morning' : 'Cloudy'
      bgTheme = 'bg-[#f0f2f5]'
      widgetTheme = 'bg-sky-100 text-sky-600'
      sidebarColor = 'from-[#0f8cd5]'
    }

        weatherData.value = {
      temp: Math.round(curr.temperature_2m),
      condition: conditionText,
      icon: markRaw(icon),
      themeWidget: widgetTheme,
      sidebarColor
    }
    themeClass.value = bgTheme

  } catch (error) {
    console.error("Failed to fetch weather data:", error)
  }
}

const navItems = [
  { name: 'Dashboard', routeName: 'dashboard', to: '/', icon: HomeIcon },
  { name: 'Gemono', routeName: 'agent', to: '/agent', icon: SparklesIcon },
]

const hourOptions = [
  { label: 'Last 6h', value: 6 },
  { label: 'Last 24h', value: 24 },
  { label: 'Last 48h', value: 48 },
  { label: 'Last 7 days', value: 168 },
]

// Room activity — will be dynamic from InfluxDB later
const roomActivity = [
  { name: 'Kamar 1', count: 0, color: '#0f8cd5' },
  { name: 'Kamar 2', count: 0, color: '#7ADAA5' },
  { name: 'Kamar 3', count: 0, color: '#c8c890' },
  { name: 'Ruang Tamu', count: 0, color: '#0f8cd5' },
]
const maxActivity = 1 // prevent division by zero

const currentDate = computed(() =>
  new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
)

const userInitial = computed(() => {
  const name = authStore.user?.displayName || authStore.user?.username || 'A'
  return name.charAt(0).toUpperCase()
})

function formatCost(amount) {
  return new Intl.NumberFormat('id-ID').format(Math.round(amount))
}

function selectHours(val) {
  selectedHours.value = val
  dropdownOpen.value = false
  store.fetchPowerHistory(val)
}

function handleOutsideClick(e) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    dropdownOpen.value = false
  }
}

function connectWebSocket() {
  const socket = new SockJS(`${import.meta.env.VITE_API_URL || 'http://localhost:8045'}/ws`)
  stompClient = new Client({
    webSocketFactory: () => socket,
    onConnect: () => {
      wsConnected.value = true
      stompClient.subscribe('/topic/presence', (msg) => {
        store.updateRoomStatus(JSON.parse(msg.body))
      })
      stompClient.subscribe('/topic/power', (msg) => {
        const parts = msg.body.split(',')
        if (parts.length >= 1) store.updateCurrentWatts(parseFloat(parts[0]))
      })
    },
    onDisconnect: () => { wsConnected.value = false },
    reconnectDelay: 5000,
  })
  stompClient.activate()
}

async function handleLogout() {
  await authStore.logout()
  router.push({ name: 'login' })
}

onMounted(async () => {
  document.addEventListener('click', handleOutsideClick)
  fetchWeather()
  await authStore.fetchProfile()
  await store.fetchSummary()
  await store.fetchPowerHistory(selectedHours.value)
  connectWebSocket()
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
  if (stompClient) stompClient.deactivate()
})
</script>