import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import ChangePasswordModal from '@/components/ChangePasswordModal.vue'
import { useAuthStore } from '@/stores/authStore'

describe('ChangePasswordModal', () => {
  let wrapper
  let authStore

  beforeEach(() => {
    setActivePinia(createPinia())
    authStore = useAuthStore()
    authStore.mustChangePassword = true
    vi.spyOn(authStore, 'changePassword').mockResolvedValue({})

    wrapper = mount(ChangePasswordModal, {
      attachTo: document.body,
    })
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('tampil jika mustChangePassword bernilai true', () => {
    expect(document.body.textContent).toContain('Ganti password default')
    expect(document.body.querySelector('input#change-pw-current')).not.toBeNull()
  })

  it('tidak me-render apapun jika mustChangePassword bernilai false', async () => {
    authStore.mustChangePassword = false
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('input#change-pw-current')).toBeNull()
  })

  it('menolak submit jika konfirmasi password tidak cocok', async () => {
    const currentInput = document.body.querySelector('#change-pw-current')
    const newInput = document.body.querySelector('#change-pw-new')
    const confirmInput = document.body.querySelector('#change-pw-confirm')
    const form = document.body.querySelector('form')

    currentInput.value = 'default123'
    currentInput.dispatchEvent(new Event('input'))
    newInput.value = 'PasswordBaru1!'
    newInput.dispatchEvent(new Event('input'))
    confirmInput.value = 'BedaPassword!'
    confirmInput.dispatchEvent(new Event('input'))
    await wrapper.vm.$nextTick()

    form.dispatchEvent(new Event('submit'))
    await wrapper.vm.$nextTick()

    expect(document.body.textContent).toContain('Konfirmasi password baru tidak cocok.')
    expect(authStore.changePassword).not.toHaveBeenCalled()
  })

  it('menolak submit jika password baru sama dengan password saat ini', async () => {
    const currentInput = document.body.querySelector('#change-pw-current')
    const newInput = document.body.querySelector('#change-pw-new')
    const confirmInput = document.body.querySelector('#change-pw-confirm')
    const form = document.body.querySelector('form')

    currentInput.value = 'sama12345'
    currentInput.dispatchEvent(new Event('input'))
    newInput.value = 'sama12345'
    newInput.dispatchEvent(new Event('input'))
    confirmInput.value = 'sama12345'
    confirmInput.dispatchEvent(new Event('input'))
    await wrapper.vm.$nextTick()

    form.dispatchEvent(new Event('submit'))
    await wrapper.vm.$nextTick()

    expect(document.body.textContent).toContain('Password baru harus berbeda dari password saat ini.')
    expect(authStore.changePassword).not.toHaveBeenCalled()
  })

  it('memanggil authStore.changePassword dan menampilkan pesan error jika gagal', async () => {
    authStore.changePassword.mockRejectedValueOnce({
      response: { data: { error: 'Password saat ini salah.' } },
    })

    const currentInput = document.body.querySelector('#change-pw-current')
    const newInput = document.body.querySelector('#change-pw-new')
    const confirmInput = document.body.querySelector('#change-pw-confirm')
    const form = document.body.querySelector('form')

    currentInput.value = 'default123'
    currentInput.dispatchEvent(new Event('input'))
    newInput.value = 'PasswordKuat123!'
    newInput.dispatchEvent(new Event('input'))
    confirmInput.value = 'PasswordKuat123!'
    confirmInput.dispatchEvent(new Event('input'))
    await wrapper.vm.$nextTick()

    form.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(authStore.changePassword).toHaveBeenCalledWith('default123', 'PasswordKuat123!')
    expect(document.body.textContent).toContain('Password saat ini salah.')
  })

  it('toggle visibility password saat tombol mata ditekan', async () => {
    const currentInput = document.body.querySelector('#change-pw-current')
    expect(currentInput.getAttribute('type')).toBe('password')

    const eyeButtons = document.body.querySelectorAll('.eyeToggle')
    eyeButtons[0].click()
    await wrapper.vm.$nextTick()
    expect(currentInput.getAttribute('type')).toBe('text')

    eyeButtons[0].click()
    await wrapper.vm.$nextTick()
    expect(currentInput.getAttribute('type')).toBe('password')
  })
})



