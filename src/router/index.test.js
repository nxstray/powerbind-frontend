import { describe, it, expect, vi, beforeEach } from 'vitest'

// Halaman di-mock supaya navigasi guard bisa dites tanpa me-load page asli
// (beserta seluruh dependensinya seperti charts/mermaid yang berat).
vi.mock('@/pages/LoginPage.vue', () => ({ default: { name: 'LoginPage', render: () => null } }))
vi.mock('@/pages/DashboardPage.vue', () => ({
  default: { name: 'DashboardPage', render: () => null },
}))
vi.mock('@/pages/AgentPage.vue', () => ({ default: { name: 'AgentPage', render: () => null } }))
vi.mock('@/pages/ErdPage.vue', () => ({ default: { name: 'ErdPage', render: () => null } }))
vi.mock('@/pages/LogPage.vue', () => ({ default: { name: 'LogPage', render: () => null } }))

import router from '@/router'

// Helper: bikin JWT dummy dengan payload role tertentu (base64url sederhana,
// signature diabaikan karena guard cuma decode payload).
function makeToken(role) {
  const payload = btoa(JSON.stringify({ sub: 'user', role })).replace(/=+$/, '')
  return `header.${payload}.signature`
}

async function visit(path) {
  await router.push(path)
  return router.currentRoute.value.name
}

describe('router guard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('route requiresAuth tanpa token → diarahkan ke login', async () => {
    expect(await visit('/agent')).toBe('login')
  })

  it('route requiresAuth dengan token → boleh masuk', async () => {
    localStorage.setItem('accessToken', makeToken('ADMIN'))

    expect(await visit('/agent')).toBe('agent')
  })

  it('route guest (login) dengan token masih ada → diarahkan ke dashboard', async () => {
    localStorage.setItem('accessToken', makeToken('USER'))

    expect(await visit('/login')).toBe('dashboard')
  })

  it('route guest (login) tanpa token → tetap di login', async () => {
    expect(await visit('/login')).toBe('login')
  })

  it('route requiresAdmin dengan role bukan ADMIN → diarahkan ke dashboard', async () => {
    localStorage.setItem('accessToken', makeToken('USER'))

    expect(await visit('/erd')).toBe('dashboard')
    expect(await visit('/log')).toBe('dashboard')
  })

  it('route requiresAdmin dengan role ADMIN → boleh masuk', async () => {
    localStorage.setItem('accessToken', makeToken('ADMIN'))

    expect(await visit('/erd')).toBe('erd')
    expect(await visit('/log')).toBe('log')
  })

  it('route requiresAdmin dengan token rusak (role tidak terbaca) → diarahkan ke dashboard', async () => {
    localStorage.setItem('accessToken', 'token-rusak')

    expect(await visit('/erd')).toBe('dashboard')
  })

  it('dashboard (/) dengan token → masuk', async () => {
    localStorage.setItem('accessToken', makeToken('USER'))

    expect(await visit('/')).toBe('dashboard')
  })

  it('dashboard (/) tanpa token → diarahkan ke login', async () => {
    // Router masih berada di '/' dari test sebelumnya; push('/') ke lokasi
    // yang sama akan di-abort sebagai duplicated navigation sehingga guard
    // tidak jalan. Paksa pindah ke '/login' dulu supaya navigasi berikutnya
    // benar-benar dieksekusi.
    await router.push('/login')

    expect(await visit('/')).toBe('login')
  })
})
