<template>
  <!-- Grafana Graph panel — warna mengikuti tema halaman (gelap ala Grafana saat malam) -->
  <div class="rounded-lg border overflow-hidden" :class="isDark ? 'border-[#2c3235] bg-[#181b1f]' : 'border-gray-200 bg-white'">
    <div class="flex items-center gap-2 px-3 py-1.5 border-b" :class="isDark ? 'border-[#2c3235]' : 'border-gray-100'">
      <p class="text-[12px] font-semibold truncate" :class="isDark ? 'text-zinc-200' : 'text-gray-800'">{{ title || 'Graph' }}</p>
      <p v-if="subtitle" class="text-[10px] font-mono truncate hidden sm:block" :class="isDark ? 'text-zinc-500' : 'text-gray-400'">{{ subtitle }}</p>
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

        <!-- Series lines — hanya series yang digambar (bisa difokus dari legend) -->
        <polyline
          v-for="x in drawnSeries"
          :key="'l' + x.i"
          :points="polyPoints(x.s)"
          fill="none"
          :stroke="lineColor(x.i)"
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
          class="absolute left-0 w-[5.4%] pr-0.5 text-right text-[10px] font-mono"
          :class="isDark ? 'text-zinc-500' : 'text-gray-500'"
          :style="{ top: g.y + 'px', transform: 'translateY(-50%)' }"
        >
          {{ g.label }}
        </span>
      </div>

      <!-- Tooltip: precise timestamp + per-series values at the hovered instant -->
      <div
        v-if="hoverX !== null"
        class="absolute z-10 pointer-events-none rounded-md border px-2.5 py-1.5 text-[11px] shadow-lg"
        :class="isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-white border-gray-200 text-gray-700'"
        :style="tooltipStyle"
      >
        <p class="font-medium mb-1 opacity-70 whitespace-nowrap">{{ hoverTimeLabel }}</p>
        <div v-for="x in drawnSeries" :key="x.s.name" class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: lineColor(x.i) }" />
          <span class="opacity-70 truncate max-w-55">{{ x.s.name }}</span>
          <span class="ml-auto font-mono">{{ fmtAt(x.s) }}</span>
        </div>
      </div>

        <!-- X tick labels — sejajar garis vertikal (setiap 15 menit). Kalau garis
             terlalu rapat (range 6/24 jam), label hanya tiap garis ke-n. -->
        <div class="relative h-4 mt-0.5" :style="{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)' }">
          <span
            v-for="(t, i) in timeTicks"
            v-show="i % xLabelStep === 0"
            :key="'x' + i"
            class="absolute top-0 text-[9.5px] font-mono whitespace-nowrap"
            :style="xLabelStyle(t)"
          >{{ fmtTick(t) }}</span>
        </div>
    </div>

    <!-- Legend — satu baris per series: dash warna + label lengkap (Grafana).
         Klik strip = fokus series itu saja; klik lagi = tampilkan semua. -->
    <div v-if="visibleSeries.length" class="custom-scroll max-h-30 overflow-y-auto px-3 py-2 space-y-1 border-t" :class="isDark ? 'border-[#2c3235]' : 'border-gray-100'">
      <div
        v-for="(s, i) in visibleSeries"
        :key="s.name"
        class="flex items-center gap-2 text-[10px] min-w-0 cursor-pointer select-none transition-opacity"
        :class="focusedSeries !== null && focusedSeries !== i ? 'opacity-30' : 'opacity-100'"
        @click="focusedSeries = focusedSeries === i ? null : i"
      >
        <span class="w-4 h-0.5 rounded-full shrink-0" :style="{ background: lineColor(i) }" />
        <span class="truncate" :class="isDark ? 'text-zinc-300' : 'text-gray-600'">{{ s.name }}</span>
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
  isDark: { type: Boolean, default: false }, // panel mengikuti tema halaman (gelap ala Grafana saat malam)
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

// Klik legend strip → fokus satu series (index asli dipertahankan supaya warnanya
// tidak berubah); klik lagi → tampilkan semua.
const focusedSeries = ref(null)
const drawnSeries = computed(() =>
  visibleSeries.value
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => focusedSeries.value === null || i === focusedSeries.value),
)

