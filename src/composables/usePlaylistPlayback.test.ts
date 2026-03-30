import { mount } from '@vue/test-utils';
import { defineComponent, nextTick, ref, type Ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { usePlaylistPlayback } from './usePlaylistPlayback';
import type { MultimediaItem, PlaylistPlaybackState } from '../types/playlist';

interface HarnessResult {
  api: ReturnType<typeof usePlaylistPlayback>;
  items: Ref<MultimediaItem[]>;
  playback: Ref<PlaylistPlaybackState>;
  applied: Array<{ monitorId: string; item: MultimediaItem | null }>;
}

const createHarness = (
  seedItems: MultimediaItem[],
  seedPlayback?: Partial<PlaylistPlaybackState>
): HarnessResult => {
  const items = ref<MultimediaItem[]>(seedItems);
  const playback = ref<PlaylistPlaybackState>({
    targetMonitorId: 'm1',
    currentIndex: 0,
    autoplay: false,
    intervalSeconds: 5,
    ...seedPlayback
  });
  const applied: Array<{ monitorId: string; item: MultimediaItem | null }> = [];
  let api!: ReturnType<typeof usePlaylistPlayback>;

  const Host = defineComponent({
    setup() {
      api = usePlaylistPlayback({
        items,
        playback,
        applyItemToMonitor: (monitorId, item) => {
          applied.push({ monitorId, item });
        },
        isMonitorReady: () => true
      });

      return () => null;
    }
  });

  mount(Host);

  return { api, items, playback, applied };
};

const imageItem = (id: string, durationMs = 1500): MultimediaItem => ({
  id,
  kind: 'image',
  name: `Image ${id}`,
  source: `data:image/png;base64,${id}`,
  durationMs
});

describe('composables/usePlaylistPlayback', () => {
  it('avanza y retrocede con wrap de indice', () => {
    const { api, playback, applied } = createHarness([imageItem('a'), imageItem('b')]);

    api.next();
    expect(playback.value.currentIndex).toBe(1);
    expect(applied.at(-1)?.item?.id).toBe('b');

    api.previous();
    expect(playback.value.currentIndex).toBe(0);
    expect(applied.at(-1)?.item?.id).toBe('a');

    api.previous();
    expect(playback.value.currentIndex).toBe(1);
    expect(applied.at(-1)?.item?.id).toBe('b');
  });

  it('detiene reproduccion y limpia monitor objetivo', () => {
    const { api, playback, applied } = createHarness([imageItem('a')]);

    api.start();
    expect(api.isPlaying.value).toBe(true);

    api.stop();

    expect(api.isPlaying.value).toBe(false);
    expect(applied.at(-1)).toEqual({ monitorId: playback.value.targetMonitorId, item: null });
  });

  it('programa autoplay timer y avanza automaticamente', () => {
    vi.useFakeTimers();
    try {
      const { api, playback, applied } = createHarness([imageItem('a', 1200), imageItem('b', 1200)], {
        autoplay: true
      });

      api.start();
      expect(api.isPlaying.value).toBe(true);

      vi.advanceTimersByTime(1200);

      expect(playback.value.currentIndex).toBe(1);
      expect(applied.at(-1)?.item?.id).toBe('b');
    } finally {
      vi.useRealTimers();
    }
  });

  it('normaliza indice al cambiar limites de la playlist', async () => {
    const { items, playback } = createHarness([imageItem('a'), imageItem('b')], {
      currentIndex: 5,
      autoplay: true
    });

    items.value = [];
    await nextTick();

    expect(playback.value.currentIndex).toBe(0);
  });
});
