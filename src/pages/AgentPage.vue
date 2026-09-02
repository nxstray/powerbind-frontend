<template>
  <div class="min-h-screen flex transition-colors duration-1000 ease-in-out" :class="themeClass">

    <!-- Mobile overlay -->
    <div v-if="sidebarOpen" class="fixed inset-0 bg-black/40 z-20 md:hidden" @click="sidebarOpen = false" />

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
      <nav class="custom-scroll flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <button
          v-for="item in navItems" :key="item.name"
          @click="$router.push(item.to); sidebarOpen = false"
          :class="[
            'w-full flex items-center rounded-xl text-sm font-medium transition group',
            sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
            $route.name === item.routeName ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
          ]"
          :title="sidebarCollapsed ? item.name : ''"
        >
          <component :is="item.icon" :size="17" class="shrink-0 transition-all duration-300" :class="item.name === 'Gemono' ? 'group-hover:animate-pulse text-gray-800/80' : ''" />
          <span v-if="!sidebarCollapsed">{{ item.name }}</span>
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
            <button
              @click="handleLogout"
              class="text-gray-800/70 hover:text-gray-900 transition shrink-0"
              title="Logout"
            >
              <LogOutIcon :size="15" />
            </button>
          </template>
        </div>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex-1 flex flex-col min-w-0 relative h-screen">

      <!-- Top bar: mobile menu + judul percakapan + history dropdown -->
      <div class="shrink-0 flex items-center justify-between gap-3 px-4 md:px-8 pt-4 md:pt-6 pb-2">
        <button @click="sidebarOpen = true" class="md:hidden text-gray-500 hover:text-gray-700" :class="isDark ? 'text-white/70' : ''">
          <MenuIcon :size="20" />
        </button>

        <!-- Judul percakapan aktif — sejajar kiri dengan tombol Riwayat Chat, bisa diklik untuk rename -->
        <div v-if="activeConversationId" class="flex-1 min-w-0">
          <div
            v-if="!editingTitle"
            @click="startEditTitle"
            class="inline-flex items-center max-w-35 sm:max-w- px-2.5 py-1 rounded-2xl border text-xs font-medium truncate cursor-text transition hover:opacity-80"
            :style="{ borderColor: accentColor + '55', color: accentColor }"
            title="Klik untuk ganti nama percakapan"
          >
            <span class="truncate">{{ activeConversationTitle }}</span>
          </div>
          <input
            v-else
            ref="titleInputEl"
            v-model="titleDraft"
            @keydown.enter="titleInputEl?.blur()"
            @keydown.esc="cancelEditTitle"
            @blur="saveTitle"
            class="px-2.5 py-1 rounded-2xl border text-xs font-medium outline-none bg-transparent"
            :style="{ width: titleInputWidth, borderColor: accentColor, color: accentColor }"
          />
        </div>
        <div v-else class="flex-1 min-w-0"></div>

        <div class="flex items-center gap-2 shrink-0">
          <!-- History dropdown -->
          <div class="relative" ref="historyDropdownRef">
            <button
              @click="toggleHistoryDropdown"
              class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-2xl border transition"
              :class="isDark ? 'border-white/20 text-white/70 hover:bg-white/10' : 'border-gray-200 text-gray-600 hover:bg-gray-50 bg-white'"
            >
              <HistoryIcon :size="13" />
              <span class="hidden sm:inline">Riwayat Chat</span>
            </button>

            <div
              v-if="historyDropdownOpen"
              class="absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-lg z-20 overflow-hidden border max-h-96 flex flex-col"
              :class="isDark ? 'bg-[#1e293b] border-white/10' : 'bg-white border-gray-100'"
            >
              <button
                @click="startNewChat"
                class="flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b transition shrink-0"
                :class="isDark ? 'border-white/10 text-white hover:bg-white/5' : 'border-gray-100 text-gray-700 hover:bg-gray-50'"
              >
                <PlusIcon :size="13" />
                Percakapan Baru
              </button>

              <div class="custom-scroll overflow-y-auto flex-1">
                <div v-if="conversations.length === 0" class="px-3 py-4 text-xs text-center" :class="isDark ? 'text-white/40' : 'text-gray-400'">
                  Belum ada riwayat percakapan
                </div>
                <div
                  v-for="conv in conversations" :key="conv.id"
                  class="group flex items-center justify-between px-3 py-2.5 text-xs cursor-pointer transition"
                  :class="[
                    conv.id === activeConversationId ? (isDark ? 'bg-white/10' : 'bg-gray-50') : '',
                    isDark ? 'text-white/70 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'
                  ]"
                  @click="loadConversation(conv.id)"
                >
                  <span class="truncate flex-1">{{ conv.title || 'Percakapan tanpa judul' }}</span>
                  <button
                    @click.stop="removeConversation(conv.id)"
                    class="opacity-0 group-hover:opacity-100 ml-2 shrink-0 hover:text-red-500 transition"
                  >
                    <TrashIcon :size="12" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat History Area -->
      <main ref="messagesEl" class="custom-scroll flex-1 overflow-y-auto px-4 md:px-8 pb-4 flex flex-col">
        <div class="max-w-3xl mx-auto w-full flex flex-col gap-6 flex-1" :class="messages.length === 0 ? 'justify-center' : ''">

          <!-- Empty State -->
          <div v-if="messages.length === 0" class="text-center">
            <h2 class="text-2xl md:text-3xl font-bold font-doto" :class="isDark ? 'text-white' : 'text-gray-800'">
              {{ typedGreeting }}<span class="typewriter-cursor" aria-hidden="true">|</span>
            </h2>

            <!-- Input tampil di sini (tengah atas) selama belum ada percakapan -->
            <div class="mt-6 flex justify-center">
              <div class="w-full max-w-2xl">
                <ChatInputBar
                  v-model:input="input"
                  :pendingFile="pendingFile"
                  :pendingFilePreview="pendingFilePreview"
                  :isDark="isDark"
                  :isRecording="isRecording"
                  :streaming="streaming"
                  @send="send"
                  @toggle-voice="toggleVoice"
                  @file-select="handleFileSelect"
                  @clear-file="clearPendingFile"
                />
              </div>
            </div>
          </div>

          <!-- Message Bubbles -->
          <div v-for="msg in messages" :key="msg.id" class="flex flex-col">

            <!-- User Message -->
            <div v-if="msg.role === 'user'" class="self-end max-w-[85%] md:max-w-[75%]">
              <!-- Attached file preview -->
              <div v-if="msg.attachment" class="mb-1.5 flex justify-end">
                <div class="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" :class="isDark ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-600'">
                  <img v-if="msg.attachment.isImage" :src="msg.attachment.previewUrl" class="w-8 h-8 rounded object-cover" />
                  <FileIcon v-else :size="14" />
                  <span class="truncate max-w-40">{{ msg.attachment.name }}</span>
                </div>
              </div>
              <div class="bg-[#f3f4f6] px-6 py-3.5 rounded-3xl rounded-br-sm shadow-sm" :class="isDark ? 'bg-white/10' : ''">
                <p :class="isDark ? 'text-white' : 'text-gray-800'" class="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{{ msg.content }}</p>
                <p class="text-[10px] mt-1.5 opacity-40">{{ msg.time }}</p>
              </div>
            </div>

            <!-- Agent Message — tanpa avatar sparkles / background gradient -->
            <div v-else class="self-start max-w-full md:max-w-[85%] w-full">
              <MarkdownRenderer :content="msg.content" :class="isDark ? 'text-gray-200' : 'text-gray-700'" class="text-sm md:text-base" />
              <div v-if="msg.hasWarning" class="mt-2 flex items-center gap-1.5 text-amber-500 text-xs font-medium">
                <span>Terdeteksi pemborosan energi</span>
              </div>
              <p class="text-[10px] mt-1.5 opacity-40">{{ msg.time }}</p>
            </div>

          </div>

          <!-- Streaming Indicator — tanpa avatar sparkles -->
          <div v-if="streaming" class="self-start flex gap-1 pt-1">
            <div v-for="i in 3" :key="i" class="w-2 h-2 rounded-full animate-bounce" :class="isDark ? 'bg-white/40' : 'bg-gray-400'" :style="{ animationDelay: (i - 1) * 0.2 + 's' }" />
          </div>

        </div>
      </main>

      <!-- Chat Input Area — dipakukan di bawah begitu percakapan sudah mulai -->
      <div v-if="messages.length > 0" class="shrink-0 px-4 md:px-8 pb-6 md:pb-8">
        <div class="max-w-3xl mx-auto w-full">
          <ChatInputBar
            v-model:input="input"
            :pendingFile="pendingFile"
            :pendingFilePreview="pendingFilePreview"
            :isDark="isDark"
            :isRecording="isRecording"
            :streaming="streaming"
            @send="send"
            @toggle-voice="toggleVoice"
            @file-select="handleFileSelect"
            @clear-file="clearPendingFile"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import agentService from '@/services/agentService'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import ChatInputBar from '@/components/ChatInputBar.vue'
