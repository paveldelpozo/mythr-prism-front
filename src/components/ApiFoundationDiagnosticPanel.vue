<script setup lang="ts">
import type { FoundationRealtimeServerEvent, SystemStatusResponse } from '../types/fullControlApi';

defineProps<{
  enabled: boolean;
  status: SystemStatusResponse | null;
  monitorCount: number | null;
  realtimeConnected: boolean;
  error: string | null;
  lastRealtimeEvent: FoundationRealtimeServerEvent | null;
}>();
</script>

<template>
  <section class="glass-panel p-4" aria-live="polite">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">V2 API Foundation Diagnostics</h2>
      <span
        class="rounded-full px-3 py-1 text-xs font-semibold"
        :class="realtimeConnected ? 'bg-emerald-500/25 text-emerald-100' : 'bg-slate-700/60 text-slate-200'"
      >
        {{ realtimeConnected ? 'Realtime connected' : 'Realtime disconnected' }}
      </span>
    </div>

    <p v-if="!enabled" class="mt-3 text-sm text-amber-100">{{ error }}</p>

    <div v-else class="mt-3 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
      <p><strong class="text-slate-100">Service:</strong> {{ status?.service ?? 'pending' }}</p>
      <p><strong class="text-slate-100">API version:</strong> {{ status?.apiVersion ?? 'pending' }}</p>
      <p><strong class="text-slate-100">Monitor records:</strong> {{ monitorCount ?? 'pending' }}</p>
      <p><strong class="text-slate-100">Last event:</strong> {{ lastRealtimeEvent?.type ?? 'pending' }}</p>
      <p class="md:col-span-2"><strong class="text-slate-100">Last status timestamp:</strong> {{ status?.timestamp ?? 'pending' }}</p>
      <p v-if="error" class="md:col-span-2 text-rose-200">{{ error }}</p>
    </div>
  </section>
</template>
