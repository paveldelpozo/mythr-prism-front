import { MESSAGE_CHANNEL } from '../types/messages';

interface CreateSlaveWindowHtmlOptions {
  monitorId: string;
  instanceToken: string;
}

export const createSlaveWindowHtml = ({
  monitorId,
  instanceToken
}: CreateSlaveWindowHtmlOptions): string => {
  const monitorIdLiteral = JSON.stringify(monitorId);
  const tokenLiteral = JSON.stringify(instanceToken);
  const channelLiteral = JSON.stringify(MESSAGE_CHANNEL);

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Multi-Monitor Slave</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at 20% 20%, #18213f 0%, #05070f 55%, #020308 100%);
        color: #e2e8f0;
        font-family: "Space Grotesk", "Segoe UI", sans-serif;
      }
      #viewport {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
      }
      #wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 120ms ease-out;
      }
      #image {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        display: none;
      }
      #video {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        display: none;
        background: #000;
      }
      #externalUrlFrame {
        width: 100%;
        height: 100%;
        border: 0;
        display: none;
        background: #000;
      }
      #empty {
        font-size: 14px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.7;
      }
      #whiteboard {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      #transitionVeil {
        position: absolute;
        inset: 0;
        background: rgba(2, 6, 23, 0.98);
        opacity: 0;
        clip-path: inset(0 100% 0 0);
        pointer-events: none;
        z-index: 18;
      }
      #monitorIdentifyFlash {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 140ms ease-out;
        z-index: 22;
      }
      #monitorIdentifyFlash.is-active {
        opacity: 1;
      }
      #monitorIdentifyFlash::before {
        content: '';
        position: absolute;
        inset: 0;
        border: 14px solid rgba(56, 189, 248, 0.92);
        box-shadow: inset 0 0 0 6px rgba(2, 6, 23, 0.3);
        animation: monitor-identify-pulse 520ms ease-in-out infinite;
      }
      #monitorIdentifyFlashLabel {
        position: relative;
        z-index: 1;
        border-radius: 999px;
        border: 1px solid rgba(125, 211, 252, 0.85);
        background: rgba(15, 23, 42, 0.9);
        color: #e0f2fe;
        padding: 10px 18px;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      #overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(2, 6, 23, 0.88);
        padding: 24px;
        z-index: 10;
      }
      #card {
        max-width: 480px;
        border-radius: 20px;
        border: 1px solid rgba(129, 140, 248, 0.35);
        background: linear-gradient(160deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
        padding: 24px;
        text-align: center;
      }
      #card h1 {
        margin: 0 0 12px;
        font-size: 22px;
      }
      #card p {
        margin: 0 0 18px;
        line-height: 1.5;
        color: #cbd5e1;
      }
      #fullscreenButton {
        border: 0;
        border-radius: 999px;
        background: #4f46e5;
        color: #f8fafc;
        padding: 14px 26px;
        font-weight: 700;
        letter-spacing: 0.03em;
        cursor: pointer;
      }
      #fullscreenButton[disabled] {
        opacity: 0.7;
        cursor: wait;
      }
      #hint {
        display: block;
        margin-top: 12px;
        font-size: 12px;
        color: #93c5fd;
      }
      @keyframes monitor-identify-pulse {
        0%,
        100% {
          opacity: 0.95;
          transform: scale(1);
        }
        50% {
          opacity: 0.55;
          transform: scale(0.985);
        }
      }
    </style>
  </head>
  <body>
      <div id="viewport">
        <div id="wrapper">
          <img id="image" alt="Imagen transmitida" />
          <video id="video" autoplay playsinline></video>
          <iframe id="externalUrlFrame" title="Contenido externo" referrerpolicy="no-referrer"></iframe>
          <p id="empty">Esperando imagen...</p>
        </div>
        <canvas id="whiteboard"></canvas>
        <div id="transitionVeil" aria-hidden="true"></div>
        <div id="monitorIdentifyFlash" aria-live="polite">
          <strong id="monitorIdentifyFlashLabel">Identificando monitor</strong>
        </div>
      </div>

    <div id="overlay">
      <div id="card">
        <h1>Pantalla lista</h1>
        <p>
          Para activar modo de proyeccion completa, haz clic en el boton desde esta misma ventana.
        </p>
        <button id="fullscreenButton" type="button">Activar Fullscreen</button>
        <small id="hint">El navegador exige interaccion del usuario en esta pantalla.</small>
      </div>
    </div>

    <script>
      (function () {
        const FULLSCREEN_REQUEST_TIMEOUT_MS = 3000;
        const FULLSCREEN_REPORT_THROTTLE_MS = 200;
        const MONITOR_ID_FLASH_DEFAULT_MS = 2200;
        const MONITOR_ID_FLASH_MIN_MS = 800;
        const MONITOR_ID_FLASH_MAX_MS = 5000;
        const IMAGE_APPLY_DEFER_MS = 0;
        const TRANSITION_DEFAULT_DURATION_MS = 450;
        const TRANSITION_MIN_DURATION_MS = 120;
        const TRANSITION_MAX_DURATION_MS = 5000;
        const THUMBNAIL_CAPTURE_INTERVAL_MS = 1000;
        const THUMBNAIL_MAX_WIDTH = 320;
        const THUMBNAIL_IMAGE_QUALITY = 0.55;
        const THUMBNAIL_CAPTURE_ERROR_BACKOFF_MS = 4000;
        const TRACE_BUFFER_LIMIT = 120;
        const MESSAGE_CHANNEL = ${channelLiteral};
        const monitorId = ${monitorIdLiteral};
        const instanceToken = ${tokenLiteral};
        const overlay = document.getElementById('overlay');
        const button = document.getElementById('fullscreenButton');
        const wrapper = document.getElementById('wrapper');
        const image = document.getElementById('image');
        const video = document.getElementById('video');
        const externalUrlFrame = document.getElementById('externalUrlFrame');
        const empty = document.getElementById('empty');
        const whiteboardCanvas = document.getElementById('whiteboard');
        const transitionVeil = document.getElementById('transitionVeil');
        const monitorIdentifyFlash = document.getElementById('monitorIdentifyFlash');
        const monitorIdentifyFlashLabel = document.getElementById('monitorIdentifyFlashLabel');
        const thumbnailCanvas = document.createElement('canvas');
        let thumbnailContext = null;
        let whiteboardContext = null;
        let whiteboardStrokes = [];
        let clipEndAtSeconds = null;
        let syncActionTimeoutId = null;
        let fullscreenIntentActive = false;
        let hasEnteredFullscreen = false;
        let isFullscreenRequestInFlight = false;
        let fullscreenRequestId = 0;
        let isClosingWindow = false;
        let lastReportedFullscreenActive = Boolean(document.fullscreenElement);
        let lastReportedUnexpectedExit = false;
        let lastFullscreenReportAtMs = 0;
        let pendingFullscreenReportTimeoutId = null;
        let pendingFullscreenReport = null;
        let thumbnailCaptureTimeoutId = null;
        let thumbnailCaptureBlockedUntilMs = 0;
        let lastThumbnailDataUrl = null;
        let imageRenderRequestId = 0;
        let externalUrlRenderRequestId = 0;
        let externalUrlLoadTimeoutId = null;
        let externalAppCaptureTrack = null;
        let externalAppCaptureOnEndedHandler = null;
        let monitorIdentifyFlashTimeoutId = null;
        let transitionTimeoutId = null;
        let transitionSequenceId = 0;
        const traceBuffer = [];
        let isTraceConsoleEnabled = false;

        try {
          isTraceConsoleEnabled = window.localStorage?.getItem('mythr-prism.slave-trace') === '1';
        } catch {
          isTraceConsoleEnabled = false;
        }

        const trace = (event, details) => {
          const entry = {
            at: Date.now(),
            event,
            details: details ?? null
          };

          traceBuffer.push(entry);
          if (traceBuffer.length > TRACE_BUFFER_LIMIT) {
            traceBuffer.shift();
          }

          window.__MMIB_SLAVE_TRACE__ = traceBuffer.slice();
          if (isTraceConsoleEnabled) {
            console.debug('[MMIB slave]', event, details ?? {});
          }
        };

        const sanitizeFlashDurationMs = (value) => {
          const durationMs = Number(value);
          if (!Number.isFinite(durationMs)) {
            return MONITOR_ID_FLASH_DEFAULT_MS;
          }

          return Math.max(
            MONITOR_ID_FLASH_MIN_MS,
            Math.min(MONITOR_ID_FLASH_MAX_MS, Math.round(durationMs))
          );
        };

        const clearTransitionTimeout = () => {
          if (transitionTimeoutId !== null) {
            window.clearTimeout(transitionTimeoutId);
            transitionTimeoutId = null;
          }
        };

        const resetTransitionVeil = () => {
          if (!transitionVeil) {
            return;
          }

          transitionVeil.style.transition = 'none';
          transitionVeil.style.opacity = '0';
          transitionVeil.style.clipPath = 'inset(0 100% 0 0)';
        };

        const sanitizeTransitionPayload = (transitionPayload) => {
          const type = transitionPayload?.type === 'fade' || transitionPayload?.type === 'wipe'
            ? transitionPayload.type
            : 'cut';
          const rawDurationMs = Number(transitionPayload?.durationMs);
          const durationMs = Number.isFinite(rawDurationMs)
            ? Math.max(
              TRANSITION_MIN_DURATION_MS,
              Math.min(TRANSITION_MAX_DURATION_MS, Math.round(rawDurationMs))
            )
            : TRANSITION_DEFAULT_DURATION_MS;

          return {
            type,
            durationMs
          };
        };

        const runContentTransition = (transitionPayload, applyChange) => {
          const transition = sanitizeTransitionPayload(transitionPayload);
          transitionSequenceId += 1;
          const sequenceId = transitionSequenceId;

          clearTransitionTimeout();

          if (!transitionVeil || transition.type === 'cut') {
            resetTransitionVeil();
            applyChange();
            return;
          }

          const halfDurationMs = Math.max(60, Math.round(transition.durationMs / 2));
          transitionVeil.style.transition = transition.type === 'fade'
            ? 'opacity ' + halfDurationMs + 'ms ease'
            : 'clip-path ' + halfDurationMs + 'ms ease';

          if (transition.type === 'fade') {
            transitionVeil.style.opacity = '0';
            transitionVeil.style.clipPath = 'inset(0 0 0 0)';

            requestAnimationFrame(() => {
              if (sequenceId !== transitionSequenceId) {
                return;
              }

              transitionVeil.style.opacity = '1';
            });
          } else {
            transitionVeil.style.opacity = '1';
            transitionVeil.style.clipPath = 'inset(0 100% 0 0)';

            requestAnimationFrame(() => {
              if (sequenceId !== transitionSequenceId) {
                return;
              }

              transitionVeil.style.clipPath = 'inset(0 0 0 0)';
            });
          }

          transitionTimeoutId = window.setTimeout(() => {
            if (sequenceId !== transitionSequenceId) {
              return;
            }

            applyChange();

            transitionVeil.style.transition = transition.type === 'fade'
              ? 'opacity ' + halfDurationMs + 'ms ease'
              : 'clip-path ' + halfDurationMs + 'ms ease';

            if (transition.type === 'fade') {
              transitionVeil.style.opacity = '0';
            } else {
              transitionVeil.style.clipPath = 'inset(0 0 0 100%)';
            }

            transitionTimeoutId = window.setTimeout(() => {
              if (sequenceId !== transitionSequenceId) {
                return;
              }

              resetTransitionVeil();
              clearTransitionTimeout();
            }, halfDurationMs);
          }, halfDurationMs);
        };

        const sanitizeFlashLabel = (value) => {
          if (typeof value !== 'string') {
            return 'Identificando monitor';
          }

          const normalized = value.trim();
          if (normalized.length === 0) {
            return 'Identificando monitor';
          }

          return normalized.slice(0, 80);
        };

        const clearMonitorIdFlash = () => {
          if (monitorIdentifyFlashTimeoutId !== null) {
            window.clearTimeout(monitorIdentifyFlashTimeoutId);
            monitorIdentifyFlashTimeoutId = null;
          }

          if (!monitorIdentifyFlash) {
            return;
          }

          monitorIdentifyFlash.classList.remove('is-active');
        };

        const showMonitorIdFlash = (payload) => {
          if (!monitorIdentifyFlash || !monitorIdentifyFlashLabel) {
            return;
          }

          const durationMs = sanitizeFlashDurationMs(payload?.durationMs);
          const monitorLabel = sanitizeFlashLabel(payload?.monitorLabel);

          monitorIdentifyFlashLabel.textContent = 'Identificando: ' + monitorLabel;
          monitorIdentifyFlash.classList.add('is-active');

          if (monitorIdentifyFlashTimeoutId !== null) {
            window.clearTimeout(monitorIdentifyFlashTimeoutId);
          }

          monitorIdentifyFlashTimeoutId = window.setTimeout(() => {
            monitorIdentifyFlashTimeoutId = null;
            monitorIdentifyFlash.classList.remove('is-active');
          }, durationMs);
        };

        const onVideoLoadedMetadata = () => {
          if (!video.dataset.startAtSeconds) {
            return;
          }

          const startAtSeconds = Number(video.dataset.startAtSeconds);
          if (!Number.isFinite(startAtSeconds) || startAtSeconds < 0) {
            return;
          }

          try {
            video.currentTime = startAtSeconds;
          } catch {
            return;
          }
        };

        const onVideoTimeUpdate = () => {
          if (clipEndAtSeconds === null) {
            return;
          }

          if (video.currentTime < clipEndAtSeconds) {
            return;
          }

          video.pause();
        };

        const clearScheduledSyncAction = () => {
          if (syncActionTimeoutId !== null) {
            window.clearTimeout(syncActionTimeoutId);
            syncActionTimeoutId = null;
          }
        };

        const toWhiteboardPoint = (value) => {
          if (!value || typeof value !== 'object') {
            return null;
          }

          const x = Number(value.x);
          const y = Number(value.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
          }

          return {
            x: Math.min(1, Math.max(0, x)),
            y: Math.min(1, Math.max(0, y))
          };
        };

        const isWhiteboardTool = (value) =>
          value === 'draw'
          || value === 'line'
          || value === 'arrow'
          || value === 'rect'
          || value === 'circle'
          || value === 'erase';

        const sanitizeWhiteboardStroke = (value) => {
          if (!value || typeof value !== 'object') {
            return null;
          }

          const points = Array.isArray(value.points)
            ? value.points
              .map((point) => toWhiteboardPoint(point))
              .filter((point) => point !== null)
            : [];

          if (points.length < 2) {
            return null;
          }

          const width = Number(value.width);

          return {
            tool: isWhiteboardTool(value.tool) ? value.tool : 'draw',
            color: typeof value.color === 'string' && value.color.trim().length > 0 ? value.color : '#ef4444',
            width: Number.isFinite(width) ? Math.max(1, Math.min(48, Math.round(width))) : 6,
            points
          };
        };

        const sanitizeWhiteboardState = (value) => {
          if (!value || typeof value !== 'object' || !Array.isArray(value.strokes)) {
            return [];
          }

          return value.strokes
            .map((stroke) => sanitizeWhiteboardStroke(stroke))
            .filter((stroke) => stroke !== null);
        };

        const ensureWhiteboardContext = () => {
          if (whiteboardContext || !whiteboardCanvas) {
            return whiteboardContext;
          }

          try {
            whiteboardContext = whiteboardCanvas.getContext('2d');
          } catch {
            whiteboardContext = null;
          }

          return whiteboardContext;
        };

        const resizeWhiteboardCanvas = () => {
          if (!whiteboardCanvas) {
            return;
          }

          const ratio = Math.max(1, window.devicePixelRatio || 1);
          const width = Math.max(1, Math.round(window.innerWidth * ratio));
          const height = Math.max(1, Math.round(window.innerHeight * ratio));

          if (whiteboardCanvas.width !== width || whiteboardCanvas.height !== height) {
            whiteboardCanvas.width = width;
            whiteboardCanvas.height = height;
          }
        };

        const drawWhiteboardFreehandStroke = (context, stroke, width, height) => {
          context.beginPath();

          stroke.points.forEach((point, index) => {
            const x = point.x * width;
            const y = point.y * height;
            if (index === 0) {
              context.moveTo(x, y);
              return;
            }

            context.lineTo(x, y);
          });

          context.stroke();
        };

        const drawWhiteboardShapeStroke = (context, stroke, width, height) => {
          const start = stroke.points[0];
          const end = stroke.points[stroke.points.length - 1];
          if (!start || !end) {
            return;
          }

          const fromX = start.x * width;
          const fromY = start.y * height;
          const toX = end.x * width;
          const toY = end.y * height;
          const dx = toX - fromX;
          const dy = toY - fromY;

          if (stroke.tool === 'line') {
            context.beginPath();
            context.moveTo(fromX, fromY);
            context.lineTo(toX, toY);
            context.stroke();
            return;
          }

          if (stroke.tool === 'arrow') {
            const angle = Math.atan2(dy, dx);
            const headSize = Math.max(10, stroke.width * 2.8);

            context.beginPath();
            context.moveTo(fromX, fromY);
            context.lineTo(toX, toY);
            context.moveTo(toX, toY);
            context.lineTo(
              toX - headSize * Math.cos(angle - Math.PI / 7),
              toY - headSize * Math.sin(angle - Math.PI / 7)
            );
            context.moveTo(toX, toY);
            context.lineTo(
              toX - headSize * Math.cos(angle + Math.PI / 7),
              toY - headSize * Math.sin(angle + Math.PI / 7)
            );
            context.stroke();
            return;
          }

          if (stroke.tool === 'rect') {
            const x = Math.min(fromX, toX);
            const y = Math.min(fromY, toY);
            const rectWidth = Math.abs(dx);
            const rectHeight = Math.abs(dy);

            if (rectWidth < 1 && rectHeight < 1) {
              return;
            }

            context.beginPath();
            context.rect(x, y, rectWidth, rectHeight);
            context.stroke();
            return;
          }

          if (stroke.tool === 'circle') {
            const radiusX = Math.abs(dx) / 2;
            const radiusY = Math.abs(dy) / 2;

            if (radiusX < 1 && radiusY < 1) {
              return;
            }

            context.beginPath();
            context.ellipse((fromX + toX) / 2, (fromY + toY) / 2, radiusX, radiusY, 0, 0, Math.PI * 2);
            context.stroke();
          }
        };

        const drawWhiteboardStroke = (context, stroke, width, height) => {
          context.save();
          context.globalCompositeOperation = stroke.tool === 'erase' ? 'destination-out' : 'source-over';
          context.strokeStyle = stroke.tool === 'erase' ? '#000000' : stroke.color;
          context.lineWidth = Math.max(1, stroke.width);
          context.lineCap = 'round';
          context.lineJoin = 'round';

          if (stroke.tool === 'draw' || stroke.tool === 'erase') {
            drawWhiteboardFreehandStroke(context, stroke, width, height);
          } else {
            drawWhiteboardShapeStroke(context, stroke, width, height);
          }

          context.restore();
        };

        const renderWhiteboard = () => {
          const context = ensureWhiteboardContext();
          if (!context || !whiteboardCanvas) {
            return;
          }

          resizeWhiteboardCanvas();

          const ratio = Math.max(1, window.devicePixelRatio || 1);
          const width = whiteboardCanvas.width / ratio;
          const height = whiteboardCanvas.height / ratio;

          context.save();
          context.setTransform(ratio, 0, 0, ratio, 0, 0);
          context.clearRect(0, 0, width, height);
          whiteboardStrokes.forEach((stroke) => {
            drawWhiteboardStroke(context, stroke, width, height);
          });
          context.restore();
        };

        const applyWhiteboardState = (state) => {
          whiteboardStrokes = sanitizeWhiteboardState(state);
          renderWhiteboard();
        };

        const clearWhiteboard = () => {
          whiteboardStrokes = [];
          renderWhiteboard();
        };

        const undoWhiteboard = () => {
          if (whiteboardStrokes.length === 0) {
            return;
          }

          whiteboardStrokes = whiteboardStrokes.slice(0, -1);
          renderWhiteboard();
        };

        const clearScheduledThumbnailCapture = () => {
          if (thumbnailCaptureTimeoutId !== null) {
            window.clearTimeout(thumbnailCaptureTimeoutId);
            thumbnailCaptureTimeoutId = null;
          }
        };

        const postThumbnailSnapshot = (imageDataUrl) => {
          if (imageDataUrl === lastThumbnailDataUrl) {
            return;
          }

          lastThumbnailDataUrl = imageDataUrl;
          postToMaster('THUMBNAIL_SNAPSHOT', {
            imageDataUrl,
            capturedAtMs: Date.now()
          });
        };

        const getThumbnailSourceElement = () => {
          if (video.style.display !== 'none' && video.videoWidth > 0 && video.videoHeight > 0) {
            return {
              element: video,
              width: video.videoWidth,
              height: video.videoHeight
            };
          }

          if (image.style.display !== 'none' && image.naturalWidth > 0 && image.naturalHeight > 0) {
            return {
              element: image,
              width: image.naturalWidth,
              height: image.naturalHeight
            };
          }

          return null;
        };

        const captureThumbnailSnapshot = () => {
          const now = Date.now();
          if (now < thumbnailCaptureBlockedUntilMs) {
            return;
          }

          const source = getThumbnailSourceElement();
          if (!source) {
            postThumbnailSnapshot(null);
            return;
          }

          const targetWidth = Math.max(1, Math.min(THUMBNAIL_MAX_WIDTH, source.width));
          const targetHeight = Math.max(1, Math.round((source.height / source.width) * targetWidth));

          if (!thumbnailContext) {
            try {
              thumbnailContext = thumbnailCanvas.getContext('2d');
            } catch {
              thumbnailContext = null;
            }

            if (!thumbnailContext) {
              postThumbnailSnapshot(null);
              return;
            }
          }

          thumbnailCanvas.width = targetWidth;
          thumbnailCanvas.height = targetHeight;

          try {
            thumbnailContext.drawImage(source.element, 0, 0, targetWidth, targetHeight);
            const imageDataUrl = thumbnailCanvas.toDataURL('image/jpeg', THUMBNAIL_IMAGE_QUALITY);
            postThumbnailSnapshot(imageDataUrl);
          } catch {
            thumbnailCaptureBlockedUntilMs = Date.now() + THUMBNAIL_CAPTURE_ERROR_BACKOFF_MS;
            postThumbnailSnapshot(null);
          }
        };

        const scheduleThumbnailCapture = (delayMs) => {
          if (typeof window === 'undefined') {
            return;
          }

          clearScheduledThumbnailCapture();

          thumbnailCaptureTimeoutId = window.setTimeout(() => {
            if (typeof window === 'undefined') {
              thumbnailCaptureTimeoutId = null;
              return;
            }

            thumbnailCaptureTimeoutId = null;
            captureThumbnailSnapshot();
            scheduleThumbnailCapture(THUMBNAIL_CAPTURE_INTERVAL_MS);
          }, Math.max(0, delayMs));
        };

        const requestThumbnailRefresh = (delayMs = 0) => {
          scheduleThumbnailCapture(delayMs);
        };

        const stopVideoPlayback = (resetSource) => {
          clearScheduledSyncAction();

          if (externalAppCaptureTrack && externalAppCaptureOnEndedHandler) {
            externalAppCaptureTrack.removeEventListener('ended', externalAppCaptureOnEndedHandler);
          }
          externalAppCaptureTrack = null;
          externalAppCaptureOnEndedHandler = null;

          video.pause();
          video.srcObject = null;
          if (resetSource) {
            video.removeAttribute('src');
          }
          video.style.display = 'none';
          video.dataset.startAtSeconds = '';
          clipEndAtSeconds = null;
        };

        const clearViewportMedia = () => {
          clearScheduledSyncAction();

          if (externalUrlLoadTimeoutId !== null) {
            window.clearTimeout(externalUrlLoadTimeoutId);
            externalUrlLoadTimeoutId = null;
          }
          externalUrlRenderRequestId += 1;

          image.src = '';
          image.style.display = 'none';

          stopVideoPlayback(true);

          externalUrlFrame.removeAttribute('src');
          externalUrlFrame.style.display = 'none';

          empty.style.display = 'block';
          empty.textContent = 'Esperando contenido...';
          requestThumbnailRefresh(0);
        };

        const hasVisibleMedia = () =>
          image.style.display !== 'none' || video.style.display !== 'none' || externalUrlFrame.style.display !== 'none';

        const ensureViewportFallbackVisible = () => {
          if (!hasVisibleMedia()) {
            empty.style.display = 'block';
            if (!empty.textContent || empty.textContent.trim().length === 0) {
              empty.textContent = 'Esperando contenido...';
            }
            return;
          }

          empty.style.display = 'none';
        };

        const toFiniteNumber = (value, fallback) => {
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) {
            return fallback;
          }

          return parsed;
        };

        const hasActiveVideo = () => video.style.display !== 'none' && typeof video.src === 'string' && video.src.length > 0;

        const runAt = (scheduledAtMs, action) => {
          if (syncActionTimeoutId !== null) {
            window.clearTimeout(syncActionTimeoutId);
            syncActionTimeoutId = null;
          }

          const now = Date.now();
          const safeScheduledAtMs = toFiniteNumber(scheduledAtMs, now);
          const delayMs = Math.max(0, safeScheduledAtMs - now);
          syncActionTimeoutId = window.setTimeout(() => {
            syncActionTimeoutId = null;
            action();
          }, delayMs);
        };

        const applyVideoTimeMs = (mediaTimeMs) => {
          if (!hasActiveVideo()) {
            return;
          }

          const seconds = Math.max(0, toFiniteNumber(mediaTimeMs, 0) / 1000);

          try {
            video.currentTime = seconds;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'No se pudo aplicar tiempo de video.';
            postToMaster('SLAVE_ERROR', { message });
          }
        };

        const showImage = (source) => {
          imageRenderRequestId += 1;
          const requestId = imageRenderRequestId;

          stopVideoPlayback(true);
          image.style.display = 'none';
          empty.style.display = 'block';
          empty.textContent = 'Cargando imagen...';

          trace('SET_IMAGE:queued', {
            requestId,
            sourceLength: typeof source === 'string' ? source.length : null
          });

          window.setTimeout(() => {
            if (requestId !== imageRenderRequestId) {
              trace('SET_IMAGE:discarded', { requestId, reason: 'superseded' });
              return;
            }

            image.src = source;

            Promise.resolve(typeof image.decode === 'function' ? image.decode() : undefined)
              .catch(() => undefined)
              .finally(() => {
                if (requestId !== imageRenderRequestId) {
                  trace('SET_IMAGE:discarded', { requestId, reason: 'superseded-after-decode' });
                  return;
                }

                image.style.display = 'block';
                empty.style.display = 'none';
                trace('SET_IMAGE:applied', { requestId });
                requestThumbnailRefresh(0);
              });
          }, IMAGE_APPLY_DEFER_MS);
        };

        const showVideo = (item) => {
          clearViewportMedia();

          const startAtSeconds = Number(item.startAtMs) / 1000;
          const endAtSeconds = item.endAtMs === null ? null : Number(item.endAtMs) / 1000;

          video.dataset.startAtSeconds = Number.isFinite(startAtSeconds) && startAtSeconds >= 0
            ? String(startAtSeconds)
            : '0';
          clipEndAtSeconds = Number.isFinite(endAtSeconds) && endAtSeconds !== null && endAtSeconds >= 0
            ? endAtSeconds
            : null;

          video.muted = Boolean(item.muted);
          video.src = item.source;
          video.style.display = 'block';
          empty.style.display = 'none';
          requestThumbnailRefresh(0);

          void video.play().catch(() => {
            empty.style.display = 'block';
            empty.textContent = 'No se pudo reproducir el video en esta ventana.';
          });
        };

        const isMediaStreamLike = (stream) => {
          if (!stream || typeof stream !== 'object') {
            return false;
          }

          return typeof stream.getVideoTracks === 'function' && typeof stream.getTracks === 'function';
        };

        const showExternalAppCaptureStream = (stream) => {
          if (!isMediaStreamLike(stream)) {
            postToMaster('EXTERNAL_APP_CAPTURE_STATUS', {
              active: false,
              reason: 'invalid-stream',
              message: 'La captura recibida no es valida para esta ventana esclava.'
            });
            return false;
          }

          const track = stream.getVideoTracks()[0] ?? null;
          if (!track) {
            postToMaster('EXTERNAL_APP_CAPTURE_STATUS', {
              active: false,
              reason: 'missing-track',
              message: 'No se detecto pista de video en la captura seleccionada.'
            });
            return false;
          }

          clearViewportMedia();

          video.muted = true;
          video.srcObject = stream;
          video.style.display = 'block';
          empty.style.display = 'none';

          externalAppCaptureTrack = track;
          externalAppCaptureOnEndedHandler = () => {
            clearViewportMedia();
            postToMaster('EXTERNAL_APP_CAPTURE_STATUS', {
              active: false,
              reason: 'track-ended',
              message: 'La captura externa finalizo en la ventana proyectada.'
            });
          };
          track.addEventListener('ended', externalAppCaptureOnEndedHandler, { once: true });

          requestThumbnailRefresh(0);

          void video.play().catch(() => {
            empty.style.display = 'block';
            empty.textContent = 'No se pudo reproducir la captura externa en esta ventana.';
          });

          postToMaster('EXTERNAL_APP_CAPTURE_STATUS', {
            active: true,
            reason: 'stream-attached'
          });

          return true;
        };

        window.__MMIB_ATTACH_EXTERNAL_APP_STREAM__ = (stream) => showExternalAppCaptureStream(stream);

        const showExternalUrl = (source) => {
          let parsed;
          try {
            parsed = new URL(source);
          } catch {
            postToMaster('SLAVE_ERROR', {
              message: 'La URL externa recibida no es valida.'
            });
            return;
          }

          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            postToMaster('SLAVE_ERROR', {
              message: 'Solo se permiten URLs externas http:// o https://.'
            });
            return;
          }

          clearViewportMedia();
          externalUrlRenderRequestId += 1;
          const requestId = externalUrlRenderRequestId;

          empty.style.display = 'block';
          empty.textContent = 'Cargando URL externa...';

          const completeRender = () => {
            if (requestId !== externalUrlRenderRequestId) {
              return;
            }

            if (externalUrlLoadTimeoutId !== null) {
              window.clearTimeout(externalUrlLoadTimeoutId);
              externalUrlLoadTimeoutId = null;
            }

            externalUrlFrame.style.display = 'block';
            empty.style.display = 'none';
            requestThumbnailRefresh(0);
          };

          externalUrlFrame.onload = () => {
            completeRender();
          };

          externalUrlFrame.onerror = () => {
            if (requestId !== externalUrlRenderRequestId) {
              return;
            }

            empty.style.display = 'block';
            empty.textContent = 'No se pudo cargar la URL externa. Revisa la politica de seguridad o intenta recargar.';
            externalUrlFrame.style.display = 'none';
            postToMaster('SLAVE_ERROR', {
              message: 'Fallo la carga de la URL externa en la ventana esclava.'
            });
          };

          externalUrlFrame.src = parsed.toString();
          externalUrlLoadTimeoutId = window.setTimeout(() => {
            if (requestId !== externalUrlRenderRequestId) {
              return;
            }

            empty.style.display = 'block';
            empty.textContent = 'La URL externa tardo demasiado en cargar. Usa Recargar o verifica conectividad.';
            postToMaster('SLAVE_ERROR', {
              message: 'Timeout al cargar la URL externa.'
            });
          }, 8000);
        };

        const isExternalUrlVisible = () =>
          externalUrlFrame.style.display !== 'none' && typeof externalUrlFrame.src === 'string' && externalUrlFrame.src.length > 0;

        const reloadExternalUrl = () => {
          if (!isExternalUrlVisible()) {
            postToMaster('SLAVE_ERROR', {
              message: 'No hay una URL externa activa para recargar.'
            });
            return;
          }

          try {
            const frameWindow = externalUrlFrame.contentWindow;
            if (frameWindow) {
              frameWindow.location.reload();
              return;
            }

            externalUrlFrame.src = externalUrlFrame.src;
          } catch {
            postToMaster('SLAVE_ERROR', {
              message: 'No fue posible recargar la URL externa en esta ventana.'
            });
          }
        };

        const navigateExternalUrl = (direction) => {
          if (!isExternalUrlVisible()) {
            postToMaster('SLAVE_ERROR', {
              message: 'No hay una URL externa activa para navegar historial.'
            });
            return;
          }

          const frameWindow = externalUrlFrame.contentWindow;
          if (!frameWindow) {
            postToMaster('SLAVE_ERROR', {
              message: 'No fue posible acceder al historial de la URL externa.'
            });
            return;
          }

          try {
            if (direction === 'back') {
              frameWindow.history.back();
              return;
            }

            frameWindow.history.forward();
          } catch {
            postToMaster('SLAVE_ERROR', {
              message: 'La navegacion atras/adelante no esta disponible para esta URL externa.'
            });
          }
        };

        const postToMaster = (type, payload) => {
          if (!window.opener) {
            return;
          }

          window.opener.postMessage(
            {
              channel: MESSAGE_CHANNEL,
              type,
              instanceToken,
              monitorId,
              payload
            },
            '*'
          );
        };

        const setFullscreenUi = (isFullscreen) => {
          overlay.style.display = isFullscreen ? 'none' : 'flex';
        };

        const updateFullscreenButtonLabel = (isFullscreen) => {
          button.disabled = isFullscreenRequestInFlight;

          if (isFullscreenRequestInFlight) {
            button.textContent = 'Activando fullscreen...';
            return;
          }

          if (isFullscreen) {
            button.textContent = 'Fullscreen activo';
            return;
          }

          if (fullscreenIntentActive && hasEnteredFullscreen) {
            button.textContent = 'Reactivar Fullscreen';
            return;
          }

          button.textContent = 'Activar Fullscreen';
        };

        const closeSlaveWindow = () => {
          if (isClosingWindow) {
            trace('REQUEST_CLOSE:ignored', { reason: 'already-closing' });
            return;
          }

          isClosingWindow = true;
          clearScheduledThumbnailCapture();
          trace('REQUEST_CLOSE:received', {
            inFullscreen: Boolean(document.fullscreenElement)
          });
          postToMaster('SLAVE_CLOSING', { timestamp: Date.now() });

          const tryCloseWindow = () => {
            try {
              window.close();
            } catch {}

            window.setTimeout(() => {
              if (window.closed) {
                return;
              }

              isClosingWindow = false;
              trace('REQUEST_CLOSE:failed', { reason: 'window-close-blocked' });
              postToMaster('SLAVE_ERROR', {
                message: 'No se pudo cerrar automaticamente. Usa el control de cierre del navegador para forzar el cierre.'
              });
            }, 800);
          };

          if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
            Promise.resolve(document.exitFullscreen())
              .catch(() => undefined)
              .finally(() => {
                tryCloseWindow();
              });
            return;
          }

          tryCloseWindow();
        };

        const reportFullscreenStatus = (message, reason, forceReport) => {
          const active = Boolean(document.fullscreenElement);
          if (active) {
            fullscreenIntentActive = true;
            hasEnteredFullscreen = true;
          }

          const unexpectedExit =
            !active
            && reason !== 'init'
            && fullscreenIntentActive
            && hasEnteredFullscreen;

          const shouldReport =
            Boolean(forceReport)
            || active !== lastReportedFullscreenActive
            || unexpectedExit !== lastReportedUnexpectedExit;

          const nextPayload = {
            active,
            requiresInteraction: !active,
            intentActive: fullscreenIntentActive,
            unexpectedExit,
            message
          };

          setFullscreenUi(active);
          ensureViewportFallbackVisible();
          updateFullscreenButtonLabel(active);

          if (!shouldReport) {
            return;
          }

          lastReportedFullscreenActive = active;
          lastReportedUnexpectedExit = unexpectedExit;

          const flushReport = (payload) => {
            lastFullscreenReportAtMs = Date.now();
            postToMaster('FULLSCREEN_STATUS', payload);
          };

          if (pendingFullscreenReportTimeoutId !== null) {
            window.clearTimeout(pendingFullscreenReportTimeoutId);
            pendingFullscreenReportTimeoutId = null;
          }

          const elapsedMs = Date.now() - lastFullscreenReportAtMs;
          if (Boolean(forceReport) || elapsedMs >= FULLSCREEN_REPORT_THROTTLE_MS) {
            flushReport(nextPayload);
            pendingFullscreenReport = null;
            return;
          }

          pendingFullscreenReport = nextPayload;
          pendingFullscreenReportTimeoutId = window.setTimeout(() => {
            pendingFullscreenReportTimeoutId = null;
            if (!pendingFullscreenReport) {
              return;
            }

            const payload = pendingFullscreenReport;
            pendingFullscreenReport = null;
            flushReport(payload);
          }, FULLSCREEN_REPORT_THROTTLE_MS - elapsedMs);
        };

        const enterFullscreenFromClick = () => {
          if (isFullscreenRequestInFlight) {
            reportFullscreenStatus('La solicitud de fullscreen sigue en curso.', 'button-click-pending');
            return;
          }

          fullscreenIntentActive = true;
          isFullscreenRequestInFlight = true;
          fullscreenRequestId += 1;
          const currentRequestId = fullscreenRequestId;

          updateFullscreenButtonLabel(Boolean(document.fullscreenElement));

          window.setTimeout(() => {
            if (!isFullscreenRequestInFlight || currentRequestId !== fullscreenRequestId) {
              return;
            }

            isFullscreenRequestInFlight = false;
            reportFullscreenStatus(
              'La activacion de fullscreen tardo demasiado. Puedes reintentar con un clic.',
              'button-click-timeout'
            );
          }, FULLSCREEN_REQUEST_TIMEOUT_MS);

          Promise.resolve(document.documentElement.requestFullscreen())
            .then(() => {
              if (currentRequestId !== fullscreenRequestId) {
                return;
              }

              isFullscreenRequestInFlight = false;
              reportFullscreenStatus('Fullscreen activado', 'button-click');
            })
            .catch((error) => {
              if (currentRequestId !== fullscreenRequestId) {
                return;
              }

              isFullscreenRequestInFlight = false;
              const message = error instanceof Error ? error.message : 'No se pudo activar fullscreen';
              reportFullscreenStatus(message, 'button-click-error');
            });
        };

        button.addEventListener('click', enterFullscreenFromClick);

        window.addEventListener('message', (event) => {
          const message = event.data;
          if (!message || typeof message !== 'object') {
            return;
          }

          if (
            message.channel !== MESSAGE_CHANNEL ||
            message.instanceToken !== instanceToken ||
            message.monitorId !== monitorId
          ) {
            return;
          }

          if (message.type === 'SET_IMAGE') {
            trace('SET_IMAGE:received', {
              hasPayload: Boolean(message.payload),
              sourceLength: typeof message.payload?.imageDataUrl === 'string'
                ? message.payload.imageDataUrl.length
                : null
            });
            const imageDataUrl = message.payload.imageDataUrl;
            const transition = message.payload.transition;

            if (imageDataUrl === null) {
              runContentTransition(transition, () => {
                clearViewportMedia();
              });
              return;
            }

            if (typeof imageDataUrl === 'string' && imageDataUrl.length > 0) {
              runContentTransition(transition, () => {
                showImage(imageDataUrl);
              });
              return;
            }

            postToMaster('SLAVE_ERROR', {
              message: 'SET_IMAGE ignorado: payload invalido.'
            });
            trace('SET_IMAGE:invalid', { payloadType: typeof imageDataUrl });
            return;
          }

          if (message.type === 'SET_MEDIA') {
            trace('SET_MEDIA:received', {
              kind: message.payload?.item?.kind ?? null
            });
            const item = message.payload.item;
            const transition = message.payload.transition;

            if (item === null) {
              runContentTransition(transition, () => {
                clearViewportMedia();
              });
              return;
            }

            if (!item || typeof item !== 'object') {
              postToMaster('SLAVE_ERROR', {
                message: 'SET_MEDIA ignorado: payload invalido.'
              });
              trace('SET_MEDIA:invalid', { reason: 'payload' });
              return;
            }

            if (item.kind === 'image' && typeof item.source === 'string' && item.source.length > 0) {
              runContentTransition(transition, () => {
                showImage(item.source);
              });
              return;
            }

            if (item.kind === 'video' && typeof item.source === 'string' && item.source.length > 0) {
              runContentTransition(transition, () => {
                showVideo(item);
              });
              return;
            }

            if (item.kind === 'external-url' && typeof item.source === 'string' && item.source.length > 0) {
              runContentTransition(transition, () => {
                showExternalUrl(item.source);
              });
              return;
            }

            postToMaster('SLAVE_ERROR', {
              message: 'SET_MEDIA ignorado: item no soportado o incompleto.'
            });
            trace('SET_MEDIA:invalid', { reason: 'item' });
            return;
          }

          if (message.type === 'FLASH_MONITOR_ID') {
            showMonitorIdFlash(message.payload);
            return;
          }

          if (message.type === 'WHITEBOARD_SET_STATE') {
            if (!message.payload || typeof message.payload !== 'object') {
              postToMaster('SLAVE_ERROR', {
                message: 'WHITEBOARD_SET_STATE ignorado: payload invalido.'
              });
              return;
            }

            if (!message.payload.state || typeof message.payload.state !== 'object') {
              postToMaster('SLAVE_ERROR', {
                message: 'WHITEBOARD_SET_STATE ignorado: state invalido.'
              });
              return;
            }

            applyWhiteboardState(message.payload.state);
            return;
          }

          if (message.type === 'WHITEBOARD_CLEAR') {
            clearWhiteboard();
            return;
          }

          if (message.type === 'WHITEBOARD_UNDO') {
            undoWhiteboard();
            return;
          }

          if (message.type === 'VIDEO_SYNC_SEEK') {
            const payload = message.payload;
            runAt(payload.scheduledAtMs, () => {
              applyVideoTimeMs(payload.mediaTimeMs);
            });
          }

          if (message.type === 'VIDEO_SYNC_PLAY') {
            const payload = message.payload;
            runAt(payload.scheduledAtMs, () => {
              applyVideoTimeMs(payload.mediaTimeMs);
              void video.play().catch(() => {
                postToMaster('SLAVE_ERROR', {
                  message: 'No se pudo ejecutar PLAY sincronizado en la ventana esclava.'
                });
              });
            });
          }

          if (message.type === 'VIDEO_SYNC_PAUSE') {
            const payload = message.payload;
            runAt(payload.scheduledAtMs, () => {
              if (!hasActiveVideo()) {
                return;
              }

              video.pause();
            });
          }

          if (message.type === 'VIDEO_SYNC_TIME') {
            const payload = message.payload;

            if (!hasActiveVideo()) {
              return;
            }

            const anchorWallClockMs = toFiniteNumber(payload.anchorWallClockMs, Date.now());
            const anchorMediaTimeMs = Math.max(0, toFiniteNumber(payload.anchorMediaTimeMs, 0));
            const driftToleranceMs = Math.max(0, toFiniteNumber(payload.driftToleranceMs, 0));
            const expectedMediaTimeMs = anchorMediaTimeMs + Math.max(0, Date.now() - anchorWallClockMs);
            const currentMediaTimeMs = Math.max(0, video.currentTime * 1000);
            const driftMs = Math.abs(expectedMediaTimeMs - currentMediaTimeMs);

            if (driftMs <= driftToleranceMs) {
              return;
            }

            applyVideoTimeMs(expectedMediaTimeMs);
          }

          if (message.type === 'SET_TRANSFORM') {
            const transform = message.payload.transform;
            wrapper.style.transform = 'translate(' + transform.translateX + 'px, ' + transform.translateY + 'px) rotate(' + transform.rotate + 'deg) scale(' + transform.scale + ')';
          }

          if (message.type === 'REQUEST_FULLSCREEN') {
            fullscreenIntentActive = true;
            setFullscreenUi(Boolean(document.fullscreenElement));
            ensureViewportFallbackVisible();
            updateFullscreenButtonLabel(Boolean(document.fullscreenElement));
          }

          if (message.type === 'REQUEST_CLOSE') {
            trace('REQUEST_CLOSE:message', {
              reason: message.payload?.reason ?? null
            });
            closeSlaveWindow();
            return;
          }

          if (message.type === 'EXTERNAL_URL_RELOAD') {
            reloadExternalUrl();
            return;
          }

          if (message.type === 'EXTERNAL_URL_BACK') {
            navigateExternalUrl('back');
            return;
          }

          if (message.type === 'EXTERNAL_URL_FORWARD') {
            navigateExternalUrl('forward');
            return;
          }

          if (message.type === 'EXTERNAL_APP_CAPTURE_START') {
            clearViewportMedia();
            empty.style.display = 'block';
            empty.textContent = 'Selecciona una ventana o pestana de app en el selector nativo para iniciar captura.';
            return;
          }

          if (message.type === 'EXTERNAL_APP_CAPTURE_STOP') {
            clearViewportMedia();
            postToMaster('EXTERNAL_APP_CAPTURE_STATUS', {
              active: false,
              reason: typeof message.payload?.reason === 'string'
                ? message.payload.reason
                : 'operator-stop'
            });
            return;
          }

          if (message.type === 'PING') {
            postToMaster('PONG', { timestamp: Date.now() });
          }
        });

        document.addEventListener('fullscreenchange', () => {
          isFullscreenRequestInFlight = false;
          const isActive = Boolean(document.fullscreenElement);
          trace('fullscreenchange', {
            active: isActive,
            intentActive: fullscreenIntentActive
          });
          const statusMessage =
            !isActive && fullscreenIntentActive && hasEnteredFullscreen
              ? 'Fullscreen se cerro por una accion externa del navegador o el sistema.'
              : 'Cambio de fullscreen';

          reportFullscreenStatus(statusMessage, 'fullscreenchange');
        });
        window.addEventListener('beforeunload', () => {
          clearMonitorIdFlash();
          clearTransitionTimeout();
          clearScheduledThumbnailCapture();
          stopVideoPlayback(true);
          window.__MMIB_ATTACH_EXTERNAL_APP_STREAM__ = undefined;
          if (externalUrlLoadTimeoutId !== null) {
            window.clearTimeout(externalUrlLoadTimeoutId);
            externalUrlLoadTimeoutId = null;
          }
          if (pendingFullscreenReportTimeoutId !== null) {
            window.clearTimeout(pendingFullscreenReportTimeoutId);
            pendingFullscreenReportTimeoutId = null;
          }
          pendingFullscreenReport = null;
          trace('beforeunload', { isClosingWindow });
          postToMaster('SLAVE_CLOSING', { timestamp: Date.now() });
        });
        window.addEventListener('resize', () => {
          renderWhiteboard();
        });
        video.addEventListener('loadedmetadata', onVideoLoadedMetadata);
        video.addEventListener('timeupdate', onVideoTimeUpdate);

        renderWhiteboard();
        scheduleThumbnailCapture(THUMBNAIL_CAPTURE_INTERVAL_MS);
        postToMaster('SLAVE_READY', { timestamp: Date.now() });
        reportFullscreenStatus('Ventana inicializada', 'init', true);
      })();
    </script>
  </body>
</html>`;
};
