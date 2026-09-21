import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

import AppTooltip from '@/components/AppTooltip.vue'

let wrapper

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('AppTooltip', () => {
  it('me-render konten slot sebagai trigger', () => {
    wrapper = mount(AppTooltip, { slots: { default: '<button>info</button>' } })

    expect(wrapper.find('button').text()).toBe('info')
    expect(wrapper.find('span.opacity-0').exists()).toBe(false)
  })

  it('menyimpan teks tooltip di atribut data-tooltip dan span-nya', () => {
    wrapper = mount(AppTooltip, { props: { text: 'Daya realtime' } })

    expect(wrapper.find('[data-tooltip="Daya realtime"]').exists()).toBe(true)
    const tip = wrapper.find('span.opacity-0')
    expect(tip.exists()).toBe(true)
    expect(tip.text()).toBe('Daya realtime')
  })

  it('tanpa teks: span tooltip tidak di-render sama sekali', () => {
    wrapper = mount(AppTooltip, { props: { text: '' } })

    expect(wrapper.find('span.opacity-0').exists()).toBe(false)
  })

  it('posisi default = top', () => {
    wrapper = mount(AppTooltip, { props: { text: 'x' } })

    expect(wrapper.find('span.opacity-0').classes()).toContain('bottom-full')
  })

  it('posisi bottom memakai class top-full', () => {
    wrapper = mount(AppTooltip, { props: { text: 'x', position: 'bottom' } })

    const tip = wrapper.find('span.opacity-0')
    expect(tip.classes()).toContain('top-full')
  })

  it('posisi right memakai class left-full', () => {
    wrapper = mount(AppTooltip, { props: { text: 'x', position: 'right' } })

    const tip = wrapper.find('span.opacity-0')
    expect(tip.classes()).toContain('left-full')
  })
})
