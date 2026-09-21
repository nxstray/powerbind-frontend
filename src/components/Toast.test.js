import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

import Toast from '@/components/Toast.vue'

// Toast renders via <Teleport to="body"> — mount attached to the document body
// so the teleported DOM actually exists and can be queried.
let wrapper

function mountToast(toasts) {
  wrapper = mount(Toast, {
    attachTo: document.body,
    props: { toasts },
  })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('Toast', () => {
  it('tidak me-render kartu apa pun saat daftar toast kosong', () => {
    mountToast([])

    expect(document.body.querySelectorAll('.bg-white.rounded-xl.border-amber-200')).toHaveLength(0)
  })

  it('me-render satu kartu per toast dengan pesannya', () => {
    mountToast([
      { id: 1, message: 'AC menyala tanpa jadwal' },
      { id: 2, message: 'Daya melebihi batas' },
    ])

    const cards = document.body.querySelectorAll('.bg-white.rounded-xl.border-amber-200')
    expect(cards).toHaveLength(2)
    expect(document.body.textContent).toContain('AC menyala tanpa jadwal')
    expect(document.body.textContent).toContain('Daya melebihi batas')
  })

  it('tombol tutup meng-emit dismiss dengan id toast yang benar', async () => {
    mountToast([{ id: 7, message: 'pesan' }])

    const button = document.body.querySelector('button')
    button.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('dismiss')).toEqual([[7]])
  })

  it('tiap kartu punya tombol tutup sendiri (dismiss per-toast)', async () => {
    mountToast([
      { id: 1, message: 'a' },
      { id: 2, message: 'b' },
    ])

    const buttons = document.body.querySelectorAll('button')
    expect(buttons).toHaveLength(2)
    buttons[1].click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('dismiss')).toEqual([[2]])
  })
})
