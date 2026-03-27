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
        <small id="hint">El navegador exige interaccion del usuario en esta pantalla.</small>
      </div>
    </div>

    <script>
      (function () {
        const MESSAGE_CHANNEL = ${channelLiteral};
        const monitorId = ${monitorIdLiteral};
        const instanceToken = ${tokenLiteral};
        const overlay = document.getElementById('overlay');
        const button = document.getElementById('fullscreenButton');
        const wrapper = document.getElementById('wrapper');
        const image = document.getElementById('image');
        const empty = document.getElementById('empty');

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

        const reportFullscreenStatus = (message) => {
          const active = Boolean(document.fullscreenElement);
          postToMaster('FULLSCREEN_STATUS', {
            active,
            requiresInteraction: !active,
            message
          });
          setFullscreenUi(active);
        };

        const enterFullscreenFromClick = async () => {
          try {
            await document.documentElement.requestFullscreen();
            reportFullscreenStatus('Fullscreen activado');
          } catch (error) {
            const message = error instanceof Error ? error.message : 'No se pudo activar fullscreen';
            reportFullscreenStatus(message);
          }
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
            const imageDataUrl = message.payload.imageDataUrl;
            if (typeof imageDataUrl === 'string' && imageDataUrl.length > 0) {
              image.src = imageDataUrl;
              image.style.display = 'block';
              empty.style.display = 'none';
            } else {
              image.src = '';
              image.style.display = 'none';
              empty.style.display = 'block';
            }
          }

          if (message.type === 'SET_TRANSFORM') {
            const transform = message.payload.transform;
            wrapper.style.transform = 'translate(' + transform.translateX + 'px, ' + transform.translateY + 'px) rotate(' + transform.rotate + 'deg) scale(' + transform.scale + ')';
          }

          if (message.type === 'REQUEST_FULLSCREEN') {
            reportFullscreenStatus('Haz clic en esta ventana para activar fullscreen');
          }

          if (message.type === 'PING') {
            postToMaster('PONG', { timestamp: Date.now() });
          }
        });

        document.addEventListener('fullscreenchange', () => reportFullscreenStatus('Cambio de fullscreen'));
        window.addEventListener('beforeunload', () => postToMaster('SLAVE_CLOSING', { timestamp: Date.now() }));

        postToMaster('SLAVE_READY', { timestamp: Date.now() });
        reportFullscreenStatus('Ventana inicializada');
      })();
    </script>
  </body>
</html>`;
};
