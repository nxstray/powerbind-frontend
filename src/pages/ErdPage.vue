<template>
  <div class="min-h-screen flex transition-colors duration-1000 ease-in-out" :class="themeClass">
    <!-- Mobile overlay -->
    <div v-if="sidebarOpen" class="fixed inset-0 bg-black/40 z-20 md:hidden" @click="sidebarOpen = false" />

    <!-- Sidebar (same structure as DashboardPage) -->
    <aside
      :class="[
        'fixed md:sticky top-0 h-screen z-30 flex flex-col transition-all duration-500',
        'bg-linear-to-br to-[#d5e2de]',
        sidebarColor,
        sidebarCollapsed ? 'w-16' : 'w-60',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      ]"
    >
      <nav class="custom-scroll flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <button
          v-for="item in navItems"
          :key="item.name"
          @click="$router.push(item.to); sidebarOpen = false"
          :class="[
            'w-full flex items-center rounded-xl text-sm font-medium transition group',
            sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
            $route.name === item.routeName ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white',
          ]"
          :title="sidebarCollapsed ? item.name : ''"
        >
          <component :is="item.icon" :size="17" class="shrink-0" />
          <span v-if="!sidebarCollapsed" class="relative top-px">{{ item.name }}</span>
        </button>
      </nav>

      <div class="px-2 pb-2 hidden md:block shrink-0">
        <button
          @click="sidebarCollapsed = !sidebarCollapsed"
          class="w-full flex items-center justify-center py-2 rounded-xl transition"
          :class="isDark ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-gray-800/70 hover:text-gray-900 hover:bg-black/10'"
        >
          <ChevronLeftIcon :size="16" :class="sidebarCollapsed ? 'rotate-180' : ''" class="transition-transform duration-300" />
        </button>
      </div>

      <div class="border-t border-white/10 px-2 py-3 shrink-0">
        <div :class="['flex items-center gap-2.5 px-2 py-2', sidebarCollapsed ? 'justify-center' : '']">
          <div class="w-7 h-7 rounded-full bg-[#ECECBB] flex items-center justify-center text-xs font-bold text-gray-700 shrink-0">
            {{ userInitial }}
          </div>
          <template v-if="!sidebarCollapsed">
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-white truncate">{{ authStore.user?.displayName || 'Admin' }}</p>
              <p class="text-[10px] text-white/50 truncate">{{ authStore.user?.username || 'admin' }}</p>
            </div>
            <AppTooltip text="Logout" position="right">
              <button
                @click="askLogout"
                class="transition shrink-0"
                :class="isDark ? 'text-white/40 hover:text-white' : 'text-gray-800/70 hover:text-gray-900'"
              >
                <LogOutIcon :size="15" />
              </button>
            </AppTooltip>
          </template>
        </div>
      </div>
    </aside>

    <!-- Validation: logout -->
    <ConfirmDialog
      :open="logoutConfirm.open"
      :loading="logoutConfirm.loading"
      danger
      title="Keluar dari Akun"
      message="Kamu akan keluar dari sesi ini. Lanjutkan?"
      confirm-text="Keluar"
      cancel-text="Batal"
      @confirm="confirmLogout"
      @cancel="cancelLogout"
    />

    <!-- Main — header & toolbar removed, canvas now fills the entire workstation -->
    <div class="flex-1 flex flex-col min-w-0 relative h-screen">
      <!-- Mobile-only menu trigger, since the header that used to hold it is gone -->
      <button
        v-if="!sidebarOpen"
        @click="sidebarOpen = true"
        class="md:hidden absolute top-3 left-3 z-20 p-2 rounded-lg backdrop-blur-md border"
        :class="isDark ? 'bg-black/30 border-white/10 text-white/80' : 'bg-white/80 border-gray-200 text-gray-600'"
      >
        <MenuIcon :size="18" />
      </button>

      <!-- canvas viewport -->
      <div
        ref="viewportRef"
        class="relative flex-1 overflow-hidden select-none"
        :class="[isDark ? 'bg-zinc-950' : 'bg-slate-50', handTool ? 'cursor-grab' : 'cursor-default']"
        :style="{
          backgroundImage: showGrid ? `radial-gradient(${gridColor} 1px, transparent 1px)` : 'none',
          backgroundSize: `${24 * scale}px ${24 * scale}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }"
        @mousedown="onCanvasMouseDown"
        @wheel="onWheel"
      >
        <div v-if="loading" class="absolute inset-0 flex items-center justify-center text-sm" :class="isDark ? 'text-zinc-400' : 'text-slate-400'">
          Memuat skema entity...
        </div>
        <div v-else-if="loadError" class="absolute inset-0 flex items-center justify-center text-sm text-red-400 px-6 text-center">
          Gagal memuat skema dari /api/admin/erd. Pastikan kamu login sebagai admin.
        </div>

        <div
          v-else
          :style="{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: contentW + 'px',
            height: contentH + 'px',
          }"
          class="relative"
        >
          <svg :width="contentW" :height="contentH" class="absolute inset-0 overflow-visible" style="pointer-events: none">
            <g v-for="p in paths" :key="p.key">
              <!-- fat invisible hit-area so the thin line is easy to hover -->
              <path :d="p.d" fill="none" stroke="transparent" stroke-width="14" style="pointer-events: stroke" class="cursor-pointer"
                @mouseenter="hoveredRel = p.key" @mouseleave="hoveredRel = null" @click.stop="focusedTable = null" />
              <path
                :d="p.d"
                fill="none"
                :stroke="p.active ? lineFocusColor : lineColor"
                :stroke-width="p.active ? 2.25 : 1.3"
                :opacity="p.dimmed ? 0.15 : 1"
                style="pointer-events: none"
                class="transition-all duration-150"
              />
              <g v-if="p.active || !p.dimmed">
                <text :x="p.fromLabel.x" :y="p.fromLabel.y" font-size="10" font-weight="700" text-anchor="middle"
                  :fill="p.active ? lineFocusColor : lineColor" :opacity="p.dimmed ? 0.3 : 1">{{ p.fromLabel.text }}</text>
                <text :x="p.toLabel.x" :y="p.toLabel.y" font-size="10" font-weight="700" text-anchor="middle"
                  :fill="p.active ? lineFocusColor : lineColor" :opacity="p.dimmed ? 0.3 : 1">{{ p.toLabel.text }}</text>
              </g>
            </g>
          </svg>

          <div
            v-for="table in schema.tables"
            :key="table.name"
            data-table
            @mousedown="onTableMouseDown($event, table.name)"
            @click.stop="onTableClick(table.name)"
            :style="{ left: positions[table.name]?.x + 'px', top: positions[table.name]?.y + 'px', width: BOX_W + 'px' }"
            class="absolute rounded-lg border shadow-sm overflow-hidden transition-shadow duration-150"
            :class="[
              isDark ? 'bg-zinc-800' : 'bg-white',
              isRelevantTable(table.name) ? 'border-sky-400 ring-2 ring-sky-300/60' : (isDark ? 'border-zinc-700' : 'border-slate-200'),
              hasActiveHighlight && !isRelevantTable(table.name) ? 'opacity-30' : 'opacity-100',
              handTool ? '' : 'cursor-move',
            ]"
          >
            <div class="px-2.5 py-1.5 text-[12px] font-semibold" :class="isDark ? 'bg-zinc-700 text-zinc-100' : 'bg-sky-500 text-white'">
              {{ table.name }}
            </div>
            <div>
              <div
                v-for="col in table.columns"
                :key="col.name"
                class="flex items-center gap-1.5 px-2.5 text-[11px] rounded-sm transition-colors"
                :style="{ height: ROW_H + 'px' }"
                :class="[
                  isDark ? 'text-zinc-300' : 'text-slate-700',
                  isRelevantColumn(table.name, col.name) ? (isDark ? 'bg-white/10' : 'bg-sky-50') : '',
                ]"
                @mouseenter="(col.pk || col.fk) && (hoveredColumn = { table: table.name, column: col.name })"
                @mouseleave="hoveredColumn = null"
              >
                <AppTooltip v-if="col.pk" text="Primary key" position="right">
                  <KeyIcon :size="10" class="shrink-0 text-amber-500" />
                </AppTooltip>
                <AppTooltip v-else-if="col.fk" text="Foreign key" position="right">
                  <LinkIcon :size="10" class="shrink-0 text-sky-500" />
                </AppTooltip>
                <AppTooltip v-else-if="col.unique" text="Unique key" position="right">
                  <KeyIcon :size="10" class="shrink-0 text-violet-500" />
                </AppTooltip>
                <span v-else class="w-2.5 shrink-0" />
                <span :class="col.pk ? 'font-semibold' : ''">{{ col.name }}</span>
                <span class="ml-auto text-[10px]" :class="isDark ? 'text-zinc-500' : 'text-slate-400'">{{ col.type }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Floating toolbar — zoom / view / tool controls, moved out of the old top navbar -->
        <div
          class="absolute bottom-4 left-4 z-20 flex items-center gap-1 px-2 py-1.5 rounded-xl border shadow-lg backdrop-blur-md"
          :class="isDark ? 'bg-zinc-900/80 border-white/10' : 'bg-white/90 border-gray-200'"
        >
          <AppTooltip text="Perkecil" position="top">
            <button @click="zoomBy(1 / 1.15)" class="p-1.5 rounded-lg" :class="btnClass">
              <ZoomOutIcon :size="14" />
            </button>
          </AppTooltip>

          <button @click="scale = 1" class="text-xs w-12 text-center tabular-nums" :class="isDark ? 'text-zinc-300' : 'text-slate-600'">
            {{ Math.round(scale * 100) }}%
          </button>

          <AppTooltip text="Perbesar" position="top">
            <button @click="zoomBy(1.15)" class="p-1.5 rounded-lg" :class="btnClass">
              <ZoomInIcon :size="14" />
            </button>
          </AppTooltip>

          <span class="w-px h-5 mx-1" :class="isDark ? 'bg-white/10' : 'bg-black/10'" />

          <AppTooltip text="Sesuaikan ke layar" position="top">
            <button @click="fitToScreen" class="p-1.5 rounded-lg" :class="btnClass">
              <MaximizeIcon :size="14" />
            </button>
          </AppTooltip>

          <AppTooltip text="Reset tampilan" position="top">
            <button @click="resetView" class="p-1.5 rounded-lg" :class="btnClass">
              <RotateCcwIcon :size="14" />
            </button>
          </AppTooltip>

          <span class="w-px h-5 mx-1" :class="isDark ? 'bg-white/10' : 'bg-black/10'" />

          <AppTooltip text="Alat pilih" position="top">
            <button @click="handTool = false" class="p-1.5 rounded-lg" :class="!handTool ? btnOnClass : btnClass">
              <MousePointerIcon :size="14" />
            </button>
          </AppTooltip>

          <AppTooltip text="Alat geser (pan)" position="top">
            <button @click="handTool = true" class="p-1.5 rounded-lg" :class="handTool ? btnOnClass : btnClass">
              <HandIcon :size="14" />
            </button>
          </AppTooltip>

          <span class="w-px h-5 mx-1" :class="isDark ? 'bg-white/10' : 'bg-black/10'" />

          <AppTooltip text="Tampilkan grid" position="top">
            <button @click="showGrid = !showGrid" class="p-1.5 rounded-lg" :class="showGrid ? btnOnClass : btnClass">
              <GridIcon :size="14" />
            </button>
          </AppTooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, h } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import adminService from '@/services/adminService'
import AppTooltip from '@/components/AppTooltip.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

import HomeIcon from '@/components/icons/HomeIcon.vue'
import SparklesIcon from '@/components/icons/SparklesIcon.vue'
import DatabaseIcon from '@/components/icons/DatabaseIcon.vue'
import TerminalIcon from '@/components/icons/TerminalIcon.vue'
import ChevronLeftIcon from '@/components/icons/ChevronLeftIcon.vue'
import MenuIcon from '@/components/icons/MenuIcon.vue'
import LogOutIcon from '@/components/icons/LogOutIcon.vue'

// Small inline-svg icons for the toolbar, following the same shape as
// src/components/icons/*.vue. Worth promoting into their own .vue files if
// you end up reusing any of these elsewhere — kept inline here so this diff
// stays focused on the ERD page itself.
const iconFactory = (paths) => (props) =>
  h(
    'svg',
    { xmlns: 'http://www.w3.org/2000/svg', width: props.size || 24, height: props.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    paths,
  )
const ZoomInIcon = iconFactory([h('circle', { cx: 11, cy: 11, r: 8 }), h('line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 }), h('line', { x1: 11, y1: 8, x2: 11, y2: 14 }), h('line', { x1: 8, y1: 11, x2: 14, y2: 11 })])
const ZoomOutIcon = iconFactory([h('circle', { cx: 11, cy: 11, r: 8 }), h('line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 }), h('line', { x1: 8, y1: 11, x2: 14, y2: 11 })])
const MaximizeIcon = iconFactory([h('path', { d: 'M8 3H5a2 2 0 0 0-2 2v3' }), h('path', { d: 'M21 8V5a2 2 0 0 0-2-2h-3' }), h('path', { d: 'M3 16v3a2 2 0 0 0 2 2h3' }), h('path', { d: 'M16 21h3a2 2 0 0 0 2-2v-3' })])
const RotateCcwIcon = iconFactory([h('polyline', { points: '1 4 1 10 7 10' }), h('path', { d: 'M3.51 15a9 9 0 1 0 2.13-9.36L1 10' })])
const MousePointerIcon = iconFactory([h('path', { d: 'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z' })])
const HandIcon = iconFactory([h('path', { d: 'M18 11V6a2 2 0 0 0-4 0v5' }), h('path', { d: 'M14 10V4a2 2 0 0 0-4 0v7' }), h('path', { d: 'M10 10.5V6a2 2 0 0 0-4 0v8' }), h('path', { d: 'M6 14v0a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6v-3' })])
const GridIcon = iconFactory([h('rect', { x: 3, y: 3, width: 7, height: 7 }), h('rect', { x: 14, y: 3, width: 7, height: 7 }), h('rect', { x: 14, y: 14, width: 7, height: 7 }), h('rect', { x: 3, y: 14, width: 7, height: 7 })])
const KeyIcon = iconFactory([h('path', { d: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4' })])
const LinkIcon = iconFactory([h('path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }), h('path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' })])

const router = useRouter()
const authStore = useAuthStore()
const sidebarCollapsed = ref(false)
const sidebarOpen = ref(false)

// ---- logout (same behaviour/colors as Dashboard & Gemono pages) -----------
const logoutConfirm = ref({ open: false, loading: false })
function askLogout() {
  logoutConfirm.value = { open: true, loading: false }
}
async function confirmLogout() {
  logoutConfirm.value.loading = true
  await authStore.logout()
  router.push({ name: 'login' })
}
function cancelLogout() {
  if (logoutConfirm.value.loading) return
  logoutConfirm.value = { open: false, loading: false }
}

const navItems = [
  { name: 'Dashboard', routeName: 'dashboard', to: '/', icon: HomeIcon },
  { name: 'Gemono', routeName: 'agent', to: '/agent', icon: SparklesIcon },
  { name: 'ERD', routeName: 'erd', to: '/erd', icon: DatabaseIcon },
  { name: 'Log', routeName: 'log', to: '/log', icon: TerminalIcon },
]

const userInitial = computed(() => {
  const name = authStore.user?.displayName || authStore.user?.username || 'A'
  return name.charAt(0).toUpperCase()
})

// ---- automatic weather/time theme — identical thresholds to DashboardPage --
// (kept only for the dark/light class used across the canvas + sidebar; the
// header that used to display the weather badge has been removed)
const themeClass = ref('bg-[#f0f2f5]')
const sidebarColor = ref('from-[#0f8cd5]')
const isDark = ref(false)

async function fetchWeather() {
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=-6.4025&longitude=106.9600&current=temperature_2m,weather_code,is_day&timezone=Asia/Jakarta',
    )
    const data = await res.json()
    const curr = data.current
    const hour = new Date().getHours()
    const isRain = curr.weather_code >= 51 && curr.weather_code <= 99

    if (isRain) {
      themeClass.value = 'bg-[#e5e7eb]'; sidebarColor.value = 'from-[#64748b]'; isDark.value = false
    } else if (curr.is_day === 0) {
      themeClass.value = 'bg-[#1e293b]'; sidebarColor.value = 'from-[#1e1b4b]'; isDark.value = true
    } else if (hour >= 15 && hour < 18) {
      themeClass.value = 'bg-[#fed7aa]'; sidebarColor.value = 'from-[#f97316]'; isDark.value = false
    } else {
      themeClass.value = 'bg-[#f0f2f5]'; sidebarColor.value = 'from-[#0f8cd5]'; isDark.value = false
    }
  } catch (error) {
    console.error('Failed to fetch weather data:', error)
  }
}

const btnClass = computed(() => (isDark.value ? 'text-zinc-400 hover:bg-zinc-800' : 'text-slate-500 hover:bg-sky-50'))
const btnOnClass = computed(() => 'bg-sky-500 text-white')
const gridColor = computed(() => (isDark.value ? '#3f3f46' : '#94a3b8'))
const lineColor = computed(() => (isDark.value ? '#52525b' : '#94a3b8'))
const lineFocusColor = computed(() => (isDark.value ? '#38bdf8' : '#0284c7'))

// ---- schema from the backend (auto-generated via reflection) --------------
const BOX_W = 216
const ROW_H = 22
const HEAD_H = 30
const GAP_X = 60
const GAP_Y = 40

const schema = reactive({ tables: [], relations: [] })
const positions = reactive({})
const loading = ref(true)
const loadError = ref(false)

function boxHeight(table) {
  return HEAD_H + table.columns.length * ROW_H
}

// Layered graph layout (Sugiyama-style, simplified): tables are placed into
// columns based on how many FK "hops" they are from a referenced-only root
// table, so a cable never has to travel far or loop around unrelated boxes.
// Within each column, tables are ordered by the average vertical position of
// the tables they reference in the previous column (barycenter heuristic),
// which keeps most cables flowing left-to-right instead of criss-crossing.
function layoutTables(tables) {
  if (!tables.length) return
  const byName = new Map(tables.map((t) => [t.name, t]))

  const references = new Map(tables.map((t) => [t.name, new Set()]))
  schema.relations.forEach((r) => {
    if (references.has(r.from) && byName.has(r.to) && r.to !== r.from) {
      references.get(r.from).add(r.to)
    }
  })

  const layerCache = new Map()
  function layerOf(name, visiting = new Set()) {
    if (layerCache.has(name)) return layerCache.get(name)
    if (visiting.has(name)) return 0 // break circular FK chains instead of recursing forever
    visiting.add(name)
    const refs = [...references.get(name)]
    const layer = refs.length ? 1 + Math.max(...refs.map((r) => layerOf(r, visiting))) : 0
    layerCache.set(name, layer)
    return layer
  }
  tables.forEach((t) => layerOf(t.name))

  const layers = []
  tables.forEach((t) => {
    const l = layerCache.get(t.name)
    if (!layers[l]) layers[l] = []
    layers[l].push(t)
  })

  const orderIndex = new Map()
  layers.forEach((layerTables) => {
    const barycenter = (name) => {
      const refs = [...references.get(name)].filter((r) => orderIndex.has(r))
      if (!refs.length) return Number.MAX_SAFE_INTEGER
      return refs.reduce((sum, r) => sum + orderIndex.get(r), 0) / refs.length
    }
    layerTables.sort((a, b) => barycenter(a.name) - barycenter(b.name))
    layerTables.forEach((t, i) => orderIndex.set(t.name, i))
  })

  layers.forEach((layerTables, li) => {
    const x = li * (BOX_W + GAP_X) + 20
    let y = 20
    layerTables.forEach((t) => {
      positions[t.name] = { x, y }
      y += boxHeight(t) + GAP_Y
    })
  })
}

async function loadSchema() {
  loading.value = true
  loadError.value = false
  try {
    const data = await adminService.getErdSchema()
    schema.tables = data.tables
    schema.relations = data.relations
    layoutTables(data.tables)
  } catch (e) {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

const contentW = computed(() => {
  const xs = Object.values(positions).map((p) => p.x + BOX_W)
  return xs.length ? Math.max(...xs) + 60 : 1200
})
const contentH = computed(() => {
  const table = (name) => schema.tables.find((t) => t.name === name)
  const ys = Object.entries(positions).map(([name, p]) => p.y + boxHeight(table(name)))
  return ys.length ? Math.max(...ys) + 60 : 800
})

// ---- pan / zoom / drag / select ---------------------------------------------
const MIN_SCALE = 0.35
const MAX_SCALE = 2.2
const viewportRef = ref(null)
const scale = ref(1.2)
const pan = reactive({ x: 40, y: 20 })
const showGrid = ref(true)
const handTool = ref(false)
const focusedTable = ref(null)

let panState = null
let dragState = null

function neighborsOf(name) {
  const set = new Set([name])
  schema.relations.forEach((r) => {
    if (r.from === name) set.add(r.to)
    if (r.to === name) set.add(r.from)
  })
  return set
}
const highlighted = computed(() => (focusedTable.value ? neighborsOf(focusedTable.value) : null))
function isNeighbor(name) {
  return highlighted.value ? highlighted.value.has(name) : true
}

// ---- relationship highlighting (dbdiagram-style) ---------------------------
// Hover a PK/FK column, or the cable itself, to light up exactly the
// relationship(s) it belongs to and dim everything else. Clicking a table
// keeps the older "focus this table's neighbours" behaviour.
const hoveredColumn = ref(null) // { table, column }
const hoveredRel = ref(null) // relation key string

function relKey(r) {
  return `${r.from}.${r.fromColumn}->${r.to}.${r.toColumn}`
}

const activeRelKeys = computed(() => {
  if (hoveredRel.value) return new Set([hoveredRel.value])
  if (hoveredColumn.value) {
    const keys = new Set()
    schema.relations.forEach((r) => {
      if (
        (r.from === hoveredColumn.value.table && r.fromColumn === hoveredColumn.value.column) ||
        (r.to === hoveredColumn.value.table && r.toColumn === hoveredColumn.value.column)
      ) {
        keys.add(relKey(r))
      }
    })
    return keys
  }
  return null
})

const hasActiveHighlight = computed(() => !!focusedTable.value || !!hoveredColumn.value || !!hoveredRel.value)

function isRelevantTable(name) {
  if (activeRelKeys.value) {
    if (hoveredColumn.value?.table === name) return true
    return schema.relations.some((r) => activeRelKeys.value.has(relKey(r)) && (r.from === name || r.to === name))
  }
  if (focusedTable.value) return isNeighbor(name)
  return false
}

function isRelevantColumn(tableName, colName) {
  return !!hoveredColumn.value && hoveredColumn.value.table === tableName && hoveredColumn.value.column === colName
}

function onCanvasMouseDown(e) {
  if (dragState) return
  if (!handTool.value && e.target.closest('[data-table]')) return
  panState = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
  if (!handTool.value && !e.target.closest('[data-table]')) {
    focusedTable.value = null
  }
}

function onTableMouseDown(e, name) {
  e.stopPropagation()
  if (handTool.value) return
  dragState = { id: name, startX: e.clientX, startY: e.clientY, origX: positions[name].x, origY: positions[name].y }
}

function onTableClick(name) {
  if (handTool.value) return
  focusedTable.value = focusedTable.value === name ? null : name
}

function onMove(e) {
  if (panState) {
    pan.x = panState.panX + (e.clientX - panState.startX)
    pan.y = panState.panY + (e.clientY - panState.startY)
  } else if (dragState) {
    positions[dragState.id] = {
      x: dragState.origX + (e.clientX - dragState.startX) / scale.value,
      y: dragState.origY + (e.clientY - dragState.startY) / scale.value,
    }
  }
}
function onUp() {
  panState = null
  dragState = null
}

function onWheel(e) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const rect = viewportRef.value.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const prevScale = scale.value
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prevScale * (e.deltaY > 0 ? 0.92 : 1.08)))
    pan.x = cx - ((cx - pan.x) / prevScale) * next
    pan.y = cy - ((cy - pan.y) / prevScale) * next
    scale.value = next
  } else {
    pan.x -= e.deltaX
    pan.y -= e.deltaY
  }
}

function zoomBy(factor) {
  scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(scale.value * factor).toFixed(2)))
}

function fitToScreen() {
  const vp = viewportRef.value
  if (!vp || schema.tables.length === 0) return
  const xs = schema.tables.map((t) => positions[t.name].x)
  const ys = schema.tables.map((t) => positions[t.name].y)
  const xe = schema.tables.map((t) => positions[t.name].x + BOX_W)
  const ye = schema.tables.map((t) => positions[t.name].y + boxHeight(t))
  const minX = Math.min(...xs), minY = Math.min(...ys)
  const maxX = Math.max(...xe), maxY = Math.max(...ye)
  const pad = 60
  const s = Math.min((vp.clientWidth - pad * 2) / (maxX - minX), (vp.clientHeight - pad * 2) / (maxY - minY), MAX_SCALE)
  scale.value = +s.toFixed(2)
  pan.x = pad - minX * s
  pan.y = pad - minY * s
}

function resetView() {
  scale.value = 1.2
  pan.x = 40
  pan.y = 20
  focusedTable.value = null
}

const paths = computed(() => {
  return schema.relations.map((r) => {
    const fromTable = schema.tables.find((t) => t.name === r.from)
    const toTable = schema.tables.find((t) => t.name === r.to)
    const fp = positions[r.from]
    const tp = positions[r.to]
    if (!fromTable || !toTable || !fp || !tp) return null

    const key = relKey(r)
    const fromCol = fromTable.columns.find((c) => c.name === r.fromColumn)
    const toCol = toTable.columns.find((c) => c.name === r.toColumn)
    const fromLabelText = fromCol?.pk ? '1' : '*'
    const toLabelText = toCol?.pk ? '1' : '*'

    const fromH = boxHeight(fromTable)
    const toH = boxHeight(toTable)
    // Tables placed in the same (or overlapping) column look messy when
    // wired left-to-right, since the cable has to loop all the way around
    // the boxes in between — route those vertically (bottom-to-top) instead.
    const overlapX = fp.x < tp.x + BOX_W && tp.x < fp.x + BOX_W

    let fx, fy, tx, ty, d, fromLabel, toLabel

    if (overlapX) {
      const fromAbove = fp.y < tp.y
      fx = fp.x + BOX_W / 2
      fy = fromAbove ? fp.y + fromH : fp.y
      tx = tp.x + BOX_W / 2
      ty = fromAbove ? tp.y : tp.y + toH
      const dy = (ty - fy) * 0.5
      d = `M ${fx} ${fy} C ${fx} ${fy + dy}, ${tx} ${ty - dy}, ${tx} ${ty}`
      fromLabel = { x: fx + 11, y: fy + (fromAbove ? 13 : -7), text: fromLabelText }
      toLabel = { x: tx + 11, y: ty + (fromAbove ? -7 : 13), text: toLabelText }
    } else {
      const fIdx = fromTable.columns.findIndex((c) => c.name === r.fromColumn)
      const tIdx = toTable.columns.findIndex((c) => c.name === r.toColumn)
      const fromRightOf = fp.x + BOX_W / 2 < tp.x + BOX_W / 2
      fx = fromRightOf ? fp.x + BOX_W : fp.x
      fy = fp.y + HEAD_H + Math.max(0, fIdx) * ROW_H + ROW_H / 2
      tx = fromRightOf ? tp.x : tp.x + BOX_W
      ty = tp.y + HEAD_H + Math.max(0, tIdx) * ROW_H + ROW_H / 2
      const dx = Math.max(50, Math.abs(tx - fx) / 2)
      d = `M ${fx} ${fy} C ${fx + (fromRightOf ? dx : -dx)} ${fy}, ${tx + (fromRightOf ? -dx : dx)} ${ty}, ${tx} ${ty}`
      fromLabel = { x: fx + (fromRightOf ? 11 : -11), y: fy - 6, text: fromLabelText }
      toLabel = { x: tx + (fromRightOf ? -11 : 11), y: ty - 6, text: toLabelText }
    }

    let active = false
    let dimmed = false
    if (activeRelKeys.value) {
      active = activeRelKeys.value.has(key)
      dimmed = !active
    } else if (focusedTable.value) {
      active = highlighted.value.has(r.from) && highlighted.value.has(r.to)
      dimmed = !active
    }

    return { key, d, active, dimmed, fromLabel, toLabel }
  }).filter(Boolean)
})

onMounted(() => {
  fetchWeather()
  loadSchema()
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
})
onUnmounted(() => {
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onUp)
})
</script>