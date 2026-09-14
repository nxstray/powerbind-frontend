<template>
  <!-- Grafana Graph panel — colors follow the page theme (Grafana-style dark at night) -->
  <div class="rounded-lg border overflow-hidden" :class="isDark ? 'border-[#2c3235] bg-[#181b1f]' : 'border-gray-200 bg-white'">
    <div class="flex items-center gap-2 px-3 py-1.5 border-b" :class="isDark ? 'border-[#2c3235]' : 'border-gray-100'">
      <p class="text-[12px] font-semibold truncate" :class="isDark ? 'text-zinc-200' : 'text-gray-800'">{{ title || 'Graph' }}</p>
      <p v-if="subtitle" class="text-[10px] font-mono truncate hidden sm:block" :class="isDark ? 'text-zinc-500' : 'text-gray-400'">{{ subtitle }}</p>
      <div v-if="$slots.actions" class="ml-auto flex items-center shrink-0">
        <slot name="actions" />
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
        <!-- Solid grid — horizontal + vertical (underlined for clarity) -->
        <line v-for="(g, i) in gridLines" :key="'g' + i" :x1="PAD_L" :x2="W" :y1="g.y" :y2="g.y" :stroke="gridStroke" />
        <line v-for="(v, i) in vGridX" :key="'v' + i" :x1="v" :x2="v" :y1="0" :y2="PLOT_H" :stroke="vGridStroke" />

        <!-- Series lines — only drawn series (focusable from the legend) -->
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

      <!-- Y tick labels — HTML overlay (not SVG <text>) so the font isn't
           stretched horizontally by preserveAspectRatio="none", and the top label
           isn't clipped (translateY(-50%) may extend slightly outside the box). -->
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

        <!-- X tick labels — aligned with the vertical lines (every 15 minutes). If the
             lines get too dense (6/24h range), label only every n-th line. -->
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

    <!-- Legend — one row per series: colored dash + full label (Grafana).
         Click a strip to focus that series; click again to show all. -->
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

// Layout similar to LogsVolumeChart, plus a left gutter for Y tick labels
const W = 720
const H = 170
const PLOT_H = 140
const PAD_L = 40 // room for the Y numbers on the left

const props = defineProps({
  series: { type: Array, default: () => [] }, // [{ name, points: [{ t, v }] }]
  isDark: { type: Boolean, default: false }, // panel follows the page theme (Grafana-style dark at night)
  // 'bytes' | 'ratio' | 'number' — picks the tooltip/legend number format
  format: { type: String, default: 'number' },
  // header panel: title on the left, subtitle (query) to its right
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
})

// Grafana palette — color order matches the legend in the picture
const COLORS = ['#73BF69', '#F2CC0C', '#5794F2', '#FF9830', '#F2495C', '#B877D9', '#37872D', '#FADE2A', '#C15C17', '#E02F44', '#96D98D', '#FF7383']
function lineColor(i) {
  return COLORS[i % COLORS.length]
}

// ---- Grafana draw mode — Lines saja (per design) ----

const svgEl = ref(null)
const hoverX = ref(null)
const hoverY = ref(null)

const visibleSeries = computed(() => props.series.filter((s) => s.points?.length))

// Click a legend strip → focus one series (original index preserved so its
// color doesn't change); click again → show all.
const focusedSeries = ref(null)
const drawnSeries = computed(() =>
  visibleSeries.value
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => focusedSeries.value === null || i === focusedSeries.value),
)

// Grid colors follow the theme — translucent white on dark panels, translucent black on light panels
const gridStroke = computed(() => (props.isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)'))
const vGridStroke = computed(() => (props.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.16)'))
const crossStroke = computed(() => (props.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)'))

// Vertical gridlines — every 15 minutes, aligned to clock times (09:45, 10:00, ...)
// like Grafana. X labels are rendered per line (see the X tick labels template).
const V_STEP_MS = 15 * 60 * 1000
const timeTicks = computed(() => {
  const { t0, t1 } = timeRange.value
  const out = []
  for (let t = Math.ceil(t0 / V_STEP_MS) * V_STEP_MS; t <= t1; t += V_STEP_MS) out.push(t)
  return out
})
const vGridX = computed(() => timeTicks.value.map((t) => xAt(t)))

// Global time range across all series (for the X scale & tooltip interpolation)
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

// Raw global max from the data (baseline 0 — natural for memory/CPU/counter)
const maxVal = computed(() => {
  let max = 0
  for (const s of visibleSeries.value) {
    for (const p of s.points) max = Math.max(max, p.v)
  }
  return max > 0 ? max : 1
})

// ---- Nice round-number ticks Grafana/D3 style -----------------------------------
// So gridlines land on round numbers (0, 25 Mil, 50 Mil, 75 Mil, 100 Mil...)
// instead of raw percentages of the actual max value.
// Includes the "2.5" fraction (besides 1/2/5/10) so ticks can land on multiples
// of 25 (2.5 × 10^n) like 25 Mil/50 Mil/... Grafana-style, not just 20/50.
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

// The Y scale is shared by gridlines & point plotting (yAt) so lines and data align
const yScaleMax = computed(() => ticks.value.niceMax || maxVal.value)

// Reserved space above the plot so the topmost gridline label (e.g. "150 Mil")
// isn't clipped by the panel border when translateY(-50%) pulls it upward.
const TOP_PAD = 10

// Gridlines: from 0 to niceMax, per round step — Grafana-style labels ("150 Mil")
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

// Grafana-style Y format: "150 Mil" — English unit, compact number
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

// X labels for each vertical line; if ticks get too dense (6/24h range),
// show only every n-th line (max ±13 labels) to avoid collisions.
const xLabelStep = computed(() => Math.max(1, Math.ceil(timeTicks.value.length / 13)))
function xLabelStyle(t) {
  const pct = (xAt(t) / W) * 100
  // Clamp at the left/right edges so labels aren't clipped by the panel border
  const transform = pct < 4 ? 'translateX(0)' : pct > 96 ? 'translateX(-100%)' : 'translateX(-50%)'
  return { left: pct + '%', transform }
}

function fmtTick(ms) {
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Grafana-style precise timestamp in the tooltip
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

// Per-series value at hover time — snapped to the nearest point
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

// Tooltip follows the crosshair with a gap, flipping left past the midpoint
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
