<template>
  <div class="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
    <!-- Header -->
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-gray-900 truncate">{{ room.name }}</p>
        <p class="text-[10px] text-gray-400 mt-0.5 truncate">{{ room.mqttTopic }}</p>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <span
          :class="room.presenceDetected
            ? 'bg-[#7ADAA5]/20 text-[#16a34a]'
            : 'bg-gray-100 text-gray-400'"
          class="text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0"
        >
          {{ room.presenceDetected ? 'Occupied' : 'Empty' }}
        </span>

        <!-- Power toggle — small round icon button. Green = relay on, red = relay off.
             Desktop: a click opens the confirmation dialog directly.
             Mobile: press-and-hold with a filling ring, then the confirmation dialog opens. -->
        <AppTooltip :text="room.relayOn ? 'Tekan untuk mematikan perangkat' : 'Perangkat sudah mati'" position="top">
          <!-- 3D push button toggle with glow effect (relay on = glowing, relay off = dim) -->
          <button
            type="button"
            :disabled="!room.relayOn"
            @click="handleClick"
            @pointerdown="handlePointerDown"
            @pointerup="cancelHold"
            @pointerleave="cancelHold"
            @pointercancel="cancelHold"
            class="power-push-btn relative flex items-center justify-center select-none touch-none"
            :class="room.relayOn ? 'power-push-btn--on cursor-pointer' : 'cursor-default'"
          >
            <PowerIcon :size="14" class="power-push-btn__icon" />

            <!-- Hold-to-confirm progress ring (mobile only) -->
            <svg v-if="room.relayOn" class="absolute inset-0 -rotate-90 pointer-events-none" viewBox="0 0 28 28">
              <circle
                cx="14" cy="14" r="11.5"
                fill="none"
                stroke="white"
                stroke-width="2"
                stroke-linecap="round"
                :stroke-dasharray="circumference"
                :stroke-dashoffset="holding ? 0 : circumference"
                :style="{
                  transition: holding ? `stroke-dashoffset ${HOLD_MS}ms linear` : 'stroke-dashoffset 200ms ease-out',
                  opacity: holding ? 0.9 : 0
                }"
              />
            </svg>
          </button>
        </AppTooltip>
      </div>
    </div>

    <!-- Presence indicator bar -->
    <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div
        class="h-full rounded-full transition-all duration-700"
        :class="room.presenceDetected ? 'bg-[#7ADAA5]' : 'bg-gray-200'"
        :style="{ width: room.presenceDetected ? '100%' : '0%' }"
      />
    </div>

    <!-- Stats row -->
    <div class="grid grid-cols-2 gap-2">
      <!-- Relay -->
      <div class="bg-gray-50 rounded-xl px-3 py-2">
        <p class="text-[10px] text-gray-400 mb-0.5">Relay</p>
        <div class="flex items-center gap-1.5">
          <div
            :class="room.relayOn ? 'bg-[#0f8cd5]' : 'bg-gray-300'"
            class="w-2 h-2 rounded-full transition-colors duration-300 shrink-0"
          />
          <span class="text-xs font-semibold" :class="room.relayOn ? 'text-[#0f8cd5]' : 'text-gray-400'">
            {{ room.relayOn ? 'ON' : 'OFF' }}
          </span>
        </div>
      </div>

      <!-- Presence -->
      <div class="bg-gray-50 rounded-xl px-3 py-2">
        <p class="text-[10px] text-gray-400 mb-0.5">Status</p>
        <div class="flex items-center gap-1.5">
          <div
            :class="room.presenceDetected ? 'bg-[#7ADAA5] animate-pulse' : 'bg-gray-300'"
            class="w-2 h-2 rounded-full shrink-0"
          />
          <span class="text-xs font-semibold" :class="room.presenceDetected ? 'text-[#16a34a]' : 'text-gray-400'">
            {{ room.presenceDetected ? 'Active' : 'Idle' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import PowerIcon from '@/components/icons/PowerIcon.vue'
import AppTooltip from '@/components/AppTooltip.vue'

const props = defineProps({
  room: { type: Object, required: true },
})

const emit = defineEmits(['request-off'])

const HOLD_MS = 800
const circumference = 2 * Math.PI * 11.5

const holding = ref(false)
const isTouch = ref(false)
let holdTimer = null

onMounted(() => {
  isTouch.value = window.matchMedia('(pointer: coarse)').matches
})

function handleClick() {
  // On touch devices, only a completed hold confirms — ignore plain taps
  // so the round button can't be triggered by an accidental tap.
  if (isTouch.value) return
  if (props.room.relayOn) emit('request-off', props.room)
}

function handlePointerDown() {
  if (!isTouch.value || !props.room.relayOn) return
  holding.value = true
  holdTimer = setTimeout(() => {
    holding.value = false
    emit('request-off', props.room)
  }, HOLD_MS)
}

function cancelHold() {
  if (holdTimer) {
    clearTimeout(holdTimer)
    holdTimer = null
  }
  holding.value = false
}
</script>

<style scoped>
/* 3D push button toggle with glow effect, adapted from the CSS toggle-button collection by @AshNolan_ */
.power-push-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: #dfdfdf;
  box-shadow:
    0 2px 4px 0 #a4a4a4,
    0 0 0 2px #e5e5e5,
    0 0 4px 1px transparent,
    0 0 0 3px #f9f9f9;
  transition: box-shadow 200ms ease-in-out, background-color 200ms ease-in-out, transform 150ms ease-in-out;
}

.power-push-btn__icon {
  color: #aaa;
  transition: color 200ms ease-in-out;
}

/* Hover — off/disabled state: subtle lift, no color change since it isn't interactive */
.power-push-btn:not(.power-push-btn--on):hover {
  box-shadow:
    0 2px 5px 0 #999,
    0 0 0 2px #d8d8d8,
    0 0 6px 1px transparent,
    0 0 0 3px #f9f9f9;
}

/* Relay on — glowing state */
.power-push-btn--on {
  box-shadow:
    0 0 4px 0 #0077b3,
    0 0 0 2px #0094e0,
    0 0 12px 2px #0094e0,
    0 0 0 3px #f9f9f9;
}

.power-push-btn--on .power-push-btn__icon {
  color: #0094e0;
}

/* Hover — on/interactive state: glow intensifies and knob lifts slightly */
.power-push-btn--on:hover {
  box-shadow:
    0 0 6px 0 #005c8a,
    0 0 0 2px #0077b3,
    0 0 18px 4px #0094e0,
    0 0 0 3px #f9f9f9;
  transform: scale(1.06);
}

.power-push-btn--on:hover .power-push-btn__icon {
  color: #33b1f0;
}
</style>