<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :class="className"
  >
    <!-- Roof path -->
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <!-- Door polyline: adding origin-bottom and group-hover scaling to simulate opening -->
    <polyline 
      points="9 22 9 12 15 12 15 22" 
      class="origin-bottom transition-transform duration-300 group-hover:scale-y-50 group-hover:stroke-sky-200" 
    />
  </svg>
</template>

<script setup>
defineProps({
  size: { type: [String, Number], default: 24 },
  className: { type: String, default: '' },
})
</script>