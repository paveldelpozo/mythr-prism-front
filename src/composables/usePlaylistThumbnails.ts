import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { MultimediaItem, VideoMultimediaItem } from '../types/playlist';
import { captureVideoThumbnail } from '../services/videoThumbnail';

type ThumbnailStatus = 'ready' | 'loading' | 'error';

export interface PlaylistItemThumbnail {
  status: ThumbnailStatus;
  source: string | null;
  message: string;
}

interface VideoThumbnailJob {
  itemId: string;
  cacheKey: string;
  source: string;
  startAtMs: number;
}

const VIDEO_THUMBNAIL_CONCURRENCY = 2;
const VIDEO_THUMBNAIL_TIMEOUT_MS = 5000;
const VIDEO_LOADING_MESSAGE = 'Generando preview...';
const VIDEO_FALLBACK_MESSAGE = 'Preview no disponible';

const buildVideoThumbnailCacheKey = (item: VideoMultimediaItem): string =>
  `${item.source}::${item.startAtMs}`;

export const usePlaylistThumbnails = (items: Ref<MultimediaItem[]>) => {
  const thumbnails = ref<Record<string, PlaylistItemThumbnail>>({});
  const cacheByVideoSource = new Map<string, string>();
  const inProgressByItemId = new Map<string, AbortController>();
  const inProgressCacheKeyByItemId = new Map<string, string>();
  const queuedItemIds = new Set<string>();
  let queue: VideoThumbnailJob[] = [];
  let activeJobs = 0;

  const setThumbnail = (itemId: string, thumbnail: PlaylistItemThumbnail) => {
    thumbnails.value = {
      ...thumbnails.value,
      [itemId]: thumbnail
    };
  };

  const removeThumbnail = (itemId: string) => {
    if (!(itemId in thumbnails.value)) {
      return;
    }

    const nextThumbnails = { ...thumbnails.value };
    delete nextThumbnails[itemId];
    thumbnails.value = nextThumbnails;
  };

  const abortForItem = (itemId: string) => {
    const controller = inProgressByItemId.get(itemId);
    if (!controller) {
      return;
    }

    controller.abort();
    inProgressByItemId.delete(itemId);
    inProgressCacheKeyByItemId.delete(itemId);
  };

  const removeStaleQueueJobs = () => {
    const itemById = new Map(items.value.map((item) => [item.id, item]));
    queue = queue.filter((job) => {
      const currentItem = itemById.get(job.itemId);
      if (!currentItem || currentItem.kind !== 'video') {
        queuedItemIds.delete(job.itemId);
        return false;
      }

      if (buildVideoThumbnailCacheKey(currentItem) !== job.cacheKey) {
        queuedItemIds.delete(job.itemId);
        return false;
      }

      return true;
    });
  };

  const runJob = async (job: VideoThumbnailJob) => {
    activeJobs += 1;
    const controller = new AbortController();
    inProgressByItemId.set(job.itemId, controller);
    inProgressCacheKeyByItemId.set(job.itemId, job.cacheKey);

    try {
      const thumbnailSource = await captureVideoThumbnail({
        source: job.source,
        startAtMs: job.startAtMs,
        timeoutMs: VIDEO_THUMBNAIL_TIMEOUT_MS,
        signal: controller.signal
      });

      cacheByVideoSource.set(job.cacheKey, thumbnailSource);

      const currentItem = items.value.find((item) => item.id === job.itemId);
      if (!currentItem || currentItem.kind !== 'video') {
        return;
      }

      if (buildVideoThumbnailCacheKey(currentItem) !== job.cacheKey) {
        return;
      }

      setThumbnail(job.itemId, {
        status: 'ready',
        source: thumbnailSource,
        message: ''
      });
    } catch {
      const currentItem = items.value.find((item) => item.id === job.itemId);
      if (!currentItem || currentItem.kind !== 'video') {
        return;
      }

      if (buildVideoThumbnailCacheKey(currentItem) !== job.cacheKey) {
        return;
      }

      setThumbnail(job.itemId, {
        status: 'error',
        source: null,
        message: VIDEO_FALLBACK_MESSAGE
      });
    } finally {
      inProgressByItemId.delete(job.itemId);
      inProgressCacheKeyByItemId.delete(job.itemId);
      activeJobs = Math.max(0, activeJobs - 1);
      runQueue();
    }
  };

  const runQueue = () => {
    if (queue.length === 0 || activeJobs >= VIDEO_THUMBNAIL_CONCURRENCY) {
      return;
    }

    while (queue.length > 0 && activeJobs < VIDEO_THUMBNAIL_CONCURRENCY) {
      const nextJob = queue.shift();
      if (!nextJob) {
        continue;
      }

      queuedItemIds.delete(nextJob.itemId);
      void runJob(nextJob);
    }
  };

  const queueVideoThumbnail = (item: VideoMultimediaItem) => {
    const cacheKey = buildVideoThumbnailCacheKey(item);
    const cachedThumbnail = cacheByVideoSource.get(cacheKey);
    if (cachedThumbnail) {
      setThumbnail(item.id, {
        status: 'ready',
        source: cachedThumbnail,
        message: ''
      });
      return;
    }

    if (inProgressByItemId.has(item.id) || queuedItemIds.has(item.id)) {
      return;
    }

    setThumbnail(item.id, {
      status: 'loading',
      source: null,
      message: VIDEO_LOADING_MESSAGE
    });

    queuedItemIds.add(item.id);
    queue.push({
      itemId: item.id,
      cacheKey,
      source: item.source,
      startAtMs: item.startAtMs
    });
    runQueue();
  };

  const syncThumbnails = () => {
    const itemIds = new Set(items.value.map((item) => item.id));

    for (const [itemId] of inProgressByItemId) {
      if (itemIds.has(itemId)) {
        continue;
      }

      abortForItem(itemId);
    }

    removeStaleQueueJobs();

    for (const itemId of Object.keys(thumbnails.value)) {
      if (itemIds.has(itemId)) {
        continue;
      }

      removeThumbnail(itemId);
    }

    for (const item of items.value) {
      if (item.kind === 'image') {
        abortForItem(item.id);
        setThumbnail(item.id, {
          status: 'ready',
          source: item.source,
          message: ''
        });
        continue;
      }

      const currentInProgressKey = inProgressCacheKeyByItemId.get(item.id);
      const currentCacheKey = buildVideoThumbnailCacheKey(item);
      if (currentInProgressKey && currentInProgressKey !== currentCacheKey) {
        abortForItem(item.id);
      }

      queueVideoThumbnail(item);
    }
  };

  watch(items, syncThumbnails, { deep: true, immediate: true });

  onBeforeUnmount(() => {
    for (const [itemId] of inProgressByItemId) {
      abortForItem(itemId);
    }

    queue = [];
    queuedItemIds.clear();
  });

  const getItemThumbnail = (item: MultimediaItem): PlaylistItemThumbnail => {
    const thumbnail = thumbnails.value[item.id];
    if (thumbnail) {
      return thumbnail;
    }

    if (item.kind === 'image') {
      return {
        status: 'ready',
        source: item.source,
        message: ''
      };
    }

    return {
      status: 'loading',
      source: null,
      message: VIDEO_LOADING_MESSAGE
    };
  };

  return {
    getItemThumbnail
  };
};
