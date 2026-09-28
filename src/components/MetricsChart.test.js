import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import MetricsChart from '@/components/MetricsChart.vue'
import { formatValue, lineColor } from '@/utils/metricsFormat'

// Layout constants of the component's SVG viewBox — a mouse position is mapped
// back into this coordinate space to find the hovered instant.
const W = 720
const H = 170
const PAD_L = 40

const T0 = new Date(2026, 0, 1, 10, 0, 0).getTime()
// One point per minute, so the tooltip interpolation has something to snap to.
const series = (name, values) => ({ name, points: values.map((v, i) => ({ t: T0 + i * 60_000, v })) })

const mountChart = (props = {}, options = {}) =>
  mount(MetricsChart, { props: { series: [series('cpu_total', [10, 20, 30])], ...props }, ...options })

// The chart scales via viewBox + w-full, so it reads the element's bounding box to
// convert a real mouse position into viewBox coordinates.
function hoverAt(wrapper, clientX, clientY = 40) {
  const svg = wrapper.find('svg').element
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H })
  return wrapper.find('svg').trigger('mousemove', { clientX, clientY })
}

// Legend rows live inside the (optionally scrollable) legend container.
const legendRows = (wrapper) => wrapper.findAll('.custom-scroll > div')

describe('MetricsChart', () => {
  it('menampilkan judul, subtitle, dan slot actions', () => {
    const wrapper = mountChart(
      { title: 'Memory', subtitle: 'node_memory_available_bytes' },
      { slots: { actions: '<button class="zoom">z</button>' } },
    )

    expect(wrapper.text()).toContain('Memory')
    expect(wrapper.text()).toContain('node_memory_available_bytes')
    expect(wrapper.find('button.zoom').exists()).toBe(true)
  })

  it('memakai judul default "Graph" bila title tidak diisi', () => {
    expect(mountChart().text()).toContain('Graph')
  })

  it('menggambar satu polyline per series yang punya titik data', () => {
    const wrapper = mountChart({ series: [series('a', [1, 2]), series('b', [3, 4])] })

    expect(wrapper.findAll('polyline')).toHaveLength(2)
    expect(wrapper.findAll('polyline')[1].attributes('stroke')).toBe(lineColor(1))
  })

  it('melewatkan series kosong dari garis maupun legend', () => {
    const wrapper = mountChart({ series: [series('ada', [1, 2]), { name: 'kosong', points: [] }] })

    expect(wrapper.findAll('polyline')).toHaveLength(1)
    expect(legendRows(wrapper)).toHaveLength(1)
    expect(wrapper.text()).toContain('ada')
    expect(wrapper.text()).not.toContain('kosong')
  })

  it('tanpa series yang terlihat, legend tidak dirender', () => {
    const wrapper = mountChart({ series: [] })

    expect(wrapper.find('.custom-scroll').exists()).toBe(false)
    expect(wrapper.findAll('polyline')).toHaveLength(0)
    expect(wrapper.text()).toContain('Graph')
  })

  it('klik legend memfokuskan satu series, klik lagi menampilkan semua', async () => {
    const wrapper = mountChart({ series: [series('a', [1, 2]), series('b', [3, 4])] })
    const rows = legendRows(wrapper)

    expect(wrapper.findAll('polyline')).toHaveLength(2)

    await rows[1].trigger('click')

    expect(wrapper.findAll('polyline')).toHaveLength(1)
    expect(wrapper.findAll('polyline')[0].attributes('stroke')).toBe(lineColor(1))
    expect(rows[0].classes()).toContain('opacity-30')
    expect(rows[1].classes()).toContain('opacity-100')

    await rows[1].trigger('click')

    expect(wrapper.findAll('polyline')).toHaveLength(2)
    expect(rows[0].classes()).toContain('opacity-100')
  })

  it('hideLegendScrollbar membuat legend penuh tanpa area scroll', () => {
    const scrollable = mountChart()
    const full = mountChart({ hideLegendScrollbar: true })

    expect(scrollable.find('.custom-scroll').exists()).toBe(true)
    expect(full.find('.custom-scroll').exists()).toBe(false)
    expect(full.find('.overflow-visible').exists()).toBe(true)
  })

  it('hover menampilkan tooltip berisi timestamp presisi dan nilai tiap series', async () => {
    const wrapper = mountChart({ series: [series('cpu', [10, 20, 30])] })

    // Exactly halfway across the panel. The tooltip flips only past 50% of the
    // full viewBox width, so this stays on the right of the crosshair, and the
    // hovered instant snaps to the middle point (t0 + 60s).
    await hoverAt(wrapper, W / 2)

    const tooltip = wrapper.find('.z-10')
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.text()).toContain('cpu')
    expect(tooltip.text()).toContain(formatValue('number', 20))
    // Left half of the panel → tooltip stays on the right side of the crosshair.
    expect(tooltip.attributes('style')).toContain('translateX(14px)')
    // Crosshair: one vertical + one horizontal dashed line.
    expect(wrapper.findAll('svg line[stroke-dasharray="3,3"]')).toHaveLength(2)
  })

  it('tooltip membalik ke kiri kursor saat melewati tengah panel', async () => {
    const wrapper = mountChart()

    await hoverAt(wrapper, W * 0.9)

    expect(wrapper.find('.z-10').attributes('style')).toContain('calc(-100% - 14px)')
  })

  it('tooltip hilang saat kursor meninggalkan chart', async () => {
    const wrapper = mountChart()

    await hoverAt(wrapper, PAD_L + 100)
    expect(wrapper.find('.z-10').exists()).toBe(true)

    await wrapper.find('svg').trigger('mouseleave')

    expect(wrapper.find('.z-10').exists()).toBe(false)
    expect(wrapper.findAll('svg line[stroke-dasharray="3,3"]')).toHaveLength(0)
  })

  it('format bytes memakai satuan biner pada label sumbu Y dan tooltip', async () => {
    const wrapper = mountChart({ format: 'bytes', series: [series('mem', [3 * 1024 * 1024, 2 * 1024 * 1024])] })

    // Y tick labels are an HTML overlay so they never get stretched by the viewBox.
    expect(wrapper.find('.pointer-events-none').text()).toContain('MiB')

    await hoverAt(wrapper, PAD_L + 1)

    expect(wrapper.find('.z-10').text()).toContain(formatValue('bytes', 3 * 1024 * 1024))
  })

  it('format ratio menampilkan persentase di tooltip', async () => {
    const wrapper = mountChart({ format: 'ratio', series: [series('usage', [0.25, 0.5])] })

    await hoverAt(wrapper, PAD_L + 1)

    expect(wrapper.find('.z-10').text()).toContain('25.0%')
  })

  it('warna grid mengikuti tema halaman', () => {
    const light = mountChart()
    const dark = mountChart({ isDark: true })

    expect(light.findAll('svg line')[0].attributes('stroke')).toBe('rgba(0,0,0,0.12)')
    expect(dark.findAll('svg line')[0].attributes('stroke')).toBe('rgba(255,255,255,0.22)')
  })
})
