<template>
  <div class="flex flex-col rounded-xl border overflow-hidden" :class="isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100'">
    <div class="flex items-center justify-between px-3 py-2 border-b" :class="headClass">
      <div class="flex items-center gap-1.5 text-xs font-semibold">
        <span>{{ META[sourceKey].label }}</span>
      </div>
      <div class="flex items-center gap-2 text-[11px]">
        <span v-if="counts.ERROR > 0" class="text-red-600 font-semibold">{{ counts.ERROR }}E</span>
        <span v-if="counts.WARN > 0" class="text-amber-600 font-semibold">{{ counts.WARN }}W</span>
        <span class="opacity-60">{{ logs.length }}</span>
        <button @click="focused ? $emit('unfocus') : $emit('focus')" class="opacity-60 hover:opacity-100">
          {{ focused ? '▁' : '⤢' }}
        </button>
      </div>
    </div>

    <div ref="scrollEl" @scroll="onScroll" class="bg-zinc-900 overflow-y-auto font-mono text-[11.5px] leading-5" :class="heightClass">
      <div v-if="logs.length === 0" class="h-full flex flex-col items-center justify-center text-zinc-500 gap-1 py-10">
        <p class="text-xs">Tidak ada log</p>
      </div>

      <div
        v-for="l in logs"
        :key="l.timestampMs + l.message"
        @click="expandedKey = expandedKey === l.timestampMs + l.message ? null : l.timestampMs + l.message"
        class="border-l-2 px-2.5 py-1 cursor-pointer hover:bg-zinc-800/60"
        :class="[LEVEL_BAR[l.level] || LEVEL_BAR.INFO, expandedKey === l.timestampMs + l.message ? 'bg-zinc-800/70' : '']"
      >
        <div class="flex items-start gap-1.5 flex-wrap">
          <span class="text-zinc-500 shrink-0">{{ fmtTime(l.timestampMs) }}</span>
          <span class="shrink-0 font-semibold" :class="LEVEL_TEXT[l.level] || LEVEL_TEXT.INFO">{{ l.level }}</span>
          <span class="text-zinc-200 break-all">{{ l.message }}</span>
        </div>
        <div v-if="expandedKey === l.timestampMs + l.message" class="mt-1 mb-0.5 ml-1 text-zinc-500 text-[10.5px]">
          {{ fmtFull(l.timestampMs) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  sourceKey: { type: String, required: true }, // BACKEND | FRONTEND | IOT
  logs: { type: Array, required: true },
  isDark: { type: Boolean, default: false },
  isLive: { type: Boolean, default: true },
  focused: { type: Boolean, default: false },
  heightClass: { type: String, default: 'h-[360px]' },
})
defineEmits(['focus', 'unfocus'])

const META = {
  BACKEND: { label: 'Backend' },
  FRONTEND: { label: 'Frontend' },
  IOT: { label: 'IoT' },
}
const HEAD_CLASS = {
  BACKEND: 'bg-sky-50 text-sky-700 border-sky-100',
  FRONTEND: 'bg-violet-50 text-violet-700 border-violet-100',
  IOT: 'bg-emerald-50 text-emerald-700 border-emerald-100',
}
const headClass = computed(() => HEAD_CLASS[props.sourceKey])

const LEVEL_BAR = {
  ERROR: 'border-l-red-500', WARN: 'border-l-amber-500', INFO: 'border-l-sky-500', DEBUG: 'border-l-zinc-400',
}
const LEVEL_TEXT = {
  ERROR: 'text-red-400', WARN: 'text-amber-400', INFO: 'text-sky-300', DEBUG: 'text-zinc-400',
}

const counts = computed(() => {
  const c = { ERROR: 0, WARN: 0 }
  for (const l of props.logs) if (c[l.level] !== undefined) c[l.level]++
  return c
})

const expandedKey = ref(null)
const scrollEl = ref(null)
const atBottom = ref(true)

function onScroll() {
  const el = scrollEl.value
  if (!el) return
  atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40
}

watch(
  () => props.logs.length,
  async () => {
    if (props.isLive && atBottom.value) {
      await nextTick()
      if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
    }
  },
)

function fmtTime(ms) {
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
function fmtFull(ms) {
  return new Date(ms).toLocaleString('id-ID', { hour12: false })
}
</script>
