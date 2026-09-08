<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div class="fixed inset-0 z-100 flex items-center justify-center px-4">
        <!-- Blurred backdrop — intentionally not clickable, this dialog can't be dismissed -->
        <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" />

        <div class="relative w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-xl p-5">
          <h3 class="text-sm font-bold text-gray-900">Ganti password default</h3>
          <p class="text-xs text-gray-500 mt-2 leading-relaxed">
            Akun kamu masih memakai password default. Buat password baru milikmu sendiri sebelum melanjutkan.
          </p>

          <form @submit.prevent="handleSubmit" class="mt-4 space-y-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Password saat ini</label>
              <div class="pwBx">
                <input
                  v-model="form.currentPassword"
                  :type="showCurrent ? 'text' : 'password'"
                  required
                  autocomplete="current-password"
                  class="w-full px-3 py-1.5 pr-8 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f8cd5]/30 focus:border-[#0f8cd5] transition"
                />
                <button type="button" class="eyeToggle" tabindex="-1" @click="showCurrent = !showCurrent">
                  <EyeOffIcon v-if="showCurrent" :size="15" />
                  <EyeIcon v-else :size="15" />
                </button>
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Password baru</label>
              <div class="pwBx">
                <input
                  v-model="form.newPassword"
                  :type="showNew ? 'text' : 'password'"
                  required
                  minlength="8"
                  autocomplete="new-password"
                  class="w-full px-3 py-1.5 pr-8 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f8cd5]/30 focus:border-[#0f8cd5] transition"
                />
                <button type="button" class="eyeToggle" tabindex="-1" @click="showNew = !showNew">
                  <EyeOffIcon v-if="showNew" :size="15" />
                  <EyeIcon v-else :size="15" />
                </button>
              </div>
              <p class="text-[11px] text-gray-400 mt-1">Minimal 8 karakter.</p>

              <!-- password strength indicator -->
              <div v-if="form.newPassword" class="space-y-1 mt-1.5">
                <div class="flex gap-1">
                  <div
                    v-for="i in 4"
                    :key="i"
                    class="h-1 flex-1 rounded-full transition-colors duration-300"
                    :class="strengthBarColor(i)"
                  ></div>
                </div>
                <p class="text-xs transition-colors duration-300" :class="strengthTextColor">{{ strengthLabel }}</p>
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Konfirmasi password baru</label>
              <div class="pwBx">
                <input
                  v-model="form.confirmPassword"
                  :type="showConfirm ? 'text' : 'password'"
                  required
                  autocomplete="new-password"
                  class="w-full px-3 py-1.5 pr-8 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f8cd5]/30 focus:border-[#0f8cd5] transition"
                />
                <button type="button" class="eyeToggle" tabindex="-1" @click="showConfirm = !showConfirm">
                  <EyeOffIcon v-if="showConfirm" :size="15" />
                  <EyeIcon v-else :size="15" />
                </button>
              </div>
            </div>

            <p v-if="errorMsg" class="text-xs text-red-500">{{ errorMsg }}</p>

            <button
              type="submit"
              :disabled="loading"
              class="changePwSubmit w-full py-2 rounded-lg bg-[#0f8cd5] text-white text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            >
              {{ loading ? 'Menyimpan...' : 'Simpan password baru' }}
            </button>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import EyeIcon from '@/components/icons/EyeIcon.vue'
import EyeOffIcon from '@/components/icons/EyeOffIcon.vue'

const authStore = useAuthStore()

const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const loading = ref(false)
const errorMsg = ref('')

const showCurrent = ref(false)
const showNew = ref(false)
const showConfirm = ref(false)

// password strength: score 1-4, same as the reference
const passwordStrength = computed(() => {
  const p = form.newPassword
  if (!p) return 0
  let score = 0
  if (p.length >= 6) score++
  if (p.length >= 10) score++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++
  if (/[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)) score++
  return score
})

const strengthLabel = computed(() => {
  const labels = ['', 'Lemah', 'Cukup', 'Kuat', 'Sangat Kuat']
  return labels[passwordStrength.value] || ''
})

const strengthTextColor = computed(() => ({
  'text-[#EA4335]': passwordStrength.value === 1,
  'text-[#FBBC05]': passwordStrength.value === 2,
  'text-[#34A853]': passwordStrength.value >= 3,
}))

function strengthBarColor(index) {
  if (index > passwordStrength.value) return 'bg-gray-200'
  const colors = {
    1: 'bg-[#EA4335]',
    2: 'bg-[#FBBC05]',
    3: 'bg-[#34A853]',
    4: 'bg-[#34A853]',
  }
  return colors[passwordStrength.value] || 'bg-gray-200'
}

async function handleSubmit() {
  errorMsg.value = ''

  if (form.newPassword !== form.confirmPassword) {
    errorMsg.value = 'Konfirmasi password baru tidak cocok.'
    return
  }
  if (form.newPassword === form.currentPassword) {
    errorMsg.value = 'Password baru harus berbeda dari password saat ini.'
    return
  }

  loading.value = true
  try {
    await authStore.changePassword(form.currentPassword, form.newPassword)
    // authStore.mustChangePassword is now false — the parent watching it
    // will close this modal automatically, nothing else to do here.
  } catch (e) {
    errorMsg.value = e.response?.data?.error || 'Gagal mengganti password. Coba lagi.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity 0.15s ease;
}
.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
}

.pwBx {
  position: relative;
  width: 100%;
}
.eyeToggle {
  position: absolute;
  right: 0.55rem;
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

/* Button submit */
.changePwSubmit {
  background: linear-gradient(45deg, #0f8cd5, #38bdf8);
  background-size: 200% 200%;
  background-position: 0% 50%;
  transition: background-position 0.5s ease, transform 0.15s ease, box-shadow 0.3s ease;
}
.changePwSubmit:hover:not(:disabled) {
  background-position: 100% 50%;
  box-shadow: 0 4px 14px rgba(15, 140, 213, 0.35);
}
.changePwSubmit:active:not(:disabled) {
  transform: translateY(0);
}
</style>