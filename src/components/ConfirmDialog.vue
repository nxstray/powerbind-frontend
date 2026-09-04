<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div v-if="open" class="fixed inset-0 z-100 flex items-center justify-center px-4">
        <!-- Blurred backdrop -->
        <div
          class="absolute inset-0 bg-black/30 backdrop-blur-sm"
          @click="!loading && $emit('cancel')"
        />

        <!-- Dialog -->
        <div class="relative w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-xl p-5">
          <h3 class="text-sm font-bold text-gray-900">{{ title }}</h3>
          <p class="text-xs text-gray-500 mt-2 leading-relaxed">{{ message }}</p>

          <div class="flex items-center justify-end gap-2 mt-5">
            <button
              type="button"
              :disabled="loading"
              @click="$emit('cancel')"
              class="px-3.5 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
            >
              {{ cancelText }}
            </button>
            <button
              type="button"
              :disabled="loading"
              @click="$emit('confirm')"
              :class="danger ? 'bg-red-500 hover:bg-red-600' : 'bg-[#0f8cd5] hover:bg-[#0d7ec0]'"
              class="px-3.5 py-2 rounded-lg text-xs font-medium text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {{ loading ? 'Memproses...' : confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
// Generic confirmation dialog — centered, blurred backdrop, no icons/emoji.
// Used for anything destructive or hard-to-undo: turning off a device,
// logging out, deleting a conversation, etc.
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: 'Konfirmasi' },
  message: { type: String, default: 'Apakah kamu yakin?' },
  confirmText: { type: String, default: 'Ya' },
  cancelText: { type: String, default: 'Batal' },
  danger: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})

defineEmits(['confirm', 'cancel'])
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