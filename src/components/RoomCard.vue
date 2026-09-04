<template>
  <div class="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
    <!-- Header -->
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-gray-900 truncate">{{ room.name }}</p>
        <p class="text-[10px] text-gray-400 mt-0.5 truncate">{{ room.mqttTopic }}</p>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Power toggle — small round icon button. Green = relay on, red = relay off.
             Desktop: a click opens the confirmation dialog directly.
             Mobile: press-and-hold with a filling ring, then the confirmation dialog opens. -->
        <AppTooltip :text="room.relayOn ? 'Tahan untuk mematikan perangkat' : 'Perangkat sudah mati'" position="top">
          <button
            type="button"
            :disabled="!room.relayOn"
            @click="handleClick"
            @pointerdown="handlePointerDown"
            @pointerup="cancelHold"
            @pointerleave="cancelHold"
            @pointercancel="cancelHold"
            class="relative w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 select-none touch-none"
            :class="room.relayOn
              ? 'bg-[#16a34a] text-white hover:bg-[#15803d] cursor-pointer'
              : 'bg-red-600 text-white hover:bg-red-700 cursor-default'"
          >
            <PowerIcon :size="14" />

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

        <span
          :class="room.presenceDetected
            ? 'bg-[#7ADAA5]/20 text-[#16a34a]'
            : 'bg-gray-100 text-gray-400'"
          class="text-[10px] font-semibold px-2 py-0.5 rounded-lg shrink-0"
        >
          {{ room.presenceDetected ? 'Occupied' : 'Empty' }}
        </span>
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