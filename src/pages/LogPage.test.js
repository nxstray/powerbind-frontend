import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/services/adminService', () => ({
  default: {
    queryLogs: vi.fn(),
  },
}))

import adminService from '@/services/adminService'
import LogPage from '@/pages/LogPage.vue'
import LogPanel from '@/components/LogPanel.vue'
import LogsVolumeChart from '@/components/LogsVolumeChart.vue'
import LogOutIcon from '@/components/icons/LogOutIcon.vue'
import MenuIcon from '@/components/icons/MenuIcon.vue'
import { useAuthStore } from '@/stores/authStore'

// LogPage does not use <RouterLink>: the sidebar pushes programmatically, so
// both the router composable (script) and $router/$route (template) are stubbed.
let wrapper

function mountPage() {
  wrapper = mount(LogPage, {
    global: {
      mocks: {
        $router: { push: pushMock },
        $route: { name: 'log' },
      },
    },
  })
  return wrapper
}

// Grafana-style legend chips for the level filter (their text is exactly the level)
function levelChip(level) {
  return wrapper.findAll('button').find((b) => b.text() === level)
}

// Range dropdown options and its trigger share the same labels; the trigger
// always comes first in DOM order.
const RANGE_LABELS = ['15 menit', '1 jam', '6 jam', '24 jam']
function rangeDropdownButtons() {
  return wrapper.findAll('button').filter((b) => RANGE_LABELS.includes(b.text()))
}
function rangeTrigger() {
  return rangeDropdownButtons()[0]
}

const SAMPLE_LOGS = [
  { source: 'BACKEND', level: 'ERROR', message: 'DB down', timestampMs: 1_700_000_000_000 },
  { source: 'BACKEND', level: 'INFO', message: 'started', timestampMs: 1_700_000_000_001 },
  { source: 'FRONTEND', level: 'WARN', message: 'slow render', timestampMs: 1_700_000_000_002 },
  { source: 'IOT', level: 'DEBUG', message: 'ping', timestampMs: 1_700_000_000_003 },
]

