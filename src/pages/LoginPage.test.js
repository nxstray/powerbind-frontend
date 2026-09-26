import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LoginPage from '@/pages/LoginPage.vue'
import { useAuthStore } from '@/stores/authStore'

const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

describe('LoginPage', () => {
  let wrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    pushMock.mockClear()
    localStorage.clear()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('me-render form input username, password, dan tombol submit', () => {
    wrapper = mount(LoginPage)

    expect(wrapper.find('input#login-username').exists()).toBe(true)
    expect(wrapper.find('input#login-password').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').text()).toBe('Masuk')
  })

  it('toggle tombol eye mengubah tipe input password', async () => {
    wrapper = mount(LoginPage)
    const pwInput = wrapper.find('input#login-password')
    const toggleBtn = wrapper.find('.eyeToggle')

    expect(pwInput.attributes('type')).toBe('password')

    await toggleBtn.trigger('click')
    expect(pwInput.attributes('type')).toBe('text')

    await toggleBtn.trigger('click')
    expect(pwInput.attributes('type')).toBe('password')
  })

  it('submit sukses memanggil authStore.login lalu redirect ke dashboard', async () => {
    const authStore = useAuthStore()
    const loginSpy = vi.spyOn(authStore, 'login').mockResolvedValue({})

    wrapper = mount(LoginPage)
    await wrapper.find('input#login-username').setValue('admin')
    await wrapper.find('input#login-password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')

    expect(loginSpy).toHaveBeenCalledWith('admin', 'password123')
    await flushPromises()
    expect(pushMock).toHaveBeenCalledWith({ name: 'dashboard' })
    expect(wrapper.find('.text-red-500').exists()).toBe(false)
  })

  it('submit gagal menampilkan pesan error standar jika bukan rate limit', async () => {
    const authStore = useAuthStore()
    vi.spyOn(authStore, 'login').mockRejectedValue({
      response: {
        status: 401,
        data: { error: 'Username atau password salah.' },
      },
    })

    wrapper = mount(LoginPage)
    await wrapper.find('input#login-username').setValue('admin')
    await wrapper.find('input#login-password').setValue('wrong')
    await wrapper.find('form').trigger('submit.prevent')

    await flushPromises()
    const err = wrapper.find('.text-red-500')
    expect(err.exists()).toBe(true)
    expect(err.text()).toBe('Username atau password salah.')
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('submit gagal dengan status 429 menampilkan pesan rate limit', async () => {
    const authStore = useAuthStore()
    vi.spyOn(authStore, 'login').mockRejectedValue({
      response: {
        status: 429,
        data: {},
      },
    })

    wrapper = mount(LoginPage)
    await wrapper.find('input#login-username').setValue('admin')
    await wrapper.find('input#login-password').setValue('spam')
    await wrapper.find('form').trigger('submit.prevent')

    await flushPromises()
    const err = wrapper.find('.text-red-500')
    expect(err.exists()).toBe(true)
    expect(err.text()).toContain('Terlalu banyak percobaan')
  })
})
