<template>
  <!-- ThinkingKnot: wavy circle logo with 4 pointed lobes + rhombus hole.
       Shape = SVG path from a polar profile, redrawn every frame by a
       single requestAnimationFrame (phases: pointed -> round -> slanted
       point -> rhombus -> spring). Sheen (SMIL) and light dots
       (CSS stroke-dash) are separate overlays. -->
  <div class="thinking-knot" :class="{ 'tk-reduced': reduced }">
    <svg :width="size" :height="size" viewBox="-110 -110 220 220" style="overflow: visible">
      <defs>
        <linearGradient id="ink" gradientUnits="userSpaceOnUse" x1="-80" y1="-80" x2="80" y2="80">
          <stop offset="0" stop-color="#d4d8de" />
          <stop offset="0.5" stop-color="#8b919a" />
          <stop offset="1" stop-color="#3f444c" />
        </linearGradient>
        <linearGradient id="sh" gradientUnits="userSpaceOnUse" x1="-30" y1="-30" x2="30" y2="30">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.6" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
          <animateTransform
            attributeName="gradientTransform"
            type="translate"
            values="-150 -150;150 150;150 150"
            keyTimes="0;.6;1"
            dur="4s"
            repeatCount="indefinite"
          />
        </linearGradient>
        <path ref="orbitSrc" id="orbit" pathLength="100" d="" />
      </defs>

      <g id="logo">
        <!-- 1. body -->
        <path ref="bodyEl" fill-rule="evenodd" fill="url(#ink)" d="" />
        <!-- 2. sheen -->
        <path ref="sheenEl" class="sheen" fill-rule="evenodd" fill="url(#sh)" d="" />
        <!-- 3. outer edge outline -->
        <path
          ref="edgeEl"
          class="tk-stroke"
          fill="none"
          stroke-width="2.4"
          stroke-linejoin="round"
          stroke-linecap="round"
          d=""
        />
        <!-- 4. hole outline (empty when w > .97) -->
        <path
          ref="holeEl"
          class="tk-stroke"
          fill="none"
          stroke-width="2.4"
          stroke-linejoin="round"
          stroke-linecap="round"
          d=""
        />
        <!-- 5. light dots on the outer edge -->
        <g class="orbit">
          <use class="d1 tk-stroke" href="#orbit" fill="none" stroke-linecap="round" />
          <use class="d2 tk-stroke" href="#orbit" fill="none" stroke-linecap="round" />
          <use class="d3 tk-stroke" href="#orbit" fill="none" stroke-linecap="round" />
        </g>
      </g>
    </svg>
  </div>
</template>


<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps({
  // SVG size in px.
  size: { type: Number, default: 30 },
})

const bodyEl = ref(null)
const sheenEl = ref(null)
const edgeEl = ref(null)
const holeEl = ref(null)
const orbitSrc = ref(null)

// ---- Profile data (do not edit) ----
// PO = outer-edge radius, angles 0-89.5 degrees (0.5 step), repeated 4x with 90-degree rotation.
const PO = [88.0,88.0,87.7,87.2,86.1,84.0,81.8,79.5,77.7,75.8,74.1,72.7,71.6,70.7,69.8,68.9,68.0,67.1,66.4,65.7,65.2,64.6,64.0,63.5,62.9,62.5,62.1,61.8,61.4,60.9,60.2,59.2,58.6,58.1,57.7,57.2,57.0,56.7,56.4,56.0,55.8,55.6,55.5,55.5,55.5,55.5,55.5,55.5,55.5,55.5,55.5,55.6,55.5,55.4,55.4,55.3,55.3,55.3,55.2,55.2,55.1,55.1,55.1,55.0,54.9,54.8,54.7,54.6,54.5,54.5,54.4,54.3,54.2,54.0,53.8,53.4,53.2,53.0,52.8,52.5,52.2,52.0,52.0,51.8,51.7,51.7,51.8,51.7,51.7,51.7,51.6,51.5,51.3,51.2,51.0,50.9,50.8,50.7,50.7,50.7,50.8,50.9,51.0,51.1,51.2,51.4,51.5,51.7,51.9,52.1,52.3,52.4,52.6,52.7,52.9,53.0,53.1,53.2,53.3,53.4,53.5,53.6,53.7,53.9,53.9,54.0,53.9,54.0,54.2,54.2,54.3,54.4,54.5,54.5,54.7,54.7,54.8,54.8,55.1,55.2,55.6,56.0,56.6,57.4,58.0,58.3,58.6,58.9,59.3,59.7,60.2,60.8,61.3,61.7,62.0,62.4,62.8,63.4,64.0,64.6,65.2,65.8,66.3,67.0,67.9,68.9,69.8,70.7,71.6,72.7,74.1,75.8,77.8,79.5,81.8,84.2,86.1,87.2,87.7,88.0]
// PH = hole radius, angles 0-89 degrees (1-degree step), repeated 4x with 90-degree rotation.
const PH = [23.2,23.1,23.3,23.4,23.5,23.0,22.4,21.6,21.2,20.7,20.3,19.9,19.6,19.4,19.1,18.9,18.6,18.4,18.2,18.1,17.9,17.7,17.5,17.3,17.2,17.1,17.0,16.9,16.8,16.7,16.6,16.5,16.4,16.3,16.3,16.2,16.2,16.1,16.1,16.1,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.1,16.1,16.2,16.2,16.3,16.4,16.4,16.5,16.5,16.7,16.7,16.8,16.9,17.0,17.2,17.3,17.5,17.6,17.7,17.9,18.1,18.3,18.5,18.7,18.9,19.1,19.4,19.6,19.9,20.1,20.5,20.8,21.1,21.5,21.8,22.2,22.5,22.9,23.3,23.3]


