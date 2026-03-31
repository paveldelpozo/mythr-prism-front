<script setup lang="ts">
import { ArrowTopRightOnSquareIcon } from '@heroicons/vue/24/outline';
import MonitorControls from './MonitorControls.vue';
import type { MonitorDescriptor, MonitorRuntimeState } from '../types/broadcaster';

defineProps<{
  monitor: MonitorDescriptor;
  state: MonitorRuntimeState;
  isFileImportBlocked?: boolean;
  fileImportBlockedMessage?: string;
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

      <div class="flex flex-col items-end gap-2">
        <span
          class="rounded-full px-3 py-1 text-[11px] font-semibold"
          :class="monitor.isPrimary ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-700/40 text-slate-200'"
        >
          {{ monitor.isPrimary ? 'Principal' : 'Externo' }}
        </span>
        <span
          v-if="monitor.isMasterAppScreen"
          class="rounded-full bg-indigo-500/25 px-3 py-1 text-[11px] font-semibold text-indigo-100"
        >
          Ventana principal (esta app)
        </span>
      </div>
    </header>

    <div class="surface-panel-xl mb-4">
      <p class="text-xs text-slate-300/90">Estado ventana: {{ state.isWindowOpen ? 'Abierta' : 'Cerrada' }}</p>
      <p class="text-xs text-slate-300/90">Handshake: {{ state.isSlaveReady ? 'Conectado' : 'Pendiente' }}</p>
      <p class="text-xs text-slate-300/90">Fullscreen: {{ state.isFullscreen ? 'Activo' : 'No activo' }}</p>
      <p v-if="state.lostFullscreenUnexpectedly" class="mt-1 text-xs text-amber-200/90">
        Fullscreen se cerro por una accion externa. Usa "Reactivar fullscreen" para recuperarlo en un clic.
      </p>
      <p v-if="state.requiresFullscreenInteraction" class="mt-1 text-xs text-indigo-200/90">
        Requiere clic en la ventana esclava para fullscreen.
      </p>
      <p v-if="state.lastError" class="mt-1 text-xs text-amber-200/90">{{ state.lastError }}</p>
    </div>

    <button
      v-if="!state.isWindowOpen"
      type="button"
      class="btn-with-icon btn-md btn-indigo-soft mb-4 w-full border"
      @click="emit('openWindow', monitor.id)"
    >
      <ArrowTopRightOnSquareIcon aria-hidden="true" class="btn-icon" />
      Abrir ventana en este monitor
    </button>

    <MonitorControls
      v-else
      :monitor-id="monitor.id"
      :state="state"
      :is-file-import-blocked="isFileImportBlocked"
      :file-import-blocked-message="fileImportBlockedMessage"
      @close-window="emit('closeWindow', $event)"
      @request-fullscreen="emit('requestFullscreen', $event)"
      @upload-image="(id, file) => emit('uploadImage', id, file)"
      @clear-image="emit('clearImage', $event)"
      @transform="(id, action) => emit('transform', id, action)"
    />
  </article>
</template>
