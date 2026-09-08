import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import api from './utils/api' // Make sure this import path matches your project structure
import './assets/main.css'

const app = createApp(App)

// Catch global Vue errors (e.g. undefined variables in the template)
app.config.errorHandler = (err, instance, info) => {
  console.error('Global Vue Error:', err)
  
  // Send to the Spring Boot backend so it lands in Grafana Loki
  api.post('/api/logs', { 
    level: 'ERROR', 
    message: `Vue Render Error: ${err.message} | Component Info: ${info}` 
  }).catch(() => {}) // Empty catch so the frontend doesn't crash when the server is down
}

app.use(createPinia())
app.use(router)

app.mount('#app')