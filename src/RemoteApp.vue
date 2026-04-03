<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { io, type Socket } from 'socket.io-client';
import { isKnownEnvelope, MESSAGE_CHANNEL, type MasterToSlaveMessage } from './types/messages';
import type { MultimediaItem } from './types/playlist';
import type { MonitorTransform } from './types/broadcaster';
import type { WhiteboardState } from './types/whiteboard';

type RemoteConnectionState = 'connecting' | 'paired' | 'reconnecting' | 'down';

const query = new URLSearchParams(window.location.search);
const roomId = ref(query.get('roomId')?.trim() ?? '');
const pairCode = ref('');
const pairingFeedback = ref<string | null>(null);
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

const videoRef = ref<HTMLVideoElement | null>(null);
const iframeRef = ref<HTMLIFrameElement | null>(null);
const whiteboardCanvasRef = ref<HTMLCanvasElement | null>(null);

let socket: Socket | null = null;
let peer: RTCPeerConnection | null = null;
let dataChannel: RTCDataChannel | null = null;

const backendUrl = (() => {
  const configured = import.meta.env.VITE_REMOTE_BACKEND_URL;
  if (typeof configured === 'string' && configured.trim().length > 0) {
    return configured;
  }

  return window.location.origin;
})();

const normalizedPairCode = computed(() => pairCode.value.trim().toUpperCase());

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

    dataChannel.onopen = () => postState('paired');
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

const submitPairing = async () => {
  if (roomId.value.trim().length === 0) {
    pairingFeedback.value = 'Falta roomId en la URL del cliente remoto.';
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

onMounted(() => {
  void nextTick(drawWhiteboard);
});

onBeforeUnmount(() => {
  closeRemoteSession();
});
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-slate-100">
    <section v-if="activeTab === 'pair'" class="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-4 px-6">
      <h1 class="text-2xl font-semibold">Monitor remoto</h1>
      <p class="text-sm text-slate-300">
        Ingresa el codigo de emparejamiento entregado por el host (`XXXX-XXXX-XXXX`).
      </p>

      <label class="form-field" for="pair-code-input">
        Codigo de emparejamiento
        <input
          id="pair-code-input"
          v-model="pairCode"
          class="form-control"
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

    <section v-else class="relative h-screen w-screen overflow-hidden">
      <header class="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-2xl bg-slate-900/70 px-3 py-2 text-xs">
        <strong>{{ monitorLabel }}</strong>
        <span class="rounded-full bg-indigo-500/30 px-2 py-1">{{ remoteStateLabel }}</span>
        <button type="button" class="btn-with-icon btn-sm btn-rose-soft" @click="closeRemoteSession">Cerrar sesion</button>
        <button type="button" class="btn-with-icon btn-sm btn-emerald-soft" @click="requestFullscreen">Intentar fullscreen</button>
      </header>

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
  </main>
</template>
