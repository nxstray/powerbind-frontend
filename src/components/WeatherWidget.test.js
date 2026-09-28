import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import WeatherWidget from '@/components/WeatherWidget.vue'

// WMO weather codes drive the whole scene — the widget is fully automatic.
const mountWidget = (props) => mount(WeatherWidget, { props })

describe('WeatherWidget', () => {
  it('kode 0 (cerah) menampilkan matahari tanpa awan depan atau hujan', () => {
    const wrapper = mountWidget({ code: 0, isDay: true })

    expect(wrapper.classes()).toContain('weather-widget--clear')
    expect(wrapper.find('.weather-widget__sun').exists()).toBe(true)
    expect(wrapper.find('.weather-widget__sun--night').exists()).toBe(false)
    expect(wrapper.find('.weather-widget__cloud--front').exists()).toBe(false)
    expect(wrapper.find('.weather-widget__rain').exists()).toBe(false)
    expect(wrapper.find('.weather-widget__bolt').exists()).toBe(false)
  })

  it('kode berawan + malam menampilkan awan depan dan bulan', () => {
    const wrapper = mountWidget({ code: 45, isDay: false })

    expect(wrapper.classes()).toContain('weather-widget--cloudy')
    expect(wrapper.find('.weather-widget__cloud--front').exists()).toBe(true)
    expect(wrapper.find('.weather-widget__sun--night').exists()).toBe(true)
    expect(wrapper.vm.condition).toBe('cloudy')
  })

  it('kode hujan menampilkan lima tetes air', () => {
    const wrapper = mountWidget({ code: 61, isDay: true })

    expect(wrapper.classes()).toContain('weather-widget--rain')
    expect(wrapper.findAll('.weather-widget__rain line')).toHaveLength(5)
    expect(wrapper.find('.weather-widget__snow').exists()).toBe(false)
  })

  it('kode salju menampilkan kepingan salju', () => {
    const wrapper = mountWidget({ code: 75, isDay: true })

    expect(wrapper.classes()).toContain('weather-widget--snow')
    expect(wrapper.findAll('.weather-widget__snow circle')).toHaveLength(5)
    expect(wrapper.find('.weather-widget__rain').exists()).toBe(false)
  })

  it('kode badai menampilkan petir + hujan', () => {
    const wrapper = mountWidget({ code: 95, isDay: true })

    expect(wrapper.classes()).toContain('weather-widget--thunder')
    expect(wrapper.find('.weather-widget__bolt').exists()).toBe(true)
    expect(wrapper.findAll('.weather-widget__rain line')).toHaveLength(5)
    expect(wrapper.vm.condition).toBe('thunder')
  })

  it('ukuran widget mengikuti prop size', () => {
    const wrapper = mountWidget({ code: 0, size: 48 })

    expect(wrapper.attributes('style')).toContain('width: 48px')
    expect(wrapper.attributes('style')).toContain('height: 48px')
  })
})
