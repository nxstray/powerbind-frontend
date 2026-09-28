import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import LiquidCard from '@/components/LiquidCard.vue'

const mountCard = (props) =>
  mount(LiquidCard, {
    props: { label: 'Daya', value: '123 W', ...props },
    slots: { default: '<svg class="slot-icon" />' },
  })

describe('LiquidCard', () => {
  it('menampilkan label, value, sub, dan slot ikon', () => {
    const wrapper = mountCard({ sub: 'pemakaian saat ini' })

    expect(wrapper.find('.label').text()).toBe('Daya')
    expect(wrapper.find('.value').text()).toBe('123 W')
    expect(wrapper.find('.sub').text()).toBe('pemakaian saat ini')
    expect(wrapper.find('.slot-icon').exists()).toBe(true)
    expect(wrapper.attributes('style')).toContain('--liquid-color: #0f8cd5')
  })

  it('varian dark memakai kelas dark-card', () => {
    const wrapper = mountCard({ dark: true, color: '#ECECBB' })

    expect(wrapper.classes()).toContain('dark-card')
    expect(wrapper.attributes('style')).toContain('--liquid-color: #ECECBB')
  })

  it('fill 40% menaruh permukaan air di 60% dari atas', () => {
    const wrapper = mountCard({ fill: 40 })

    expect(wrapper.vm.liquidTop).toBe('60%')
    expect(wrapper.vm.hoverTop).toBe('50%')
  })

  it('fill 0 menyembunyikan gelombang di bawah kartu (150%)', () => {
    const wrapper = mountCard({ fill: 0 })

    expect(wrapper.vm.liquidTop).toBe('150%')
    expect(wrapper.vm.hoverTop).toBe('150%')
  })

  it('fill di atas 100% dibatasi supaya gelombang tidak keluar kartu', () => {
    const wrapper = mountCard({ fill: 140 })

    expect(wrapper.vm.liquidTop).toBe('0%')
    expect(wrapper.vm.hoverTop).toBe('-10%')
  })
})

