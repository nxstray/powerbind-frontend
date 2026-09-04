<template>
  <div class="relative" style="height: 200px">
    <canvas ref="chartCanvas" class="w-full h-full" />
    <div
      v-if="!data || data.length === 0"
      class="absolute inset-0 flex items-center justify-center"
    >
      <p class="text-xs text-gray-400">No data available</p>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  data: {
    type: Array,
    default: () => [],
  },
})

const chartCanvas = ref(null)
let animationFrame = null

function drawChart() {
  const canvas = chartCanvas.value
  if (!canvas || !props.data || props.data.length === 0) return

  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()

  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  const W = rect.width
  const H = rect.height
  const padL = 40
  const padR = 16
  const padT = 16
  const padB = 32

  ctx.clearRect(0, 0, W, H)

  const values = props.data.map((d) => d.watts)
  const maxVal = Math.max(...values, 1)
  const minVal = Math.min(...values, 0)
  const range = maxVal - minVal || 1

  const xStep = (W - padL - padR) / Math.max(props.data.length - 1, 1)

  // Grid lines
  ctx.strokeStyle = '#f0f0ee'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = padT + ((4 - i) / 4) * (H - padT - padB)
    ctx.beginPath()
    ctx.moveTo(padL, y)
    ctx.lineTo(W - padR, y)
    ctx.stroke()

    // Y labels
    ctx.fillStyle = '#9ca3af'
    ctx.font = '10px system-ui'
    ctx.textAlign = 'right'
    ctx.fillText(Math.round(minVal + (range * i) / 4) + 'W', padL - 4, y + 3)
  }

  // Gradient fill under line
  const gradient = ctx.createLinearGradient(0, padT, 0, H - padB)
  gradient.addColorStop(0, '#7ADAA540')
  gradient.addColorStop(1, '#7ADAA500')

  ctx.beginPath()
  props.data.forEach((d, i) => {
    const x = padL + i * xStep
    const y = padT + (1 - (d.watts - minVal) / range) * (H - padT - padB)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.lineTo(padL + (props.data.length - 1) * xStep, H - padB)
  ctx.lineTo(padL, H - padB)
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()

  // Line
  ctx.beginPath()
  ctx.strokeStyle = '#7ADAA5'
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  props.data.forEach((d, i) => {
    const x = padL + i * xStep
    const y = padT + (1 - (d.watts - minVal) / range) * (H - padT - padB)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()

  // X labels — show every N labels to avoid crowding
  const labelEvery = Math.ceil(props.data.length / 6)
  ctx.fillStyle = '#9ca3af'
  ctx.font = '10px system-ui'
  ctx.textAlign = 'center'
  props.data.forEach((d, i) => {
    if (i % labelEvery === 0) {
      const x = padL + i * xStep
      ctx.fillText(d.timestamp, x, H - 8)
    }
  })
}

function resizeObserverCallback() {
  cancelAnimationFrame(animationFrame)
  animationFrame = requestAnimationFrame(drawChart)
}

let resizeObserver = null

onMounted(() => {
  resizeObserver = new ResizeObserver(resizeObserverCallback)
  if (chartCanvas.value) {
    resizeObserver.observe(chartCanvas.value.parentElement)
  }
  drawChart()
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
  cancelAnimationFrame(animationFrame)
})

watch(() => props.data, drawChart, { deep: true })
</script>