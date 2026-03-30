<script setup lang="ts">
import { ArrowDownTrayIcon, EyeIcon, EyeSlashIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import MonitorCard from './MonitorCard.vue';
import type { MonitorDescriptor, MonitorStateMap } from '../types/broadcaster';

defineProps<{
  monitors: MonitorDescriptor[];
  states: MonitorStateMap;
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
}>();

const emit = defineEmits<{
  'update:showOnlyProjectable': [value: boolean];
  'update:layoutDraftName': [value: string];
  'update:selectedLayoutId': [value: string | null];
  closeAll: [];
  saveLayout: [];
  loadLayout: [];
  deleteLayout: [];
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
  <section class="space-y-4">
    <div class="glass-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div>
        <p class="section-kicker">Monitores disponibles</p>
        <p class="mt-1 text-sm text-slate-200/90">
          Mostrando {{ monitors.length }} de {{ totalMonitors }}
          {{ showOnlyProjectable ? '(solo proyectables)' : '(todos)' }}
        </p>
      </div>

      <div class="monitor-toolbar-actions">
        <button
          type="button"
          class="btn-with-icon btn-sm rounded-xl border px-4"
          :class="showOnlyProjectable
            ? 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
            : 'border-slate-500/40 bg-slate-700/30 text-slate-100 hover:bg-slate-700/45'"
          @click="emit('update:showOnlyProjectable', !showOnlyProjectable)"
        >
          <EyeIcon v-if="showOnlyProjectable" aria-hidden="true" class="btn-icon" />
          <EyeSlashIcon v-else aria-hidden="true" class="btn-icon" />
          {{ showOnlyProjectable ? 'Ver todos' : 'Ver solo proyectables' }}
        </button>

        <button
          data-testid="monitorlist-close-all"
          type="button"
          class="btn-with-icon btn-sm btn-rose-soft"
          :disabled="!canCloseAllWindows"
          :aria-disabled="!canCloseAllWindows"
          @click="emit('closeAll')"
        >
          <XMarkIcon aria-hidden="true" class="btn-icon" />
          Cerrar todas las ventanas
        </button>
      </div>
    </div>

    <div class="surface-panel space-y-3 px-4 py-3" data-testid="layout-manager-panel">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="section-kicker">Layouts guardados</p>
        <span class="text-xs text-slate-300/80" data-testid="layout-count">
          {{ layouts.length === 0 ? 'Sin layouts' : `${layouts.length} guardado(s)` }}
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
            :value="layoutDraftName"
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
            :value="selectedLayoutId ?? ''"
            @change="emit('update:selectedLayoutId', ($event.target as HTMLSelectElement).value || null)"
          >
            <option value="">{{ layouts.length === 0 ? 'No hay layouts guardados' : 'Selecciona un layout' }}</option>
            <option
              v-for="layout in layouts"
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
          :disabled="!selectedLayoutId"
          :aria-disabled="!selectedLayoutId"
          @click="emit('loadLayout')"
        >
          <ArrowDownTrayIcon aria-hidden="true" class="btn-icon" />
          Cargar layout
        </button>

        <button
          type="button"
          data-testid="layout-delete-btn"
          class="btn-with-icon btn-sm btn-rose-soft"
          :disabled="!selectedLayoutId"
          :aria-disabled="!selectedLayoutId"
          @click="emit('deleteLayout')"
        >
          <TrashIcon aria-hidden="true" class="btn-icon" />
          Eliminar layout
        </button>
      </div>

      <p
        v-if="layoutFeedback"
        data-testid="layout-feedback"
        class="text-xs text-slate-200/90"
      >
        {{ layoutFeedback }}
      </p>
    </div>

    <p
      v-if="showOnlyProjectable && monitors.length === 0"
      class="app-alert app-alert--amber"
    >
      No hay monitores proyectables disponibles. La ventana principal esta ocupando el unico monitor detectado.
    </p>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <MonitorCard
        v-for="monitor in monitors"
        :key="monitor.id"
        :monitor="monitor"
        :state="states[monitor.id]"
        @open-window="emit('openWindow', $event)"
        @close-window="emit('closeWindow', $event)"
        @request-fullscreen="emit('requestFullscreen', $event)"
        @upload-image="(id, file) => emit('uploadImage', id, file)"
        @clear-image="emit('clearImage', $event)"
        @transform="(id, action) => emit('transform', id, action)"
      />
    </div>
  </section>
</template>
