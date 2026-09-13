<template>
  <!-- Grafana Graph panel — gelap permanen: title kiri + draw-mode selector kanan -->
  <div class="rounded-lg border border-[#2c3235] bg-[#181b1f] overflow-hidden">
    <div class="flex items-center gap-2 px-3 py-1.5 border-b border-[#2c3235]">
      <p class="text-[12px] font-semibold text-zinc-200 truncate">{{ title || 'Graph' }}</p>
      <p v-if="subtitle" class="text-[10px] font-mono text-zinc-500 truncate hidden sm:block">{{ subtitle }}</p>
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
        <!-- Grid solid — horizontal + vertikal (digaris bawahi biar jelas) -->
        <line v-for="(g, i) in gridLines" :key="'g' + i" :x1="PAD_L" :x2="W" :y1="g.y" :y2="g.y" :stroke="gridStroke" />
        <line v-for="(v, i) in vGridX" :key="'v' + i" :x1="v" :x2="v" :y1="0" :y2="PLOT_H" :stroke="vGridStroke" />

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

        <!-- Crosshair follows the cursor continuously (X + Y) -->
        <line v-if="hoverX !== null" :x1="hoverX" :x2="hoverX" :y1="0" :y2="PLOT_H" :stroke="crossStroke" stroke-width="1" stroke-dasharray="3,3" />
        <line v-if="hoverY !== null" :x1="PAD_L" :x2="W" :y1="hoverY" :y2="hoverY" :stroke="crossStroke" stroke-width="1" stroke-dasharray="3,3" />
      </svg>

      <!-- Y tick labels — HTML overlay (bukan <text> SVG) supaya font tidak ikut
           ter-stretch horizontal oleh preserveAspectRatio="none", dan label teratas
           tidak terpotong (translateY(-50%) boleh keluar sedikit dari box). -->
      <div class="absolute inset-0 pointer-events-none">
        <span
          v-for="(g, i) in gridLines"
          :key="'t' + i"
          class="absolute left-0 w-[5.4%] pr-0.5 text-right text-[10px] font-mono text-zinc-500"
          :style="{ top: g.y + 'px', transform: 'translateY(-50%)' }"
        >
          {{ g.label }}
        </span>
      </div>

      <!-- Tooltip: precise timestamp + per-series values at the hovered instant -->
      <div
        v-if="hoverX !== null"
        class="absolute z-10 pointer-events-none rounded-md border px-2.5 py-1.5 text-[11px] shadow-lg bg-zinc-800 border-zinc-700 text-zinc-200"
        :style="tooltipStyle"
      >
        <p class="font-medium mb-1 opacity-70 whitespace-nowrap">{{ hoverTimeLabel }}</p>
        <div v-for="(s, i) in visibleSeries" :key="s.name" class="flex items-center gap-1.5">
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
    <div v-if="visibleSeries.length" class="custom-scroll max-h-30 overflow-y-auto px-3 py-2 space-y-1 border-t border-[#2c3235]">
      <div v-for="(s, i) in visibleSeries" :key="s.name" class="flex items-center gap-2 text-[10px] min-w-0">
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

// ---- Grafana draw mode — Lines saja (per design) ----

const svgEl = ref(null)
const hoverX = ref(null)
const hoverY = ref(null)

const visibleSeries = computed(() => props.series.filter((s) => s.points?.length))

// Grid vertikal — stroke sedikit lebih tegas agar jelas terlihat
const gridStroke = 'rgba(255,255,255,0.22)'
const vGridStroke = 'rgba(255,255,255,0.3)'
const crossStroke = 'rgba(255,255,255,0.5)'

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