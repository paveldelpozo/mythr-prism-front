<script setup lang="ts">
import MonitorCard from './MonitorCard.vue';
import type { MonitorDescriptor, MonitorStateMap } from '../types/broadcaster';

defineProps<{
  monitors: MonitorDescriptor[];
  states: MonitorStateMap;
  showOnlyProjectable: boolean;
  totalMonitors: number;
}>();

const emit = defineEmits<{
  'update:showOnlyProjectable': [value: boolean];
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
        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300/85">Monitores disponibles</p>
        <p class="mt-1 text-sm text-slate-200/90">
          Mostrando {{ monitors.length }} de {{ totalMonitors }}
          {{ showOnlyProjectable ? '(solo proyectables)' : '(todos)' }}
        </p>
      </div>

      <button
        type="button"
        class="rounded-xl border px-4 py-2 text-xs font-semibold transition"
        :class="showOnlyProjectable
          ? 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
          : 'border-slate-500/40 bg-slate-700/30 text-slate-100 hover:bg-slate-700/45'"
        @click="emit('update:showOnlyProjectable', !showOnlyProjectable)"
      >
        {{ showOnlyProjectable ? 'Ver todos' : 'Ver solo proyectables' }}
      </button>
    </div>

    <p
      v-if="showOnlyProjectable && monitors.length === 0"
      class="glass-panel border-amber-300/35 bg-amber-900/20 p-4 text-sm text-amber-100"
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
