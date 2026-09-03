<template>
  <div class="min-h-screen flex items-center justify-center bg-[#f5f5f0] overflow-hidden">
    <div class="ring">
      <i style="--clr:#0f172a;"></i>
      <i style="--clr:#0f8cd5;"></i>
      <i style="--clr:#f97316;"></i>

      <!-- Card: Only input box -->
      <div class="w-75 flex flex-col items-center gap-5">
        <img src="/favicon.ico" alt="Powerbind" class="w-10 h-10" />

        <form @submit.prevent="handleLogin" class="w-full flex flex-col gap-4">
          <div class="inputBx">
            <input
              v-model="form.username"
              type="text"
              placeholder="Username"
              required
            />
          </div>

          <div class="inputBx">
            <input
              v-model="form.password"
              type="password"
              placeholder="Password"
              required
            />
          </div>

          <p v-if="errorMsg" class="text-xs text-red-500 text-center -mt-1">{{ errorMsg }}</p>

          <div class="inputBx">
            <input
              type="submit"
              :value="loading ? 'Signing in...' : 'Sign in'"
              :disabled="loading"
            />
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

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

<style scoped>
.ring {
  position: relative;
  width: 420px;
  height: 420px;
  display: flex;
  justify-content: center;
  align-items: center;
}
.ring i {
  position: absolute;
  inset: 0;
  border: 2px solid #d1d5db;
  transition: border 0.5s, filter 0.5s;
}
.ring i:nth-child(1) {
  border-radius: 38% 62% 63% 37% / 41% 44% 56% 59%;
  animation: spin 6s linear infinite;
}
.ring i:nth-child(2) {
  border-radius: 41% 44% 56% 59% / 38% 62% 63% 37%;
  animation: spin 4s linear infinite;
}
.ring i:nth-child(3) {
  border-radius: 41% 44% 56% 59% / 38% 62% 63% 37%;
  animation: spinReverse 10s linear infinite;
}
.ring:hover i {
  border: 4px solid var(--clr);
  filter: drop-shadow(0 0 16px var(--clr));
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes spinReverse {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

.inputBx {
  position: relative;
  width: 100%;
}
.inputBx input {
  width: 100%;
  padding: 0.65rem 1.1rem;
  background: white;
  border: 1.5px solid #e5e7eb;
  border-radius: 0.75rem;
  font-size: 0.9rem;
  color: #111827;
  outline: none;
  transition: 0.2s;
}
.inputBx input:focus {
  border-color: #0f8cd5;
  box-shadow: 0 0 0 3px rgba(15, 140, 213, 0.15);
}
.inputBx input::placeholder {
  color: #9ca3af;
}
.inputBx input[type='submit'] {
  cursor: pointer;
  border: none;
  color: white;
  font-weight: 600;
  background: linear-gradient(45deg, #0f8cd5, #38bdf8);
  text-align: center;
}
.inputBx input[type='submit']:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>