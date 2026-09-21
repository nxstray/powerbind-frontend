import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

import ConfirmDialog from '@/components/ConfirmDialog.vue'

// ConfirmDialog renders via <Teleport to="body"> — attach to the document body
// so the teleported DOM exists and clicks can be dispatched on real elements.
let wrapper

function mountDialog(props = {}) {
  wrapper = mount(ConfirmDialog, {
    attachTo: document.body,
    props: { open: true, ...props },
  })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('ConfirmDialog', () => {
  it('tidak me-render apa pun saat open=false', () => {
    wrapper = mount(ConfirmDialog, { attachTo: document.body, props: { open: false } })

    expect(document.body.querySelector('h3')).toBeNull()
  })

  it('me-render title, message, dan teks tombol (default Ya/Batal)', () => {
    mountDialog({ title: 'Matikan relay?', message: 'Daya ke ruang tamu akan diputus.' })

    expect(document.body.querySelector('h3').textContent).toBe('Matikan relay?')
    expect(document.body.textContent).toContain('Daya ke ruang tamu akan diputus.')
    const buttons = Array.from(document.body.querySelectorAll('button'))
    expect(buttons.map((b) => b.textContent.trim())).toEqual(['Batal', 'Ya'])
  })

  it('klik Batal meng-emit cancel', async () => {
    mountDialog()
    const [cancelBtn] = document.body.querySelectorAll('button')
    cancelBtn.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('klik Ya meng-emit confirm', async () => {
    mountDialog()
    const [, confirmBtn] = document.body.querySelectorAll('button')
    confirmBtn.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  it('klik backdrop meng-emit cancel (modal bisa ditutup dari luar)', async () => {
    mountDialog()
    const backdrop = document.body.querySelector('.backdrop-blur-sm')
    backdrop.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('varian danger memakai tombol merah', () => {
    mountDialog({ danger: true })

    const confirmBtn = document.body.querySelectorAll('button')[1]
    expect(confirmBtn.className).toContain('bg-red-500')
  })

  it('varian normal memakai tombol biru', () => {
    mountDialog()

    const confirmBtn = document.body.querySelectorAll('button')[1]
    expect(confirmBtn.className).toContain('bg-[#0f8cd5]')
  })

  it('loading: kedua tombol disabled dan label confirm jadi "Memproses..."', async () => {
    mountDialog({ loading: true })
    const buttons = Array.from(document.body.querySelectorAll('button'))

    expect(buttons.map((b) => b.disabled)).toEqual([true, true])
    expect(buttons[1].textContent.trim()).toBe('Memproses...')

    // Interaksi diblokir: klik backdrop saat loading TIDAK meng-emit cancel
    document.body.querySelector('.backdrop-blur-sm').click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })
})
