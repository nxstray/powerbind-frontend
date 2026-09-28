import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

import PowerChart from '@/components/PowerChart.vue'

describe('PowerChart', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })

    // Mock HTMLCanvasElement.prototype.getContext
    const mockCtx = {
      scale: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx)
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 200,
      top: 0,
      left: 0,
      bottom: 200,
      right: 400,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('menampilkan "No data available" jika props.data kosong', () => {
    const wrapper = mount(PowerChart, {
      props: {
        data: [],
      },
    })

    expect(wrapper.text()).toContain('No data available')
  })

  it('tidak menampilkan "No data available" jika terdapat data dan menggambar ke canvas', () => {
    const wrapper = mount(PowerChart, {
      props: {
        data: [
          { timestamp: '10:00', watts: 150 },
          { timestamp: '10:05', watts: 180 },
        ],
      },
    })

    expect(wrapper.text()).not.toContain('No data available')
    expect(wrapper.find('canvas').exists()).toBe(true)
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d')
  })
})

