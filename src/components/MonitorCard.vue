<script setup lang="ts">
import {
  ArrowTopRightOnSquareIcon,
  PencilSquareIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
const isRenameModalOpen = ref(false);
const renameDraft = ref(props.monitor.label);
const infoPopoverToggleButton = ref<HTMLButtonElement | null>(null);
const infoPopoverPanel = ref<HTMLElement | null>(null);
const renameModalInput = ref<HTMLInputElement | null>(null);
const renameTriggerButton = ref<HTMLButtonElement | null>(null);
const bodyScrollSnapshot = ref<{
  overflow: string;
  paddingRight: string;
} | null>(null);

const infoPanelId = computed(() => `monitor-info-panel-${props.monitor.id}`);
const renameModalId = computed(() => `monitor-rename-modal-${props.monitor.id}`);
const renameModalTitleId = computed(() => `monitor-rename-modal-title-${props.monitor.id}`);
const renameInputId = computed(() => `monitor-rename-input-${props.monitor.id}`);

watch(
  () => props.monitor.label,
  (nextLabel) => {
    renameDraft.value = nextLabel;
  }
);

const lockBodyScroll = () => {
  if (typeof document === 'undefined' || bodyScrollSnapshot.value) {
    return;
  }

  const body = document.body;
  bodyScrollSnapshot.value = {
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight
  };

  const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  body.style.overflow = 'hidden';
  body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : body.style.paddingRight;
};

const unlockBodyScroll = () => {
  if (typeof document === 'undefined' || !bodyScrollSnapshot.value) {
    return;
  }

  const body = document.body;
  body.style.overflow = bodyScrollSnapshot.value.overflow;
  body.style.paddingRight = bodyScrollSnapshot.value.paddingRight;
  bodyScrollSnapshot.value = null;
};

const openRenameModal = () => {
  renameDraft.value = props.monitor.label;
  isRenameModalOpen.value = true;
};

const closeRenameModal = () => {
  isRenameModalOpen.value = false;

  void nextTick(() => {
    renameTriggerButton.value?.focus();
  });
};

const closeInfoPopover = () => {
  isInfoPanelOpen.value = false;
};

const toggleInfoPopover = () => {
  isInfoPanelOpen.value = !isInfoPanelOpen.value;
};

const submitRename = () => {
  emit('renameMonitor', props.monitor.id, renameDraft.value.trim());
  closeRenameModal();
};

const onWindowKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') {
    return;
  }

  if (isRenameModalOpen.value) {
    closeRenameModal();
    return;
  }

  if (isInfoPanelOpen.value) {
    closeInfoPopover();
  }
};

const onDocumentMouseDown = (event: MouseEvent) => {
  if (!isInfoPanelOpen.value) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (infoPopoverPanel.value?.contains(target) || infoPopoverToggleButton.value?.contains(target)) {
    return;
  }

  closeInfoPopover();
};

const thumbnailCapturedAtLabel = computed(() => {
  if (!props.thumbnail.capturedAtMs) {
    return 'Sin captura';
  }

  return `Actualizada ${new Date(props.thumbnail.capturedAtMs).toLocaleTimeString('es-AR')}`;
});

watch(isRenameModalOpen, (isOpen) => {
  if (isOpen) {
    lockBodyScroll();
    void nextTick(() => {
      renameModalInput.value?.focus();
    });
    return;
  }

  unlockBodyScroll();
});

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown);
  document.addEventListener('mousedown', onDocumentMouseDown);
});

onBeforeUnmount(() => {
  unlockBodyScroll();
  window.removeEventListener('keydown', onWindowKeydown);
  document.removeEventListener('mousedown', onDocumentMouseDown);
});
</script>

<template>
  <article
    class="monitor-card"
    :class="state.isWindowOpen ? 'monitor-card--open' : 'monitor-card--closed'"
  >
    <header class="mb-4 flex items-center justify-between gap-3">
      <div>
        <div class="monitor-card-title-row">
          <h3 class="text-lg font-bold text-slate-100">{{ monitor.label }}</h3>
          <button
            ref="renameTriggerButton"
            type="button"
            class="btn-with-icon btn-sm btn-slate-soft"
            data-testid="monitor-rename-open"
            :aria-controls="renameModalId"
            :aria-haspopup="'dialog'"
            :aria-expanded="isRenameModalOpen"
            :aria-label="`Renombrar ${monitor.label}`"
            @click="openRenameModal"
          >
            <PencilSquareIcon aria-hidden="true" class="btn-icon" />
            Editar
          </button>
        </div>
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
        <div class="monitor-status-popover-wrap">
          <button
            ref="infoPopoverToggleButton"
            type="button"
            class="btn-with-icon btn-sm btn-slate-soft"
            data-testid="monitor-info-toggle"
            :aria-controls="infoPanelId"
            :aria-expanded="isInfoPanelOpen"
            :aria-haspopup="'dialog'"
            @click="toggleInfoPopover"
          >
            Estado
          </button>

          <section
            v-if="isInfoPanelOpen"
            :id="infoPanelId"
            ref="infoPopoverPanel"
            class="monitor-status-popover"
            role="dialog"
            aria-label="Estado detallado del monitor"
            data-testid="monitor-info-popover"
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
        </div>
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

    <div
      v-if="isRenameModalOpen"
      :id="renameModalId"
      data-testid="monitor-rename-modal-overlay"
      class="app-modal-overlay"
      @click.self="closeRenameModal"
    >
      <section
        data-testid="monitor-rename-modal"
        class="app-modal-panel app-modal-panel--sm"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="renameModalTitleId"
      >
        <header class="app-modal-header">
          <div>
            <p class="section-kicker">Monitor</p>
            <h4 :id="renameModalTitleId" class="mt-1 text-lg font-semibold text-slate-100">
              Renombrar pantalla
            </h4>
          </div>
          <button
            type="button"
            class="app-modal-close-btn"
            data-testid="monitor-rename-modal-close"
            aria-label="Cerrar dialogo de renombrado"
            @click="closeRenameModal"
          >
            <XMarkIcon aria-hidden="true" class="h-4 w-4" />
          </button>
        </header>

        <div class="app-modal-body">
          <label class="form-field block" :for="renameInputId">
            Nombre personalizado
            <input
              :id="renameInputId"
              ref="renameModalInput"
              data-testid="monitor-rename-modal-input"
              type="text"
              class="form-control"
              :value="renameDraft"
              maxlength="80"
              placeholder="Ej: LED lateral"
              @input="renameDraft = ($event.target as HTMLInputElement).value"
              @keydown.enter.prevent="submitRename"
            />
          </label>
        </div>

        <footer class="app-modal-footer">
          <button
            type="button"
            class="btn-with-icon btn-sm btn-slate-soft"
            data-testid="monitor-rename-modal-cancel"
            @click="closeRenameModal"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn-with-icon btn-sm btn-indigo-soft"
            data-testid="monitor-rename-modal-save"
            @click="submitRename"
          >
            Guardar
          </button>
        </footer>
      </section>
    </div>
  </article>
</template>