// Warna grid mengikuti tema — putih-transparan di panel gelap, hitam-transparan di panel terang
const gridStroke = computed(() => (props.isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)'))
const vGridStroke = computed(() => (props.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.16)'))
const crossStroke = computed(() => (props.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)'))

// Gridline vertikal — setiap 15 menit, sejajar jam (09:45, 10:00, ...) seperti
// Grafana. Label X dirender per garis ini (lihat template X tick labels).
const V_STEP_MS = 15 * 60 * 1000
const timeTicks = computed(() => {
  const { t0, t1 } = timeRange.value
  const out = []
  for (let t = Math.ceil(t0 / V_STEP_MS) * V_STEP_MS; t <= t1; t += V_STEP_MS) out.push(t)
  return out
})
const vGridX = computed(() => timeTicks.value.map((t) => xAt(t)))

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

// Max global mentah dari data (baseline 0 — natural untuk memori/CPU/counter)
const maxVal = computed(() => {
  let max = 0
  for (const s of visibleSeries.value) {
    for (const p of s.points) max = Math.max(max, p.v)
  }
  return max > 0 ? max : 1
})

// ---- Nice round-number ticks ala Grafana/D3 -----------------------------------
// Supaya gridline jatuh di angka bulat (0, 25 Mil, 50 Mil, 75 Mil, 100 Mil...)
// alih-alih persentase mentah dari nilai max aktual.
// Termasuk pecahan "2.5" (selain 1/2/5/10) supaya bisa jatuh di kelipatan
// 25 (2.5 × 10^n) seperti 25 Mil/50 Mil/... ala Grafana, bukan cuma 20/50.
function niceNum(range, round) {
  const exponent = Math.floor(Math.log10(range))
  const fraction = range / Math.pow(10, exponent)
  let niceFraction
  if (round) {
    if (fraction < 1.5) niceFraction = 1
    else if (fraction < 2.25) niceFraction = 2
    else if (fraction < 3.75) niceFraction = 2.5
    else if (fraction < 7) niceFraction = 5
    else niceFraction = 10
  } else {
    if (fraction <= 1) niceFraction = 1
    else if (fraction <= 2) niceFraction = 2
    else if (fraction <= 2.5) niceFraction = 2.5
    else if (fraction <= 5) niceFraction = 5
    else niceFraction = 10
  }
  return niceFraction * Math.pow(10, exponent)
}

function niceTicks(max, tickDivisions = 8) {
  if (max <= 0) return { niceMax: 1, step: 1 }
  const range = niceNum(max, false)
  const step = niceNum(range / tickDivisions, true)
  const niceMax = Math.ceil(max / step) * step
  return { niceMax, step }
}

const ticks = computed(() => niceTicks(maxVal.value, 8))

// Skala Y dipakai bareng oleh gridline & plot titik (yAt), biar garis & data selaras
const yScaleMax = computed(() => ticks.value.niceMax || maxVal.value)

// Ruang cadangan di atas plot supaya label gridline paling atas (mis. "150 Mil")
// tidak kepotong oleh border panel saat translateY(-50%) menariknya ke atas.
const TOP_PAD = 10

// Gridline: dari 0 sampai niceMax, per step bulat — label ala Grafana ("150 Mil")
const gridLines = computed(() => {
  const { niceMax, step } = ticks.value
  const n = Math.max(1, Math.round(niceMax / step))
  const usableH = PLOT_H - TOP_PAD
  const out = []
  for (let i = 0; i <= n; i++) {
    const val = i * step
    const y = TOP_PAD + usableH - (val / niceMax) * usableH
    out.push({ y, label: fmtY(val) })
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
  const max = yScaleMax.value
  const usableH = PLOT_H - TOP_PAD
  return TOP_PAD + usableH - Math.min(Math.max(v / max, 0), 1) * usableH
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

// Label X tiap garis vertikal; kalau tick terlalu rapat (range 6/24 jam),
// tampilkan hanya tiap garis ke-n (maks ±13 label) biar tidak tabrakan.
const xLabelStep = computed(() => Math.max(1, Math.ceil(timeTicks.value.length / 13)))
function xLabelStyle(t) {
  const pct = (xAt(t) / W) * 100
  // Clamp di tepi kiri/kanan supaya label tidak terpotong border panel
  const transform = pct < 4 ? 'translateX(0)' : pct > 96 ? 'translateX(-100%)' : 'translateX(-50%)'
  return { left: pct + '%', transform }
}

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
