<script setup lang="ts">
defineProps<{
  hasMonitors: boolean;
}>();

const emit = defineEmits<{
  closeAll: [];
}>();
</script>

<template>
  <header class="glass-panel flex flex-wrap items-center justify-between gap-4 p-5">
    <div>
      <p class="text-xs uppercase tracking-[0.24em] text-indigo-300/80">Mythr Prism</p>
      <h1 class="mt-1 text-2xl font-black text-slate-100 md:text-3xl">Panel de Control Multi-Monitor</h1>
    </div>

    <button
      v-if="hasMonitors"
      type="button"
      class="rounded-xl border border-rose-300/40 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/25"
      @click="emit('closeAll')"
    >
      Cerrar todas las ventanas
    </button>
  </header>
</template>
