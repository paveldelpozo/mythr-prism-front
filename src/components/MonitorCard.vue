<script setup lang="ts">
import { ArrowTopRightOnSquareIcon } from '@heroicons/vue/24/outline';
import { computed, ref, watch } from 'vue';
import MonitorControls from './MonitorControls.vue';
import type {
  MonitorDescriptor,
  MonitorRuntimeState,
  MonitorThumbnailState
} from '../types/broadcaster';

const props = defineProps<{
  monitor: MonitorDescriptor;
  state: MonitorRuntimeState;
  thumbnail: MonitorThumbnailState;
  isFileImportBlocked?: boolean;
  fileImportBlockedMessage?: string;
}>();

const emit = defineEmits<{
  openWindow: [monitorId: string];
  requestFullscreen: [monitorId: string];
  closeWindow: [monitorId: string];
  uploadImage: [monitorId: string, file: File];
  clearImage: [monitorId: string];
  renameMonitor: [monitorId: string, nextName: string];
  transform: [
    monitorId: string,
    action: { type: 'rotate'; value: number } | { type: 'scale'; value: number } | { type: 'move'; value: { x?: number; y?: number } } | { type: 'reset' }
  ];
}>();

const isInfoPanelOpen = ref(false);
const renameDraft = ref(props.monitor.label);

const infoPanelId = computed(() => `monitor-info-panel-${props.monitor.id}`);
const renameInputId = computed(() => `monitor-rename-input-${props.monitor.id}`);
watch(
  () => props.monitor.label,
  (nextLabel) => {
    renameDraft.value = nextLabel;
  }
);

const submitRename = () => {
  emit('renameMonitor', props.monitor.id, renameDraft.value.trim());
};

const thumbnailCapturedAtLabel = computed(() => {
  if (!props.thumbnail.capturedAtMs) {
    return 'Sin captura';
  }

  return `Actualizada ${new Date(props.thumbnail.capturedAtMs).toLocaleTimeString('es-AR')}`;
});
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
        <label class="form-field mt-3 block" :for="renameInputId">
          Renombrar pantalla
          <input
            :id="renameInputId"
            data-testid="monitor-rename-input"
            type="text"
            class="form-control"
            :value="renameDraft"
            maxlength="80"
            placeholder="Ej: LED lateral"
            @input="renameDraft = ($event.target as HTMLInputElement).value"
            @blur="submitRename"
            @keydown.enter.prevent="submitRename"
          />
        </label>
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
        <button
          type="button"
          class="btn-with-icon btn-sm btn-slate-soft"
          data-testid="monitor-info-toggle"
          :aria-controls="infoPanelId"
          :aria-expanded="isInfoPanelOpen"
          @click="isInfoPanelOpen = !isInfoPanelOpen"
        >
          {{ isInfoPanelOpen ? 'Ocultar estado' : 'Estado' }}
        </button>
      </div>
    </header>

    <div class="monitor-card-preview" :data-testid="`monitor-preview-${monitor.id}`">
      <img
        v-if="thumbnail.imageDataUrl"
        :src="thumbnail.imageDataUrl"
        :alt="`Miniatura de ${monitor.label}`"
        :data-testid="`monitor-preview-image-${monitor.id}`"
        class="monitor-card-preview-media"
      />
      <p
        v-else
        :data-testid="`monitor-preview-empty-${monitor.id}`"
        class="monitor-card-preview-empty"
      >
        {{ state.isWindowOpen ? 'Esperando captura en vivo...' : 'Abre la ventana para ver miniatura' }}
      </p>
    </div>

    <p class="mb-4 mt-2 text-[11px] text-slate-300/75">{{ thumbnailCapturedAtLabel }}</p>

    <section
      v-if="isInfoPanelOpen"
      :id="infoPanelId"
      class="surface-panel-xl mb-4"
      role="region"
      aria-label="Estado detallado del monitor"
      data-testid="monitor-info-panel"
    >
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
    </section>

    <button
      v-if="!state.isWindowOpen"
      data-testid="monitor-open-window"
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
      @request-fullscreen="emit('requestFullscreen', $event)"
      @close-window="emit('closeWindow', $event)"
      @upload-image="(id, file) => emit('uploadImage', id, file)"
      @clear-image="emit('clearImage', $event)"
      @transform="(id, action) => emit('transform', id, action)"
    />
  </article>
</template>
