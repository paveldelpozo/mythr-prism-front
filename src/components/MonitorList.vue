<script setup lang="ts">
import MonitorCard from './MonitorCard.vue';
import type { MonitorDescriptor, MonitorStateMap } from '../types/broadcaster';

defineProps<{
  monitors: MonitorDescriptor[];
  states: MonitorStateMap;
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
  <section class="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
  </section>
</template>
