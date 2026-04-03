<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { QrCodeIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import type { PairingRoomInfo } from '../types/remoteSync';

const props = defineProps<{
  open: boolean;
  room: PairingRoomInfo | null;
  pendingApprovals: Array<{ clientSocketId: string; requestedAtMs: number }>;
  isConnecting: boolean;
  expiresInMs: number;
  error: string | null;
}>();

const emit = defineEmits<{
  close: [];
  createRoom: [];
  approveClient: [clientSocketId: string];
}>();

const closeButtonRef = ref<HTMLButtonElement | null>(null);
const expiresInLabel = computed(() => {
  const totalSeconds = Math.ceil(props.expiresInMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
});

const qrUrl = computed(() => {
  if (!props.room) {
    return null;
  }

  const payload = encodeURIComponent(props.room.joinUrl);
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${payload}`;
});

const onWindowKeydown = (event: KeyboardEvent) => {
  if (!props.open || event.key !== 'Escape') {
    return;
  }

  emit('close');
};

watch(() => props.open, (nextOpen) => {
  if (!nextOpen) {
    return;
  }

  void nextTick(() => {
    closeButtonRef.value?.focus();
  });
});

watch(() => props.open, (nextOpen) => {
  if (!nextOpen) {
    document.body.style.overflow = '';
    return;
  }

  document.body.style.overflow = 'hidden';
});

window.addEventListener('keydown', onWindowKeydown);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="app-modal-overlay" role="dialog" aria-modal="true" aria-label="Emparejar monitor remoto">
      <article class="app-modal-panel app-modal-panel--md">
        <header class="app-modal-header">
          <div>
            <p class="section-kicker">Monitor Virtual Remoto</p>
            <h2 class="text-lg font-semibold text-slate-100">Emparejamiento Cloud Sync</h2>
          </div>
          <button
            ref="closeButtonRef"
            type="button"
            class="btn-icon-only btn-slate-soft"
            aria-label="Cerrar emparejamiento remoto"
            @click="emit('close')"
          >
            <XMarkIcon aria-hidden="true" class="btn-icon" />
          </button>
        </header>

        <div class="app-modal-body space-y-4">
          <p class="text-sm text-slate-200/90">
            Crea una sala para vincular tablets o moviles como monitores remotos de la sesion.
          </p>

          <button
            v-if="!room"
            type="button"
            class="btn-with-icon btn-sm btn-indigo-soft"
            :disabled="isConnecting"
            @click="emit('createRoom')"
          >
            <QrCodeIcon aria-hidden="true" class="btn-icon" />
            {{ isConnecting ? 'Creando sala...' : 'Crear sala de pairing' }}
          </button>

          <template v-else>
            <p class="text-xs text-slate-300/80">
              Sala <strong>{{ room.roomId }}</strong> expira en <strong>{{ expiresInLabel }}</strong> si no entra el primer cliente.
            </p>

            <div class="grid gap-4 md:grid-cols-[280px_1fr]">
              <div class="rounded-2xl bg-slate-900/70 p-2">
                <img v-if="qrUrl" :src="qrUrl" alt="QR de acceso remoto" class="h-auto w-full rounded-xl">
              </div>

              <div class="space-y-3">
                <p class="text-xs text-slate-300/85">URL de acceso remoto</p>
                <input class="form-control" :value="room.joinUrl" readonly>

                <p class="text-xs text-slate-300/85">Codigo para cliente</p>
                <input class="form-control font-mono tracking-[0.2em]" :value="room.pairCode" readonly>
              </div>
            </div>

            <div class="space-y-2">
              <p class="text-xs uppercase tracking-[0.12em] text-slate-300/80">Solicitudes pendientes</p>
              <p v-if="pendingApprovals.length === 0" class="text-sm text-slate-300/80">Aun no hay clientes solicitando validacion.</p>
              <div v-else class="space-y-2">
                <div
                  v-for="approval in pendingApprovals"
                  :key="approval.clientSocketId"
                  class="flex items-center justify-between rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-2"
                >
                  <div>
                    <p class="text-xs text-slate-300">Cliente {{ approval.clientSocketId }}</p>
                    <p class="text-[11px] text-slate-400">Solicitud {{ new Date(approval.requestedAtMs).toLocaleTimeString('es-AR') }}</p>
                  </div>
                  <button type="button" class="btn-with-icon btn-sm btn-emerald-soft" @click="emit('approveClient', approval.clientSocketId)">
                    Aprobar
                  </button>
                </div>
              </div>
            </div>
          </template>

          <p v-if="error" class="app-alert app-alert--amber">{{ error }}</p>
        </div>

        <footer class="app-modal-footer">
          <button type="button" class="btn-with-icon btn-sm btn-slate-soft" @click="emit('close')">Cerrar</button>
        </footer>
      </article>
    </div>
  </Teleport>
</template>
