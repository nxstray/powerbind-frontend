import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/services/metricsService', () => ({
  default: {
    getNames: vi.fn(),
    query: vi.fn(),
  },
}))

vi.mock('@/services/agentService', () => ({
  default: {
    streamQuickAsk: vi.fn(),
  },
}))

import metricsService from '@/services/metricsService'
import agentService from '@/services/agentService'
import MetricsPage from '@/pages/MetricsPage.vue'
import MetricsChart from '@/components/MetricsChart.vue'
import CloseIcon from '@/components/icons/CloseIcon.vue'
import LogOutIcon from '@/components/icons/LogOutIcon.vue'
import { useAuthStore } from '@/stores/authStore'

// MetricsPage does not use <RouterLink>: the sidebar pushes programmatically, so
// both the router composable (script) and $router/$route (template) are stubbed.
let wrapper

function mountPage() {
  wrapper = mount(MetricsPage, {
    global: {
      mocks: {
        $router: { push: pushMock },
        $route: { name: 'metrics' },
      },
    },
  })
  return wrapper
}

// sendAsk appends to the streamed reply object directly (not through a ref), so
// the panel only shows the final answer on its next re-render.
async function forceRender() {
  wrapper.vm.$forceUpdate()
  await nextTick()
}

// Raw Prometheus names returned by the backend — only the runtime prefixes survive
// MetricsPage's filter, and *_seconds_count / *_seconds_sum are dropped.
const ALL_METRIC_NAMES = [
  'jvm_memory_used_bytes',
  'process_cpu_usage',
  'http_server_requests_seconds_count',
  'jvm_gc_pause_seconds_sum',
  'custom_business_metric',
]
const FILTERED_METRIC_NAMES = ['jvm_memory_used_bytes', 'process_cpu_usage']

function metricDropdownOptions() {
  return wrapper.findAll('[data-metric-dd] .max-h-52 button')
}
function metricTrigger() {
  return wrapper.find('[data-metric-dd] > button')
}
function rangeTrigger() {
  return wrapper.find('[data-range-dd] > button')
}
function askPanel() {
  // aside[0] is the navigation sidebar, aside[1] is the Ask Gemono panel
  return wrapper.findAll('aside')[1]
}
function askTrigger() {
  return wrapper.findAll('button').find((b) => b.text().includes('Ask Gemono'))
}

