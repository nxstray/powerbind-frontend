<template>
  <div class="flex items-center justify-center my-2">
    <div class="relative" :style="{ width: size + 'px', height: size + 'px' }">
      <canvas ref="canvas" :style="{ width: size + 'px', height: size + 'px' }" />
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <p class="font-bold text-gray-900" :style="{ fontSize: size * 0.18 + 'px' }">{{ kwh.toFixed(1) }}</p>
        <p class="text-gray-400" :style="{ fontSize: size * 0.1 + 'px' }">kWh</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  kwh:    { type: Number, default: 0 },
  maxKwh: { type: Number, default: 10 },
  size:   { type: Number, default: 160 },
})

const canvas = ref(null)

function draw() {
  const el = canvas.value
  if (!el) return

  const dpr = window.devicePixelRatio || 1
  const s = props.size
  el.width  = s * dpr
  el.height = s * dpr

  const ctx = el.getContext('2d')
  ctx.scale(dpr, dpr)

  const cx = s / 2
  const cy = s / 2
  const radius    = s * 0.38
  const lineWidth = s * 0.1
  const startAngle = -Math.PI / 2
  const ratio = Math.min(props.kwh / props.maxKwh, 1)

  // Background track
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.strokeStyle = '#f0f0ee'
  ctx.lineWidth = lineWidth
  ctx.stroke()

  // Gradient fill
  if (ratio > 0) {
    const grad = ctx.createLinearGradient(0, 0, s, s)
    grad.addColorStop(0, '#7ADAA5')
    grad.addColorStop(1, '#0f8cd5')

    ctx.beginPath()
    ctx.arc(cx, cy, radius, startAngle, startAngle + ratio * Math.PI * 2)
    ctx.strokeStyle = grad
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.stroke()
  }
}

onMounted(draw)
watch(() => [props.kwh, props.maxKwh, props.size], draw)
</script>