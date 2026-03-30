<script setup lang="ts">
import { ComputerDesktopIcon, QueueListIcon } from '@heroicons/vue/24/outline';

defineProps<{
  activeMainViewTab: 'monitors' | 'playlist';
}>();

const emit = defineEmits<{
  'update:activeMainViewTab': [value: 'monitors' | 'playlist'];
}>();
</script>

<template>
  <header class="glass-panel flex flex-wrap items-center justify-between gap-4 p-5">
    <div>
      <p class="text-xs uppercase tracking-[0.24em] text-indigo-300/80">Mythr Prism</p>
      <h1 class="mt-1 text-2xl font-black text-slate-100 md:text-3xl">Panel de Control Multi-Monitor</h1>
    </div>

    <div class="app-header-actions">
      <div
        role="tablist"
        aria-label="Secciones de trabajo"
        class="app-tabs app-tabs--header"
      >
        <button
          id="tab-monitors"
          data-testid="tab-monitors"
          type="button"
          role="tab"
          :aria-selected="activeMainViewTab === 'monitors'"
          aria-controls="panel-monitors"
          :tabindex="activeMainViewTab === 'monitors' ? 0 : -1"
          class="app-tab-btn"
          :class="activeMainViewTab === 'monitors'
            ? 'app-tab-btn--active'
            : 'app-tab-btn--inactive'"
          @click="emit('update:activeMainViewTab', 'monitors')"
        >
          <ComputerDesktopIcon aria-hidden="true" class="btn-icon" />
          Monitores
        </button>

        <button
          id="tab-playlist"
          data-testid="tab-playlist"
          type="button"
          role="tab"
          :aria-selected="activeMainViewTab === 'playlist'"
          aria-controls="panel-playlist"
          :tabindex="activeMainViewTab === 'playlist' ? 0 : -1"
          class="app-tab-btn"
          :class="activeMainViewTab === 'playlist'
            ? 'app-tab-btn--active'
            : 'app-tab-btn--inactive'"
          @click="emit('update:activeMainViewTab', 'playlist')"
        >
          <QueueListIcon aria-hidden="true" class="btn-icon" />
          Playlist
        </button>
      </div>
    </div>
  </header>
</template>
