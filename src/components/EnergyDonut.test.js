import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

import EnergyDonut from '@/components/EnergyDonut.vue'

describe('EnergyDonut', () => {
  let mockCtx

  beforeEach(() => {
    mockCtx = {
      scale: vi.fn(),
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      createConicGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => mockCtx)

    vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(cb, 0))
    vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('me-render canvas dengan ukuran prop', async () => {
    const wrapper = mount(EnergyDonut, {
      props: {
        size: 200,
        kwh: 5,
        maxKwh: 10,
      },
    })

    const canvas = wrapper.find('canvas')
    expect(canvas.exists()).toBe(true)
    expect(canvas.attributes('style')).toContain('width: 200px')
    expect(canvas.attributes('style')).toContain('height: 200px')

    wrapper.unmount()
  })

  it('menginisialisasi konteks 2D canvas saat tick dieksekusi', async () => {
    const wrapper = mount(EnergyDonut, {
      props: {
        kwh: 5,
        maxKwh: 10,
      },
    })

    await new Promise((r) => setTimeout(r, 20))
    expect(mockCtx.arc).toHaveBeenCalled()

    wrapper.unmount()
  })

  it('dapat dijalankan dengan mode demo', async () => {
    const wrapper = mount(EnergyDonut, {
      props: {
        demo: true,
      },
    })

    await new Promise((r) => setTimeout(r, 20))
    expect(wrapper.exists()).toBe(true)

    wrapper.unmount()
  })
})



