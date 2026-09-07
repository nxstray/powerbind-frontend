<template>
  <div class="bg-white rounded-2xl border border-gray-100 p-5">
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs font-medium text-gray-500">{{ label }}</span>
      <div
        class="w-8 h-8 rounded-xl flex items-center justify-center"
        :style="{ backgroundColor: color + '20' }"
      >
        <slot />
      </div>
    </div>
    <p class="text-2xl font-bold text-gray-900">{{ value }}</p>
    <p class="text-xs text-gray-400 mt-1">{{ sub }}</p>
  </div>
</template>

<script setup>
defineProps({
  label: String,
  value: [String, Number],
  sub: String,
  color: { type: String, default: '#0f8cd5' },
})
</script>