// fetchWeather() is never awaited by the page, so it must always resolve
const fetchMock = vi.fn()
function mockWeather(current) {
  fetchMock.mockResolvedValue({ json: () => Promise.resolve({ current }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  adminService.queryLogs.mockResolvedValue([])
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

describe('LogPage', () => {
  it('me-render tiga panel (Backend, Frontend, IoT) dan mengambil log sekali saat mount', async () => {
    adminService.queryLogs.mockResolvedValue(SAMPLE_LOGS)
    mountPage()
    await flushPromises()

    expect(adminService.queryLogs).toHaveBeenCalledWith({ source: 'ALL', since: '1h', limit: 400 })

    const panels = wrapper.findAllComponents(LogPanel)
    expect(panels).toHaveLength(3)
    expect(panels.map((p) => p.props('sourceKey'))).toEqual(['BACKEND', 'FRONTEND', 'IOT'])
    expect(wrapper.text()).toContain('Backend')
    expect(wrapper.text()).toContain('Frontend')
    expect(wrapper.text()).toContain('IoT')
    expect(panels[0].props('isLive')).toBe(true)
    expect(wrapper.findComponent(LogsVolumeChart).props('logs')).toHaveLength(SAMPLE_LOGS.length)
  })

  it('membagi log ke panel sesuai source-nya', async () => {
    adminService.queryLogs.mockResolvedValue(SAMPLE_LOGS)
    mountPage()
    await flushPromises()

    const panels = wrapper.findAllComponents(LogPanel)
    expect(panels[0].props('logs').map((l) => l.message)).toEqual(['DB down', 'started'])
    expect(panels[1].props('logs').map((l) => l.message)).toEqual(['slow render'])
    expect(panels[2].props('logs').map((l) => l.message)).toEqual(['ping'])
  })

  it('menampilkan pesan error kalau /api/admin/logs gagal', async () => {
    adminService.queryLogs.mockRejectedValue(new Error('loki down'))
    mountPage()
    await flushPromises()

    const alert = wrapper.find('p.text-red-400')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('Gagal mengambil log dari /api/admin/logs')
    expect(wrapper.findAllComponents(LogPanel)[0].props('logs')).toEqual([])
  })

  it('tombol Coba lagi menarik ulang log lalu menyembunyikan strip error', async () => {
    adminService.queryLogs.mockRejectedValueOnce(new Error('loki down'))
    mountPage()
    await flushPromises()
    expect(wrapper.find('p.text-red-400').exists()).toBe(true)

    adminService.queryLogs.mockResolvedValue(SAMPLE_LOGS)
    await wrapper.find('p.text-red-400 button').trigger('click')
    await flushPromises()

    expect(adminService.queryLogs).toHaveBeenCalledTimes(2)
    expect(wrapper.find('p.text-red-400').exists()).toBe(false)
    expect(wrapper.findAllComponents(LogPanel)[0].props('logs')).toHaveLength(2)
  })

  it('chip level yang dimatikan menyembunyikan log level tersebut', async () => {
    adminService.queryLogs.mockResolvedValue(SAMPLE_LOGS)
    mountPage()
    await flushPromises()

    const chip = levelChip('ERROR')
    expect(chip.find('span.line-through').exists()).toBe(false)

    await chip.trigger('click')

    expect(wrapper.findAllComponents(LogPanel)[0].props('logs').map((l) => l.message)).toEqual(['started'])
    expect(chip.find('span.line-through').exists()).toBe(true)
    expect(chip.find('span.rounded-full').attributes('style')).toContain('opacity: 0.25')
  })

  it('level terakhir yang masih aktif tidak bisa dimatikan', async () => {
    adminService.queryLogs.mockResolvedValue([SAMPLE_LOGS[0]])
    mountPage()
    await flushPromises()

    for (const lvl of ['WARN', 'INFO', 'DEBUG']) {
      await levelChip(lvl).trigger('click')
    }
    await levelChip('ERROR').trigger('click')

    expect(levelChip('ERROR').find('span.line-through').exists()).toBe(false)
    expect(wrapper.findAllComponents(LogPanel)[0].props('logs')).toHaveLength(1)
  })

  it('mode fokus menyisakan satu panel lalu kembali ke layout tiga kolom', async () => {
    mountPage()
    await flushPromises()
    const grid = wrapper.find('.grid')
    expect(grid.classes()).toContain('md:grid-cols-3')

    wrapper.findAllComponents(LogPanel)[0].vm.$emit('focus')
    await nextTick()

    expect(wrapper.findAllComponents(LogPanel)).toHaveLength(1)
    expect(wrapper.findAllComponents(LogPanel)[0].props('focused')).toBe(true)
    expect(grid.classes()).not.toContain('md:grid-cols-3')

    wrapper.findAllComponents(LogPanel)[0].vm.$emit('unfocus')
    await nextTick()

    expect(wrapper.findAllComponents(LogPanel)).toHaveLength(3)
    expect(grid.classes()).toContain('md:grid-cols-3')
  })


  it('dropdown range menampilkan opsi dan memilih rentang baru menarik ulang log', async () => {
    mountPage()
    await flushPromises()
    expect(rangeTrigger().text()).toBe('1 jam')
    expect(rangeDropdownButtons()).toHaveLength(1)

    await rangeTrigger().trigger('click')
    expect(rangeDropdownButtons()).toHaveLength(RANGE_LABELS.length + 1)

    await wrapper.findAll('button').find((b) => b.text() === '24 jam').trigger('click')

    expect(rangeTrigger().text()).toBe('24 jam')
    expect(adminService.queryLogs).toHaveBeenLastCalledWith({ source: 'ALL', since: '24h', limit: 400 })
    expect(wrapper.findComponent(LogsVolumeChart).props('range')).toBe('24h')
    expect(rangeDropdownButtons()).toHaveLength(1)
  })

  it('klik di luar dropdown range menutup panel opsinya', async () => {
    mountPage()
    await flushPromises()

    await rangeTrigger().trigger('click')
    expect(rangeDropdownButtons()).toHaveLength(RANGE_LABELS.length + 1)

    document.body.click()
    await nextTick()

    expect(rangeDropdownButtons()).toHaveLength(1)
  })

  it('menarik ulang log setiap 3 detik (polling) dan berhenti saat unmount', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    mountPage()
    await flushPromises()
    expect(adminService.queryLogs).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(3000)
    await flushPromises()
    vi.advanceTimersByTime(3000)
    await flushPromises()
    expect(adminService.queryLogs).toHaveBeenCalledTimes(3)

    wrapper.unmount()
    vi.advanceTimersByTime(9000)
    await flushPromises()
    expect(adminService.queryLogs).toHaveBeenCalledTimes(3)
  })


  it('sidebar menampilkan inisial user, nama menu, dan bisa diperkecil/diperbesar', async () => {
    const authStore = useAuthStore()
    authStore.user = { displayName: 'Budi', username: 'budi' }
    mountPage()
    await flushPromises()

    const aside = wrapper.find('aside')
    expect(aside.classes()).toContain('w-60')
    expect(wrapper.find('aside .border-t .rounded-full').text()).toBe('B')
    expect(wrapper.findAll('aside nav button').map((b) => b.text())).toEqual([
      'Dashboard', 'Gemono', 'ERD', 'Log', 'Metrics',
    ])

    await wrapper.find('aside .pb-2 > button').trigger('click')

    expect(aside.classes()).toContain('w-16')
    expect(wrapper.findAll('aside nav button').map((b) => b.text())).toEqual(['', '', '', '', ''])
    expect(wrapper.find('aside .border-t p').exists()).toBe(false)
  })

  it('klik menu sidebar memanggil router.push', async () => {
    mountPage()
    await flushPromises()

    await wrapper.findAll('aside nav button').find((b) => b.text() === 'Metrics').trigger('click')

    expect(pushMock).toHaveBeenCalledWith('/metrics')
  })

  it('tombol menu mobile membuka overlay sidebar dan klik overlay menutupnya', async () => {
    mountPage()
    await flushPromises()
    expect(wrapper.find('div.fixed.inset-0').exists()).toBe(false)

    wrapper.findComponent(MenuIcon).element.closest('button').click()
    await nextTick()

    const overlay = wrapper.find('div.fixed.inset-0')
    expect(overlay.exists()).toBe(true)

    await overlay.trigger('click')
    expect(wrapper.find('div.fixed.inset-0').exists()).toBe(false)
  })


  it('tombol logout membuka konfirmasi lalu keluar dan kembali ke halaman login', async () => {
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

  it('membatalkan konfirmasi logout tidak memanggil authStore.logout', async () => {
    const authStore = useAuthStore()
    const logoutSpy = vi.spyOn(authStore, 'logout').mockResolvedValue()
    mountPage()
    await flushPromises()

    wrapper.findComponent(LogOutIcon).element.closest('button').click()
    await flushPromises()

    const buttons = document.body.querySelectorAll('button')
    buttons[buttons.length - 2].click()
    await flushPromises()

    expect(logoutSpy).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toContain('Keluar dari Akun')
  })


  it('memakai tema malam saat is_day = 0', async () => {
    mockWeather({ weather_code: 0, is_day: 0 })
    mountPage()
    await flushPromises()

    expect(wrapper.classes()).toContain('bg-[#1e293b]')
    expect(wrapper.find('aside').classes()).toContain('from-[#1e1b4b]')
  })

  it('memakai tema hujan saat weather_code >= 51', async () => {
    mockWeather({ weather_code: 61, is_day: 1 })
    mountPage()
    await flushPromises()

    expect(wrapper.classes()).toContain('bg-[#e5e7eb]')
    expect(wrapper.find('aside').classes()).toContain('from-[#64748b]')
  })

  it('memakai tema sore antara pukul 15-18 saat siang cerah', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-05T16:30:00'))
    mountPage()
    await flushPromises()

    expect(wrapper.classes()).toContain('bg-[#fed7aa]')
    expect(wrapper.find('aside').classes()).toContain('from-[#f97316]')
  })

  it('kegagalan ambil cuaca tidak mematikan halaman (tema default tetap dipakai)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValue(new Error('offline'))
    mountPage()
    await flushPromises()

    expect(console.error).toHaveBeenCalled()
    expect(wrapper.classes()).toContain('bg-[#f0f2f5]')
    expect(wrapper.find('aside').classes()).toContain('from-[#0f8cd5]')
    expect(adminService.queryLogs).toHaveBeenCalledTimes(1)
  })
})

