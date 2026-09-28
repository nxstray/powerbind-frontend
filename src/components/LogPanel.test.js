import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

import LogPanel from '@/components/LogPanel.vue'

const T0 = new Date(2026, 0, 2, 10, 15, 30).getTime()
const entry = (level, message, offsetMs = 0) => ({
  timestampMs: T0 + offsetMs,
  level,
  source: 'BACKEND',
  message,
})

const LOGS = [entry('ERROR', 'boom'), entry('ERROR', 'boom lagi', 1_000), entry('WARN', 'hati-hati', 2_000)]

const mountPanel = (props = {}) => mount(LogPanel, { props: { sourceKey: 'BACKEND', logs: [], ...props } })

// The log list has no fixed height in jsdom, so the scroll metrics are stubbed to
// reproduce "user is at the bottom" vs "user is reading older lines".
function stubScroll(el, { scrollTop = 0, scrollHeight = 500, clientHeight = 100 } = {}) {
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
  el.scrollTop = scrollTop
  return el
}

describe('LogPanel', () => {
  it('menampilkan label panel sesuai sourceKey', () => {
    expect(mountPanel({ sourceKey: 'BACKEND' }).text()).toContain('Backend')
    expect(mountPanel({ sourceKey: 'FRONTEND' }).text()).toContain('Frontend')
    expect(mountPanel({ sourceKey: 'IOT' }).text()).toContain('IoT')
  })

  it('menghitung badge per level dan total log di header', () => {
    const wrapper = mountPanel({ logs: LOGS })

    expect(wrapper.find('span.text-red-500').text()).toBe('2E')
    expect(wrapper.find('span.text-amber-500').text()).toBe('1W')
    expect(wrapper.find('span.text-sky-500').exists()).toBe(false)
    expect(wrapper.find('span.opacity-60').text()).toBe('3')
  })

  it('menampilkan pesan kosong saat tidak ada log', () => {
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('Tidak ada log')
    expect(wrapper.findAll('.border-l-2')).toHaveLength(0)
  })

  it('baris log menampilkan jam, level, pesan, dan warna sesuai level', () => {
    const wrapper = mountPanel({ logs: LOGS })
    const rows = wrapper.findAll('.border-l-2')

    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('10:15:30')
    expect(rows[0].text()).toContain('ERROR')
    expect(rows[0].text()).toContain('boom')
    expect(rows[0].classes()).toContain('border-l-red-500')
    expect(rows[2].classes()).toContain('border-l-amber-500')
    expect(rows[0].find('span.text-red-400').exists()).toBe(true)
  })

  it('level yang tidak dikenal memakai gaya INFO sebagai fallback', () => {
    const wrapper = mountPanel({ logs: [entry('TRACE', 'halus')] })
    const row = wrapper.find('.border-l-2')

    expect(row.classes()).toContain('border-l-sky-500')
    expect(row.find('span.text-sky-300').exists()).toBe(true)
  })

  it('klik baris membuka timestamp lengkap dan klik lagi menutupnya', async () => {
    const wrapper = mountPanel({ logs: [LOGS[0]] })
    const full = new Date(T0).toLocaleString('id-ID', { hour12: false })

    expect(wrapper.text()).not.toContain(full)

    await wrapper.find('.border-l-2').trigger('click')

    expect(wrapper.text()).toContain(full)
    expect(wrapper.find('.border-l-2').classes()).toContain('bg-zinc-800/70')

    await wrapper.find('.border-l-2').trigger('click')

    expect(wrapper.text()).not.toContain(full)
  })

  it('tombol maximize meng-emit focus, dan unfocus saat panel sedang fokus', async () => {
    const idle = mountPanel()
    await idle.find('button').trigger('click')

    expect(idle.emitted('focus')).toHaveLength(1)
    expect(idle.find('button').text()).toBe('⤢')

    const focused = mountPanel({ focused: true })
    await focused.find('button').trigger('click')

    expect(focused.emitted('unfocus')).toHaveLength(1)
    expect(focused.find('button').text()).toBe('▁')
  })

  it('tema gelap menerapkan kelas panel gelap', () => {
    expect(mountPanel().classes()).toContain('bg-white')
    expect(mountPanel({ isDark: true }).classes()).toContain('bg-zinc-900')
  })

  it('otomatis menggulir ke bawah saat log baru masuk (live + sedang di dasar)', async () => {
    const wrapper = mountPanel({ logs: LOGS })
    const el = stubScroll(wrapper.find('.log-scroll').element, { scrollTop: 450 })

    await wrapper.find('.log-scroll').trigger('scroll')
    await wrapper.setProps({ logs: [...LOGS, entry('INFO', 'log baru', 3_000)] })
    await flushPromises()

    expect(el.scrollTop).toBe(500)
  })

  it('tidak menggulir saat pengguna sedang membaca log lama di atas', async () => {
    const wrapper = mountPanel({ logs: LOGS })
    const el = stubScroll(wrapper.find('.log-scroll').element, { scrollTop: 0 })

    await wrapper.find('.log-scroll').trigger('scroll')
    await wrapper.setProps({ logs: [...LOGS, entry('INFO', 'log baru', 3_000)] })
    await flushPromises()

    expect(el.scrollTop).toBe(0)
  })

  it('tidak auto-scroll saat mode Live dimatikan', async () => {
    const wrapper = mountPanel({ logs: LOGS, isLive: false })
    const el = stubScroll(wrapper.find('.log-scroll').element, { scrollTop: 450 })

    await wrapper.find('.log-scroll').trigger('scroll')
    await wrapper.setProps({ logs: [...LOGS, entry('INFO', 'log baru', 3_000)] })
    await flushPromises()

    expect(el.scrollTop).toBe(450)
  })
})
