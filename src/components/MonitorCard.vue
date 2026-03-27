<script setup lang="ts">
import MonitorControls from './MonitorControls.vue';
import type { MonitorDescriptor, MonitorRuntimeState } from '../types/broadcaster';

defineProps<{
  monitor: MonitorDescriptor;
  state: MonitorRuntimeState;
}>();

const emit = defineEmits<{
  openWindow: [monitorId: string];
  closeWindow: [monitorId: string];
  requestFullscreen: [monitorId: string];
  uploadImage: [monitorId: string, file: File];
  clearImage: [monitorId: string];
  transform: [
    monitorId: string,
    action: { type: 'rotate'; value: number } | { type: 'scale'; value: number } | { type: 'move'; value: { x?: number; y?: number } } | { type: 'reset' }
  ];
}>();
</script>

<template>
  <article
    class="monitor-card"
    :class="state.isWindowOpen ? 'monitor-card--open' : 'monitor-card--closed'"
  >
    <header class="mb-4 flex items-center justify-between gap-3">
      <div>
        <h3 class="text-lg font-bold text-slate-100">{{ monitor.label }}</h3>
        <p class="mt-1 text-xs text-slate-300/80">
          {{ monitor.width }}x{{ monitor.height }} | pos ({{ monitor.left }}, {{ monitor.top }})
        </p>
      </div>

      <span
        class="rounded-full px-3 py-1 text-[11px] font-semibold"
        :class="monitor.isPrimary ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-700/40 text-slate-200'"
      >
        {{ monitor.isPrimary ? 'Principal' : 'Externo' }}
      </span>
    </header>

    <div class="mb-4 rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
      <p class="text-xs text-slate-300/90">Estado ventana: {{ state.isWindowOpen ? 'Abierta' : 'Cerrada' }}</p>
      <p class="text-xs text-slate-300/90">Handshake: {{ state.isSlaveReady ? 'Conectado' : 'Pendiente' }}</p>
      <p class="text-xs text-slate-300/90">Fullscreen: {{ state.isFullscreen ? 'Activo' : 'No activo' }}</p>
      <p v-if="state.requiresFullscreenInteraction" class="mt-1 text-xs text-indigo-200/90">
        Requiere clic en la ventana esclava para fullscreen.
      </p>
      <p v-if="state.lastError" class="mt-1 text-xs text-amber-200/90">{{ state.lastError }}</p>
    </div>

    <button
      v-if="!state.isWindowOpen"
      type="button"
      class="mb-4 w-full rounded-xl border border-indigo-300/30 bg-indigo-500/20 px-4 py-3 font-semibold text-indigo-100 transition hover:bg-indigo-500/30"
      @click="emit('openWindow', monitor.id)"
    >
      Abrir ventana en este monitor
    </button>

    <MonitorControls
      v-else
      :monitor-id="monitor.id"
      :state="state"
      @close-window="emit('closeWindow', $event)"
      @request-fullscreen="emit('requestFullscreen', $event)"
      @upload-image="(id, file) => emit('uploadImage', id, file)"
      @clear-image="emit('clearImage', $event)"
      @transform="(id, action) => emit('transform', id, action)"
    />
  </article>
</template>
