<script setup lang="ts">
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowsPointingOutIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
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
    <div class="surface-panel">
      <label class="section-kicker-muted mb-2 block text-[11px]">Imagen local</label>
      <div class="flex items-center gap-2">
        <input
          type="file"
          accept="image/*"
          class="form-file-control mt-0 text-xs text-slate-200 file:mr-3 file:bg-indigo-500 file:px-3 file:py-1.5 file:text-white"
          @change="onFileChange"
        />
        <button
          type="button"
          class="btn-with-icon btn-sm btn-rose-soft shrink-0"
          @click="emit('clearImage', monitorId)"
        >
          <TrashIcon aria-hidden="true" class="btn-icon" />
          Limpiar
        </button>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <div class="surface-panel">
        <p class="section-kicker-muted mb-2 text-[11px]">Rotacion</p>
        <div class="grid grid-cols-2 gap-2">
          <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'rotate', value: -90 })">
            <ArrowUturnLeftIcon aria-hidden="true" class="btn-icon" />
            Rotar -90
          </button>
          <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'rotate', value: 90 })">
            <ArrowUturnRightIcon aria-hidden="true" class="btn-icon" />
            Rotar +90
          </button>
        </div>
      </div>

      <div class="surface-panel">
        <p class="section-kicker-muted mb-2 text-[11px]">Escala</p>
        <div class="grid grid-cols-3 gap-2">
          <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'scale', value: -0.1 })">
            <MagnifyingGlassMinusIcon aria-hidden="true" class="btn-icon" />
            Reducir
          </button>
          <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'reset' })">
            <ArrowPathIcon aria-hidden="true" class="btn-icon" />
            Reset
          </button>
          <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'scale', value: 0.1 })">
            <MagnifyingGlassPlusIcon aria-hidden="true" class="btn-icon" />
            Aumentar
          </button>
        </div>
      </div>
    </div>

    <div class="surface-panel">
      <p class="section-kicker-muted mb-2 text-[11px]">Posicion</p>
      <div class="mx-auto grid w-full max-w-sm grid-cols-2 gap-2 sm:grid-cols-4">
        <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'move', value: { y: -40 } })">
          <ArrowUpIcon aria-hidden="true" class="btn-icon" />
          Arriba
        </button>
        <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'move', value: { y: 40 } })">
          <ArrowDownIcon aria-hidden="true" class="btn-icon" />
          Abajo
        </button>
        <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'move', value: { x: -40 } })">
          <ArrowLeftIcon aria-hidden="true" class="btn-icon" />
          Izquierda
        </button>
        <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'move', value: { x: 40 } })">
          <ArrowRightIcon aria-hidden="true" class="btn-icon" />
          Derecha
        </button>
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="btn-with-icon btn-sm btn-indigo-soft"
        @click="emit('requestFullscreen', monitorId)"
      >
        <ArrowsPointingOutIcon aria-hidden="true" class="btn-icon" />
        Solicitar fullscreen
      </button>

      <button
        type="button"
        class="btn-with-icon btn-sm btn-rose-soft"
        @click="emit('closeWindow', monitorId)"
      >
        <XMarkIcon aria-hidden="true" class="btn-icon" />
        Cerrar ventana
      </button>
    </div>

    <p class="text-xs text-slate-300/80">
      Transform: scale {{ state.transform.scale.toFixed(2) }} | rotate {{ state.transform.rotate }}deg | x {{ state.transform.translateX }} | y {{ state.transform.translateY }}
    </p>
  </div>
</template>