import HomeIcon from '@/components/icons/HomeIcon.vue'
import SparklesIcon from '@/components/icons/SparklesIcon.vue'
import LogOutIcon from '@/components/icons/LogOutIcon.vue'
import ChevronLeftIcon from '@/components/icons/ChevronLeftIcon.vue'
import MenuIcon from '@/components/icons/MenuIcon.vue'
import HistoryIcon from '@/components/icons/HistoryIcon.vue'
import TrashIcon from '@/components/icons/TrashIcon.vue'
import FileIcon from '@/components/icons/FileIcon.vue'
import CloseIcon from '@/components/icons/CloseIcon.vue'
import PlusIcon from '@/components/icons/PlusIcon.vue'

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

// File attachment state
const pendingFile = ref(null)
const pendingFilePreview = ref(null)

const ACTIVE_CONVERSATION_KEY = 'gemono_active_conversation_id'

// History dropdown state
const historyDropdownOpen = ref(false)
const historyDropdownRef = ref(null)
const conversations = ref([])
const activeConversationId = ref(null)

const activeConversationTitle = computed(() => {
  const conv = conversations.value.find((c) => c.id === activeConversationId.value)
  return conv?.title || 'Percakapan tanpa judul'
})

// warna aksen mengikuti tema weather saat ini (dipakai untuk border/teks judul)
const accentColor = ref('#0f8cd5')

