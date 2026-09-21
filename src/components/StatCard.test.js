import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

import StatCard from '@/components/StatCard.vue'

let wrapper

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('StatCard', () => {
  it('me-render label, value, dan sub', () => {
    wrapper = mount(StatCard, { props: { label: 'Total Daya', value: 128, sub: '4 ruang aktif' } })

    expect(wrapper.text()).toContain('Total Daya')
    expect(wrapper.text()).toContain('128')
    expect(wrapper.text()).toContain('4 ruang aktif')
  })

  it('memakai warna default #0f8cd5 untuk kotak ikon', () => {
    wrapper = mount(StatCard, { props: { label: 'L', value: 1 } })

    const badge = wrapper.find('.w-8.h-8')
    // jsdom normalizes hex+alpha (#0f8cd520) to its rgba() form
    expect(badge.attributes('style')).toContain('rgba(15, 140, 213')
  })

  it('menghormati prop color kustom (ditransparankan 20 hex)', () => {
    wrapper = mount(StatCard, { props: { label: 'L', value: 1, color: '#ef4444' } })

    const badge = wrapper.find('.w-8.h-8')
    expect(badge.attributes('style')).toContain('rgba(239, 68, 68')
  })

  it('me-render konten slot (ikon) di dalam kotak berwarna', () => {
    wrapper = mount(StatCard, {
      props: { label: 'L', value: 1 },
      slots: { default: '<span data-test="icon">ikon</span>' },
    })

    const badge = wrapper.find('.w-8.h-8')
    expect(badge.find('[data-test="icon"]').text()).toBe('ikon')
  })
})
