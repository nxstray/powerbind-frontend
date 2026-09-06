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

    <div v-if="expanded" class="relative px-2 pt-2 pb-1">
      <svg
        ref="svgEl"
        :viewBox="`0 0 ${W} ${H}`"
        class="w-full block cursor-crosshair"
        :height="H"
        preserveAspectRatio="none"
        @mousemove="onMouseMove"
        @mouseleave="hoverX = null; hoverY = null"
      >
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

        <g v-for="(b, i) in buckets" :key="i">
          <template v-for="(seg, si) in stackedSegs(b)" :key="si">
            <rect v-if="seg.h > 0" :x="barX(i)" :y="seg.y" :width="barW" :height="Math.max(seg.h, 1.5)" :fill="LEVEL_COLOR[seg.level]" rx="1" />
          </template>
        </g>

        <!-- Crosshair: vertical + horizontal lines follow the cursor continuously across the plot area -->
        <line
          v-if="hoverX !== null"
          :x1="hoverX"
          :x2="hoverX"
          y1="0"
          :y2="PLOT_H"
          :stroke="isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'"
          stroke-width="1"
          stroke-dasharray="3,3"
        />
        <line
          v-if="hoverY !== null"
          x1="0"
          :x2="W"
          :y1="hoverY"
          :y2="hoverY"
          :stroke="isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'"
          stroke-width="1"
          stroke-dasharray="3,3"
        />
      </svg>

      <div class="flex justify-between text-[9.5px] mt-1 px-0.5" :class="isDark ? 'text-white/25' : 'text-gray-300'">
        <span v-for="(t, i) in xTicks" :key="i">{{ t }}</span>
      </div>

      <div
        v-if="hoverX !== null"
        class="absolute z-10 pointer-events-none rounded-lg border px-2.5 py-1.5 text-[10.5px] shadow-lg min-w-"
        :class="isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-white border-gray-200 text-gray-700'"
        :style="tooltipStyle"
      >
        <p class="font-medium mb-1 opacity-70 whitespace-nowrap">{{ hoverTimeLabel }}</p>
        <template v-if="hoverBucket && bucketHasData(hoverBucket)">
          <div v-for="lvl in LEVEL_KEYS" :key="lvl" v-show="hoverBucket[lvl] > 0" class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: LEVEL_COLOR[lvl] }" />
            <span class="opacity-70">{{ lvl.toLowerCase() }}</span>
            <span class="font-semibold ml-auto">{{ hoverBucket[lvl] }}</span>
          </div>
        </template>
        <p v-else class="opacity-50">Tidak ada log</p>
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
const svgEl = ref(null)
const hoverX = ref(null) // cursor position in SVG coordinate space (0..W), null when not hovering
const hoverY = ref(null) // cursor position in SVG coordinate space (0..PLOT_H), null when not hovering

const LEVEL_KEYS = ['ERROR', 'WARN', 'INFO', 'DEBUG']
const LEVEL_COLOR = { ERROR: '#f87171', WARN: '#fbbf24', INFO: '#4ade80', DEBUG: '#a1a1aa' }

const RANGE_MS = { '15m': 15 * 60_000, '1h': 3_600_000, '6h': 21_600_000, '24h': 86_400_000 }
const BUCKET_COUNT = 48

// Fixed SVG coordinate space; scales responsively via viewBox + w-full.
const W = 600
const H = 130
const PLOT_H = 96

// Shared time range info, used by both bucketing and the crosshair position → time conversion.
const timeMeta = computed(() => {
  const span = RANGE_MS[props.range] || RANGE_MS['1h']
  const now = Date.now()
  return { span, now, start: now - span, bucketSize: span / BUCKET_COUNT }
})

const buckets = computed(() => {
  const { start, bucketSize, now } = timeMeta.value
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

// Grafana-style precise timestamp: "YYYY-MM-DD HH:mm:ss.SSS"
function fmtPrecise(ms) {
  const d = new Date(ms)
  const pad = (n, len = 2) => String(n).padStart(len, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

const activeLegend = computed(() => {
  const present = LEVEL_KEYS.filter((lvl) => buckets.value.some((b) => b[lvl] > 0))
  return present.length ? present : LEVEL_KEYS
})

// Converts a raw mouse event into an SVG-space X coordinate (0..W), accounting for
// the viewBox scaling that happens because the SVG is rendered responsively (w-full).
function onMouseMove(e) {
  const el = svgEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const xRatio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
  hoverX.value = xRatio * W

  // rect.height maps to the full H viewBox (including the x-axis strip below the
  // plot), so scale by H then clamp to PLOT_H so the horizontal line never drifts
  // past the bars into the axis label area.
  const yRatio = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1)
  hoverY.value = Math.min(yRatio * H, PLOT_H)
}

// The exact time under the cursor — continuous, not snapped to a bucket boundary.
const hoverTimeMs = computed(() => {
  if (hoverX.value === null) return null
  const { start, span } = timeMeta.value
  return start + (hoverX.value / W) * span
})
const hoverTimeLabel = computed(() => (hoverTimeMs.value === null ? '' : fmtPrecise(hoverTimeMs.value)))

// Which bucket's counts to show in the tooltip — the one the cursor currently sits over.
const hoverBucket = computed(() => {
  if (hoverX.value === null) return null
  const idx = Math.min(Math.max(Math.floor(hoverX.value / (W / BUCKET_COUNT)), 0), BUCKET_COUNT - 1)
  return buckets.value[idx]
})

const tooltipStyle = computed(() => {
  if (hoverX.value === null) return {}
  const xPct = (hoverX.value / W) * 100
  return { left: `min(${xPct}%, 68%)`, top: '4px' }
})
</script>