<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-100 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
      <TransitionGroup name="toast-fade">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="bg-white rounded-xl border border-amber-200 shadow-lg p-4 flex items-start gap-3"
        >
          <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <span class="text-amber-500 text-sm font-bold">!</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900">Pemborosan energi terdeteksi</p>
            <p class="text-xs text-gray-500 mt-0.5">{{ toast.message }}</p>
          </div>
          <button
            type="button"
            @click="$emit('dismiss', toast.id)"
            class="text-gray-300 hover:text-gray-500 transition shrink-0"
          >
            <CloseIcon :size="14" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import CloseIcon from '@/components/icons/CloseIcon.vue'

defineProps({
  toasts: { type: Array, default: () => [] }, // [{ id, message }]
})
defineEmits(['dismiss'])
</script>

<style scoped>
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.2s ease;
}
.toast-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.toast-fade-leave-to {
  opacity: 0;
}
</style>