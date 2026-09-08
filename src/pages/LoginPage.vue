<template>
  <div class="min-h-screen flex items-center justify-center bg-[#f5f5f0] overflow-hidden">
    <div class="loginRing">
      <i style="--clr:#0f172a;"></i>
      <i style="--clr:#0f8cd5;"></i>
      <i style="--clr:#f97316;"></i>

      <!-- Card: Only input box -->
      <div class="w-66 flex flex-col items-center gap-4">
        <img src="/favicon.ico" alt="Powerbind" class="w-10 h-10" />

        <form @submit.prevent="handleLogin" class="w-full flex flex-col gap-3">
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
              :type="showPassword ? 'text' : 'password'"
              placeholder="Password"
              required
              class="pr-9"
            />
            <button
              type="button"
              class="eyeToggle"
              tabindex="-1"
              @click="showPassword = !showPassword"
              :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
            >
              <EyeOffIcon v-if="showPassword" :size="16" />
              <EyeIcon v-else :size="16" />
            </button>
          </div>

          <p v-if="errorMsg" class="text-xs text-red-500 text-center -mt-1">{{ errorMsg }}</p>

          <!-- Was an <input type="submit"> whose value just swapped to the text
               "Sedang masuk" — switched to a <button> so a real animated
               loading indicator (3-dot pulse) can render in its place instead
               of static text. -->
          <div class="inputBx">
            <button type="submit" class="submitBtn" :disabled="loading">
              <span v-if="!loading">Masuk</span>
              <span v-else class="loadingDots" aria-label="Sedang masuk">
                <span></span><span></span><span></span>
              </span>
            </button>
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
import EyeIcon from '@/components/icons/EyeIcon.vue'
import EyeOffIcon from '@/components/icons/EyeOffIcon.vue'

const router = useRouter()
const authStore = useAuthStore()

const form = ref({ username: '', password: '' })
const loading = ref(false)
const errorMsg = ref('')
const showPassword = ref(false)

async function handleLogin() {
  loading.value = true
  errorMsg.value = ''
  try {
    await authStore.login(form.value.username, form.value.password)
    router.push({ name: 'dashboard' })
  } catch (e) {
    const msg = e.response?.data?.error
    if (e.response?.status === 429) {
      errorMsg.value = msg || 'Terlalu banyak percobaan. Coba lagi nanti.'
    } else {
      errorMsg.value = msg || 'Username atau password salah.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.loginRing {
  position: relative;
  width: 420px;
  height: 420px;
  display: flex;
  justify-content: center;
  align-items: center;
}
.loginRing i {
  position: absolute;
  inset: 0;
  border: 2px solid #d1d5db;
  transition: border 0.5s, filter 0.5s;
}
.loginRing i:nth-child(1) {
  border-radius: 38% 62% 63% 37% / 41% 44% 56% 59%;
  animation: spin 6s linear infinite;
}
.loginRing i:nth-child(2) {
  border-radius: 41% 44% 56% 59% / 38% 62% 63% 37%;
  animation: spin 4s linear infinite;
}
.loginRing i:nth-child(3) {
  border-radius: 41% 44% 56% 59% / 38% 62% 63% 37%;
  animation: spinReverse 10s linear infinite;
}
.loginRing:hover i {
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
  padding: 0.5rem 0.9rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.65rem;
  font-size: 0.85rem;
  color: #111827;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.inputBx input:hover:not(:focus) {
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}
.inputBx input:focus {
  border-color: #0f8cd5;
  box-shadow: 0 0 0 3px rgba(15, 140, 213, 0.15);
}
.inputBx input::placeholder {
  color: #9ca3af;
}

/* Eye toggle button */
.eyeToggle {
  position: absolute;
  right: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  background: transparent;
  border: none;
  padding: 2px;
  cursor: pointer;
  transition: color 0.2s ease;
}
.eyeToggle:hover {
  color: #0f8cd5;
}

/* Sign in button — same look as before, now a <button> instead of
   <input type="submit"> so it can render the loading-dots animation */
.submitBtn {
  width: 100%;
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  border: none;
  border-radius: 0.65rem;
  color: white;
  font-weight: 600;
  font-size: 0.85rem;
  font-family: inherit;
  background: linear-gradient(45deg, #0f8cd5, #38bdf8);
  background-size: 200% 200%;
  background-position: 0% 50%;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 2.1rem;
  transition: background-position 0.5s ease, transform 0.15s ease, box-shadow 0.3s ease;
}
.submitBtn:hover:not(:disabled) {
  background-position: 100% 50%;
  box-shadow: 0 4px 14px rgba(15, 140, 213, 0.35);
}
.submitBtn:active:not(:disabled) {
  transform: translateY(0);
}
.submitBtn:disabled {
  opacity: 0.85;
  cursor: not-allowed;
}

/* Loading dots — the 3-dot pulse animation from the Button State Builder
   codepen (https://codepen.io/Margarita-the-solid/pen/XJpgEXm), adapted here
   to replace the static "Sedang masuk" text. */
.loadingDots {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.loadingDots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.8;
  animation: loginDotPulse 1.1s ease-in-out infinite;
}
.loadingDots span:nth-child(2) {
  animation-delay: 0.18s;
}
.loadingDots span:nth-child(3) {
  animation-delay: 0.36s;
}
@keyframes loginDotPulse {
  0%, 80%, 100% {
    transform: scale(1);
    opacity: 0.4;
  }
  40% {
    transform: scale(1.5);
    opacity: 1;
  }
}
</style>