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
import { useAuthStore } from '@/stores/authStore'
import ChangePasswordModal from '@/components/ChangePasswordModal.vue'

const authStore = useAuthStore()
</script>