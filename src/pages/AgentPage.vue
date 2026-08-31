<template>
  <div class="min-h-screen flex transition-colors duration-1000 ease-in-out" :class="themeClass">

    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-black/40 z-20 md:hidden"
      @click="sidebarOpen = false"
    />

    <!-- Sidebar (Persis dengan DashboardPage) -->
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
          <component
            :is="item.icon"
            :size="17"
            class="shrink-0 transition-all duration-300"
            :class="item.name === 'AI Agent' ? 'group-hover:animate-pulse' : ''"
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
    <div class="flex-1 flex flex-col min-w-0 relative h-screen">

      <!-- Mobile sidebar toggle — no topbar on this page, so this floats standalone -->
      <button
        @click="sidebarOpen = true"
        class="md:hidden absolute top-4 left-4 z-10 text-gray-500 hover:text-gray-700"
        :class="isDark ? 'text-white/70' : ''"
      >
        <MenuIcon :size="20" />
      </button>

      <!-- Chat History Area -->
      <main ref="messagesEl" class="flex-1 overflow-y-auto px-4 md:px-8 pb-4 pt-16 md:pt-8 flex flex-col">
        <div class="max-w-3xl mx-auto w-full flex flex-col gap-6 flex-1" :class="messages.length === 0 ? 'justify-center' : ''">

          <!-- Empty State — greeting only, no suggestions -->
          <div v-if="messages.length === 0" class="text-center">
            <h2 class="text-2xl md:text-3xl font-bold" :class="isDark ? 'text-white' : 'text-gray-800'">
              Halo, {{ authStore.user?.displayName || 'Administrator' }}
            </h2>
          </div>

          <!-- Message Bubbles -->
          <div v-for="msg in messages" :key="msg.id" class="flex flex-col">

            <!-- User Message -->
            <div v-if="msg.role === 'user'" class="self-end bg-[#f3f4f6] px-6 py-3.5 rounded-3xl rounded-br-sm max-w-[85%] md:max-w-[75%] shadow-sm" :class="isDark ? 'bg-white/10' : ''">
              <p :class="isDark ? 'text-white' : 'text-gray-800'" class="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{{ msg.content }}</p>
              <p class="text-[10px] mt-1.5 opacity-40">{{ msg.time }}</p>
            </div>

            <!-- Agent Message -->
            <div v-else class="self-start flex gap-4 max-w-full md:max-w-[85%] w-full">
              <div class="w-8 h-8 md:w-10 md:h-10 rounded-full bg-linear-to-br from-[#0f8cd5] to-[#10b981] flex items-center justify-center shrink-0 mt-1 shadow-md">
                <SparklesIcon :size="16" class="text-white" />
              </div>
              <div class="pt-1.5 flex-1">
                <div
                  class="text-sm md:text-base leading-loose prose-sm"
                  :class="isDark ? 'text-gray-200' : 'text-gray-700'"
                  v-html="renderMarkdown(msg.content)"
                />
                <!-- warning badge for anomaly messages -->
                <div v-if="msg.hasWarning" class="mt-2 flex items-center gap-1.5 text-amber-500 text-xs font-medium">
                  <span>Terdeteksi pemborosan energi</span>
                </div>
                <p class="text-[10px] mt-1.5 opacity-40">{{ msg.time }}</p>
              </div>
            </div>

          </div>

          <!-- Streaming/Typing Indicator -->
          <div v-if="streaming" class="self-start flex gap-4">
            <div class="w-8 h-8 md:w-10 md:h-10 rounded-full bg-linear-to-br from-[#0f8cd5] to-[#10b981] flex items-center justify-center shrink-0 mt-1 opacity-50">
              <SparklesIcon :size="16" class="text-white animate-spin" />
            </div>
            <div class="pt-3 flex gap-1">
              <div v-for="i in 3" :key="i" class="w-2 h-2 rounded-full bg-gray-400 animate-bounce" :style="{ animationDelay: (i - 1) * 0.2 + 's' }" />
            </div>
          </div>

        </div>
      </main>

      <!-- Chat Input Area — flat, no pulse/glow, sits directly below content -->
      <div class="shrink-0 px-4 md:px-8 pb-6 md:pb-8">
        <div class="max-w-3xl mx-auto w-full">
          <div
            class="w-full flex items-center border rounded-full pl-6 pr-2 py-2 shadow-sm transition-all"
            :class="isDark ? 'bg-[#1e293b]/80 border-white/10' : 'bg-white border-gray-200'"
          >
            <textarea
              v-model="input"
              @keydown.enter.exact.prevent="send"
              rows="1"
              placeholder="Tanya soal pemakaian energi hari ini..."
              class="flex-1 bg-transparent border-none outline-none text-sm md:text-base placeholder-gray-400 w-full py-2 resize-none leading-relaxed max-h-28 overflow-y-auto"
              :class="isDark ? 'text-white' : 'text-gray-800'"
            />

            <!-- Voice input button -->
            <button
              @click="toggleVoice"
              :class="[
                'w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition shrink-0 ml-1',
                isRecording ? 'bg-red-500 text-white animate-pulse' : (isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100')
              ]"
              title="Voice input"
            >
              <MicIcon :size="16" />
            </button>

            <!-- Send button -->
            <button
              @click="send"
              :disabled="!input.trim() || streaming"
              class="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all shrink-0 ml-1"
              :class="input.trim() ? 'bg-[#0f8cd5] text-white hover:bg-[#0d7ab9] hover:scale-105' : 'bg-gray-200 text-gray-400'"
            >
              <SendIcon :size="18" class="ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import agentService from '@/services/agentService'
