<template>
  <div class="min-h-screen flex items-center justify-center bg-[#f5f5f0]">
    <div class="w-full max-w-md">
      <!-- Logo / Title -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#0f8cd5] mb-4">
          <BoltIcon :size="22" class="text-white" />
        </div>
        <h1 class="text-2xl font-semibold text-gray-900">Powerbind</h1>
        <p class="text-sm text-gray-500 mt-1">Smart Home Monitoring</p>
      </div>

      <!-- Card -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-6">Sign in</h2>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <!-- Username -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
            <input
              v-model="form.username"
              type="text"
              placeholder="admin"
              required
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f8cd5]/30 focus:border-[#0f8cd5] transition"
            />
          </div>

          <!-- Password -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <input
              v-model="form.password"
              type="password"
              placeholder="••••••••"
              required
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f8cd5]/30 focus:border-[#0f8cd5] transition"
            />
          </div>

          <!-- Error -->
          <p v-if="errorMsg" class="text-sm text-red-500">{{ errorMsg }}</p>

          <!-- Submit -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2.5 rounded-lg bg-[#0f8cd5] text-white text-sm font-medium hover:bg-[#0d7ec0] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {{ loading ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import BoltIcon from '@/components/icons/BoltIcon.vue'

const router = useRouter()
const authStore = useAuthStore()

const form = ref({ username: '', password: '' })
const loading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  loading.value = true
  errorMsg.value = ''
  try {
    await authStore.login(form.value.username, form.value.password)
    router.push({ name: 'dashboard' })
  } catch (e) {
    const msg = e.response?.data?.error
    if (e.response?.status === 429) {
      errorMsg.value = msg || 'Too many attempts. Please try again later.'
    } else {
      errorMsg.value = msg || 'Invalid username or password.'
    }
  } finally {
    loading.value = false
  }
}
</script>