// rename judul percakapan inline
const editingTitle = ref(false)
const titleDraft = ref('')
const titleInputEl = ref(null)

// lebar box rename mengikuti panjang teks yang diketik (min 6ch, max 40ch)
const titleInputWidth = computed(() => {
  const len = titleDraft.value.length || 1
  return Math.min(Math.max(len + 2, 6), 40) + 'ch'
})

function startEditTitle() {
  titleDraft.value = activeConversationTitle.value
  editingTitle.value = true
  nextTick(() => titleInputEl.value?.focus())
}

function cancelEditTitle() {
  editingTitle.value = false
}

async function saveTitle() {
  if (!editingTitle.value) return
  editingTitle.value = false
  const newTitle = titleDraft.value.trim()
  if (!newTitle || newTitle === activeConversationTitle.value || !activeConversationId.value) return

  const conv = conversations.value.find((c) => c.id === activeConversationId.value)
  const previousTitle = conv?.title
  if (conv) conv.title = newTitle // optimistic update

  try {
    await agentService.renameConversation(activeConversationId.value, newTitle)
  } catch (_) {
    console.warn('[Agent] Failed to rename conversation')
    if (conv) conv.title = previousTitle // rollback kalau backend menolak
  }
}

const navItems = [
  { name: 'Dashboard', routeName: 'dashboard', to: '/', icon: HomeIcon },
  { name: 'Gemono', routeName: 'agent', to: '/agent', icon: SparklesIcon },
]

const weatherData = ref({ sidebarColor: 'from-[#0f8cd5]' })
const themeClass = ref('bg-[#f0f2f5]')
const isDark = ref(false)

async function fetchWeather() {
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-6.4025&longitude=106.9600&current=temperature_2m,weather_code,is_day&timezone=Asia/Jakarta')
    const data = await res.json()
    const curr = data.current
    const hour = new Date().getHours()
    const isRain = curr.weather_code >= 51 && curr.weather_code <= 99

    let bgTheme = 'bg-[#f0f2f5]'
    let sidebarColor = 'from-[#0f8cd5]'
    let accent = '#0f8cd5'
    let night = false

    if (isRain) {
      bgTheme = 'bg-[#e5e7eb]'; sidebarColor = 'from-[#64748b]'; accent = '#64748b'
    } else if (curr.is_day === 0) {
      // aksen dibuat lebih terang dari sidebarColor supaya tetap kontras di atas bg gelap
      bgTheme = 'bg-[#1e293b]'; sidebarColor = 'from-[#1e1b4b]'; accent = '#818cf8'; night = true
    } else if (hour >= 15 && hour < 18) {
      bgTheme = 'bg-[#fed7aa]'; sidebarColor = 'from-[#f97316]'; accent = '#f97316'
    } else {
      bgTheme = 'bg-[#f0f2f5]'; sidebarColor = 'from-[#0f8cd5]'; accent = '#0f8cd5'
    }

    weatherData.value = { sidebarColor }
    themeClass.value = bgTheme
    accentColor.value = accent
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
function timeFormat(dateStr) {
  return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTo({ top: messagesEl.value.scrollHeight, behavior: 'smooth' })
  }
}

function buildHistory() {
  return messages.value.slice(-10).map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }))
}

// ===== Typewriter greeting (font Doto) =====
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

// replay animasi kalau user kembali ke empty state (mis. setelah "Percakapan Baru")
watch(
  () => messages.value.length === 0,
  (isEmpty) => { if (isEmpty) startTypewriter() },
)

// ===== History dropdown =====
function toggleHistoryDropdown() {
  historyDropdownOpen.value = !historyDropdownOpen.value
}

function handleOutsideClick(e) {
  if (historyDropdownRef.value && !historyDropdownRef.value.contains(e.target)) {
    historyDropdownOpen.value = false
  }
}

