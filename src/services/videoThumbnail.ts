interface CaptureVideoThumbnailOptions {
  source: string;
  startAtMs: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_THUMBNAIL_WIDTH = 320;

const toSeekSeconds = (startAtMs: number, durationSeconds: number): number => {
  const targetSeconds = Math.max(0, startAtMs / 1000);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return targetSeconds;
  }

  return Math.min(targetSeconds, Math.max(0, durationSeconds - 0.05));
};

const toCanvasSize = (videoWidth: number, videoHeight: number): { width: number; height: number } => {
  if (videoWidth <= 0 || videoHeight <= 0) {
    return { width: 0, height: 0 };
  }

  if (videoWidth <= MAX_THUMBNAIL_WIDTH) {
    return {
      width: Math.round(videoWidth),
      height: Math.round(videoHeight)
    };
  }

  const ratio = MAX_THUMBNAIL_WIDTH / videoWidth;
  return {
    width: Math.round(videoWidth * ratio),
    height: Math.round(videoHeight * ratio)
  };
};

export const captureVideoThumbnail = ({
  source,
  startAtMs,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal
}: CaptureVideoThumbnailOptions): Promise<string> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const timeoutId = window.setTimeout(() => {
      fail('timeout');
    }, timeoutMs);
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onVideoError);
      video.pause();
      video.removeAttribute('src');
    };

    const succeed = (thumbnailDataUrl: string) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(thumbnailDataUrl);
    };

    const fail = (reason: string) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(new Error(`video-thumbnail:${reason}`));
    };

    const drawFrame = () => {
      const size = toCanvasSize(video.videoWidth, video.videoHeight);
      if (size.width <= 0 || size.height <= 0) {
        fail('invalid-dimensions');
        return;
      }

      canvas.width = size.width;
      canvas.height = size.height;

      const context = canvas.getContext('2d');
      if (!context) {
        fail('missing-canvas-context');
        return;
      }

      try {
        context.drawImage(video, 0, 0, size.width, size.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        succeed(dataUrl);
      } catch {
        fail('canvas-tainted');
      }
    };

    const onSeeked = () => {
      drawFrame();
    };

    const onLoadedMetadata = () => {
      const targetSeconds = toSeekSeconds(startAtMs, video.duration);
      if (Math.abs(video.currentTime - targetSeconds) < 0.01) {
        drawFrame();
        return;
      }

      try {
        video.currentTime = targetSeconds;
      } catch {
        drawFrame();
      }
    };

    const onVideoError = () => {
      fail('video-error');
    };

    const onAbort = () => {
      fail('aborted');
    };

    if (signal?.aborted) {
      fail('aborted');
      return;
    }

    signal?.addEventListener('abort', onAbort, { once: true });
    video.preload = 'metadata';
    video.playsInline = true;
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onVideoError, { once: true });
    video.src = source;
  });
