<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { io, type Socket } from 'socket.io-client';
import { isKnownEnvelope, MESSAGE_CHANNEL, type MasterToSlaveMessage } from './types/messages';
import type { MultimediaItem } from './types/playlist';
import type { MonitorTransform } from './types/broadcaster';
import type { WhiteboardState } from './types/whiteboard';
import { resolveRemoteBackendUrl } from './utils/remoteBackend';
import { isValidPairCode, parseRemotePairingQuery } from './utils/remotePairing';
import mythrPrismLogo from './assets/img/MythrPrism.png';

type RemoteConnectionState = 'connecting' | 'paired' | 'reconnecting' | 'down';

const initialPairingQuery = parseRemotePairingQuery(window.location.search);
const roomId = ref(initialPairingQuery.roomId);
const pairCode = ref(initialPairingQuery.pairCode);
const pairingFeedback = ref<string | null>(initialPairingQuery.feedback);
const remoteState = ref<RemoteConnectionState>('connecting');
const remoteMonitorId = ref('');
const hostSocketId = ref('');
const monitorLabel = ref('Monitor remoto');

const imageDataUrl = ref<string | null>(null);
const mediaItem = ref<MultimediaItem | null>(null);
const transform = ref<MonitorTransform>({ rotate: 0, scale: 1, translateX: 0, translateY: 0 });
const whiteboardState = ref<WhiteboardState>({ strokes: [] });
const identifyLabel = ref<string | null>(null);
const activeTab = ref<'pair' | 'viewer'>('pair');
const isPortraitOrientation = ref(false);
const isToolbarVisible = ref(true);

const videoRef = ref<HTMLVideoElement | null>(null);
const iframeRef = ref<HTMLIFrameElement | null>(null);
const whiteboardCanvasRef = ref<HTMLCanvasElement | null>(null);

let socket: Socket | null = null;
let peer: RTCPeerConnection | null = null;
let dataChannel: RTCDataChannel | null = null;

const backendUrl = resolveRemoteBackendUrl();
const REMOTE_VIEWPORT_CONTENT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
const TOOLBAR_IDLE_TIMEOUT_MS = 10_000;

let previousViewportContent: string | null = null;
let createdViewportMeta = false;
let toolbarIdleTimer: ReturnType<typeof window.setTimeout> | null = null;

const normalizedPairCode = computed(() => pairCode.value.trim().toUpperCase());

const resolveLandscapeStatus = (): boolean => {
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(orientation: landscape)').matches;
  }

  return window.innerWidth >= window.innerHeight;
};

const syncOrientationState = () => {
  isPortraitOrientation.value = !resolveLandscapeStatus();
};

const tryLockLandscapeOrientation = async () => {
  const orientationApi = screen.orientation;
  if (!orientationApi || typeof orientationApi.lock !== 'function') {
    return;
  }

  try {
    await orientationApi.lock('landscape');
  } catch {
    // Ignored: some browsers require fullscreen/user activation.
  }
};

const displayTransform = computed(() =>
  `translate(${transform.value.translateX}px, ${transform.value.translateY}px) rotate(${transform.value.rotate}deg) scale(${transform.value.scale})`
);

const remoteStateLabel = computed(() => {
  if (remoteState.value === 'paired') {
    return 'Emparejado';
  }

  if (remoteState.value === 'reconnecting') {
    return 'Reconectando';
  }

  if (remoteState.value === 'down') {
    return 'Caido';
  }

  return 'Conectando';
});

const postState = (state: RemoteConnectionState) => {
  remoteState.value = state;
  socket?.emit('remote:update-state', { state });
};

const preventGestureZoom = (event: Event) => {
  event.preventDefault();
};

const resolveViewportMeta = (): HTMLMetaElement => {
  const existingViewportMeta = document.querySelector('meta[name="viewport"]');
  if (existingViewportMeta) {
    return existingViewportMeta;
  }

  const viewportMeta = document.createElement('meta');
  viewportMeta.setAttribute('name', 'viewport');
  document.head.append(viewportMeta);
  createdViewportMeta = true;
  return viewportMeta;
};