async function loadConversationList() {
  try {
    conversations.value = await agentService.getConversations()
  } catch (_) { conversations.value = [] }
}

async function loadConversation(id) {
  historyDropdownOpen.value = false
  try {
    const history = await agentService.getConversationMessages(id)
    messages.value = history.map((h) => ({
      id: h.id,
      role: h.role === 'assistant' ? 'agent' : 'user',
      content: h.content,
      time: timeFormat(h.createdAt),
      hasWarning: false,
    }))
    activeConversationId.value = id
    localStorage.setItem(ACTIVE_CONVERSATION_KEY, String(id))
    await scrollToBottom()
  } catch (_) {
    console.warn('[Agent] Failed to load conversation')
    localStorage.removeItem(ACTIVE_CONVERSATION_KEY)
  }
}

function startNewChat() {
  messages.value = []
  activeConversationId.value = null
  historyDropdownOpen.value = false
  clearPendingFile()
  localStorage.removeItem(ACTIVE_CONVERSATION_KEY)
}

async function removeConversation(id) {
  try {
    await agentService.deleteConversation(id)
    conversations.value = conversations.value.filter((c) => c.id !== id)
    if (activeConversationId.value === id) startNewChat()
  } catch (_) {
    console.warn('[Agent] Failed to delete conversation')
  }
}

// ===== File attachment =====
function handleFileSelect(file) {
  if (!file) return
  pendingFile.value = file
  if (file.type.startsWith('image/')) {
    pendingFilePreview.value = URL.createObjectURL(file)
  } else {
    pendingFilePreview.value = null
  }
}

function clearPendingFile() {
  if (pendingFilePreview.value) URL.revokeObjectURL(pendingFilePreview.value)
  pendingFile.value = null
  pendingFilePreview.value = null
}

// ===== Send message =====
async function send() {
  const text = input.value.trim()
  if ((!text && !pendingFile.value) || streaming.value) return

  const file = pendingFile.value
  const isImage = file?.type.startsWith('image/')
  const previewUrl = pendingFilePreview.value

  const userMsg = {
    id: Date.now(),
    role: 'user',
    content: text || (isImage ? 'Analisis gambar ini' : `Analisis dokumen: ${file?.name}`),
    time: timeNow(),
  }
  if (file) {
    userMsg.attachment = { name: file.name, isImage, previewUrl }
  }
  messages.value.push(userMsg)

  input.value = ''
  clearPendingFile()
  streaming.value = true
  await scrollToBottom()

  const agentMsgId = Date.now() + 1
  messages.value.push({ id: agentMsgId, role: 'agent', content: '', time: timeNow(), hasWarning: false })

  const onChunk = (chunk) => {
    const msg = messages.value.find((m) => m.id === agentMsgId)
    if (msg) {
      msg.content += chunk
      if (chunk.toLowerCase().includes('waste') || chunk.includes('boros') || chunk.includes('WARNING')) {
        msg.hasWarning = true
      }
      scrollToBottom()
    }
  }
  const wasNewConversation = !activeConversationId.value
  const onDone = async () => {
    streaming.value = false
    await loadConversationList()
    // if this was the first message of a new thread, adopt the newest
    // conversation as active so the next message continues the same thread
    if (wasNewConversation && conversations.value.length > 0) {
      activeConversationId.value = conversations.value[0].id
      localStorage.setItem(ACTIVE_CONVERSATION_KEY, String(activeConversationId.value))
    }
  }
  const onError = (err) => {
    const msg = messages.value.find((m) => m.id === agentMsgId)
    if (msg) msg.content = 'Maaf, terjadi kesalahan saat menghubungi AI. Coba lagi.'
    streaming.value = false
    console.error('[Agent] Stream error:', err)
  }

  if (file && isImage) {
    agentService.streamVision(userMsg.content, file, onChunk, onDone, onError)
  } else if (file) {
    agentService.streamDocument(userMsg.content, file, activeConversationId.value, onChunk, onDone, onError)
  } else {
    const history = buildHistory().slice(0, -1)
    agentService.streamChat(text, history, activeConversationId.value, onChunk, onDone, onError)
  }
}

// ===== Voice input =====
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
      try {
        const text = await agentService.transcribe(blob)
        if (text) input.value = text
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
  document.addEventListener('click', handleOutsideClick)
  try { await authStore.fetchProfile() } catch (_) {}
  await loadConversationList()

  // tetap di conversation yang sedang aktif setelah refresh, kalau ada
  const savedId = localStorage.getItem(ACTIVE_CONVERSATION_KEY)
  if (savedId) await loadConversation(savedId)
  if (!activeConversationId.value) startTypewriter()
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
  clearPendingFile()
  clearInterval(typeTimer)
})
</script>