<template>
  <!-- Grafana Graph panel — gelap permanen: title kiri + draw-mode selector kanan -->
  <div class="rounded-lg border border-[#2c3235] bg-[#181b1f] overflow-hidden">
    <div class="flex items-center gap-2 px-3 py-1.5 border-b border-[#2c3235]">
      <p class="text-[12px] font-semibold text-zinc-200 truncate">{{ title || 'Graph' }}</p>
      <p v-if="subtitle" class="text-[10px] font-mono text-zinc-500 truncate hidden sm:block">{{ subtitle }}</p>

      <div class="ml-auto flex items-center gap-1 shrink-0">
        <button
          v-for="m in DRAW_MODES"
          :key="m"
          @click="drawMode = m"
          class="text-[10.5px] px-2 py-0.5 rounded transition"
          :class="drawMode === m ? 'bg-[#3d71d9] text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'"
        >
          {{ m }}
        </button>
      </div>
    </div>

    <div class="relative px-2 pt-2">
      <svg
        ref="svgEl"
        :viewBox="`0 0 ${W} ${H}`"
        :height="H"
        preserveAspectRatio="none"
        class="w-full block cursor-crosshair"
        @mousemove="onMouseMove"
        @mouseleave="hoverX = null; hoverY = null"
      >
        <!-- Grid solid — horizontal + vertical, ala Grafana -->
        <line v-for="(g, i) in gridLines" :key="'g' + i" :x1="PAD_L" :x2="W" :y1="g.y" :y2="g.y" :stroke="gridStroke" />
        <line v-for="(v, i) in vGridX" :key="'v' + i" :x1="v" :x2="v" :y1="0" :y2="PLOT_H" :stroke="gridStroke" />
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

        <!-- Series drawing — bentuk mengikuti draw-mode -->
        <g v-for="(s, i) in drawSeries" :key="'l' + i">
          <template v-if="isLineMode">
            <polyline
              :points="polyPoints(s)"
              fill="none"
              :stroke="lineColor(i)"
              :stroke-width="drawMode === 'Stacked lines' ? 1.6 : 1.4"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          </template>
          <template v-else-if="drawMode === 'Bars' || drawMode === 'Stacked bars'">
            <rect v-for="(r, j) in barRects(s)" :key="'r' + j" :x="r.x" :y="r.y" :width="r.w" :height="r.h" :fill="lineColor(i)" />
          </template>
          <template v-else-if="drawMode === 'Points'">
            <circle v-for="(p, j) in s.points" :key="'c' + j" :cx="xAt(p.t)" :cy="yAt(p.v)" r="1.8" :fill="lineColor(i)" />
          </template>
        </g>

        <!-- Crosshair follows the cursor continuously (X + Y) -->
        <line v-if="hoverX !== null" :x1="hoverX" :x2="hoverX" :y1="0" :y2="PLOT_H" :stroke="crossStroke" stroke-width="1" stroke-dasharray="3,3" />
        <line v-if="hoverY !== null" :x1="PAD_L" :x2="W" :y1="hoverY" :y2="hoverY" :stroke="crossStroke" stroke-width="1" stroke-dasharray="3,3" />
      </svg>

      <!-- Tooltip: precise timestamp + per-series values at the hovered instant -->
      <div
        v-if="hoverX !== null"
        class="absolute z-10 pointer-events-none rounded-md border px-2.5 py-1.5 text-[11px] shadow-lg bg-zinc-800 border-zinc-700 text-zinc-200"
        :style="tooltipStyle"
      >
        <p class="font-medium mb-1 opacity-70 whitespace-nowrap">{{ hoverTimeLabel }}</p>
        <div v-for="(s, i) in drawSeries" :key="s.name" class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: lineColor(i) }" />
          <span class="opacity-70 truncate max-w-55">{{ s.name }}</span>
          <span class="ml-auto font-mono">{{ fmtAt(s) }}</span>
        </div>
      </div>

      <!-- X tick labels -->
      <div
        class="flex justify-between text-[9.5px] mt-1 pb-1"
        :style="{ paddingLeft: PAD_L + 'px', color: 'rgba(255,255,255,0.3)' }"
      >
        <span v-for="(t, i) in xTicks" :key="i">{{ t }}</span>
      </div>
    </div>

    <!-- Legend — satu baris per series: dash warna + label lengkap (Grafana) -->
    <div v-if="drawSeries.length" class="custom-scroll max-h-30 overflow-y-auto px-3 py-2 space-y-1 border-t border-[#2c3235]">
      <div v-for="(s, i) in drawSeries" :key="s.name" class="flex items-center gap-2 text-[10px] min-w-0">
        <span class="w-4 h-0.5 rounded-full shrink-0" :style="{ background: lineColor(i) }" />
        <span class="text-zinc-300 truncate">{{ s.name }}</span>
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
  isDark: { type: Boolean, default: false }, // kompatibilitas API — panel sekarang permanen gelap (Grafana)
  // 'bytes' | 'ratio' | 'number' — memilih format angka tooltip/legend
  format: { type: String, default: 'number' },
  // header panel: title kiri, subtitle (query) di sebelah kanannya
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
})