const lockViewportZoom = () => {
  const viewportMeta = resolveViewportMeta();
  previousViewportContent = viewportMeta.getAttribute('content');
  viewportMeta.setAttribute('content', REMOTE_VIEWPORT_CONTENT);

  document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
  document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
  document.addEventListener('gestureend', preventGestureZoom, { passive: false });
};

const unlockViewportZoom = () => {
  document.removeEventListener('gesturestart', preventGestureZoom);
  document.removeEventListener('gesturechange', preventGestureZoom);
  document.removeEventListener('gestureend', preventGestureZoom);

  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (!viewportMeta) {
    return;
  }

  if (previousViewportContent === null) {
    if (createdViewportMeta) {
      viewportMeta.remove();
    } else {
      viewportMeta.removeAttribute('content');
    }
    return;
  }

  viewportMeta.setAttribute('content', previousViewportContent);
};

const resolveFullscreenCapability = (): { supported: boolean; available: boolean } => {
  const supported = typeof document?.documentElement?.requestFullscreen === 'function';
  return {
    supported,
    available: supported
  };
};

const postFullscreenCapability = () => {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    return;
  }

  const capability = resolveFullscreenCapability();
  dataChannel.send(JSON.stringify({
    type: 'REMOTE_FULLSCREEN_CAPABILITY',
    payload: capability
  }));
};

const connectSocket = (): Socket => {
  if (socket) {
    return socket;
  }

  socket = io(backendUrl, { transports: ['websocket', 'polling'] });

  socket.on('disconnect', () => {
    postState('down');
  });

  socket.on('connect', () => {
    if (remoteState.value === 'reconnecting') {
      postState('paired');
    }
  });

  socket.on('pairing:approved', async (payload: { roomId: string; remoteMonitorId: string; hostSocketId: string }) => {
    roomId.value = payload.roomId;
    remoteMonitorId.value = payload.remoteMonitorId;
    hostSocketId.value = payload.hostSocketId;
    activeTab.value = 'viewer';
    postState('connecting');
    await setupPeer();
  });

  socket.on('room:closed', () => {
    pairingFeedback.value = 'La sesion remota fue cerrada por el host.';
    postState('down');
    activeTab.value = 'pair';
  });

  socket.on('signal:offer', async (payload: { fromSocketId: string; payload: RTCSessionDescriptionInit }) => {
    if (payload.fromSocketId !== hostSocketId.value && hostSocketId.value.length > 0) {
      return;
    }

    if (!peer) {
      await setupPeer();
    }

    if (!peer) {
      return;
    }

    await peer.setRemoteDescription(new RTCSessionDescription(payload.payload));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket?.emit('signal:answer', {
      roomId: roomId.value,
      targetSocketId: payload.fromSocketId,
      payload: answer,
      sentAtMs: Date.now()
    });
  });

  socket.on('signal:ice-candidate', async (payload: { payload: RTCIceCandidateInit }) => {
    if (!peer) {
      return;
    }

    await peer.addIceCandidate(new RTCIceCandidate(payload.payload));
  });

  socket.on('remote:control-message', (payload: { message: unknown }) => {
    applyControlMessage(payload.message);
  });

  return socket;
};

const setupPeer = async (): Promise<void> => {
  const activeSocket = connectSocket();
  peer = new RTCPeerConnection();

  peer.onicecandidate = (event) => {
    if (!event.candidate) {
      return;
    }

    activeSocket.emit('signal:ice-candidate', {
      roomId: roomId.value,
      targetSocketId: hostSocketId.value,
      payload: event.candidate.toJSON(),
      sentAtMs: Date.now()
    });
  };

  peer.onconnectionstatechange = () => {
    const state = peer?.connectionState;
    if (state === 'connected') {
      postState('paired');
      return;
    }

    if (state === 'disconnected' || state === 'failed') {
      postState('reconnecting');
      return;
    }

    if (state === 'closed') {
      postState('down');
    }
  };

  peer.ondatachannel = (event) => {
    dataChannel = event.channel;

    dataChannel.onmessage = (messageEvent) => {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(String(messageEvent.data));
      } catch {
        return;
      }

      applyControlMessage(parsed);
    };

    dataChannel.onopen = () => {
      postState('paired');
      postFullscreenCapability();
    };
    dataChannel.onclose = () => postState('reconnecting');
  };
};

