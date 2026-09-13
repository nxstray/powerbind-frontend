<template>
  <div class="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
    <!-- Header -->
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-gray-900 truncate">{{ room.name }}</p>
        <p class="text-[10px] text-gray-400 mt-0.5 truncate">{{ room.mqttTopic }}</p>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <AppTooltip :text="room.relayOn ? 'Klik untuk mematikan perangkat' : 'Perangkat sudah mati'" position="top">
          <!-- Pill toggle ala CodePen @cl0udc0ntr0l (njQQbw) — ON = glow cyan, OFF = dim.
               Klik langsung di semua perangkat (desktop & mobile sama);
               validasi lewat ConfirmDialog di DashboardPage. -->
          <div
            class="toggle shrink-0 cursor-pointer select-none"
            :class="{ 'toggle-on': room.relayOn }"
            @click="handleToggle"
          >
            <div class="toggle-text-off">OFF</div>
            <div class="glow-comp"></div>
            <div class="toggle-button"></div>
            <div class="toggle-text-on">ON</div>
          </div>
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
import AppTooltip from '@/components/AppTooltip.vue'

const props = defineProps({
  room: { type: Object, required: true },
})

const emit = defineEmits(['request-off'])

// Klik langsung (desktop & mobile sama, tanpa hold). Hanya relay ON yang bisa
// dimatikan; validasi ditangani ConfirmDialog di DashboardPage.
function handleToggle() {
  if (props.room.relayOn) emit('request-off', props.room)
}
</script>

<style scoped>
/* Pill toggle ala CodePen @cl0udc0ntr0l (https://codepen.io/cl0udc0ntr0l/pen/njQQbw).
   Diskalakan 75x40 -> 56x28 supaya muat di header kartu ruangan. */
.toggle {
  position: relative;
  width: 56px;
  height: 28px;
  border: 2px solid #444249;
  border-radius: 20px;
  box-sizing: border-box;
  transition: border-color 0.6s ease-out;
}

.toggle.toggle-on {
  border-color: rgba(137, 194, 217, 0.4);
  transition: all 0.5s 0.15s ease-out;
}

.toggle-button {
  position: absolute;
  top: 4px;
  width: 20px;
  bottom: 4px;
  right: 27px;
  background-color: #444249;
  border-radius: 19px;
  cursor: pointer;
  transition: all 0.3s 0.1s, width 0.1s, top 0.1s, bottom 0.1s;
}

.toggle-on .toggle-button {
  top: 3px;
  width: 46px;
  bottom: 3px;
  right: 3px;
  border-radius: 23px;
  background-color: #89c2da;
  box-shadow: 0 0 10px #4b7a8d;
  transition: all 0.2s 0.1s, right 0.1s;
}

.toggle-text-on {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  line-height: 24px;
  text-align: center;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  user-select: none;
  color: rgba(0, 0, 0, 0);
}

.toggle-on .toggle-text-on {
  color: #3b6a7d;
  transition: color 0.3s 0.15s;
}

.toggle-text-off {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 4px;
  line-height: 24px;
  text-align: center;
  font-size: 10px;
  font-weight: bold;
  user-select: none;
  cursor: pointer;
  color: #444249;
}

.toggle-on .toggle-text-off {
  color: rgba(0, 0, 0, 0);
}

/* Glow streak effect saat ON */
.glow-comp {
  position: absolute;
  opacity: 0;
  top: 4px;
  bottom: 4px;
  left: 4px;
  right: 4px;
  border-radius: 6px;
  background-color: rgba(75, 122, 141, 0.1);
  box-shadow: 0 0 8px rgba(75, 122, 141, 0.2);
  transition: opacity 4.5s 1s;
}

.toggle-on .glow-comp {
  opacity: 1;
  transition: opacity 1s;
}
</style>