// Palet Grafana — urutan warna sama dengan legend di gambar
const COLORS = ['#73BF69', '#F2CC0C', '#5794F2', '#FF9830', '#F2495C', '#B877D9', '#37872D', '#FADE2A', '#C15C17', '#E02F44', '#96D98D', '#FF7383']
function lineColor(i) {
  return COLORS[i % COLORS.length]
}

// ---- Grafana draw modes: Lines / Bars / Points / Stacked lines / Stacked bars ----
const DRAW_MODES = ['Lines', 'Bars', 'Points', 'Stacked lines', 'Stacked bars']
const drawMode = ref('Lines')
const isLineMode = computed(() => drawMode.value === 'Lines' || drawMode.value === 'Stacked lines')
const isStacked = computed(() => drawMode.value === 'Stacked lines' || drawMode.value === 'Stacked bars')

const svgEl = ref(null)
const hoverX = ref(null)
const hoverY = ref(null)

const visibleSeries = computed(() => props.series.filter((s) => s.points?.length))

// Panel permanen gelap (Grafana) — warna statis, tidak lagi mengikuti isDark
const gridStroke = 'rgba(255,255,255,0.22)'
const crossStroke = 'rgba(255,255,255,0.5)'
const tickFill = 'rgba(255,255,255,0.45)'

// Series yang digambar — versi kumulatif saat mode Stacked (base = jumlah series di bawahnya)
const drawSeries = computed(() => {
  if (!isStacked.value) return visibleSeries.value
  const list = visibleSeries.value
  const out = list.map((s) => ({ ...s, points: [] }))
  const n = Math.min(...list.map((s) => s.points.length))
  for (let pi = 0; pi < n; pi++) {
    let acc = 0
    for (let si = 0; si < list.length; si++) {
      acc += list[si].points[pi].v
      out[si].points.push({ t: list[si].points[pi].t, v: acc })
    }
  }
  return out
})

// 6 gridline vertikal merata
const vGridX = computed(() => {
  const plotW = W - PAD_L
  const out = []
  for (let i = 0; i <= 5; i++) out.push(PAD_L + (plotW * i) / 5)
  return out
})

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

// 5 gridline: 0%, 25%, 50%, 75%, 100% — label Y format ala Grafana ("150 Mil")
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
  return fmtGrafana(v)
}

// Format Y ala Grafana: "150 Mil" — unit bahasa Inggris, angka singkat
function fmtGrafana(v) {
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 1e9) return trimNum(v / 1e9) + ' Bil'
  if (a >= 1e6) return trimNum(v / 1e6) + ' Mil'
  if (a >= 1e3) return trimNum(v / 1e3) + ' K'
  if (a >= 1) return trimNum(v)
  return v.toPrecision(3)
}
function trimNum(n) {
  const a = Math.abs(n)
  const s = a >= 100 ? n.toFixed(0) : a >= 10 ? n.toFixed(1) : n.toFixed(2)
  return s.replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1')
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

function xAt(t) {
  const { t0, t1 } = timeRange.value
  const span = t1 - t0
  const plotW = W - PAD_L
  return PAD_L + ((t - t0) / span) * plotW
}
function yAt(v) {
  const max = maxVal.value
  return PLOT_H - Math.min(Math.max(v / max, 0), 1) * (PLOT_H - 4) - 2
}
function polyPoints(s) {
  return s.points.map((p) => `${xAt(p.t).toFixed(1)},${yAt(p.v).toFixed(1)}`).join(' ')
}
// Bars: rect per titik — lebar mengikuti kepadatan data
function barRects(s) {
  const pts = s.points
  if (!pts.length) return []
  const w = Math.max((pts[1] ? xAt(pts[1].t) - xAt(pts[0].t) : 3) - 1, 1.5)
  return pts.map((p) => {
    const x = xAt(p.t)
    const y = yAt(p.v)
    return { x: x - w / 2, y, w, h: Math.max(PLOT_H - y, 0.5) }
  })
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

</script>