const drawWhiteboard = () => {
  const canvas = whiteboardCanvasRef.value;
  if (!canvas) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width));
  canvas.height = Math.max(1, Math.floor(rect.height));

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  whiteboardState.value.strokes.forEach((stroke) => {
    if (!stroke.points || stroke.points.length === 0) {
      return;
    }

    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.beginPath();

    stroke.points.forEach((point, index) => {
      const x = point.x * canvas.width;
      const y = point.y * canvas.height;

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });

    context.stroke();
  });
};

const applyControlMessage = (message: unknown) => {
  if (!isKnownEnvelope(message)) {
    return;
  }

  if (message.channel !== MESSAGE_CHANNEL || message.monitorId !== remoteMonitorId.value) {
    return;
  }

  const typed = message as MasterToSlaveMessage;

  if (typed.type === 'MASTER_INIT') {
    monitorLabel.value = typed.payload.monitorLabel;
    return;
  }

  if (typed.type === 'SET_TRANSFORM') {
    transform.value = typed.payload.transform;
    return;
  }

  if (typed.type === 'SET_IMAGE') {
    imageDataUrl.value = typed.payload.imageDataUrl;
    mediaItem.value = null;
    return;
  }

  if (typed.type === 'SET_MEDIA') {
    mediaItem.value = typed.payload.item;
    imageDataUrl.value = null;
    return;
  }

  if (typed.type === 'WHITEBOARD_SET_STATE') {
    whiteboardState.value = typed.payload.state;
    void nextTick(drawWhiteboard);
    return;
  }

  if (typed.type === 'WHITEBOARD_CLEAR') {
    whiteboardState.value = { strokes: [] };
    void nextTick(drawWhiteboard);
    return;
  }

  if (typed.type === 'WHITEBOARD_UNDO') {
    whiteboardState.value = {
      strokes: whiteboardState.value.strokes.slice(0, -1)
    };
    void nextTick(drawWhiteboard);
    return;
  }

  if (typed.type === 'FLASH_MONITOR_ID') {
    identifyLabel.value = typed.payload.monitorLabel;
    window.setTimeout(() => {
      identifyLabel.value = null;
    }, typed.payload.durationMs);
    return;
  }

  if (typed.type === 'REQUEST_FULLSCREEN') {
    void requestFullscreen();
    return;
  }

  if (typed.type === 'REQUEST_CLOSE') {
    closeRemoteSession();
    return;
  }

  if (typed.type === 'VIDEO_SYNC_PLAY') {
    const video = videoRef.value;
    if (video) {
      video.currentTime = typed.payload.mediaTimeMs / 1000;
      void video.play();
    }
    return;
  }

  if (typed.type === 'VIDEO_SYNC_PAUSE') {
    videoRef.value?.pause();
    return;
  }

  if (typed.type === 'VIDEO_SYNC_SEEK') {
    const video = videoRef.value;
    if (video) {
      video.currentTime = typed.payload.mediaTimeMs / 1000;
    }
    return;
  }

  if (typed.type === 'EXTERNAL_URL_RELOAD') {
    iframeRef.value?.contentWindow?.location.reload();
  }
};

const requestFullscreen = async () => {
  try {
    if (document.fullscreenElement) {
      return;
    }

    await document.documentElement.requestFullscreen();
    void tryLockLandscapeOrientation();
    pairingFeedback.value = 'Fullscreen activado.';
  } catch {
    pairingFeedback.value = 'No se pudo activar fullscreen en este navegador. Continua en modo normal.';
  }
};

