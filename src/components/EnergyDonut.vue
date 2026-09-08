<template>
  <div class="flex items-center justify-center my-2">
    <div class="relative" :style="{ width: size + 'px', height: size + 'px' }">
      <canvas ref="canvas" :style="{ width: size + 'px', height: size + 'px' }" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  kwh:    { type: Number, default: 0 },
  maxKwh: { type: Number, default: 10 },
  size:   { type: Number, default: 160 },
  // When true, ignores kwh/maxKwh and animates the ring from empty to
  // past-full on a loop, purely so the blue -> red full-limit look can be
  // previewed without waiting for real usage data.
  demo:   { type: Boolean, default: false },
})

const canvas = ref(null)

// Current on-screen ratio, eased toward the target ratio every frame so the
// ring sweeps smoothly instead of jumping when kwh changes.
let displayedRatio = 0
let targetRatio = 0
let rafId = null
let demoT = 0

function draw(ratio) {
  const el = canvas.value
  if (!el) return

  const dpr = window.devicePixelRatio || 1
  const s = props.size
  el.width  = s * dpr
  el.height = s * dpr

  const ctx = el.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, s, s)

  const cx = s / 2
  const cy = s / 2
  const radius    = s * 0.36
  const lineWidth = s * 0.28 // thick, solid ring
  const startAngle = -Math.PI / 2
  const clamped = Math.min(ratio, 1)
  const overLimit = ratio >= 1

  // Background track
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.strokeStyle = '#f0f0ee'
  ctx.lineWidth = lineWidth
  ctx.stroke()

  if (clamped <= 0) return

  // Blue -> amber -> red sweep, mapped across the full circle starting at
  // the top so the visible arc always reads blue-to-red as it fills, and
  // the ring is fully red once the daily limit is reached.
  let strokeStyle
  if (typeof ctx.createConicGradient === 'function') {
    const grad = ctx.createConicGradient(startAngle, cx, cy)
    grad.addColorStop(0, '#0f8cd5')
    grad.addColorStop(0.55, '#f59e0b')
    grad.addColorStop(1, '#ef4444')
    strokeStyle = grad
  } else {
    // Fallback for browsers without conic gradient support
    const grad = ctx.createLinearGradient(0, 0, s, s)
    grad.addColorStop(0, '#0f8cd5')
    grad.addColorStop(1, overLimit ? '#ef4444' : '#f59e0b')
    strokeStyle = grad
  }

  ctx.beginPath()
  ctx.arc(cx, cy, radius, startAngle, startAngle + clamped * Math.PI * 2)
  ctx.strokeStyle = overLimit ? '#ef4444' : strokeStyle
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'

  // Soft glow once the daily limit is reached/exceeded
  if (overLimit) {
    ctx.shadowColor = 'rgba(239, 68, 68, 0.55)'
    ctx.shadowBlur = s * 0.08
  } else {
    ctx.shadowBlur = 0
  }

  ctx.stroke()
  ctx.shadowBlur = 0
}

function tick() {
  if (props.demo) demoTick()
  // Ease the displayed ratio toward the target so changes animate smoothly
  displayedRatio += (targetRatio - displayedRatio) * 0.08
  if (!props.demo && Math.abs(targetRatio - displayedRatio) < 0.001) displayedRatio = targetRatio

  draw(displayedRatio)
  rafId = requestAnimationFrame(tick)
}

function updateTarget() {
  if (props.demo) return // demo mode drives its own ratio in tick()
  targetRatio = props.maxKwh > 0 ? props.kwh / props.maxKwh : 0
}

function demoTick() {
  // Sweeps 0 -> ~1.15 (past the daily limit) and loops, so the red
  // full-limit state can be previewed without real data.
  demoT += 0.006
  const wave = (Math.sin(demoT) + 1) / 2 // 0 -> 1 -> 0
  targetRatio = wave * 1.15
}

onMounted(() => {
  updateTarget()
  displayedRatio = targetRatio
  rafId = requestAnimationFrame(tick)
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
})

watch(() => [props.kwh, props.maxKwh, props.demo], updateTarget)
</script>