// ---- Core functions ----
const H = Math.PI / 2
const DEG = Math.PI / 180
const RC = 57
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const back = (p) => {
  const c1 = 1.5
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2)
}
const ph2 = (i) => {
  const x = i / 2
  const i0 = Math.floor(x)
  const f = x - i0
  return PH[i0 % 90] * (1 - f) + PH[(i0 + 1) % 90] * f
}
const pr = (x) => {
  x = ((x % 180) + 180) % 180
  const i0 = Math.floor(x)
  const f = x - i0
  return PO[i0] * (1 - f) + PO[(i0 + 1) % 180] * f
}

// m = 0 round / 1 pointed (may exceed 1 because of the spring), q = pointed-tip
// position shift (1 = shift 22.5 degrees clockwise), w = 0 normal /
// 1 solid rhombus only.
function build(m, q, w) {
  let d = ''
  for (let k = 0; k < 4; k++)
    for (let i = 0; i < PO.length; i++) {
      const A = i * 0.5 * DEG + k * H
      const r = (RC + (pr(i - 45 * q) - RC) * m) * (1 - w) + ph2(i) * w
      d += (d ? 'L' : 'M') + (Math.cos(A) * r).toFixed(1) + ' ' + (Math.sin(A) * r).toFixed(1)
    }
  d += 'Z'
  const hs = 1 - w
  let hd = ''
  for (let k = 0; k < 4; k++)
    for (let i = 0; i < PH.length; i++) {
      const A = i * DEG + k * H
      hd += (hd ? 'L' : 'M') + (Math.cos(A) * PH[i] * hs).toFixed(1) + ' ' + (Math.sin(A) * PH[i] * hs).toFixed(1)
    }
  if (w > 0.97) hd = '' // hole already closed: skip drawing it (avoids stray points)
  const outer = d
  const full = d + hd + 'Z'
  // set: body.d=full, sheen.d=full, edge.d=outer, orbitPath.d=outer, hole.d=hd?hd+'Z':''
  bodyEl.value?.setAttribute('d', full)
  sheenEl.value?.setAttribute('d', full)
  edgeEl.value?.setAttribute('d', outer)
  holeEl.value?.setAttribute('d', hd ? hd + 'Z' : '')
  orbitSrc.value?.setAttribute('d', outer)
}

// ---- Timeline: one CYCLE-second cycle, t in seconds -> [m,q,w] ----
// CYCLE < 10 = faster morph; per-phase timing stays proportional through the
// mapping T = (t * 10 / CYCLE) % 10 so the ease/back curves stay unchanged.
const CYCLE = 6
function st(t) {
  const T = ((t * 10) / CYCLE) % 10
  const c = (a, b) => Math.max(0, Math.min(1, (T - a) / (b - a)))
  if (T >= 4) {
    const m = T < 8.8 ? 1 - ease(c(4, 4.8)) : back(c(8.8, 9.6))
    const w = T < 7.4 ? ease(c(5.2, 6.2)) : 1 - ease(c(7.4, 8.4))
    return [m, 0, w]
  }
  const m1 = T < 2 ? 1 - ease(c(1.2, 2)) : back(c(2.6, 3.3))
  const q = T < 2 ? 0 : T >= 3.3 ? 1 - ease(c(3.3, 4)) : 1
  return [m1, q, 0]
}

// ---- Reduced motion: one static frame, no sheen & light dots ----
const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false

let rafId = 0
let startTs = null

function frame(now) {
  if (startTs === null) startTs = now
  const [m, q, w] = st((now - startTs) / 1000)
  build(m, q, w)
  rafId = requestAnimationFrame(frame)
}

onMounted(() => {
  if (reduced || typeof requestAnimationFrame !== 'function') {
    build(1, 0, 0) // static frame: pointed shape
    return
  }
  rafId = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<style scoped>
.thinking-knot {
  display: inline-block;
}

.tk-stroke {
  stroke: var(--fg);
}

/* Light dot on the outer edge (comet) */
.d1 {
  --L: 4;
  stroke-dasharray: 4 96;
  stroke-width: 3.4;
  stroke-opacity: 1;
}
.d2 {
  --L: 12;
  stroke-dasharray: 12 88;
  stroke-width: 2.6;
  stroke-opacity: 0.45;
}
.d3 {
  --L: 28;
  stroke-dasharray: 28 72;
  stroke-width: 1.8;
  stroke-opacity: 0.2;
}
.d1,
.d2,
.d3 {
  animation: orb 4.2s linear infinite;
}
@keyframes orb {
  from {
    stroke-dashoffset: var(--L);
  }
  to {
    stroke-dashoffset: calc(var(--L) - 100);
  }
}

/* Reduced motion: hide sheen + light dots */
.tk-reduced .sheen,
.tk-reduced .orbit {
  display: none;
}
</style>

<style>
:root {
  --bg: #f3f1ee;
  --fg: #1d1a1a;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #17151a;
    --fg: #ece8f2;
  }
}
</style>