const fetchMock = vi.fn()
function mockWeather(current) {
  fetchMock.mockResolvedValue({ json: () => Promise.resolve({ current }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  metricsService.getNames.mockResolvedValue(ALL_METRIC_NAMES)
  metricsService.query.mockImplementation(({ metric }) =>
    Promise.resolve({ query: metric, series: [{ name: metric, points: [{ t: 1_700_000_000_000, v: 1024 }] }] }),
  )
  mockWeather({ weather_code: 0, is_day: 1 })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('MetricsPage', () => {
  it('mengambil deret memory & cpu saat mount lalu mengoper ke dua chart', async () => {
    mountPage()
    await flushPromises()

    expect(metricsService.query).toHaveBeenNthCalledWith(1, {
      metric: 'jvm_memory_used_bytes', groupBy: null, agg: 'sum', hours: 1, step: 60,
    })
    expect(metricsService.query).toHaveBeenNthCalledWith(2, {
      metric: 'process_cpu_usage', groupBy: null, agg: 'avg', hours: 1, step: 60,
    })
    expect(metricsService.getNames).toHaveBeenCalledTimes(1)

    const charts = wrapper.findAllComponents(MetricsChart)
    expect(charts).toHaveLength(2)
    expect(charts[0].props('title')).toBe('jvm_memory_used_bytes')
    expect(charts[0].props('format')).toBe('bytes')
    expect(charts[0].props('series')).toHaveLength(1)
    expect(charts[1].props('title')).toBe('process_cpu_usage')
    expect(charts[1].props('format')).toBe('ratio')
    expect(wrapper.text()).toContain('updated')
    expect(wrapper.find('p.text-red-400').exists()).toBe(false)
  })

  it('menampilkan pesan error kalau query metrik gagal', async () => {
    metricsService.query.mockRejectedValue(new Error('prometheus down'))
    mountPage()
    await flushPromises()

    const alert = wrapper.find('p.text-red-400')
    expect(alert.exists()).toBe(true)
    expect(alert.classes()).toContain('text-center')
    expect(alert.text()).toContain('Gagal mengambil metrik dari /api/admin/metrics')
    expect(wrapper.findAllComponents(MetricsChart)[0].props('series')).toEqual([])
  })

  it('tombol Coba lagi menarik ulang metrik dan daftar nama metrik', async () => {
    metricsService.query.mockRejectedValue(new Error('prometheus down'))
    mountPage()
    await flushPromises()
    expect(wrapper.find('p.text-red-400').exists()).toBe(true)
    expect(metricsService.getNames).toHaveBeenCalledTimes(1)

    metricsService.query.mockImplementation(({ metric }) =>
      Promise.resolve({ query: metric, series: [{ name: metric, points: [{ t: 1_700_000_000_000, v: 1024 }] }] }),
    )
    await wrapper.find('p.text-red-400 button').trigger('click')
    await flushPromises()

    expect(metricsService.query).toHaveBeenCalledTimes(4)
    expect(metricsService.getNames).toHaveBeenCalledTimes(2)
    expect(wrapper.find('p.text-red-400').exists()).toBe(false)
    expect(wrapper.findAllComponents(MetricsChart)[0].props('series')).toHaveLength(1)
  })

  it('dropdown range mengubah hours + step lalu menarik ulang metrik', async () => {
    mountPage()
    await flushPromises()
    expect(rangeTrigger().text()).toBe('Last 1 hour')

    await rangeTrigger().trigger('click')
    await wrapper.findAll('[data-range-dd] button').find((b) => b.text() === 'Last 6 hours').trigger('click')

    expect(rangeTrigger().text()).toBe('Last 6 hours')
    expect(metricsService.query).toHaveBeenCalledTimes(4)
    expect(metricsService.query).toHaveBeenNthCalledWith(3, {
      metric: 'jvm_memory_used_bytes', groupBy: null, agg: 'sum', hours: 6, step: 240,
    })
    expect(metricsService.query).toHaveBeenNthCalledWith(4, {
      metric: 'process_cpu_usage', groupBy: null, agg: 'avg', hours: 6, step: 240,
    })
  })

  it('dropdown metrik hanya menampilkan nama runtime dan bisa difilter', async () => {
    mountPage()
    await flushPromises()
    expect(metricTrigger().text()).toBe('process_cpu_usage')

    await metricTrigger().trigger('click')
    expect(metricDropdownOptions().map((o) => o.text())).toEqual(FILTERED_METRIC_NAMES)

    await wrapper.find('#metric-search').setValue('memory')
    expect(metricDropdownOptions().map((o) => o.text())).toEqual(['jvm_memory_used_bytes'])

    await metricDropdownOptions()[0].trigger('click')

    expect(metricTrigger().text()).toBe('jvm_memory_used_bytes')
    expect(wrapper.find('#metric-search').exists()).toBe(false)
    expect(metricsService.query).toHaveBeenLastCalledWith({
      metric: 'jvm_memory_used_bytes', groupBy: null, agg: 'avg', hours: 1, step: 60,
    })
    expect(wrapper.findAllComponents(MetricsChart)[1].props('title')).toBe('jvm_memory_used_bytes')
  })

  it('menampilkan pesan kosong saat pencarian metrik tidak cocok', async () => {
    mountPage()
    await flushPromises()

    await metricTrigger().trigger('click')
    await wrapper.find('#metric-search').setValue('tidak-ada-metrik-ini')

    expect(metricDropdownOptions()).toHaveLength(0)
    expect(wrapper.text()).toContain('Tidak ada metrik yang cocok.')
  })

  it('daftar metrik tetap kosong kalau getNames gagal', async () => {
    metricsService.getNames.mockRejectedValue(new Error('backend down'))
    mountPage()
    await flushPromises()

    await metricTrigger().trigger('click')

    expect(metricDropdownOptions()).toHaveLength(0)
    expect(wrapper.text()).toContain('Tidak ada metrik yang cocok.')
    expect(wrapper.findAllComponents(MetricsChart)).toHaveLength(2)
  })

  it('klik di luar menutup dropdown range dan dropdown metrik', async () => {
    mountPage()
    await flushPromises()

    await rangeTrigger().trigger('click')
    await metricTrigger().trigger('click')
    expect(wrapper.findAll('[data-range-dd] button')).toHaveLength(4)
    expect(metricDropdownOptions()).toHaveLength(FILTERED_METRIC_NAMES.length)

    // The mounted tree is detached from the document, so the document-level
    // outside-click listener only fires for events dispatched on attached nodes.
    document.body.click()
    await nextTick()

    expect(wrapper.findAll('[data-range-dd] button')).toHaveLength(1)
    expect(metricDropdownOptions()).toHaveLength(0)
  })

  it('panel Ask Gemono: typewriter greeting dan jawaban streaming masuk ke riwayat', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const authStore = useAuthStore()
    authStore.user = { displayName: 'Budi' }
    mountPage()
    await flushPromises()

    expect(askPanel().attributes('style')).toContain('0px')
    await askTrigger().trigger('click')
    expect(askPanel().attributes('style')).toContain('320px')

    // Greeting is typed one character per tick (55ms) before any question is asked
    vi.advanceTimersByTime(55)
    await nextTick()
    expect(askPanel().text()).toContain('H|')
    vi.advanceTimersByTime(55 * 20)
    await nextTick()
    expect(askPanel().text()).toContain('Halo, Budi')

    await wrapper.find('#ask-gemono-input').setValue('kenapa memory naik?')
    await wrapper.find('form').trigger('submit.prevent')

    expect(agentService.streamQuickAsk).toHaveBeenCalledWith(
      'kenapa memory naik?',
      ['jvm_memory_used_bytes', 'process_cpu_usage'],
      1,
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    )
    expect(wrapper.find('#ask-gemono-input').element.value).toBe('')

    const [, , , onChunk, onDone] = agentService.streamQuickAsk.mock.calls[0]
    onChunk('Memory naik ')
    onChunk('karena GC.')
    expect(wrapper.vm.askMessages[1]).toMatchObject({
      role: 'assistant',
      content: 'Memory naik karena GC.',
      streaming: true,
    })
    expect(askPanel().find('.animate-pulse').exists()).toBe(true)

    onDone()
    expect(wrapper.vm.askStreaming).toBe(false)
    expect(wrapper.vm.askMessages[1].streaming).toBe(false)

    // sendAsk appends to the reply object directly, so the panel only picks the
    // final answer up on the next re-render — force one and assert the DOM.
    await forceRender()

    expect(askPanel().text()).toContain('kenapa memory naik?')
    expect(askPanel().text()).toContain('Memory naik karena GC.')
    expect(askPanel().find('.animate-pulse').exists()).toBe(false)

    // Kirim ulang dengan input kosong tidak menambah pertanyaan baru
    await wrapper.find('form').trigger('submit.prevent')
    expect(agentService.streamQuickAsk).toHaveBeenCalledTimes(1)
  })


  it('menampilkan pesan kendala saat stream Ask Gemono gagal', async () => {
    mountPage()
    await flushPromises()

    await askTrigger().trigger('click')
    await wrapper.find('#ask-gemono-input').setValue('status GC?')
    await wrapper.find('form').trigger('submit.prevent')

    const [, , , , , onError] = agentService.streamQuickAsk.mock.calls[0]
    onError(new Error('AI unavailable'))

    expect(wrapper.vm.askStreaming).toBe(false)
    expect(wrapper.vm.askMessages[1]).toMatchObject({
      role: 'assistant',
      content: 'Maaf, terjadi kendala: AI unavailable',
      streaming: false,
    })

    await forceRender()

    expect(askPanel().text()).toContain('Maaf, terjadi kendala: AI unavailable')
    expect(askPanel().find('.animate-pulse').exists()).toBe(false)
  })

  it('tombol close menutup panel Ask Gemono', async () => {
    mountPage()
    await flushPromises()

    await askTrigger().trigger('click')
    expect(askPanel().attributes('style')).toContain('320px')

    wrapper.findComponent(CloseIcon).element.closest('button').click()
    await nextTick()

    expect(askPanel().attributes('style')).toContain('0px')
  })

  it('menarik ulang metrik setiap 30 detik dan berhenti saat unmount', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    mountPage()
    await flushPromises()
    expect(metricsService.query).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(30_000)
    await flushPromises()
    expect(metricsService.query).toHaveBeenCalledTimes(4)

    wrapper.unmount()
    vi.advanceTimersByTime(60_000)
    await flushPromises()
    expect(metricsService.query).toHaveBeenCalledTimes(4)
  })

  it('sidebar menampilkan inisial user, daftar menu, dan bisa diperkecil', async () => {
    const authStore = useAuthStore()
    authStore.user = { displayName: 'Budi', username: 'budi' }
    mountPage()
    await flushPromises()

    const aside = wrapper.findAll('aside')[0]
    expect(aside.classes()).toContain('w-60')
    expect(wrapper.find('aside .border-t .rounded-full').text()).toBe('B')
    expect(wrapper.findAll('aside nav button').map((b) => b.text())).toEqual([
      'Dashboard', 'Gemono', 'ERD', 'Log', 'Metrics',
    ])

    await wrapper.find('aside .pb-2 > button').trigger('click')

    expect(aside.classes()).toContain('w-16')
    expect(wrapper.find('aside .border-t p').exists()).toBe(false)
  })

  it('klik menu sidebar memanggil router.push', async () => {
    mountPage()
    await flushPromises()

    await wrapper.findAll('aside nav button').find((b) => b.text() === 'Log').trigger('click')

    expect(pushMock).toHaveBeenCalledWith('/log')
  })

  it('konfirmasi logout memanggil authStore.logout lalu redirect ke login', async () => {
    const authStore = useAuthStore()
    const logoutSpy = vi.spyOn(authStore, 'logout').mockResolvedValue()
    mountPage()
    await flushPromises()

    wrapper.findComponent(LogOutIcon).element.closest('button').click()
    await flushPromises()
    expect(document.body.textContent).toContain('Keluar dari Akun')

    const buttons = document.body.querySelectorAll('button')
    buttons[buttons.length - 1].click()
    await flushPromises()

    expect(logoutSpy).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith({ name: 'login' })
  })

  it('memakai tema malam + accent color saat is_day = 0', async () => {
    mockWeather({ weather_code: 0, is_day: 0 })
    mountPage()
    await flushPromises()

    expect(wrapper.classes()).toContain('bg-[#1e293b]')
    expect(wrapper.attributes('style')).toContain('#4338ca')
    expect(wrapper.findAllComponents(MetricsChart)[0].props('isDark')).toBe(true)
  })

  it('kegagalan ambil cuaca tidak mematikan halaman (tema default tetap dipakai)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValue(new Error('offline'))
    mountPage()
    await flushPromises()

    expect(console.error).toHaveBeenCalled()
    expect(wrapper.classes()).toContain('bg-[#f0f2f5]')
    expect(wrapper.findAllComponents(MetricsChart)[0].props('isDark')).toBe(false)
  })
})