const closeRemoteSession = () => {
  if (roomId.value.length > 0) {
    socket?.emit('remote:close-session', { roomId: roomId.value });
  }

  postState('down');
  socket?.disconnect();
  socket = null;
  peer?.close();
  peer = null;
  dataChannel?.close();
  dataChannel = null;
  activeTab.value = 'pair';
};

const clearToolbarIdleTimer = () => {
  if (toolbarIdleTimer === null) {
    return;
  }

  window.clearTimeout(toolbarIdleTimer);
  toolbarIdleTimer = null;
};

const scheduleToolbarAutoHide = () => {
  clearToolbarIdleTimer();
  toolbarIdleTimer = window.setTimeout(() => {
    isToolbarVisible.value = false;
  }, TOOLBAR_IDLE_TIMEOUT_MS);
};

const showToolbarAndResetTimer = () => {
  if (activeTab.value !== 'viewer') {
    return;
  }

  isToolbarVisible.value = true;
  scheduleToolbarAutoHide();
};

const handleRemoteInteraction = () => {
  showToolbarAndResetTimer();
};

const submitPairing = async () => {
  if (roomId.value.trim().length === 0) {
    pairingFeedback.value = 'Falta roomId en la URL del cliente remoto.';
    return;
  }

  if (!isValidPairCode(normalizedPairCode.value)) {
    pairingFeedback.value = 'El codigo de emparejamiento debe tener formato `XXXX-XXXX-XXXX`.';
    return;
  }

  const activeSocket = connectSocket();
  pairingFeedback.value = null;

  await new Promise<void>((resolve) => {
    activeSocket.emit('pairing:join-request', {
      roomId: roomId.value,
      pairCode: normalizedPairCode.value
    }, (result: { ok: boolean; error?: string }) => {
      if (!result.ok) {
        pairingFeedback.value = `No se pudo emparejar: ${result.error ?? 'error_desconocido'}.`;
        resolve();
        return;
      }

      pairingFeedback.value = 'Solicitud enviada. Esperando validacion del host...';
      resolve();
    });
  });
};

watch(whiteboardState, () => {
  drawWhiteboard();
}, { deep: true });

watch(activeTab, (tab) => {
  if (tab === 'viewer') {
    showToolbarAndResetTimer();
    return;
  }

  clearToolbarIdleTimer();
  isToolbarVisible.value = true;
});

onMounted(() => {
  lockViewportZoom();
  syncOrientationState();
  void tryLockLandscapeOrientation();
  void nextTick(drawWhiteboard);
  document.addEventListener('fullscreenchange', postFullscreenCapability);
  window.addEventListener('orientationchange', syncOrientationState);
  window.addEventListener('resize', syncOrientationState);
  screen.orientation?.addEventListener('change', syncOrientationState);
  window.addEventListener('pointerdown', handleRemoteInteraction);
  window.addEventListener('touchstart', handleRemoteInteraction, { passive: true });
  window.addEventListener('click', handleRemoteInteraction);
  window.addEventListener('keydown', handleRemoteInteraction);
});

onBeforeUnmount(() => {
  unlockViewportZoom();
  document.removeEventListener('fullscreenchange', postFullscreenCapability);
  window.removeEventListener('orientationchange', syncOrientationState);
  window.removeEventListener('resize', syncOrientationState);
  screen.orientation?.removeEventListener('change', syncOrientationState);
  window.removeEventListener('pointerdown', handleRemoteInteraction);
  window.removeEventListener('touchstart', handleRemoteInteraction);
  window.removeEventListener('click', handleRemoteInteraction);
  window.removeEventListener('keydown', handleRemoteInteraction);
  clearToolbarIdleTimer();
  closeRemoteSession();
});
</script>

