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
      #empty {
        font-size: 14px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.7;
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
      #closeButton,
      #quickCloseButton {
        border: 1px solid rgba(148, 163, 184, 0.5);
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.9);
        color: #f8fafc;
        padding: 10px 16px;
        font-weight: 600;
        cursor: pointer;
      }
      #closeButton {
        margin-top: 10px;
      }
      #quickCloseButton {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 20;
      }
      #hint {
        display: block;
        margin-top: 12px;
        font-size: 12px;
        color: #93c5fd;
      }
    </style>
  </head>
  <body>
    <div id="viewport">
      <div id="wrapper">
        <img id="image" alt="Imagen transmitida" />
        <video id="video" autoplay playsinline></video>
        <p id="empty">Esperando imagen...</p>
      </div>
    </div>

    <div id="overlay">
      <div id="card">
        <h1>Pantalla lista</h1>
        <p>
          Para activar modo de proyeccion completa, haz clic en el boton desde esta misma ventana.
        </p>
        <button id="fullscreenButton" type="button">Activar Fullscreen</button>
        <button id="closeButton" type="button">Cerrar ventana</button>
        <small id="hint">El navegador exige interaccion del usuario en esta pantalla.</small>
      </div>
    </div>
    <button id="quickCloseButton" type="button" aria-label="Cerrar ventana">Cerrar ventana</button>

    <script>
      (function () {
        const FULLSCREEN_REQUEST_TIMEOUT_MS = 3000;
        const FULLSCREEN_REPORT_THROTTLE_MS = 200;
        const IMAGE_APPLY_DEFER_MS = 0;
        const TRACE_BUFFER_LIMIT = 120;
        const MESSAGE_CHANNEL = ${channelLiteral};
        const monitorId = ${monitorIdLiteral};
        const instanceToken = ${tokenLiteral};
        const overlay = document.getElementById('overlay');
        const button = document.getElementById('fullscreenButton');
        const closeButton = document.getElementById('closeButton');
        const quickCloseButton = document.getElementById('quickCloseButton');
        const wrapper = document.getElementById('wrapper');
        const image = document.getElementById('image');
        const video = document.getElementById('video');
        const empty = document.getElementById('empty');
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
        let imageRenderRequestId = 0;
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

        const stopVideoPlayback = (resetSource) => {
          clearScheduledSyncAction();

          video.pause();
          if (resetSource) {
            video.removeAttribute('src');
          }
          video.style.display = 'none';
          video.dataset.startAtSeconds = '';
          clipEndAtSeconds = null;
        };

        const clearViewportMedia = () => {
          clearScheduledSyncAction();

          image.src = '';
          image.style.display = 'none';

          stopVideoPlayback(true);

          empty.style.display = 'block';
          empty.textContent = 'Esperando contenido...';
        };

        const hasVisibleMedia = () =>
          image.style.display !== 'none' || video.style.display !== 'none';

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

          void video.play().catch(() => {
            empty.style.display = 'block';
            empty.textContent = 'No se pudo reproducir el video en esta ventana.';
          });
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
        closeButton.addEventListener('click', closeSlaveWindow);
        quickCloseButton.addEventListener('click', closeSlaveWindow);

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

            if (imageDataUrl === null) {
              clearViewportMedia();
              return;
            }

            if (typeof imageDataUrl === 'string' && imageDataUrl.length > 0) {
              showImage(imageDataUrl);
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

            if (item === null) {
              clearViewportMedia();
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
              showImage(item.source);
              return;
            }

            if (item.kind === 'video' && typeof item.source === 'string' && item.source.length > 0) {
              showVideo(item);
              return;
            }

            postToMaster('SLAVE_ERROR', {
              message: 'SET_MEDIA ignorado: item no soportado o incompleto.'
            });
            trace('SET_MEDIA:invalid', { reason: 'item' });
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
          if (pendingFullscreenReportTimeoutId !== null) {
            window.clearTimeout(pendingFullscreenReportTimeoutId);
            pendingFullscreenReportTimeoutId = null;
          }
          pendingFullscreenReport = null;
          trace('beforeunload', { isClosingWindow });
          postToMaster('SLAVE_CLOSING', { timestamp: Date.now() });
        });
        video.addEventListener('loadedmetadata', onVideoLoadedMetadata);
        video.addEventListener('timeupdate', onVideoTimeUpdate);

        postToMaster('SLAVE_READY', { timestamp: Date.now() });
        reportFullscreenStatus('Ventana inicializada', 'init', true);
      })();
    </script>
  </body>
</html>`;
};