import HomeIcon from '@/components/icons/HomeIcon.vue'
import SparklesIcon from '@/components/icons/SparklesIcon.vue'
import LogOutIcon from '@/components/icons/LogOutIcon.vue'
import ChevronLeftIcon from '@/components/icons/ChevronLeftIcon.vue'
import MenuIcon from '@/components/icons/MenuIcon.vue'
import SendIcon from '@/components/icons/SendIcon.vue'
import MicIcon from '@/components/icons/MicIcon.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const sidebarCollapsed = ref(false)
const sidebarOpen = ref(false)
const messages = ref([])
const input = ref('')
const streaming = ref(false)
const messagesEl = ref(null)
const isRecording = ref(false)
let mediaRecorder = null
let audioChunks = []

const navItems = [
  { name: 'Dashboard', routeName: 'dashboard', to: '/', icon: HomeIcon },
  { name: 'AI Agent', routeName: 'agent', to: '/agent', icon: SparklesIcon },
]

// same weather state shape as DashboardPage — only sidebarColor and the page
// background (themeClass) are used here, since this page has no topbar/weather widget
const weatherData = ref({
  sidebarColor: 'from-[#0f8cd5]',
})
const themeClass = ref('bg-[#f0f2f5]')
const isDark = ref(false)

// fetch weather from Open-Meteo for Cileungsi — identical logic to DashboardPage
// so both pages always land on the same sidebar color and background
async function fetchWeather() {
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-6.4025&longitude=106.9600&current=temperature_2m,weather_code,is_day&timezone=Asia/Jakarta')
    const data = await res.json()
    const curr = data.current

    const hour = new Date().getHours()
    const isRain = curr.weather_code >= 51 && curr.weather_code <= 99

    let bgTheme = 'bg-[#f0f2f5]'
    let sidebarColor = 'from-[#0f8cd5]'
    let night = false

    if (isRain) {
      bgTheme = 'bg-[#e5e7eb]'
      sidebarColor = 'from-[#64748b]'
    } else if (curr.is_day === 0) {
      bgTheme = 'bg-[#1e293b]'
      sidebarColor = 'from-[#1e1b4b]'
      night = true
    } else if (hour >= 15 && hour < 18) {
      bgTheme = 'bg-[#fed7aa]'
      sidebarColor = 'from-[#f97316]'
    } else {
      bgTheme = 'bg-[#f0f2f5]'
      sidebarColor = 'from-[#0f8cd5]'
    }

    weatherData.value = { sidebarColor }
    themeClass.value = bgTheme
    isDark.value = night
  } catch (error) {
    console.error('Failed to fetch weather data:', error)
  }
}

