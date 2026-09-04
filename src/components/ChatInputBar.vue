<template>
  <div class="w-full">

    <!-- Pending file attachment preview -->
    <div v-if="pendingFile" class="mb-2 flex items-center gap-2">
      <div class="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" :class="isDark ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-600'">
        <img v-if="pendingFilePreview" :src="pendingFilePreview" class="w-8 h-8 rounded object-cover" />
        <FileIcon v-else :size="14" />
        <span class="truncate max-w-50">{{ pendingFile.name }}</span>
        <button @click="$emit('clear-file')" class="hover:text-red-500 transition">
          <CloseIcon :size="12" />
        </button>
      </div>
    </div>

    <div
      class="chat-input-box w-full flex items-end rounded-2xl pl-4 pr-2 py-2 shadow-sm transition-all"
      :class="isDark ? 'bg-[#1e293b]/80 chat-input-box--dark' : 'bg-white chat-input-box--light'"
      :style="{ '--chat-accent': accentColor }"
    >
      <!-- Attach file button — sized to match the mic/send buttons on desktop
           (md:w-10 md:h-10) so it sits level with them instead of lower -->
      <button
        @click="fileInputEl?.click()"
        class="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition shrink-0"
        :class="isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'"
        title="Lampirkan gambar atau dokumen"
      >
        <PaperclipIcon :size="16" />
      </button>
      <input
        ref="fileInputEl"
        type="file"
        class="hidden"
        accept="image/*,.pdf,.doc,.docx,.txt"
        @change="onFileChange"
      />

      <textarea
        ref="textareaEl"
        :value="input"
        @input="onInput"
        @keydown.enter.exact.prevent="$emit('send')"
        rows="1"
        placeholder="Tanya soal pemakaian energi hari ini..."
        class="chat-input-textarea flex-1 bg-transparent border-none outline-none text-sm md:text-base placeholder-gray-400 w-full py-2 px-2 resize-none leading-relaxed overflow-y-auto transition-[height] duration-100 ease-out"
        :class="isDark ? 'text-white' : 'text-gray-800'"
      />

      <!-- Voice input — circle on hover, consistent with the attach button -->
      <button
        @click="$emit('toggle-voice')"
        :class="[
          'w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition shrink-0 ml-1',
          isRecording ? 'bg-red-500 text-white animate-pulse' : (isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100')
        ]"
        title="Voice input"
      >
        <MicIcon :size="16" />
      </button>

      <!-- Send — no permanent circle, only shows on hover -->
      <button
        @click="$emit('send')"
        data-testid="send-button"
        :disabled="(!input.trim() && !pendingFile) || streaming"
        class="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition shrink-0 ml-1"
        :class="[
          (input.trim() || pendingFile) ? 'text-[#0f8cd5]' : (isDark ? 'text-gray-500' : 'text-gray-300'),
          isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'
        ]"
      >
        <SendIcon :size="18" class="ml-0.5" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import SendIcon from '@/components/icons/SendIcon.vue'
import MicIcon from '@/components/icons/MicIcon.vue'
import PaperclipIcon from '@/components/icons/PaperClipIcon.vue'
import FileIcon from '@/components/icons/FileIcon.vue'
import CloseIcon from '@/components/icons/CloseIcon.vue'

const props = defineProps({
  input: { type: String, required: true },
  pendingFile: { type: [File, null], default: null },
  pendingFilePreview: { type: [String, null], default: null },
  isDark: { type: Boolean, default: false },
  isRecording: { type: Boolean, default: false },
  streaming: { type: Boolean, default: false },
  // Theme accent color (follows the weather-based theme), used for the border/shadow on hover
  accentColor: { type: String, default: '#0f8cd5' },
})

const emit = defineEmits(['update:input', 'send', 'toggle-voice', 'file-select', 'clear-file'])

const fileInputEl = ref(null)
const textareaEl = ref(null)

// Max textarea height before scrolling kicks in — above this the content scrolls,
// below this the box itself stretches to fit the text (like Claude's chat input).
const MAX_HEIGHT_PX = 240

function resizeTextarea() {
  const el = textareaEl.value
  if (!el) return
  el.style.height = 'auto'
  const next = Math.min(el.scrollHeight, MAX_HEIGHT_PX)
  el.style.height = `${next}px`
  el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? 'auto' : 'hidden'
}

function onInput(e) {
  emit('update:input', e.target.value)
  nextTick(resizeTextarea)
}

// Reset height when the input is cleared externally (e.g. after a message is sent)
watch(() => props.input, (val) => {
  if (!val) nextTick(resizeTextarea)
})

function onFileChange(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (file) emit('file-select', file)
}
</script>

<style scoped>
/* Thin border by default, accent-colored border + soft shadow on hover — follows the active theme color */
.chat-input-box {
  border-width: 1px;
  border-style: solid;
}
.chat-input-box--light {
  border-color: #e5e7eb; /* gray-200, idle */
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
.chat-input-box--light:hover,
.chat-input-box--light:focus-within {
  border-color: var(--chat-accent);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--chat-accent) 22%, transparent);
}
.chat-input-box--dark {
  border-color: rgba(255, 255, 255, 0.1); /* idle */
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
.chat-input-box--dark:hover,
.chat-input-box--dark:focus-within {
  border-color: var(--chat-accent);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--chat-accent) 35%, transparent);
}
</style>