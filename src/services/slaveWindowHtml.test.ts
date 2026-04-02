import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSlaveWindowHtml } from './slaveWindowHtml';
import { MESSAGE_CHANNEL } from '../types/messages';

let runtimeInstanceCounter = 0;
let activeRuntimeIdentity = {
  monitorId: 'mirror-dest',
  instanceToken: 'token-123'
};

const mountSlaveRuntime = ({
  requestFullscreenImpl
}: {
  requestFullscreenImpl?: () => Promise<void>;
} = {}) => {
  runtimeInstanceCounter += 1;
  const monitorId = `mirror-dest-${runtimeInstanceCounter}`;
  const instanceToken = `token-${runtimeInstanceCounter}`;
  activeRuntimeIdentity = {
    monitorId,
    instanceToken
  };

  const html = createSlaveWindowHtml({
    monitorId,
    instanceToken
  });
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const scriptContent = parsed.querySelector('script')?.textContent ?? '';

  document.body.innerHTML = parsed.body.innerHTML;

  const openerPostMessage = vi.fn();
  Object.defineProperty(window, 'opener', {
    configurable: true,
    writable: true,
    value: {
      postMessage: openerPostMessage
    }
  });

  let fullscreenElementValue: Element | null = null;
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreenElementValue
  });

  const requestFullscreenMock = vi.fn(
    requestFullscreenImpl
      ?? (async () => {
        fullscreenElementValue = document.documentElement;
      })
  );
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    configurable: true,
    writable: true,
    value: requestFullscreenMock
  });

  const exitFullscreenMock = vi.fn(() => Promise.resolve());
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    writable: true,
    value: exitFullscreenMock
  });

  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  const loadSpy = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());

  new Function(scriptContent)();

  return {
    monitorId,
    instanceToken,
    loadSpy,
    exitFullscreenMock,
    requestFullscreenMock,
    openerPostMessage,
    setFullscreenElement: (nextValue: Element | null) => {
      fullscreenElementValue = nextValue;
    }
  };
};

const dispatchSlaveMessage = (
  type:
    | 'SET_IMAGE'
    | 'SET_MEDIA'
    | 'FLASH_MONITOR_ID'
    | 'SET_TRANSFORM'
    | 'WHITEBOARD_SET_STATE'
    | 'WHITEBOARD_CLEAR'
    | 'WHITEBOARD_UNDO'
    | 'REQUEST_CLOSE'
    | 'REQUEST_FULLSCREEN'
    | 'PING',
  payload: Record<string, unknown>
) => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        channel: MESSAGE_CHANNEL,
        type,
        instanceToken: activeRuntimeIdentity.instanceToken,
        monitorId: activeRuntimeIdentity.monitorId,
        payload
      }
    })
  );
};

