import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import RoomCard from '@/components/RoomCard.vue'

const ROOM = {
  id: 1,
  name: 'Ruang Tamu',
  mqttTopic: 'powerbind/room/1',
  relayOn: false,
  presenceDetected: false,
}

const mountCard = (room = ROOM) => mount(RoomCard, { props: { room: { ...room } } })

describe('RoomCard', () => {
  it('menampilkan nama ruangan dan topik MQTT', () => {
    const wrapper = mountCard()

    expect(wrapper.text()).toContain('Ruang Tamu')
    expect(wrapper.text()).toContain('powerbind/room/1')
  })

  it('ruangan kosong menampilkan relay OFF dan status Idle', () => {
    const wrapper = mountCard()

    expect(wrapper.find('.toggle').classes()).not.toContain('toggle-on')
    expect(wrapper.text()).toContain('Idle')
    expect(wrapper.find('.bg-gray-300').exists()).toBe(true)
  })

  it('relay menyala + ada kehadiran menampilkan ON dan Active', () => {
    const wrapper = mountCard({ ...ROOM, relayOn: true, presenceDetected: true })

    expect(wrapper.find('.toggle').classes()).toContain('toggle-on')
    expect(wrapper.text()).toContain('ON')
    expect(wrapper.text()).toContain('Active')
    expect(wrapper.find('.bg-\\[\\#0f8cd5\\]').exists()).toBe(true)
  })

  it('klik toggle saat relay menyala meng-emit request-off', async () => {
    const wrapper = mountCard({ ...ROOM, relayOn: true })

    await wrapper.find('.toggle').trigger('click')

    expect(wrapper.emitted('request-off')[0]).toEqual([expect.objectContaining({ id: 1 })])
    expect(wrapper.emitted('request-on')).toBeUndefined()
  })

  it('klik toggle saat relay mati meng-emit request-on', async () => {
    const wrapper = mountCard()

    await wrapper.find('.toggle').trigger('click')

    expect(wrapper.emitted('request-on')[0]).toEqual([expect.objectContaining({ id: 1 })])
    expect(wrapper.emitted('request-off')).toBeUndefined()
  })
})
