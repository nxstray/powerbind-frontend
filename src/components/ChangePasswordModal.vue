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
              <input
                v-model="form.currentPassword"
                type="password"
                required
                autocomplete="current-password"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f8cd5]/30 focus:border-[#0f8cd5] transition"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Password baru</label>
              <input
                v-model="form.newPassword"
                type="password"
                required
                minlength="8"
                autocomplete="new-password"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f8cd5]/30 focus:border-[#0f8cd5] transition"
              />
              <p class="text-[11px] text-gray-400 mt-1">Minimal 8 karakter.</p>
            </div>

            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Konfirmasi password baru</label>
              <input
                v-model="form.confirmPassword"
                type="password"
                required
                autocomplete="new-password"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f8cd5]/30 focus:border-[#0f8cd5] transition"
              />
            </div>

            <p v-if="errorMsg" class="text-xs text-red-500">{{ errorMsg }}</p>

            <button
              type="submit"
              :disabled="loading"
              class="w-full py-2.5 rounded-lg bg-[#0f8cd5] text-white text-sm font-medium hover:bg-[#0d7ec0] transition disabled:opacity-60 disabled:cursor-not-allowed mt-1"
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
import { reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()

const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const loading = ref(false)
const errorMsg = ref('')

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
</style>