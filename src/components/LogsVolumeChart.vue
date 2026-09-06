<template>
  <div class="rounded-xl border" :class="isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100'">
    <div class="flex items-center justify-between px-3 py-2 border-b" :class="isDark ? 'border-zinc-800' : 'border-gray-100'">
      <button
        @click="expanded = !expanded"
        class="flex items-center gap-1.5 text-xs font-semibold"
        :class="isDark ? 'text-white/80' : 'text-gray-700'"
      >
        <ChevronDownIcon :size="12" :class="expanded ? '' : '-rotate-90'" class="transition-transform" />
        Logs volume
      </button>
      <span class="text-[10.5px]" :class="isDark ? 'text-white/30' : 'text-gray-300'">Loki</span>
    </div>

    <div v-if="expanded" class="relative px-2 pt-2 pb-1" @mouseleave="hoverIdx = null">
      <svg :viewBox="`0 0 ${W} ${H}`" class="w-full block" :height="H" preserveAspectRatio="none">
        <line
          v-for="(gy, i) in gridYs"
          :key="'g' + i"
          :x1="0"
          :x2="W"
          :y1="gy"
          :y2="gy"
          :stroke="isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'"
          stroke-dasharray="2,3"
        />

        <g v-for="(b, i) in buckets" :key="i" @mouseenter="hoverIdx = i">
          <rect :x="barX(i)" y="0" :width="barW + 1.5" :height="PLOT_H" fill="transparent" />
          <template v-for="(seg, si) in stackedSegs(b)" :key="si">
            <rect v-if="seg.h > 0" :x="barX(i)" :y="seg.y" :width="barW" :height="Math.max(seg.h, 1.5)" :fill="LEVEL_COLOR[seg.level]" rx="1" />
          </template>
        </g>
      </svg>

      <div class="flex justify-between text-[9.5px] mt-1 px-0.5" :class="isDark ? 'text-white/25' : 'text-gray-300'">
        <span v-for="(t, i) in xTicks" :key="i">{{ t }}</span>
      </div>

      <div
        v-if="hoverIdx !== null && bucketHasData(buckets[hoverIdx])"
        class="absolute z-10 pointer-events-none rounded-lg border px-2.5 py-1.5 text-[10.5px] shadow-lg min-w-30"
        :class="isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-white border-gray-200 text-gray-700'"
        :style="tooltipStyle"
      >
        <p class="font-medium mb-1 opacity-70 whitespace-nowrap">{{ fmtBucketTime(buckets[hoverIdx].start) }}</p>
        <div v-for="lvl in LEVEL_KEYS" :key="lvl" v-show="buckets[hoverIdx][lvl] > 0" class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: LEVEL_COLOR[lvl] }" />
          <span class="opacity-70">{{ lvl.toLowerCase() }}</span>
          <span class="font-semibold ml-auto">{{ buckets[hoverIdx][lvl] }}</span>
        </div>
      </div>
    </div>

    <div v-if="expanded" class="flex items-center gap-3 px-3 pb-2 text-[10.5px]" :class="isDark ? 'text-white/50' : 'text-gray-500'">
      <span v-for="lvl in activeLegend" :key="lvl" class="flex items-center gap-1.5">
        <span class="w-2.5 h-0.5 rounded-full" :style="{ background: LEVEL_COLOR[lvl] }" />
        {{ lvl.toLowerCase() }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, h } from 'vue'

const props = defineProps({
  logs: { type: Array, default: () => [] }, // [{ timestampMs, level, source, message }]
  range: { type: String, default: '1h' }, // '15m' | '1h' | '6h' | '24h'
  isDark: { type: Boolean, default: false },
})

// Inline chevron icon (matches the icon-factory pattern already used in LogPage.vue)
const ChevronDownIcon = (p) =>
  h(
    'svg',
    { xmlns: 'http://www.w3.org/2000/svg', width: p.size || 14, height: p.size || 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    [h('path', { d: 'm6 9 6 6 6-6' })],
  )

const expanded = ref(true)
const hoverIdx = ref(null)

const LEVEL_KEYS = ['ERROR', 'WARN', 'INFO', 'DEBUG']
const LEVEL_COLOR = { ERROR: '#f87171', WARN: '#fbbf24', INFO: '#4ade80', DEBUG: '#a1a1aa' }

const RANGE_MS = { '15m': 15 * 60_000, '1h': 3_600_000, '6h': 21_600_000, '24h': 86_400_000 }
const BUCKET_COUNT = 48

// Fixed SVG coordinate space; scales responsively via viewBox + w-full.
const W = 600
const H = 130
const PLOT_H = 96

const buckets = computed(() => {
  const span = RANGE_MS[props.range] || RANGE_MS['1h']
  const now = Date.now()
  const start = now - span
  const bucketSize = span / BUCKET_COUNT
  const arr = Array.from({ length: BUCKET_COUNT }, (_, i) => ({
    start: start + i * bucketSize,
    ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0,
  }))
  for (const l of props.logs) {
    if (l.timestampMs < start || l.timestampMs > now) continue
    let idx = Math.floor((l.timestampMs - start) / bucketSize)
    if (idx < 0) idx = 0
    if (idx >= BUCKET_COUNT) idx = BUCKET_COUNT - 1
    if (arr[idx][l.level] !== undefined) arr[idx][l.level]++
  }
  return arr
})

const maxVal = computed(() => {
  let m = 0
  for (const b of buckets.value) {
    const total = LEVEL_KEYS.reduce((s, k) => s + b[k], 0)
    if (total > m) m = total
  }
  return m || 1
})

const barW = W / BUCKET_COUNT - 1.5
function barX(i) {
  return i * (W / BUCKET_COUNT)
}
function stackedSegs(b) {
  let y = PLOT_H
  const segs = []
  for (const lvl of LEVEL_KEYS) {
    const segH = (b[lvl] / maxVal.value) * PLOT_H
    y -= segH
    segs.push({ level: lvl, y, h: segH })
  }
  return segs
}
function bucketHasData(b) {
  return LEVEL_KEYS.some((lvl) => b[lvl] > 0)
}

const gridYs = computed(() => [0, PLOT_H / 2, PLOT_H])

const xTicks = computed(() => {
  const n = 6
  const arr = []
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i / (n - 1)) * (BUCKET_COUNT - 1))
    arr.push(fmtTick(buckets.value[idx]?.start))
  }
  return arr
})

function fmtTick(ms) {
  if (!ms) return ''
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fmtBucketTime(ms) {
  return new Date(ms).toLocaleString('id-ID', { hour12: false })
}

const activeLegend = computed(() => {
  const present = LEVEL_KEYS.filter((lvl) => buckets.value.some((b) => b[lvl] > 0))
  return present.length ? present : LEVEL_KEYS
})

const tooltipStyle = computed(() => {
  if (hoverIdx.value === null) return {}
  const xPct = (barX(hoverIdx.value) / W) * 100
  return { left: `min(${xPct}%, 78%)`, top: '4px' }
})
</script>