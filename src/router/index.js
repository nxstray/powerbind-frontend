import { createRouter, createWebHistory } from 'vue-router'
import { getRoleFromToken } from '@/utils/jwt'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { guest: true },
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/pages/DashboardPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/agent/:id?',
      name: 'agent',
      component: () => import('@/pages/AgentPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/erd',
      name: 'erd',
      component: () => import('@/pages/ErdPage.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/log',
      name: 'log',
      component: () => import('@/pages/LogPage.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/metrics',
      name: 'metrics',
      component: () => import('@/pages/MetricsPage.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('accessToken')
  if (to.meta.requiresAuth && !token) return { name: 'login' }
  if (to.meta.guest && token) return { name: 'dashboard' }

  // Admin-only pages (ERD, Log) — role comes straight off the JWT so this
  // works even on a hard refresh, before authStore.user has been fetched.
  if (to.meta.requiresAdmin && getRoleFromToken(token) !== 'ADMIN') {
    return { name: 'dashboard' }
  }
})

export default router