<template>
  <main class="remote-app-root min-h-screen bg-slate-950 text-slate-100">
    <section
      v-if="activeTab === 'pair'"
      class="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-4 px-6"
      :class="{ 'pointer-events-none select-none opacity-25': isPortraitOrientation }"
    >
      <div class="remote-pairing-brand">
        <img
          :src="mythrPrismLogo"
          alt="Logo de Mythr Prism"
          class="remote-pairing-brand-logo"
        >
        <div>
          <p class="section-kicker">Mythr Prism</p>
          <h1 class="mt-1 text-2xl font-semibold">Monitor remoto</h1>
        </div>
      </div>
      <p class="text-sm text-slate-300">
        Ingresa el codigo de emparejamiento entregado por el host (`XXXX-XXXX-XXXX`).
      </p>

      <label class="form-field" for="pair-code-input">
        Codigo de emparejamiento
        <input
          id="pair-code-input"
          v-model="pairCode"
          class="form-control remote-pair-code-input"
          inputmode="text"
          autocomplete="off"
          placeholder="ABCD-EFGH-2345"
        >
      </label>

      <button type="button" class="btn-with-icon btn-sm btn-indigo-soft" @click="submitPairing">
        Conectar monitor remoto
      </button>

      <p v-if="pairingFeedback" class="text-sm text-slate-200">{{ pairingFeedback }}</p>
    </section>

    <section
      v-else
      class="relative h-screen w-screen overflow-hidden"
      :class="{ 'pointer-events-none select-none opacity-25': isPortraitOrientation }"
    >
      <transition name="remote-toolbar-fade">
        <header
          v-show="isToolbarVisible"
          class="remote-viewer-toolbar remote-viewer-toolbar--right"
          :aria-hidden="isToolbarVisible ? 'false' : 'true'"
        >
          <strong>{{ monitorLabel }}</strong>
          <span class="rounded-full bg-indigo-500/30 px-2 py-1">{{ remoteStateLabel }}</span>
          <button type="button" class="btn-with-icon btn-sm btn-rose-soft" @click="closeRemoteSession">Cerrar sesion</button>
          <button type="button" class="btn-with-icon btn-sm btn-emerald-soft" @click="requestFullscreen">Intentar fullscreen</button>
        </header>
      </transition>

      <div class="flex h-full w-full items-center justify-center bg-black" :style="{ transform: displayTransform }">
        <img v-if="imageDataUrl" :src="imageDataUrl" alt="Contenido remoto" class="h-full w-full object-contain">
        <video
          v-else-if="mediaItem?.kind === 'video'"
          ref="videoRef"
          :src="mediaItem.source"
          class="h-full w-full object-contain"
          playsinline
          autoplay
        />
        <iframe
          v-else-if="mediaItem?.kind === 'external-url'"
          ref="iframeRef"
          :src="mediaItem.source"
          class="h-full w-full border-0"
        />
        <img v-else-if="mediaItem?.kind === 'image'" :src="mediaItem.source" alt="Contenido remoto" class="h-full w-full object-contain">
        <p v-else class="text-sm uppercase tracking-[0.2em] text-slate-300">Esperando contenido...</p>
      </div>

      <canvas ref="whiteboardCanvasRef" class="pointer-events-none absolute inset-0 z-20 h-full w-full" />

      <div v-if="identifyLabel" class="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-sky-400/20">
        <span class="rounded-full border border-sky-300 bg-slate-950/80 px-5 py-2 text-sm font-semibold">{{ identifyLabel }}</span>
      </div>
    </section>

    <div
      v-if="isPortraitOrientation"
      class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/95 px-6 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div class="max-w-lg space-y-3 rounded-2xl border border-amber-300/50 bg-slate-900/90 p-6 shadow-2xl">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Orientacion requerida</p>
        <h2 class="text-2xl font-semibold text-white">Gira el dispositivo a horizontal</h2>
        <p class="text-sm text-slate-200">
          Para continuar en modo remoto, usa el dispositivo en orientacion apaisada (landscape).
        </p>
      </div>
    </div>
  </main>
</template>
