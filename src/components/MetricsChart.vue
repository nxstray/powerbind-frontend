<template>
  <div>
    <!-- Legend — badge + series name + latest value, same badge language as LogsVolumeChart -->
    <div v-if="series.length" class="flex flex-wrap gap-x-3 gap-y-1 mb-1">
      <div v-for="(s, i) in visibleSeries" :key="s.name" class="flex items-center gap-1.5 text-[10px] min-w-0">
        <span class="h-2 w-2 rounded-full shrink-0" :style="{ background: lineColor(i) }" />
        <span class="opacity-70 truncate max-w-55">{{ s.name }}</span>
        <span class="opacity-45 font-mono">{{ fmtLast(s) }}</span>
      </div>
    </div>

    <div class="relative">
      <svg
        ref="svgEl"
        :viewBox="`0 0 ${W} ${H}`"
        :height="H"
        preserveAspectRatio="none"
        class="w-full block cursor-crosshair"
        @mousemove="onMouseMove"
        @mouseleave="hoverX = null; hoverY = null"
      >
        <!-- Horizontal grid + Y tick labels (angka di sebelah kiri) -->
        <line v-for="(g, i) in gridLines" :key="'g' + i" :x1="PAD_L" :x2="W" :y1="g.y" :y2="g.y" :stroke="gridStroke" stroke-dasharray="2,3" />
        <text
          v-for="(g, i) in gridLines"
          :key="'t' + i"
          :x="PAD_L - 4"
          :y="g.y + 3"
          text-anchor="end"
          class="font-mono"
          :font-size="7.5"
          :fill="tickFill"
        >
          {{ g.label }}
        </text>

        <!-- Series lines -->
        <polyline
          v-for="(s, i) in visibleSeries"
          :key="'l' + i"
          :points="polyPoints(s)"
          fill="none"
          :stroke="lineColor(i)"
          stroke-width="1.4"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <!-- Crosshair follows the cursor continuously (X + Y), like LogsVolumeChart -->
        <line v-if="hoverX !== null" :x1="hoverX" :x2="hoverX" :y1="0" :y2="PLOT_H" :stroke="crossStroke" stroke-width="1" stroke-dasharray="3,3" />
        <line v-if="hoverY !== null" :x1="PAD_L" :x2="W" :y1="hoverY" :y2="hoverY" :stroke="crossStroke" stroke-width="1" stroke-dasharray="3,3" />
      </svg>

      <!-- Tooltip: precise timestamp + per-series values at the hovered instant -->
      <div
        v-if="hoverX !== null"
        class="absolute z-10 pointer-events-none rounded-md border px-2.5 py-1.5 text-[11px] shadow-lg"
        :class="isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-white border-gray-200 text-gray-700'"
        :style="tooltipStyle"
      >
        <p class="font-medium mb-1 opacity-70 whitespace-nowrap">{{ hoverTimeLabel }}</p>
        <div v-for="(s, i) in visibleSeries" :key="s.name" class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: lineColor(i) }" />
          <span class="opacity-70 truncate max-w-">{{ s.name }}</span>
          <span class="ml-auto font-mono">{{ fmtAt(s, hoverTimeLabel) }}</span>
        </div>
      </div>

      <!-- X tick labels -->
      <div class="flex justify-between text-[9.5px] mt-1" :style="{ paddingLeft: PAD_L + 'px' }" :class="isDark ? 'text-white/25' : 'text-gray-500'">

        <span v-for="(t, i) in xTicks" :key="i">{{ t }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// Layout mirip LogsVolumeChart, plus left gutter untuk Y tick labels
const W = 720
const H = 170
const PLOT_H = 140
const PAD_L = 40 // ruang untuk angka Y di sebelah kiri

const props = defineProps({
  series: { type: Array, default: () => [] }, // [{ name, points: [{ t, v }] }]
  isDark: { type: Boolean, default: false },
  // 'bytes' | 'ratio' | 'number' — memilih format angka Y/tooltip
  format: { type: String, default: 'number' },
})

// 5 warna utama sesuai permintaan + lanjutannya kalau series lebih banyak
const COLORS = ['#22c55e', '#eab308', '#0ea5e9', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f43f5e', '#a855f7', '#14b8a6']
function lineColor(i) {
  return COLORS[i % COLORS.length]
}

const svgEl = ref(null)
const hoverX = ref(null)
const hoverY = ref(null)

const visibleSeries = computed(() => props.series.filter((s) => s.points?.length))
const gridStroke = computed(() => (props.isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.38)'))
const crossStroke = computed(() => (props.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'))
const tickFill = computed(() => (props.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.42)'))

// Rentang waktu global dari semua series (untuk skala X & interpolasi tooltip)
const timeRange = computed(() => {
  let t0 = Infinity
  let t1 = -Infinity
  for (const s of visibleSeries.value) {
    t0 = Math.min(t0, s.points[0].t)
    t1 = Math.max(t1, s.points[s.points.length - 1].t)
  }
  if (!isFinite(t0)) return { t0: 0, t1: 1 }
  return { t0, t1: t1 > t0 ? t1 : t0 + 1 }
})

// Max global untuk skala Y (baseline 0 — natural untuk memori/CPU/counter)
const maxVal = computed(() => {
  let max = 0
  for (const s of visibleSeries.value) {
    for (const p of s.points) max = Math.max(max, p.v)
  }
  return max > 0 ? max : 1
})

// 5 gridline: 0%, 25%, 50%, 75%, 100% — label Y diformat ringkas
const gridLines = computed(() => {
  const out = []
  for (let i = 0; i <= 4; i++) {
    const ratio = i / 4
    const y = i === 0 ? PLOT_H : PLOT_H - ratio * PLOT_H
    out.push({ y, label: fmtY(maxVal.value * ratio) })
  }
  return out
})

function fmtY(v) {
  if (props.format === 'bytes') return fmtBytes(v)
  if (props.format === 'ratio') return v.toFixed(2)
  return fmtCompact(v)
}

function fmtBytes(v) {
  if (v <= 0) return '0'
  const units = ['B', 'Ki', 'Mi', 'Gi', 'Ti']
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return (i === 0 ? Math.round(v) : v.toFixed(i >= 2 ? 0 : 1)) + units[i]
}

function fmtCompact(v) {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'k'
  if (Math.abs(v) >= 1) return v.toFixed(1)
  return v.toFixed(3)
}

function fmtValue(v) {
  if (props.format === 'bytes') return fmtBytes(v)
  if (props.format === 'ratio') return (v * 100).toFixed(1) + '%'
  return fmtCompact(v)
}

function polyPoints(s) {
  const { t0, t1 } = timeRange.value
  const span = t1 - t0
  const max = maxVal.value
  const plotW = W - PAD_L
  return s.points
    .map((p) => {
      const x = PAD_L + ((p.t - t0) / span) * plotW
      const y = PLOT_H - Math.min(Math.max(p.v / max, 0), 1) * (PLOT_H - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function onMouseMove(e) {
  const el = svgEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const xRatio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
  hoverX.value = xRatio * W
  const yRatio = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1)
  hoverY.value = Math.min(yRatio * H, PLOT_H)
}

// X tick: 6 label jam:menit merata di sepanjang plot
const xTicks = computed(() => {
  const { t0, t1 } = timeRange.value
  const out = []
  for (let i = 0; i < 6; i++) {
    const t = t0 + ((t1 - t0) * i) / 5
    out.push(fmtTick(t))
  }
  return out
})

function fmtTick(ms) {
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Timestamp presisi ala Grafana di tooltip
function fmtPrecise(ms) {
  const d = new Date(ms)
  const pad = (n, len = 2) => String(n).padStart(len, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const hoverTimeMs = computed(() => {
  if (hoverX.value === null) return null
  const { t0, t1 } = timeRange.value
  const plotW = W - PAD_L
  const ratio = Math.min(Math.max((hoverX.value - PAD_L) / plotW, 0), 1)
  return t0 + ratio * (t1 - t0)
})
const hoverTimeLabel = computed(() => (hoverTimeMs.value === null ? '' : fmtPrecise(hoverTimeMs.value)))

// Nilai tiap series pada waktu hover — snap ke titik terdekat
function fmtAt(s) {
  if (hoverTimeMs.value === null) return ''
  let best = s.points[0]
  let bestDiff = Infinity
  for (const p of s.points) {
    const diff = Math.abs(p.t - hoverTimeMs.value)
    if (diff < bestDiff) {
      bestDiff = diff
      best = p
    }
  }
  return fmtValue(best.v)
}

// Tooltip mengikuti crosshair dengan gap, flip ke kiri saat lewat tengah
const tooltipStyle = computed(() => {
  if (hoverX.value === null) return {}
  const xPct = (hoverX.value / W) * 100
  const flip = xPct > 50
  return {
    top: '4px',
    left: `${xPct}%`,
    transform: flip ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)',
  }
})

function fmtLast(s) {
  const last = s.points[s.points.length - 1]
  return fmtValue(last.v)
}
</script>