const flushImageRender = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('services/slaveWindowHtml mirror rendering', () => {
  it('no expone controles visibles para cerrar ventana desde el slave', () => {
    mountSlaveRuntime();

    expect(document.body.textContent).not.toContain('Cerrar ventana');
    expect(document.getElementById('closeButton')).toBeNull();
    expect(document.getElementById('quickCloseButton')).toBeNull();
  });

  it('abandona estado "Esperando contenido" al recibir SET_IMAGE valido', async () => {
    mountSlaveRuntime();

    dispatchSlaveMessage('SET_IMAGE', {
      imageDataUrl: 'data:image/png;base64,AAA'
    });
    await flushImageRender();

    const image = document.getElementById('image') as HTMLImageElement;
    const empty = document.getElementById('empty') as HTMLElement;

    expect(image.style.display).toBe('block');
    expect(empty.style.display).toBe('none');
  });

  it('aplica transicion fade sin romper render en SET_MEDIA de playlist', async () => {
    mountSlaveRuntime();

    dispatchSlaveMessage('SET_MEDIA', {
      item: {
        kind: 'image',
        source: 'data:image/png;base64,PLAYLIST_FADE'
      },
      transition: {
        type: 'fade',
        durationMs: 180
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 260));
    await flushImageRender();

    const image = document.getElementById('image') as HTMLImageElement;
    const transitionVeil = document.getElementById('transitionVeil') as HTMLElement;

    expect(image.style.display).toBe('block');
    expect(transitionVeil.style.opacity).toBe('0');
  });

  it('no intenta salir de fullscreen al aplicar SET_IMAGE', () => {
    const { loadSpy, exitFullscreenMock } = mountSlaveRuntime();

    dispatchSlaveMessage('SET_IMAGE', {
      imageDataUrl: 'data:image/png;base64,AAA'
    });

    expect(exitFullscreenMock).not.toHaveBeenCalled();
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('no intenta salir de fullscreen al aplicar SET_MEDIA (imagen o video)', () => {
    const { loadSpy, exitFullscreenMock } = mountSlaveRuntime();

    dispatchSlaveMessage('SET_MEDIA', {
      item: {
        kind: 'image',
        source: 'data:image/png;base64,BBB'
      }
    });

    dispatchSlaveMessage('SET_MEDIA', {
      item: {
        kind: 'video',
        source: 'https://cdn/video.mp4',
        startAtMs: 0,
        endAtMs: null,
        muted: true
      }
    });

    expect(exitFullscreenMock).not.toHaveBeenCalled();
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('muestra flash temporal para identificar monitor y lo oculta al vencer timeout', () => {
    vi.useFakeTimers();

    mountSlaveRuntime();

    dispatchSlaveMessage('FLASH_MONITOR_ID', {
      monitorLabel: 'Escenario lateral',
      durationMs: 1400
    });

    const flash = document.getElementById('monitorIdentifyFlash') as HTMLElement;
    const flashLabel = document.getElementById('monitorIdentifyFlashLabel') as HTMLElement;

    expect(flash.classList.contains('is-active')).toBe(true);
    expect(flashLabel.textContent).toContain('Escenario lateral');

    vi.advanceTimersByTime(1400);

    expect(flash.classList.contains('is-active')).toBe(false);
  });

  it('reporta salida externa de fullscreen y permite reactivacion en un clic', async () => {
    const { instanceToken, openerPostMessage, setFullscreenElement } = mountSlaveRuntime();
    const button = document.getElementById('fullscreenButton') as HTMLButtonElement;

    await button.click();

    setFullscreenElement(document.documentElement);
    document.dispatchEvent(new Event('fullscreenchange'));

    setFullscreenElement(null);
    document.dispatchEvent(new Event('fullscreenchange'));
    await new Promise((resolve) => setTimeout(resolve, 250));

    const fullscreenStatusMessages = openerPostMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'FULLSCREEN_STATUS' && message.instanceToken === instanceToken);
    const latestPayload = fullscreenStatusMessages.at(-1)?.payload;

    expect(latestPayload?.unexpectedExit).toBe(true);
    expect(latestPayload?.intentActive).toBe(true);
    expect(button.textContent).toContain('Reactivar Fullscreen');
  });

  it('repite el flujo fullscreen -> volver al master -> set image sin congelar controles', async () => {
    const { requestFullscreenMock, setFullscreenElement } = mountSlaveRuntime();
    const button = document.getElementById('fullscreenButton') as HTMLButtonElement;

    await button.click();
    setFullscreenElement(document.documentElement);
    document.dispatchEvent(new Event('fullscreenchange'));
    setFullscreenElement(null);
    document.dispatchEvent(new Event('fullscreenchange'));
    dispatchSlaveMessage('SET_IMAGE', {
      imageDataUrl: 'data:image/png;base64,FIRST'
    });

    await button.click();
    setFullscreenElement(document.documentElement);
    document.dispatchEvent(new Event('fullscreenchange'));
    setFullscreenElement(null);
    document.dispatchEvent(new Event('fullscreenchange'));
    dispatchSlaveMessage('SET_IMAGE', {
      imageDataUrl: 'data:image/png;base64,SECOND'
    });

    expect(requestFullscreenMock).toHaveBeenCalledTimes(2);
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain('Reactivar Fullscreen');
  });

  it('no crea watchdogs periodicos de UI en runtime esclavo', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    mountSlaveRuntime();

    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('ignora focus/visibilitychange sin cerrar ni bloquear la ventana', async () => {
    const { instanceToken, openerPostMessage } = mountSlaveRuntime();

    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));

    const messageTypes = openerPostMessage.mock.calls.map(([message]) => message.type);
    const fullscreenStatuses = openerPostMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'FULLSCREEN_STATUS' && message.instanceToken === instanceToken);

    expect(messageTypes).not.toContain('SLAVE_CLOSING');
    expect(fullscreenStatuses).toHaveLength(1);
  });

  it('deduplica y limita rafagas de fullscreenchange para evitar floods', async () => {
    vi.useFakeTimers();

    const { instanceToken, openerPostMessage, setFullscreenElement } = mountSlaveRuntime();
    const fullscreenStatusPayloads = () =>
      openerPostMessage.mock.calls
        .map(([message]) => message)
        .filter((message) => message.type === 'FULLSCREEN_STATUS' && message.instanceToken === instanceToken)
        .map((message) => message.payload);

    setFullscreenElement(document.documentElement);
    document.dispatchEvent(new Event('fullscreenchange'));
    setFullscreenElement(null);
    document.dispatchEvent(new Event('fullscreenchange'));
    setFullscreenElement(document.documentElement);
    document.dispatchEvent(new Event('fullscreenchange'));

    vi.advanceTimersByTime(250);

    const payloads = fullscreenStatusPayloads();
    expect(payloads.length).toBeLessThanOrEqual(3);
    expect(payloads.at(-1)?.active).toBe(true);
  });

  it('mantiene REQUEST_CLOSE operativo tras secuencia focus/visibility/fullscreenchange', () => {
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    const { openerPostMessage, setFullscreenElement } = mountSlaveRuntime();

    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    setFullscreenElement(document.documentElement);
    document.dispatchEvent(new Event('fullscreenchange'));
    setFullscreenElement(null);
    document.dispatchEvent(new Event('fullscreenchange'));

    dispatchSlaveMessage('REQUEST_CLOSE', {
      reason: 'Operator close command'
    });

    expect(closeSpy.mock.calls.length).toBeGreaterThanOrEqual(1);

    const closingMessages = openerPostMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'SLAVE_CLOSING');
    expect(closingMessages.length).toBeGreaterThanOrEqual(1);
  });

  it('emite THUMBNAIL_SNAPSHOT periodico con limite de frecuencia por monitor', async () => {
    vi.useFakeTimers();

    const drawImageMock = vi.fn();
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      save: vi.fn(),
      restore: vi.fn(),
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      lineCap: 'round',
      lineJoin: 'round',
      strokeStyle: '#ef4444',
      lineWidth: 1,
      globalCompositeOperation: 'source-over',
      drawImage: drawImageMock
    } as unknown as CanvasRenderingContext2D);
    const toDataUrlSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValueOnce('data:image/jpeg;base64,thumb-1')
      .mockReturnValueOnce('data:image/jpeg;base64,thumb-2')
      .mockReturnValue('data:image/jpeg;base64,thumb-3');

    const { openerPostMessage, instanceToken } = mountSlaveRuntime();

    dispatchSlaveMessage('SET_IMAGE', {
      imageDataUrl: 'data:image/png;base64,AAA'
    });
    vi.advanceTimersByTime(0);
    await Promise.resolve();
    await Promise.resolve();

    const image = document.getElementById('image') as HTMLImageElement;
    Object.defineProperty(image, 'naturalWidth', {
      configurable: true,
      get: () => 1920
    });
    Object.defineProperty(image, 'naturalHeight', {
      configurable: true,
      get: () => 1080
    });

    vi.advanceTimersByTime(2100);

    const thumbnailSnapshots = openerPostMessage.mock.calls
      .map(([message]) => message)
      .filter(
        (message) => message.type === 'THUMBNAIL_SNAPSHOT'
          && message.instanceToken === instanceToken
          && typeof message.payload?.imageDataUrl === 'string'
      );

    expect(getContextSpy).toHaveBeenCalled();
    expect(toDataUrlSpy).toHaveBeenCalled();
    expect(drawImageMock).toHaveBeenCalled();
    expect(thumbnailSnapshots.length).toBeGreaterThanOrEqual(2);
    expect(thumbnailSnapshots.length).toBeLessThanOrEqual(3);
  });

  it('ignora payload SET_MEDIA invalido sin limpiar contenido activo', async () => {
    const { openerPostMessage } = mountSlaveRuntime();

    dispatchSlaveMessage('SET_MEDIA', {
      item: {
        kind: 'image',
        source: 'data:image/png;base64,LOCKED'
      }
    });

    await flushImageRender();

    dispatchSlaveMessage('SET_MEDIA', {
      item: {
        kind: 'image',
        source: ''
      }
    });

    const image = document.getElementById('image') as HTMLImageElement;
    const empty = document.getElementById('empty') as HTMLElement;

    expect(image.style.display).toBe('block');
    expect(empty.style.display).toBe('none');

    const errorMessages = openerPostMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'SLAVE_ERROR');
    const latestError = errorMessages.at(-1)?.payload?.message;

    expect(latestError).toContain('SET_MEDIA ignorado');
  });

  it('mantiene ventana operable tras volver del selector y cargar imagen grande', async () => {
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    const { openerPostMessage, setFullscreenElement } = mountSlaveRuntime();
    const button = document.getElementById('fullscreenButton') as HTMLButtonElement;
    const wrapper = document.getElementById('wrapper') as HTMLElement;

    await button.click();
    setFullscreenElement(document.documentElement);
    document.dispatchEvent(new Event('fullscreenchange'));

    setFullscreenElement(null);
    document.dispatchEvent(new Event('fullscreenchange'));

    const hugeDataUrl = `data:image/png;base64,${'X'.repeat(200000)}`;
    dispatchSlaveMessage('SET_IMAGE', {
      imageDataUrl: hugeDataUrl
    });
    await flushImageRender();

    dispatchSlaveMessage('SET_TRANSFORM', {
      transform: {
        rotate: 12,
        scale: 1.1,
        translateX: 25,
        translateY: -8
      }
    });
    dispatchSlaveMessage('PING', {
      timestamp: Date.now()
    });

    dispatchSlaveMessage('REQUEST_CLOSE', {
      reason: 'Operator close command'
    });

    expect(wrapper.style.transform).toContain('translate(25px, -8px)');
    expect(closeSpy).toHaveBeenCalledTimes(1);

    const types = openerPostMessage.mock.calls.map(([message]) => message.type);
    expect(types).toContain('PONG');
    expect(types).toContain('SLAVE_CLOSING');

    const trace = (window as Window & { __MMIB_SLAVE_TRACE__?: Array<{ event: string }> }).__MMIB_SLAVE_TRACE__;
    expect(trace?.some((entry) => entry.event === 'SET_IMAGE:received')).toBe(true);
    expect(trace?.some((entry) => entry.event === 'fullscreenchange')).toBe(true);
    expect(trace?.some((entry) => entry.event.startsWith('REQUEST_CLOSE'))).toBe(true);
  });

  it('request close sale de fullscreen antes de cerrar ventana', async () => {
    vi.spyOn(window, 'close').mockImplementation(() => undefined);
    const { exitFullscreenMock, openerPostMessage, setFullscreenElement } = mountSlaveRuntime();

    setFullscreenElement(document.documentElement);

    dispatchSlaveMessage('REQUEST_CLOSE', {
      reason: 'Operator close command'
    });

    await Promise.resolve();

    expect(exitFullscreenMock.mock.calls.length).toBeGreaterThanOrEqual(1);

    const closingMessages = openerPostMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'SLAVE_CLOSING');

    expect(closingMessages.length).toBeGreaterThanOrEqual(1);
  });

  it('mantiene cierre operativo desde REQUEST_CLOSE', () => {
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    const { openerPostMessage } = mountSlaveRuntime();

    dispatchSlaveMessage('REQUEST_CLOSE', {
      reason: 'Operator close command'
    });

    expect(closeSpy.mock.calls.length).toBeGreaterThanOrEqual(1);

    const closingMessages = openerPostMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'SLAVE_CLOSING');

    expect(closingMessages.length).toBeGreaterThanOrEqual(1);
  });

  it('aplica trazos al overlay de pizarra con WHITEBOARD_SET_STATE', () => {
    const lineToSpy = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      save: vi.fn(),
      restore: vi.fn(),
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: lineToSpy,
      stroke: vi.fn(),
      lineCap: 'round',
      lineJoin: 'round',
      strokeStyle: '#ef4444',
      lineWidth: 1,
      globalCompositeOperation: 'source-over',
      rect: vi.fn(),
      ellipse: vi.fn(),
      drawImage: vi.fn()
    } as unknown as CanvasRenderingContext2D);
    mountSlaveRuntime();

    dispatchSlaveMessage('WHITEBOARD_SET_STATE', {
      state: {
        strokes: [
          {
            tool: 'draw',
            color: '#ef4444',
            width: 6,
            points: [
              { x: 0.1, y: 0.1 },
              { x: 0.8, y: 0.7 }
            ]
          }
        ]
      }
    });

    expect(lineToSpy).toHaveBeenCalled();
  });

  it('renderiza linea, flecha, rectangulo y circulo desde WHITEBOARD_SET_STATE', () => {
    const lineToSpy = vi.fn();
    const rectSpy = vi.fn();
    const ellipseSpy = vi.fn();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      save: vi.fn(),
      restore: vi.fn(),
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: lineToSpy,
      stroke: vi.fn(),
      rect: rectSpy,
      ellipse: ellipseSpy,
      lineCap: 'round',
      lineJoin: 'round',
      strokeStyle: '#ef4444',
      lineWidth: 1,
      globalCompositeOperation: 'source-over',
      drawImage: vi.fn()
    } as unknown as CanvasRenderingContext2D);

    mountSlaveRuntime();

    dispatchSlaveMessage('WHITEBOARD_SET_STATE', {
      state: {
        strokes: [
          {
            tool: 'line',
            color: '#38bdf8',
            width: 4,
            points: [
              { x: 0.1, y: 0.1 },
              { x: 0.9, y: 0.2 }
            ]
          },
          {
            tool: 'arrow',
            color: '#f59e0b',
            width: 5,
            points: [
              { x: 0.15, y: 0.25 },
              { x: 0.85, y: 0.35 }
            ]
          },
          {
            tool: 'rect',
            color: '#22c55e',
            width: 6,
            points: [
              { x: 0.2, y: 0.2 },
              { x: 0.8, y: 0.7 }
            ]
          },
          {
            tool: 'circle',
            color: '#e879f9',
            width: 6,
            points: [
              { x: 0.2, y: 0.3 },
              { x: 0.75, y: 0.85 }
            ]
          }
        ]
      }
    });

    expect(lineToSpy).toHaveBeenCalled();
    expect(rectSpy).toHaveBeenCalledTimes(1);
    expect(ellipseSpy).toHaveBeenCalledTimes(1);
  });

  it('reporta error en payload invalido de WHITEBOARD_SET_STATE', () => {
    const { openerPostMessage, instanceToken } = mountSlaveRuntime();

    dispatchSlaveMessage('WHITEBOARD_SET_STATE', {
      state: null
    });

    const errorMessages = openerPostMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'SLAVE_ERROR' && message.instanceToken === instanceToken);

    expect(errorMessages.at(-1)?.payload?.message).toContain('WHITEBOARD_SET_STATE ignorado');
  });
});
