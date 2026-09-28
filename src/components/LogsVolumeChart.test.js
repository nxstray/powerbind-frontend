import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

import LogsVolumeChart from '@/components/LogsVolumeChart.vue'

// Fixed SVG coordinate space of the component (scaled responsively via viewBox).
const W = 600
const H = 130
const BUCKET_COUNT = 48
const BUCKET_W = W / BUCKET_COUNT

const level = (name, ageMs, message = 'pesan') => ({
  timestampMs: Date.now() - ageMs,
  level: name,
  source: 'BACKEND',
  message,
})

const mountChart = (props = {}) => mount(LogsVolumeChart, { props: { logs: [], ...props } })

// Hover at the center of a specific time bucket (0..47).
function hoverBucket(wrapper, index, clientY = 40) {
  const svg = wrapper.find('svg.w-full').element
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H })
  return wrapper.find('svg.w-full').trigger('mousemove', { clientX: (index + 0.5) * BUCKET_W, clientY })
}

// The legend only lists the levels that actually have data. Each entry is an
// outer span holding a color swatch + the level name, so only direct children
// are read (the swatch span has no text of its own).
const legendLevels = (wrapper) =>
  wrapper.findAll('div.gap-3 > span').map((s) => s.text())

describe('LogsVolumeChart', () => {
  it('terbuka secara default dan bisa dilipat lewat header', async () => {
    const wrapper = mountChart()

    expect(wrapper.find('button').text()).toContain('Logs volume')
    expect(wrapper.find('svg.w-full').exists()).toBe(true)

    await wrapper.find('button').trigger('click')
    expect(wrapper.find('svg.w-full').exists()).toBe(false)

    await wrapper.find('button').trigger('click')
    expect(wrapper.find('svg.w-full').exists()).toBe(true)
  })

  it('membuat satu pola stripe per level log', () => {
    const wrapper = mountChart()
    const ids = wrapper.findAll('pattern').map((p) => p.attributes('id'))

    expect(ids).toHaveLength(4)
    expect(ids).toEqual([
      expect.stringContaining('-ERROR'),
      expect.stringContaining('-WARN'),
      expect.stringContaining('-INFO'),
      expect.stringContaining('-DEBUG'),
    ])
  })

  it('id pola unik antar instance supaya tidak bertabrakan di halaman yang sama', () => {
    // Both charts must live in the SAME app instance: useId() numbers components
    // per app, so a second mount() would restart the counter at v-0.
    const Host = defineComponent({
      render: () => h('div', [h(LogsVolumeChart, { logs: [] }), h(LogsVolumeChart, { logs: [] })]),
    })
    const wrapper = mount(Host)
    const ids = wrapper.findAll('pattern').map((p) => p.attributes('id'))

    expect(ids).toHaveLength(8)
    expect(ids[0]).not.toBe(ids[4])
  })

  it('menumpuk satu bar per level yang punya log dalam rentang waktu', () => {
    const wrapper = mountChart({
      logs: [level('ERROR', 1_000), level('ERROR', 2_000), level('WARN', 3_000)],
      range: '1h',
    })

    // ERROR + WARN have data; INFO/DEBUG produce no rect at all.
    expect(wrapper.findAll('rect[rx="1"]')).toHaveLength(2)
  })

  it('log di luar rentang waktu tidak dihitung', () => {
    const wrapper = mountChart({ logs: [level('ERROR', 60 * 60 * 1000)], range: '15m' })

    expect(wrapper.findAll('rect[rx="1"]')).toHaveLength(0)
  })

  it('log satu jam terakhir tetap dihitung pada rentang 24h', () => {
    const wrapper = mountChart({ logs: [level('ERROR', 60 * 60 * 1000)], range: '24h' })

    expect(wrapper.findAll('rect[rx="1"]')).toHaveLength(1)
  })

  it('legend default menampilkan keempat level saat belum ada log', () => {
    expect(legendLevels(mountChart())).toEqual(['error', 'warn', 'info', 'debug'])
  })

  it('legend hanya menyebut level yang benar-benar muncul', () => {
    const wrapper = mountChart({ logs: [level('ERROR', 1_000), level('INFO', 2_000)], range: '1h' })

    expect(legendLevels(wrapper)).toEqual(['error', 'info'])
  })

  it('crosshair + tooltip menampilkan waktu presisi dan jumlah per level', async () => {
    const wrapper = mountChart({ logs: [level('ERROR', 1_000), level('ERROR', 1_500)], range: '1h' })

    // A log 1s old lands in the last bucket of the 1h window (index 47).
    await hoverBucket(wrapper, BUCKET_COUNT - 1)

    const tooltip = wrapper.find('.z-10')
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.text()).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}/)
    expect(tooltip.text()).toContain('error')
    expect(tooltip.find('.font-semibold.ml-auto').text()).toBe('2')
    expect(wrapper.findAll('svg.w-full line[stroke-dasharray="3,3"]')).toHaveLength(2)
  })

  it('tooltip menampilkan "Tidak ada log" untuk bucket yang kosong', async () => {
    const wrapper = mountChart({ logs: [level('ERROR', 1_000)], range: '1h' })

    await hoverBucket(wrapper, 0)

    expect(wrapper.find('.z-10').text()).toContain('Tidak ada log')
  })

  it('tooltip hilang saat kursor meninggalkan chart', async () => {
    const wrapper = mountChart({ logs: [level('WARN', 1_000)], range: '1h' })

    await hoverBucket(wrapper, BUCKET_COUNT - 1)
    expect(wrapper.find('.z-10').exists()).toBe(true)

    await wrapper.find('svg.w-full').trigger('mouseleave')

    expect(wrapper.find('.z-10').exists()).toBe(false)
  })
})
