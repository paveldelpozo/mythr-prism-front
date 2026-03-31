<script setup lang="ts">
import {
  ArrowDownTrayIcon,
  EyeIcon,
  EyeSlashIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import { computed } from 'vue';
import MonitorCard from './MonitorCard.vue';
import AppCheckbox from './ui/AppCheckbox.vue';
import type { MonitorDescriptor, MonitorStateMap, MonitorThumbnailStateMap } from '../types/broadcaster';

const emit = defineEmits<{
  'update:showOnlyProjectable': [value: boolean];
  'update:layoutDraftName': [value: string];
  'update:selectedLayoutId': [value: string | null];
  'update:mirrorEnabled': [value: boolean];
  'update:mirrorSourceMonitorId': [value: string | null];
  'update:mirrorTargetMonitorIds': [value: string[]];
  closeAll: [];
  saveLayout: [];
  loadLayout: [];
  deleteLayout: [];
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

const props = defineProps<{
  monitors: MonitorDescriptor[];
  states: MonitorStateMap;
  thumbnails: MonitorThumbnailStateMap;
  showOnlyProjectable: boolean;
  totalMonitors: number;
  canCloseAllWindows: boolean;
  layouts: Array<{
    id: string;
    name: string;
    updatedAt: string;
  }>;
  layoutDraftName: string;
  selectedLayoutId: string | null;
  layoutFeedback: string | null;
  mirrorEnabled: boolean;
  mirrorSourceMonitorId: string | null;
  mirrorTargetMonitorIds: string[];
  mirrorActiveTargetCount: number;
  mirrorUnavailableTargetIds: string[];
  mirrorLastError: string | null;
  isFileImportBlocked?: boolean;
  fileImportBlockedMessage?: string;
}>();

const monitorLabelById = (monitorId: string | null): string => {
  if (!monitorId) {
    return 'sin origen';
  }

  return props.monitors.find((monitor) => monitor.id === monitorId)?.label ?? monitorId;
};

const selectedMirrorTargetIdSet = computed(() => new Set(props.mirrorTargetMonitorIds));

const mirrorDestinationOptions = computed(() =>
  props.monitors.filter((monitor) => monitor.id !== props.mirrorSourceMonitorId)
);

const unavailableMirrorTargetLabels = computed(() =>
  props.mirrorUnavailableTargetIds.map((monitorId) => monitorLabelById(monitorId))
);

const mirrorActionLabel = computed(() =>
  props.mirrorEnabled ? 'Finalizar espejo' : 'Iniciar espejo'
);

const fullscreenLossLabels = computed(() =>
  props.monitors
    .filter((monitor) => props.states[monitor.id]?.lostFullscreenUnexpectedly)
    .map((monitor) => monitor.label)
);

const onMirrorTargetToggle = (monitorId: string, selected: boolean) => {
  const nextTargetIds = selected
    ? [...props.mirrorTargetMonitorIds, monitorId]
    : props.mirrorTargetMonitorIds.filter((id) => id !== monitorId);

  emit('update:mirrorTargetMonitorIds', Array.from(new Set(nextTargetIds)));
};

</script>

<template>
  <section class="space-y-4">
    <div
      class="glass-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      data-testid="monitor-availability-panel"
      data-monitor-section="availability"
    >
      <div>
        <p class="section-kicker">Monitores disponibles</p>
        <p class="mt-1 text-sm text-slate-200/90">
          Mostrando {{ props.monitors.length }} de {{ props.totalMonitors }}
          {{ props.showOnlyProjectable ? '(solo proyectables)' : '(todos)' }}
        </p>
      </div>

      <div class="monitor-toolbar-actions">
        <button
          type="button"
          class="btn-with-icon btn-sm rounded-xl border px-4"
          :class="props.showOnlyProjectable
            ? 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
            : 'border-slate-500/40 bg-slate-700/30 text-slate-100 hover:bg-slate-700/45'"
          @click="emit('update:showOnlyProjectable', !props.showOnlyProjectable)"
        >
          <EyeIcon v-if="props.showOnlyProjectable" aria-hidden="true" class="btn-icon" />
          <EyeSlashIcon v-else aria-hidden="true" class="btn-icon" />
          {{ props.showOnlyProjectable ? 'Ver todos' : 'Ver solo proyectables' }}
        </button>

        <button
          data-testid="monitorlist-close-all"
          type="button"
          class="btn-with-icon btn-sm btn-rose-soft"
          :disabled="!props.canCloseAllWindows"
          :aria-disabled="!props.canCloseAllWindows"
          @click="emit('closeAll')"
        >
          <XMarkIcon aria-hidden="true" class="btn-icon" />
          Cerrar todas las ventanas
        </button>
      </div>
    </div>

    <p
      v-if="fullscreenLossLabels.length > 0"
      data-testid="fullscreen-loss-feedback"
      class="app-alert app-alert--amber"
    >
      Fullscreen se desactivo fuera de la app en: {{ fullscreenLossLabels.join(', ') }}.
      Pide reactivacion rapida con "Reactivar fullscreen".
    </p>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-2" data-testid="monitor-cards-section" data-monitor-section="cards">
      <MonitorCard
        v-for="monitor in props.monitors"
        :key="monitor.id"
        :monitor="monitor"
        :state="props.states[monitor.id]"
        :thumbnail="props.thumbnails[monitor.id] ?? { imageDataUrl: null, capturedAtMs: null }"
        :is-file-import-blocked="props.isFileImportBlocked"
        :file-import-blocked-message="props.fileImportBlockedMessage"
        @open-window="emit('openWindow', $event)"
        @request-fullscreen="emit('requestFullscreen', $event)"
        @close-window="emit('closeWindow', $event)"
        @upload-image="(id, file) => emit('uploadImage', id, file)"
        @clear-image="emit('clearImage', $event)"
        @rename-monitor="(id, name) => emit('renameMonitor', id, name)"
        @transform="(id, action) => emit('transform', id, action)"
      />
    </div>

    <div class="surface-panel space-y-3 px-4 py-3" data-testid="mirror-mode-panel" data-monitor-section="mirror">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="section-kicker">Modo espejo</p>
        <span class="text-xs text-slate-300/80" data-testid="mirror-target-count">
          {{ props.mirrorTargetMonitorIds.length }} destino(s) configurado(s)
        </span>
      </div>

      <button
        id="mirror-mode-enabled"
        data-testid="mirror-mode-toggle-btn"
        type="button"
        class="btn-with-icon btn-sm rounded-xl border px-4"
        :class="props.mirrorEnabled
          ? 'border-rose-300/40 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30'
          : 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'"
        :aria-pressed="props.mirrorEnabled"
        @click="emit('update:mirrorEnabled', !props.mirrorEnabled)"
      >
        <StopIcon v-if="props.mirrorEnabled" aria-hidden="true" class="btn-icon" />
        <PlayIcon v-else aria-hidden="true" class="btn-icon" />
        {{ mirrorActionLabel }}
      </button>

      <label class="form-field" for="mirror-source-select">
        Monitor origen
        <select
          id="mirror-source-select"
          data-testid="mirror-source-select"
          class="form-control"
          :value="props.mirrorSourceMonitorId ?? ''"
          @change="emit('update:mirrorSourceMonitorId', ($event.target as HTMLSelectElement).value || null)"
        >
          <option value="">Selecciona un origen</option>
          <option
            v-for="monitor in props.monitors"
            :key="monitor.id"
            :value="monitor.id"
          >
            {{ monitor.label }}
          </option>
        </select>
      </label>

      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300/80">Destinos espejo</p>
        <p v-if="mirrorDestinationOptions.length === 0" class="text-xs text-slate-300/80">
          Selecciona un origen para habilitar destinos espejo.
        </p>
        <div v-else class="grid grid-cols-1 gap-2 md:grid-cols-2">
          <AppCheckbox
            v-for="monitor in mirrorDestinationOptions"
            :id="`mirror-target-${monitor.id}`"
            :key="monitor.id"
            :model-value="selectedMirrorTargetIdSet.has(monitor.id)"
            :label="monitor.label"
            :disabled="!props.mirrorSourceMonitorId"
            @update:model-value="onMirrorTargetToggle(monitor.id, $event)"
          />
        </div>
      </div>

      <p class="text-xs text-slate-200/90" data-testid="mirror-feedback">
        <template v-if="!props.mirrorEnabled">Modo espejo desactivado.</template>
        <template v-else-if="!props.mirrorSourceMonitorId">Define un monitor origen para comenzar la replicacion.</template>
        <template v-else>
          Origen: {{ monitorLabelById(props.mirrorSourceMonitorId) }}. Destinos activos: {{ props.mirrorActiveTargetCount }}/{{ props.mirrorTargetMonitorIds.length }}.
        </template>
      </p>

      <p v-if="unavailableMirrorTargetLabels.length > 0" class="text-xs text-amber-200/90" data-testid="mirror-unavailable-feedback">
        Destinos no disponibles: {{ unavailableMirrorTargetLabels.join(', ') }}.
      </p>
      <p v-if="props.mirrorLastError" class="text-xs text-amber-200/90" data-testid="mirror-last-error">
        {{ props.mirrorLastError }}
      </p>
    </div>

    <div class="surface-panel space-y-3 px-4 py-3" data-testid="layout-manager-panel" data-monitor-section="layouts">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="section-kicker">Layouts guardados</p>
        <span class="text-xs text-slate-300/80" data-testid="layout-count">
          {{ props.layouts.length === 0 ? 'Sin layouts' : `${props.layouts.length} guardado(s)` }}
        </span>
      </div>

      <div class="form-row">
        <label class="form-field" for="layout-name-input">
          Nombre del layout
          <input
            id="layout-name-input"
            data-testid="layout-name-input"
            type="text"
            class="form-control"
            :value="props.layoutDraftName"
            placeholder="Ej: Escenario principal"
            @input="emit('update:layoutDraftName', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <label class="form-field" for="layout-select">
          Layout disponible
          <select
            id="layout-select"
            data-testid="layout-select"
            class="form-control"
            :value="props.selectedLayoutId ?? ''"
            @change="emit('update:selectedLayoutId', ($event.target as HTMLSelectElement).value || null)"
          >
            <option value="">{{ props.layouts.length === 0 ? 'No hay layouts guardados' : 'Selecciona un layout' }}</option>
            <option
              v-for="layout in props.layouts"
              :key="layout.id"
              :value="layout.id"
            >
              {{ layout.name }} (actualizado {{ new Date(layout.updatedAt).toLocaleString('es-AR') }})
            </option>
          </select>
        </label>
      </div>

      <div class="monitor-toolbar-actions">
        <button
          type="button"
          data-testid="layout-save-btn"
          class="btn-with-icon btn-sm btn-indigo-soft"
          @click="emit('saveLayout')"
        >
          <ArrowDownTrayIcon aria-hidden="true" class="btn-icon" />
          Guardar layout
        </button>

        <button
          type="button"
          data-testid="layout-load-btn"
          class="btn-with-icon btn-sm btn-emerald-soft"
          :disabled="!props.selectedLayoutId"
          :aria-disabled="!props.selectedLayoutId"
          @click="emit('loadLayout')"
        >
          <ArrowDownTrayIcon aria-hidden="true" class="btn-icon" />
          Cargar layout
        </button>

        <button
          type="button"
          data-testid="layout-delete-btn"
          class="btn-with-icon btn-sm btn-rose-soft"
          :disabled="!props.selectedLayoutId"
          :aria-disabled="!props.selectedLayoutId"
          @click="emit('deleteLayout')"
        >
          <TrashIcon aria-hidden="true" class="btn-icon" />
          Eliminar layout
        </button>
      </div>

      <p
        v-if="props.layoutFeedback"
        data-testid="layout-feedback"
        class="text-xs text-slate-200/90"
      >
        {{ props.layoutFeedback }}
      </p>
    </div>

    <p
      v-if="props.showOnlyProjectable && props.monitors.length === 0"
      class="app-alert app-alert--amber"
    >
      No hay monitores proyectables disponibles. La ventana principal esta ocupando el unico monitor detectado.
    </p>

  </section>
</template>
