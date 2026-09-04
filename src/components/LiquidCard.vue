<template>
  <div class="liquid-card" :class="{ 'dark-card': dark }" :style="{ '--liquid-color': color }">
    <!-- Liquid animation container -->
    <div class="liquid-head">
      <!-- The wave is the liquid itself, drooping downward -->
      <div class="wave wave-back"></div>
      <div class="wave wave-front"></div>
    </div>

    <!-- Card content on top of liquid -->
    <div class="card-content">
      <div class="flex items-center justify-between mb-2 md:mb-3">
        <span class="label">{{ label }}</span>
        <div class="icon-wrap" :style="{ backgroundColor: color + '30' }">
          <slot />
        </div>
      </div>
      <p class="value">{{ value }}</p>
      <p class="sub">{{ sub }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label:  { type: String, required: true },
  value:  { type: [String, Number], required: true },
  sub:    { type: String, default: '' },
  color:  { type: String, default: '#0f8cd5' },
  // 0-100 fill level percentage
  fill:   { type: Number, default: 40 },
  dark:   { type: Boolean, default: false },
})

// New logic: top 100% = water at the bottom (empty). top 0% = water full at the top.
// If fill is 40%, the top position is 60% (leaving 40% of space below)
const liquidTop = computed(() => {
  if (props.fill <= 0) return '150%' // Push the wave far down when fill is 0
  const clamped = Math.min(100, Math.max(0, props.fill))
  return `${100 - clamped}%`
})

// Hover effect: water rises slightly by 10%
const hoverTop = computed(() => {
  if (props.fill <= 0) return '150%' // Keep it hidden on hover when fill is 0
  const clamped = Math.min(100, Math.max(0, props.fill))
  return `${Math.max(-10, 90 - clamped)}%`
})
</script>

<style scoped>
.liquid-card {
  position: relative;
  border-radius: 1rem;
  overflow: hidden; /* Very important to clip the overflowing water */
  background: white;
  border: 1px solid #f3f4f6;
  padding: 1rem 1.25rem;
  cursor: default;
  transition: all 0.3s ease;
}

/* Water container */
.liquid-head {
  position: absolute;
  inset: 0;
  z-index: 1;
}

/* POSITIVE WAVE TECHNIQUE */
/* This object IS the water. It's huge (600px) so it can cover the 
   entire bottom of the card, no matter how wide the card is */
.wave {
  position: absolute;
  width: 600px;
  height: 600px;
  left: 50%;
  margin-left: -300px; /* Center horizontally */
  top: v-bind(liquidTop); /* Water surface height */
  transition: top 1.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Back wave (more faded) */
.wave-back {
  background-color: color-mix(in srgb, var(--liquid-color) 15%, transparent);
  border-radius: 40%;
  animation: spin 7s linear infinite;
}

/* Front wave (more visible and spins in the opposite direction) */
.wave-front {
  background-color: color-mix(in srgb, var(--liquid-color) 25%, transparent);
  border-radius: 42%;
  animation: spin 10s linear infinite reverse;
}

/* Hover: water surface rises */
.liquid-card:hover .wave {
  top: v-bind(hoverTop);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Content sits above liquid */
.card-content {
  position: relative;
  z-index: 10;
}

.label {
  font-size: 10px;
  font-weight: 500;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.icon-wrap {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.1;
  margin-top: 0.5rem;
}

.sub {
  font-size: 10px;
  color: #9ca3af;
  margin-top: 0.25rem;
}

/* =========================================
   DARK VARIANT (POWER CARD)
   ========================================= */
.liquid-card.dark-card {
  background: var(--liquid-color);
  border-color: transparent;
}

/* In dark mode, the waves use a transparent white color */
.liquid-card.dark-card .wave-back {
  background-color: rgba(255, 255, 255, 0.1);
}
.liquid-card.dark-card .wave-front {
  background-color: rgba(255, 255, 255, 0.15);
}

.liquid-card.dark-card .label { color: rgba(255,255,255,0.7); }
.liquid-card.dark-card .value { color: white; }
.liquid-card.dark-card .sub   { color: rgba(255,255,255,0.6); }

@media (min-width: 768px) {
  .liquid-card { padding: 1.25rem; }
  .label { font-size: 11px; }
  .value { font-size: 2rem; }
  .icon-wrap { width: 32px; height: 32px; border-radius: 12px; }
}
</style>