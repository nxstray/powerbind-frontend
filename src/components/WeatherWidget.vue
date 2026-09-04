<!--
  Animated weather scene for the navbar, adapted from the "Weather" CSS/SVG
  concept (Snap.svg + drifting clouds + rain/snow/lightning) but rebuilt with
  plain SVG + CSS animations only — no jQuery/Snap.svg/GSAP dependency needed
  for a small navbar widget. Fully automatic: driven by the real weather_code
  and is_day values from Open-Meteo for Cileungsi, never by manual buttons.
-->
<template>
  <div class="weather-widget" :class="`weather-widget--${condition}`" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg viewBox="0 0 60 60" class="weather-widget__svg">
      <!-- Sun / moon glow -->
      <circle
        v-if="condition === 'clear' || condition === 'cloudy'"
        class="weather-widget__sun"
        :class="{ 'weather-widget__sun--night': !isDay }"
        cx="30" cy="24" r="11"
      />

      <!-- Clouds — three overlapping puffs that drift left-to-right on a loop -->
      <g class="weather-widget__cloud weather-widget__cloud--back">
        <ellipse cx="18" cy="34" rx="10" ry="7" />
        <ellipse cx="28" cy="30" rx="8" ry="6" />
      </g>
      <g v-if="condition !== 'clear'" class="weather-widget__cloud weather-widget__cloud--front">
        <ellipse cx="34" cy="36" rx="12" ry="8" />
        <ellipse cx="46" cy="33" rx="9" ry="6.5" />
        <ellipse cx="24" cy="38" rx="8" ry="6" />
      </g>

      <!-- Rain drops — only for rain/thunder conditions -->
      <g v-if="condition === 'rain' || condition === 'thunder'" class="weather-widget__rain">
        <line v-for="i in 5" :key="i" :x1="12 + i * 8" y1="42" :x2="10 + i * 8" y2="50" :style="{ animationDelay: `${i * 0.15}s` }" />
      </g>

      <!-- Snow flakes — only for snow condition -->
      <g v-if="condition === 'snow'" class="weather-widget__snow">
        <circle v-for="i in 5" :key="i" :cx="12 + i * 8" cy="44" r="1.3" :style="{ animationDelay: `${i * 0.3}s` }" />
      </g>

      <!-- Lightning flash — only for thunder condition -->
      <polygon
        v-if="condition === 'thunder'"
        class="weather-widget__bolt"
        points="32,32 27,42 30,42 26,50 36,38 32,38 36,32"
      />
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // WMO weather code from Open-Meteo's `current.weather_code`
  code: { type: Number, default: 0 },
  isDay: { type: Boolean, default: true },
  size: { type: Number, default: 32 },
})

// Map the raw WMO code to one of five scene types — this fully drives the
// animation, so the widget always reflects the actual weather automatically.
const condition = computed(() => {
  const c = props.code
  if ([95, 96, 99].includes(c)) return 'thunder'
  if ([71, 73, 75, 77, 85, 86].includes(c)) return 'snow'
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return 'rain'
  if ([1, 2, 3, 45, 48].includes(c)) return 'cloudy'
  return 'clear'
})

defineExpose({ condition })
</script>

<style scoped>
.weather-widget {
  position: relative;
  flex-shrink: 0;
}

.weather-widget__svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

/* Sun / moon */
.weather-widget__sun {
  fill: #fbbf24;
  filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.7));
  animation: weather-sun-pulse 4s ease-in-out infinite;
}
.weather-widget__sun--night {
  fill: #cbd5e1;
  filter: drop-shadow(0 0 3px rgba(203, 213, 225, 0.6));
  animation: none;
}

@keyframes weather-sun-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.06); opacity: 0.9; }
}

/* Clouds drift back and forth in a slow loop */
.weather-widget__cloud ellipse {
  fill: #e5e7eb;
}
.weather-widget__cloud--back ellipse {
  fill: #f1f5f9;
}
.weather-widget__cloud--back {
  animation: weather-cloud-drift-slow 10s ease-in-out infinite;
}
.weather-widget__cloud--front {
  animation: weather-cloud-drift 7s ease-in-out infinite;
}

.weather-widget--rain .weather-widget__cloud ellipse,
.weather-widget--thunder .weather-widget__cloud ellipse {
  fill: #94a3b8;
}
.weather-widget--thunder .weather-widget__cloud--front ellipse {
  fill: #64748b;
}

@keyframes weather-cloud-drift {
  0%, 100% { transform: translateX(-2px); }
  50% { transform: translateX(2px); }
}
@keyframes weather-cloud-drift-slow {
  0%, 100% { transform: translateX(1.5px); }
  50% { transform: translateX(-1.5px); }
}

/* Rain drops fall on a loop */
.weather-widget__rain line {
  stroke: #3b82f6;
  stroke-width: 1.4;
  stroke-linecap: round;
  opacity: 0;
  animation: weather-rain-fall 0.8s linear infinite;
}
@keyframes weather-rain-fall {
  0% { transform: translateY(-4px); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: translateY(6px); opacity: 0; }
}

/* Snow flakes drift down on a loop */
.weather-widget__snow circle {
  fill: #ffffff;
  stroke: #cbd5e1;
  stroke-width: 0.3;
  opacity: 0;
  animation: weather-snow-fall 2.4s linear infinite;
}
@keyframes weather-snow-fall {
  0% { transform: translate(0, -4px); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translate(3px, 10px); opacity: 0; }
}

/* Lightning bolt flashes randomly */
.weather-widget__bolt {
  fill: #fde047;
  filter: drop-shadow(0 0 3px rgba(253, 224, 71, 0.9));
  opacity: 0;
  animation: weather-lightning-flash 3.2s ease-in-out infinite;
}
@keyframes weather-lightning-flash {
  0%, 82%, 88%, 100% { opacity: 0; }
  84%, 86% { opacity: 1; }
}
</style>