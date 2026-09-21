// Pure chart-formatting helpers for MetricsChart.vue — extracted so they can be
// unit-tested without mounting the component. All functions are stateless: the
// component passes its `format` prop ('bytes' | 'ratio' | 'number') explicitly.

// Grafana palette — color order matches the legend in the design
export const SERIES_COLORS = ['#73BF69', '#F2CC0C', '#5794F2', '#FF9830', '#F2495C', '#B877D9', '#37872D', '#FADE2A', '#C15C17', '#E02F44', '#96D98D', '#FF7383']

export function lineColor(i) {
  return SERIES_COLORS[i % SERIES_COLORS.length]
}

// ---- Nice round-number ticks Grafana/D3 style -----------------------------------
// So gridlines land on round numbers (0, 25 Mil, 50 Mil, 75 Mil, 100 Mil...)
// instead of raw percentages of the actual max value.
// Includes the "2.5" fraction (besides 1/2/5/10) so ticks can land on multiples
// of 25 (2.5 × 10^n) like 25 Mil/50 Mil/... Grafana-style, not just 20/50.
export function niceNum(range, round) {
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

export function niceTicks(max, tickDivisions = 8) {
  if (max <= 0) return { niceMax: 1, step: 1 }
  const range = niceNum(max, false)
  const step = niceNum(range / tickDivisions, true)
  const niceMax = Math.ceil(max / step) * step
  return { niceMax, step }
}

// Trim a number's decimal zeros the Grafana way: "108", "2.5", "20" — never
// "108.00", "2.50" or "20.0".
export function trimNum(n) {
  const a = Math.abs(n)
  let s
  if (a >= 100) s = n.toFixed(0)
  else if (a >= 10) s = n.toFixed(1)
  else s = n.toFixed(2)
  return s.replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1')
}

// Grafana-style Y format: "150 Mil" — English unit, compact number
export function fmtGrafana(v) {
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 1e9) return trimNum(v / 1e9) + ' Bil'
  if (a >= 1e6) return trimNum(v / 1e6) + ' Mil'
  if (a >= 1e3) return trimNum(v / 1e3) + ' K'
  if (a >= 1) return trimNum(v)
  return v.toPrecision(3)
}

export function fmtBytes(v) {
  if (v <= 0) return '0'
  // IEC units with the B suffix (KiB/MiB/GiB) — matches the AI context text and
  // the prompt rule that values use the same units the chart shows.
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  let num
  if (i === 0) num = Math.round(v)
  else if (i >= 2) num = v.toFixed(0)
  else num = v.toFixed(1)
  return num + units[i]
}

export function fmtCompact(v) {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'k'
  if (Math.abs(v) >= 1) return v.toFixed(1)
  return v.toFixed(3)
}

// Tooltip/legend value formatting per chart type.
export function formatValue(format, v) {
  if (format === 'bytes') return fmtBytes(v)
  if (format === 'ratio') return (v * 100).toFixed(1) + '%'
  return fmtCompact(v)
}

// Y-axis label formatting per chart type — bytes charts label their Y axis in
// binary units (KiB/MiB/GiB) so the axis matches the tooltip/legend — no more
// "25 Mil" next to "23.8 MiB" values.
export function formatYLabel(format, v) {
  return format === 'bytes' ? fmtBytes(v) : fmtGrafana(v)
}

// HH:MM clock label for the X tick lines
export function fmtTick(ms) {
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Grafana-style precise timestamp in the tooltip
export function fmtPrecise(ms) {
  const d = new Date(ms)
  const pad = (n, len = 2) => String(n).padStart(len, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
