<script setup lang="ts">
import AppHeader from './components/AppHeader.vue';
import MonitorList from './components/MonitorList.vue';
import { useMultiMonitorBroadcaster } from './composables/useMultiMonitorBroadcaster';

const {
  applyTransform,
  closeAllWindows,
  closeWindow,
  globalError,
  hasDetectedMonitors,
  isLoadingMonitors,
  isWindowManagementSupported,
  monitorStates,
  monitors,
  loadMonitors,
  openWindowForMonitor,
  requestFullscreen,
  setImageForMonitor
} = useMultiMonitorBroadcaster();

const uploadImage = (monitorId: string, file: File) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    const data = event.target?.result;
    if (typeof data === 'string') {
      setImageForMonitor(monitorId, data);
    }
  };
  reader.onerror = () => {
    setImageForMonitor(monitorId, null);
  };
  reader.readAsDataURL(file);
};
</script>

<template>
  <main class="relative min-h-screen overflow-hidden px-4 py-8 text-slate-100 md:px-8">
    <div class="app-bg-shape app-bg-shape--one" />
    <div class="app-bg-shape app-bg-shape--two" />

    <div class="relative mx-auto max-w-7xl space-y-6">
      <AppHeader :has-monitors="hasDetectedMonitors" @close-all="closeAllWindows" />

      <section
        v-if="!isWindowManagementSupported"
        class="glass-panel border-rose-300/35 bg-rose-900/20 p-5 text-rose-100"
      >
        <p class="text-sm font-semibold">
          Este navegador no soporta Window Management API (`getScreenDetails`).
        </p>
        <p class="mt-1 text-sm text-rose-100/90">
          Usa Chrome/Edge actualizados y concede permiso para deteccion de pantallas.
        </p>
      </section>

      <section
        v-else-if="!hasDetectedMonitors"
        class="glass-panel flex flex-col items-center gap-5 px-6 py-16 text-center"
      >
        <p class="max-w-xl text-sm text-slate-200/90">
          Detecta pantallas para iniciar la sesion multi-monitor. Se solicitara permiso del navegador para acceder al detalle de monitores.
        </p>
        <button
          type="button"
          class="rounded-2xl border border-indigo-300/35 bg-indigo-500/25 px-8 py-4 text-sm font-bold tracking-wide text-indigo-50 transition hover:bg-indigo-500/35 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isLoadingMonitors"
          @click="loadMonitors"
        >
          {{ isLoadingMonitors ? 'Detectando monitores...' : 'Detectar pantallas' }}
        </button>
      </section>

      <MonitorList
        v-else
        :monitors="monitors"
        :states="monitorStates"
        @open-window="openWindowForMonitor"
        @close-window="closeWindow"
        @request-fullscreen="requestFullscreen"
        @upload-image="uploadImage"
        @clear-image="(id) => setImageForMonitor(id, null)"
        @transform="applyTransform"
      />

      <section
        v-if="globalError"
        class="glass-panel border-amber-300/35 bg-amber-900/20 p-4 text-sm text-amber-100"
      >
        {{ globalError }}
      </section>
    </div>
  </main>
</template>