const userInitial = computed(() => {
  const name = authStore.user?.displayName || authStore.user?.username || 'A'
  return name.charAt(0).toUpperCase()
})

function timeNow() {
  return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

// format a stored createdAt timestamp from history the same way timeNow() does
function timeFormat(dateStr) {
  return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

// simple markdown renderer for agent responses
function renderMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-3 list-disc">$1</li>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br/>')
}

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

async function clearChat() {
  messages.value = []
  try { await agentService.clearHistory() } catch (_) { /* riwayat lokal tetap kekosong walau backend gagal */ }
}

// build history from messages for multi-turn context
function buildHistory() {
  return messages.value.slice(-10).map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }))
}

async function send() {
  const text = input.value.trim()
  if (!text || streaming.value) return

  // add user message
  messages.value.push({ id: Date.now(), role: 'user', content: text, time: timeNow() })
  input.value = ''
  streaming.value = true
  await scrollToBottom()

  // prepare streaming agent message
  const agentMsgId = Date.now() + 1
  messages.value.push({ id: agentMsgId, role: 'agent', content: '', time: timeNow(), hasWarning: false })

  const history = buildHistory().slice(0, -1) // exclude the just-added agent placeholder

  agentService.streamChat(
    text,
    history,
    // onChunk — append delta to last message
    (chunk) => {
      const msg = messages.value.find((m) => m.id === agentMsgId)
      if (msg) {
        msg.content += chunk
        // detect waste warning in response
        if (chunk.toLowerCase().includes('waste') || chunk.includes('boros') || chunk.includes('WARNING')) {
          msg.hasWarning = true
        }
        scrollToBottom()
      }
    },
    // onDone
    () => { streaming.value = false },
    // onError
    (err) => {
      const msg = messages.value.find((m) => m.id === agentMsgId)
      if (msg) msg.content = 'Maaf, terjadi kesalahan saat menghubungi AI. Coba lagi.'
      streaming.value = false
      console.error('[Agent] Stream error:', err)
    },
  )
}

// voice input via Whisper — records audio and sends to backend for transcription
async function toggleVoice() {
  if (isRecording.value) {
    mediaRecorder?.stop()
    isRecording.value = false
    return
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioChunks = []
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data)
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(audioChunks, { type: 'audio/webm' })
      const formData = new FormData()
      formData.append('file', blob, 'voice.webm')
      try {
        const token = localStorage.getItem('accessToken')
        const res = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8045'}/api/agent/transcribe`,
          { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData },
        )
        const data = await res.json()
        if (data?.data?.text) {
          input.value = data.data.text
        }
      } catch {
        console.warn('[Agent] Transcription failed')
      }
    }
    mediaRecorder.start()
    isRecording.value = true
  } catch {
    console.warn('[Agent] Microphone access denied')
  }
}

async function handleLogout() {
  await authStore.logout()
  router.push({ name: 'login' })
}

onMounted(async () => {
  fetchWeather()
  try { await authStore.fetchProfile() } catch (_) {}

  try {
    const history = await agentService.getHistory()
    messages.value = history.map((h) => ({
      id: h.id,
      role: h.role === 'assistant' ? 'agent' : 'user',
      content: h.content,
      time: timeFormat(h.createdAt),
      hasWarning: false,
    }))
    await scrollToBottom()
  } catch (_) { /* riwayat gagal dimuat, mulai dari kosong seperti sebelumnya */ }
})
</script>