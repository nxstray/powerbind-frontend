<template>
  <router-view v-slot="{ Component }">
      <keep-alive include="AgentPage">
        <component :is="Component" />
      </keep-alive>
  </router-view>
  <ChangePasswordModal v-if="authStore.isLoggedIn && authStore.mustChangePassword" />
</template>

<script setup>
import { RouterView } from 'vue-router'
import { defineAsyncComponent } from 'vue'
import { useAuthStore } from '@/stores/authStore'

// Lazy-loaded: only fetched from the network the first time the
// must-change-password state actually requires it, instead of shipping
// inside the initial bundle on every page.
const ChangePasswordModal = defineAsyncComponent(() => import('@/components/ChangePasswordModal.vue'))

const authStore = useAuthStore()
</script>