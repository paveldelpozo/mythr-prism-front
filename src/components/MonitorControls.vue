<script setup lang="ts">
import type { MonitorRuntimeState } from '../types/broadcaster';

const props = defineProps<{
  monitorId: string;
  state: MonitorRuntimeState;
}>();

const emit = defineEmits<{
  uploadImage: [monitorId: string, file: File];
  clearImage: [monitorId: string];
  transform: [
    monitorId: string,
    action: { type: 'rotate'; value: number } | { type: 'scale'; value: number } | { type: 'move'; value: { x?: number; y?: number } } | { type: 'reset' }
  ];
  requestFullscreen: [monitorId: string];
  closeWindow: [monitorId: string];
}>();

const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }
  emit('uploadImage', props.monitorId, file);
  target.value = '';
};
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-3">
      <label class="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Imagen local</label>
      <div class="flex items-center gap-2">
        <input
          type="file"
          accept="image/*"
          class="block w-full rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-2 text-xs text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
          @change="onFileChange"
        />
        <button
          type="button"
          class="rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/20"
          @click="emit('clearImage', monitorId)"
        >
          Limpiar
        </button>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <div class="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-3">
        <p class="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Rotacion</p>
        <div class="grid grid-cols-2 gap-2">
          <button class="control-btn" type="button" @click="emit('transform', monitorId, { type: 'rotate', value: -90 })">↺ -90</button>
          <button class="control-btn" type="button" @click="emit('transform', monitorId, { type: 'rotate', value: 90 })">↻ +90</button>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-3">
        <p class="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Escala</p>
        <div class="grid grid-cols-3 gap-2">
          <button class="control-btn" type="button" @click="emit('transform', monitorId, { type: 'scale', value: -0.1 })">-</button>
          <button class="control-btn" type="button" @click="emit('transform', monitorId, { type: 'reset' })">Reset</button>
          <button class="control-btn" type="button" @click="emit('transform', monitorId, { type: 'scale', value: 0.1 })">+</button>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-3">
      <p class="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Posicion</p>
      <div class="mx-auto grid w-max grid-cols-3 gap-2">
        <span />
        <button class="control-btn h-9 w-9" type="button" @click="emit('transform', monitorId, { type: 'move', value: { y: -40 } })">↑</button>
        <span />
        <button class="control-btn h-9 w-9" type="button" @click="emit('transform', monitorId, { type: 'move', value: { x: -40 } })">←</button>
        <button class="control-btn h-9 w-9" type="button" @click="emit('transform', monitorId, { type: 'move', value: { y: 40 } })">↓</button>
        <button class="control-btn h-9 w-9" type="button" @click="emit('transform', monitorId, { type: 'move', value: { x: 40 } })">→</button>
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-lg border border-indigo-300/30 bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/30"
        @click="emit('requestFullscreen', monitorId)"
      >
        Solicitar fullscreen
      </button>

      <button
        type="button"
        class="rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/20"
        @click="emit('closeWindow', monitorId)"
      >
        Cerrar ventana
      </button>
    </div>

    <p class="text-xs text-slate-300/80">
      Transform: scale {{ state.transform.scale.toFixed(2) }} | rotate {{ state.transform.rotate }}deg | x {{ state.transform.translateX }} | y {{ state.transform.translateY }}
    </p>
  </div>
</template>
