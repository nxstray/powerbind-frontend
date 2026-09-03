<template>
  <div class="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-gray-900 truncate">{{ room.name }}</p>
        <p class="text-[10px] text-gray-400 mt-0.5 truncate">{{ room.mqttTopic }}</p>
      </div>
      <span
        :class="room.presenceDetected
          ? 'bg-[#7ADAA5]/20 text-[#16a34a]'
          : 'bg-gray-100 text-gray-400'"
        class="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2"
      >
        {{ room.presenceDetected ? 'Occupied' : 'Empty' }}
      </span>
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

    <!-- Manual off — only shown while the relay is actually on. Actual shutdown only
         happens after the parent shows a confirmation dialog and the user confirms. -->
    <button
      v-if="room.relayOn"
      type="button"
      @click="$emit('request-off', room)"
      class="w-full text-xs font-medium text-red-500 border border-red-100 rounded-xl py-2 hover:bg-red-50 transition"
    >
      Matikan Perangkat
    </button>
  </div>
</template>

<script setup>
defineProps({
  room: { type: Object, required: true },
})

defineEmits(['request-off'])
</script>