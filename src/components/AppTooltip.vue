<template>
  <div class="relative inline-flex group/tooltip">
    <slot />
    <span
      v-if="text"
      class="pointer-events-none absolute z-50 whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 scale-95 shadow-lg transition-all duration-200 ease-out group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100"
      :class="positionClass"
    >
      {{ text }}
      <span class="absolute w-1.5 h-1.5 bg-gray-900 rotate-45" :class="arrowClass" />
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
  position: { type: String, default: 'top' }, // top | bottom | right
})

const positionClass = computed(() => {
  switch (props.position) {
    case 'right':
      return 'left-full top-1/2 -translate-y-1/2 ml-2 -translate-x-1 group-hover/tooltip:translate-x-0'
    case 'bottom':
      return 'top-full left-1/2 -translate-x-1/2 mt-2 translate-y-1 group-hover/tooltip:translate-y-2'
    default: // top
      return 'bottom-full left-1/2 -translate-x-1/2 mb-2 translate-y-1 group-hover/tooltip:translate-y-0'
  }
})

const arrowClass = computed(() => {
  switch (props.position) {
    case 'right':
      return 'left-[-3px] top-1/2 -translate-y-1/2'
    case 'bottom':
      return 'top-[-3px] left-1/2 -translate-x-1/2'
    default:
      return 'top-full left-1/2 -translate-x-1/2 -mt-[3px]'
  }
})
</script>