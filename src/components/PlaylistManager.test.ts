import { config, flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PlaylistManager from './PlaylistManager.vue';
import * as videoThumbnailService from '../services/videoThumbnail';
import type { MonitorDescriptor, MonitorStateMap } from '../types/broadcaster';
import type { MultimediaItem, PlaylistPlaybackState } from '../types/playlist';
import type { VideoSyncPlan } from '../types/videoSync';

config.global.stubs = {
  ...(config.global.stubs ?? {}),
  teleport: true
};

const createMonitor = (id: string, label: string): MonitorDescriptor => ({
  id,
  label,
  width: 1920,
  height: 1080,
  left: 0,
  top: 0,
  availLeft: 0,
  availTop: 0,
  availWidth: 1920,
  availHeight: 1080,
  isPrimary: true,
  isMasterAppScreen: false,
  raw: {} as ScreenDetailed
});

const createPlaybackState = (overrides?: Partial<PlaylistPlaybackState>): PlaylistPlaybackState => ({
  targetMonitorIds: [],
  currentIndex: 0,
  autoplay: false,
  intervalSeconds: 5,
  ...overrides
});

const createImage = (id: string, name: string): MultimediaItem => ({
  id,
  kind: 'image',
  name,
  source: `data:image/png;base64,${id}`,
  durationMs: 5000
});

const createVideo = (id: string, name: string): MultimediaItem => ({
  id,
  kind: 'video',
  name,
  source: `https://cdn/${id}.mp4`,
  startAtMs: 0,
  endAtMs: null,
  muted: true
});

const createLongSource = (): string => `data:image/png;base64,${'a'.repeat(180)}`;

const createMonitorStates = (): MonitorStateMap => ({
  m1: {
    transform: { rotate: 0, scale: 1, translateX: 0, translateY: 0 },
    imageDataUrl: null,
    activeMediaItem: null,
    isWindowOpen: true,
    isSlaveReady: true,
    isFullscreen: false,
    requiresFullscreenInteraction: false,
    lastError: null
  },
  m2: {
    transform: { rotate: 0, scale: 1, translateX: 0, translateY: 0 },
    imageDataUrl: null,
    activeMediaItem: null,
    isWindowOpen: false,
    isSlaveReady: false,
    isFullscreen: false,
    requiresFullscreenInteraction: true,
    lastError: null
  }
});

const createFileList = (file: File): FileList => {
  const fileList: Partial<FileList> & { 0: File } = {
    0: file,
    length: 1,
    item: (index: number) => (index === 0 ? file : null)
  };

  return fileList as FileList;
};

const createMockDataTransfer = (): DataTransfer => {
  const store: Record<string, string> = {};

  return {
    dropEffect: 'move',
    effectAllowed: 'all',
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [],
    clearData: (format?: string) => {
      if (!format) {
        for (const key of Object.keys(store)) {
          delete store[key];
        }
        return;
      }

      delete store[format];
    },
    getData: (format: string) => store[format] ?? '',
    setData: (format: string, value: string) => {
      store[format] = value;
    },
    setDragImage: () => {},
    addElement: () => {}
  } as DataTransfer;
};

const createVideoSyncPlan = (overrides?: Partial<VideoSyncPlan>): VideoSyncPlan => ({
  strategy: {
    commandLeadMs: 800,
    driftToleranceMs: 80,
    resyncIntervalMs: 4000
  },
  hostMonitorId: 'm1',
  clientMonitorIds: ['m2'],
  eligibleMonitorIds: ['m1', 'm2'],
  canSynchronize: true,
  reason: 'ok',
  ...overrides
});

const openAddModal = async (wrapper: ReturnType<typeof mount>) => {
  await wrapper.get('[data-testid="open-add-item-modal"]').trigger('click');
  expect(wrapper.find('[data-testid="add-item-modal"]').exists()).toBe(true);
  const dialog = wrapper.get('[data-testid="add-item-modal"]');
  expect(dialog.attributes('role')).toBe('dialog');
  expect(dialog.attributes('aria-modal')).toBe('true');
};

const getLayoutGroupOrder = (wrapper: ReturnType<typeof mount>, modalTestId: string): string[] =>
  wrapper
    .get(`[data-testid="${modalTestId}"]`)
    .findAll('[data-layout-group]')
    .map((group) => group.attributes('data-layout-group') ?? '');

const expectModalViewportLayout = (
  wrapper: ReturnType<typeof mount>,
  ids: {
    overlay: string;
    modal: string;
    modalVariant: string;
    header: string;
    body: string;
    footer?: string;
  }
) => {
  const overlay = wrapper.get(`[data-testid="${ids.overlay}"]`);
  expect(overlay.classes()).toContain('fixed');
  expect(overlay.classes()).toContain('inset-0');
  expect(overlay.classes()).toContain('items-center');
  expect(overlay.classes()).toContain('justify-center');

  const modal = wrapper.get(`[data-testid="${ids.modal}"]`);
  expect(modal.classes()).toContain('app-modal-panel');
  expect(modal.classes()).toContain(ids.modalVariant);

  const header = wrapper.get(`[data-testid="${ids.header}"]`);
  expect(header.classes()).toContain('sticky');
  expect(header.classes()).toContain('top-0');

  const body = wrapper.get(`[data-testid="${ids.body}"]`);
  expect(body.classes()).toContain('min-h-0');
  expect(body.classes()).toContain('overflow-auto');

  if (!ids.footer) {
    return;
  }

  const footer = wrapper.get(`[data-testid="${ids.footer}"]`);
  expect(footer.classes()).toContain('sticky');
  expect(footer.classes()).toContain('bottom-0');
};

describe('components/PlaylistManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  });

  it('abre modal de alta y permite guardar item', async () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    await openAddModal(wrapper);
    const closeButton = wrapper.get('[data-testid="close-add-item-modal-header"]');
    expect(closeButton.attributes('aria-label')).toBe('Cerrar dialogo de alta');

    await wrapper.get('input[placeholder="Promo apertura"]').setValue('Intro');
    await wrapper.get('input[placeholder="https://... o data:image/..."]').setValue('https://cdn/intro.png');
    await wrapper.get('[data-testid="save-add-item-modal"]').trigger('click');

    const emissions = wrapper.emitted('update:items');
    expect(emissions).toBeTruthy();

    const payload = emissions?.at(-1)?.[0] as MultimediaItem[];
    expect(payload).toHaveLength(1);
    expect(payload[0]?.name).toBe('Intro');
    expect(payload[0]?.kind).toBe('image');
    expect(wrapper.find('[data-testid="add-item-modal"]').exists()).toBe(false);
  });

  it('permite cancelar modal de alta sin emitir cambios', async () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    await openAddModal(wrapper);
    await wrapper.get('input[placeholder="Promo apertura"]').setValue('No guardar');
    await wrapper.get('[data-testid="cancel-add-item-modal"]').trigger('click');

    expect(wrapper.find('[data-testid="add-item-modal"]').exists()).toBe(false);
    expect(wrapper.emitted('update:items')).toBeUndefined();
  });

  it('cierra modal de alta con boton de cerrar en header', async () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    await openAddModal(wrapper);
    await wrapper.get('[data-testid="close-add-item-modal-header"]').trigger('click');

    expect(wrapper.find('[data-testid="add-item-modal"]').exists()).toBe(false);
  });

  it('reordena items por drag and drop y muestra feedback', async () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [createImage('a', 'A'), createImage('b', 'B'), createImage('c', 'C')],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    const dataTransfer = createMockDataTransfer();

    await wrapper.get('[data-testid="playlist-item-a"]').trigger('dragstart', { dataTransfer });
    await wrapper.get('[data-testid="playlist-item-c"]').trigger('dragover', { dataTransfer });
    await wrapper.get('[data-testid="playlist-item-c"]').trigger('drop', { dataTransfer });

    const payload = wrapper.emitted('update:items')?.at(-1)?.[0] as MultimediaItem[];
    expect(payload.map((item) => item.id)).toEqual(['b', 'c', 'a']);
    expect(wrapper.get('[data-testid="playlist-reorder-feedback"]').text()).toContain('posicion 3');
  });

  it('mantiene fallback subir/bajar tras habilitar drag and drop', async () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [createImage('a', 'A'), createImage('b', 'B')],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    const bajarButton = wrapper
      .get('[data-testid="playlist-item-actions-a"]')
      .findAll('button')
      .find((button) => button.text() === 'Bajar');

    if (!bajarButton) {
      throw new Error('No se encontro boton Bajar para fallback.');
    }

    await bajarButton.trigger('click');

    const payload = wrapper.emitted('update:items')?.at(-1)?.[0] as MultimediaItem[];
    expect(payload.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('mantiene overlay fijo y bloquea/restaura scroll del body en alta', async () => {
    const initialOverflow = document.body.style.overflow;
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    await openAddModal(wrapper);
    expectModalViewportLayout(wrapper, {
      overlay: 'add-item-modal-overlay',
      modal: 'add-item-modal',
      modalVariant: 'app-modal-panel--md',
      header: 'add-item-modal-header',
      body: 'add-item-modal-body',
      footer: 'add-item-modal-footer'
    });
    expect(document.body.style.overflow).toBe('hidden');

    await wrapper.get('[data-testid="cancel-add-item-modal"]').trigger('click');

    expect(document.body.style.overflow).toBe(initialOverflow);
  });

  it('soporta edicion en modal, cancelacion, reordenado y eliminado', async () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [createImage('a', 'A'), createImage('b', 'B')],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    await wrapper.get('[data-testid="open-edit-item-modal-a"]').trigger('click');
    expect(wrapper.find('[data-testid="edit-item-modal"]').exists()).toBe(true);
    const editDialog = wrapper.get('[data-testid="edit-item-modal"]');
    expect(editDialog.attributes('role')).toBe('dialog');
    expect(editDialog.attributes('aria-modal')).toBe('true');

    let sourceInput: ReturnType<typeof wrapper.find> | null = null;
    for (const node of wrapper.findAll('[data-testid="edit-item-modal"] input')) {
      const element = node.element as HTMLInputElement;
      if (element.type === 'text' && element.value.startsWith('data:image/png;base64,')) {
        sourceInput = node;
        break;
      }
    }

    if (!sourceInput) {
      throw new Error('No se encontro input de source en modal de edicion.');
    }

    await sourceInput.setValue('https://cdn/new.png');
    await wrapper.get('[data-testid="cancel-edit-item-modal"]').trigger('click');

    const cancelPayload = wrapper.emitted('update:items')?.at(-1)?.[0] as MultimediaItem[];
    expect(cancelPayload[0]?.source).toContain('data:image/png;base64,a');

    await wrapper.get('[data-testid="open-edit-item-modal-a"]').trigger('click');
    sourceInput = null;
    for (const node of wrapper.findAll('[data-testid="edit-item-modal"] input')) {
      const element = node.element as HTMLInputElement;
      if (element.type === 'text' && element.value.startsWith('data:image/png;base64,')) {
        sourceInput = node;
        break;
      }
    }
    if (!sourceInput) {
      throw new Error('No se encontro input de source para guardar edicion.');
    }
    await sourceInput.setValue('https://cdn/final.png');
    await wrapper.get('[data-testid="save-edit-item-modal"]').trigger('click');

    let subirButton: ReturnType<typeof wrapper.find> | null = null;
    for (const node of wrapper.findAll('button')) {
      if (node.text() === 'Bajar') {
        subirButton = node;
        break;
      }
    }
    if (!subirButton) {
      throw new Error('No se encontro boton Bajar.');
    }
    await subirButton.trigger('click');

    let deleteButton: ReturnType<typeof wrapper.find> | null = null;
    for (const node of wrapper.findAll('button')) {
      if (node.text() === 'Eliminar') {
        deleteButton = node;
        break;
      }
    }
    if (!deleteButton) {
      throw new Error('No se encontro boton Eliminar.');
    }
    await deleteButton.trigger('click');

    const emissions = wrapper.emitted('update:items') ?? [];
    expect(emissions.length).toBeGreaterThanOrEqual(5);

    const payloads = emissions.map((entry) => entry[0] as MultimediaItem[]);
    expect(payloads.some((entry) => entry[0]?.source === 'https://cdn/final.png')).toBe(true);

    const reordered = payloads.find((entry) => entry.length === 2 && entry[0]?.id === 'b');
    if (!reordered) {
      throw new Error('No se encontro emision de reordenado esperada.');
    }
    expect(reordered[0]?.id).toBe('b');

    const removed = emissions.at(-1)?.[0] as MultimediaItem[];
    expect(removed).toHaveLength(1);
  });

  it('mantiene overlay fijo y bloquea/restaura scroll del body en edicion', async () => {
    const initialOverflow = document.body.style.overflow;
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [createImage('a', 'A')],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    await wrapper.get('[data-testid="open-edit-item-modal-a"]').trigger('click');
    expectModalViewportLayout(wrapper, {
      overlay: 'edit-item-modal-overlay',
      modal: 'edit-item-modal',
      modalVariant: 'app-modal-panel--md',
      header: 'edit-item-modal-header',
      body: 'edit-item-modal-body',
      footer: 'edit-item-modal-footer'
    });
    expect(document.body.style.overflow).toBe('hidden');

    await wrapper.get('[data-testid="cancel-edit-item-modal"]').trigger('click');

    expect(document.body.style.overflow).toBe(initialOverflow);
  });

  it('teleporta overlays de preview, alta y edicion al body para anclar viewport real', async () => {
    const wrapper = mount(PlaylistManager, {
      attachTo: document.body,
      global: {
        stubs: {
          teleport: false
        }
      },
      props: {
        items: [createImage('a', 'A')],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    await wrapper.get('[data-testid="item-thumbnail-a"]').trigger('click');
    const previewOverlay = document.body.querySelector('[data-testid="preview-item-modal-overlay"]');
    const previewModal = document.body.querySelector('[data-testid="preview-item-modal"]');
    expect(previewOverlay).not.toBeNull();
    expect(previewOverlay?.parentElement).toBe(document.body);
    expect(previewModal).not.toBeNull();
    expect(document.querySelector('.glass-panel [data-testid="preview-item-modal-overlay"]')).toBeNull();

    const closePreviewButton = document.body.querySelector('[data-testid="close-preview-item-modal-header"]');
    if (!(closePreviewButton instanceof HTMLButtonElement)) {
      throw new Error('No se encontro boton de cierre de preview en contenido teletransportado.');
    }
    closePreviewButton.click();
    await flushPromises();
    await wrapper.get('[data-testid="open-add-item-modal"]').trigger('click');

    const addOverlay = document.body.querySelector('[data-testid="add-item-modal-overlay"]');
    const addModal = document.body.querySelector('[data-testid="add-item-modal"]');
    expect(addOverlay).not.toBeNull();
    expect(addOverlay?.parentElement).toBe(document.body);
    expect(addModal).not.toBeNull();
    expect(document.querySelector('.glass-panel [data-testid="add-item-modal-overlay"]')).toBeNull();

    const cancelAddButton = document.body.querySelector('[data-testid="cancel-add-item-modal"]');
    if (!(cancelAddButton instanceof HTMLButtonElement)) {
      throw new Error('No se encontro boton cancelar en modal de alta teletransportado.');
    }
    cancelAddButton.click();
    await flushPromises();
    await wrapper.get('[data-testid="open-edit-item-modal-a"]').trigger('click');

    const editOverlay = document.body.querySelector('[data-testid="edit-item-modal-overlay"]');
    const editModal = document.body.querySelector('[data-testid="edit-item-modal"]');
    expect(editOverlay).not.toBeNull();
    expect(editOverlay?.parentElement).toBe(document.body);
    expect(editModal).not.toBeNull();
    expect(document.querySelector('.glass-panel [data-testid="edit-item-modal-overlay"]')).toBeNull();
  });

  it('mantiene overlay fijo/centrado aun con scroll del contenedor padre', async () => {
    const wrapper = mount(PlaylistManager, {
      attachTo: document.body,
      global: {
        stubs: {
          teleport: false
        }
      },
      props: {
        items: [createImage('a', 'A')],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    const playlistPanel = document.querySelector('[data-testid="panel-playlist"]');
    if (playlistPanel instanceof HTMLElement) {
      playlistPanel.style.maxHeight = '180px';
      playlistPanel.style.overflow = 'auto';
      playlistPanel.scrollTop = 120;
    }

    await wrapper.get('[data-testid="open-add-item-modal"]').trigger('click');

    const overlay = document.body.querySelector('[data-testid="add-item-modal-overlay"]');
    const modal = document.body.querySelector('[data-testid="add-item-modal"]');

    if (!(overlay instanceof HTMLElement) || !(modal instanceof HTMLElement)) {
      throw new Error('No se encontraron overlay y modal teletransportados para validar viewport.');
    }

    expect(overlay.classList.contains('fixed')).toBe(true);
    expect(overlay.classList.contains('inset-0')).toBe(true);
    expect(overlay.classList.contains('items-center')).toBe(true);
    expect(overlay.classList.contains('justify-center')).toBe(true);

    expect(modal.classList.contains('app-modal-panel')).toBe(true);
    expect(modal.classList.contains('app-modal-panel--md')).toBe(true);
  });

  it('trunca visualmente source largo y mantiene title con valor completo', async () => {
    const longSource = createLongSource();
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [
          {
            id: 'long',
            kind: 'image',
            name: 'Largo',
            source: longSource,
            durationMs: 5000
          }
        ],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    const sourcePreview = wrapper.get('[data-testid="item-source-preview-long"]');

    expect(sourcePreview.attributes('title')).toBe(longSource);
    expect(sourcePreview.text().length).toBeLessThan(longSource.length);
    expect(sourcePreview.text()).toContain('...');
    expect(sourcePreview.text()).not.toBe(longSource);
  });

  it('renderiza thumbnail de imagen usando source del item', () => {
    const item = createImage('img-thumb', 'Imagen con preview');
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [item],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    const thumbnail = wrapper.get('[data-testid="item-thumbnail-image-img-thumb"]');
    expect(thumbnail.attributes('src')).toBe(item.source);
  });

  it('abre modal de preview ampliada al hacer click en thumbnail', async () => {
    const item = createImage('img-preview', 'Imagen ampliada');
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [item],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    await wrapper.get('[data-testid="item-thumbnail-img-preview"]').trigger('click');

    const modal = wrapper.get('[data-testid="preview-item-modal"]');
    expect(modal.attributes('role')).toBe('dialog');
    expect(modal.attributes('aria-modal')).toBe('true');
    expectModalViewportLayout(wrapper, {
      overlay: 'preview-item-modal-overlay',
      modal: 'preview-item-modal',
      modalVariant: 'app-modal-panel--lg',
      header: 'preview-item-modal-header',
      body: 'preview-item-modal-body'
    });
    expect(wrapper.find('[data-testid="preview-item-modal-footer"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="close-preview-item-modal-header"]').attributes('aria-label')).toBe('Cerrar preview');
    expect(modal.text()).toContain('Imagen ampliada');
    expect(modal.text()).toContain('Tipo: Imagen');
    expect(wrapper.get('[data-testid="preview-item-modal-image"]').attributes('src')).toBe(item.source);
  });

  it('permite cerrar modal de preview por boton, Escape y click fuera', async () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [createImage('img-close', 'Imagen cierre')],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    await wrapper.get('[data-testid="item-thumbnail-img-close"]').trigger('click');
    await wrapper.get('[data-testid="close-preview-item-modal-header"]').trigger('click');
    expect(wrapper.find('[data-testid="preview-item-modal"]').exists()).toBe(false);

    await wrapper.get('[data-testid="item-thumbnail-img-close"]').trigger('click');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(wrapper.find('[data-testid="preview-item-modal"]').exists()).toBe(false);

    await wrapper.get('[data-testid="item-thumbnail-img-close"]').trigger('click');
    await wrapper.get('[data-testid="preview-item-modal-overlay"]').trigger('click');
    expect(wrapper.find('[data-testid="preview-item-modal"]').exists()).toBe(false);
  });

  it('genera thumbnail de video de forma asincrona cuando la captura es exitosa', async () => {
    const captureSpy = vi
      .spyOn(videoThumbnailService, 'captureVideoThumbnail')
      .mockResolvedValueOnce('data:image/jpeg;base64,VIDEO_THUMB_OK');

    const wrapper = mount(PlaylistManager, {
      props: {
        items: [createVideo('vid-thumb', 'Video con preview')],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    expect(wrapper.get('[data-testid="item-thumbnail-loading-vid-thumb"]').text()).toContain('Generando preview');

    await flushPromises();

    expect(captureSpy).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-testid="item-thumbnail-video-vid-thumb"]').attributes('src')).toContain(
      'VIDEO_THUMB_OK'
    );
  });

  it('muestra fallback cuando falla captura de thumbnail de video (cors/timeout/error)', async () => {
    vi.spyOn(videoThumbnailService, 'captureVideoThumbnail').mockRejectedValueOnce(
      new Error('video-thumbnail:canvas-tainted')
    );

    const wrapper = mount(PlaylistManager, {
      props: {
        items: [createVideo('vid-fallback', 'Video con fallback')],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    await flushPromises();

    const fallback = wrapper.get('[data-testid="item-thumbnail-fallback-vid-fallback"]');
    expect(fallback.text()).toContain('Preview no disponible');
  });

  it('muestra fallback claro en modal cuando no hay thumbnail disponible', async () => {
    vi.spyOn(videoThumbnailService, 'captureVideoThumbnail').mockRejectedValueOnce(
      new Error('video-thumbnail:network-failure')
    );

    const wrapper = mount(PlaylistManager, {
      props: {
        items: [createVideo('vid-modal-fallback', 'Video sin preview')],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    await flushPromises();
    await wrapper.get('[data-testid="item-thumbnail-vid-modal-fallback"]').trigger('click');

    const fallback = wrapper.get('[data-testid="preview-item-modal-fallback"]');
    expect(fallback.text()).toContain('No hay thumbnail disponible para este item');
    expect(fallback.text()).toContain('Preview no disponible');
    expect(wrapper.get('[data-testid="preview-item-modal"]').text()).toContain('Tipo: Video');
  });

  it('mantiene acciones de editar/eliminar/reordenar operativas mientras se procesa thumbnail', async () => {
    const neverEndingThumbnail = new Promise<string>(() => {});
    vi.spyOn(videoThumbnailService, 'captureVideoThumbnail').mockReturnValue(neverEndingThumbnail);

    const wrapper = mount(PlaylistManager, {
      props: {
        items: [createVideo('video-a', 'Video A'), createImage('image-b', 'Imagen B')],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    const dataTransfer = createMockDataTransfer();
    await wrapper.get('[data-testid="playlist-item-video-a"]').trigger('dragstart', { dataTransfer });
    await wrapper.get('[data-testid="playlist-item-image-b"]').trigger('drop', { dataTransfer });

    await wrapper.get('[data-testid="open-edit-item-modal-video-a"]').trigger('click');
    expect(wrapper.find('[data-testid="edit-item-modal"]').exists()).toBe(true);
    await wrapper.get('[data-testid="cancel-edit-item-modal"]').trigger('click');

    const actions = wrapper.get('[data-testid="playlist-item-actions-video-a"]').findAll('button');
    const deleteButton = actions.find((button) => button.text() === 'Eliminar');
    if (!deleteButton) {
      throw new Error('No se encontro boton Eliminar para validar acciones con thumbnail en carga.');
    }
    await deleteButton.trigger('click');

    const emissions = wrapper.emitted('update:items') ?? [];
    expect(emissions.length).toBeGreaterThanOrEqual(2);
    const reordered = emissions[0]?.[0] as MultimediaItem[];
    const removed = emissions.at(-1)?.[0] as MultimediaItem[];

    expect(reordered.map((item) => item.id)).toContain('video-a');
    expect(removed.some((item) => item.id === 'video-a')).toBe(false);
  });

  it('mantiene acciones del item en linea con contenedor inline sin wrap', async () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [createImage('line', 'Linea')],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    const actions = wrapper.get('[data-testid="playlist-item-actions-line"]');
    const actionTexts = actions.findAll('button').map((button) => button.text());

    expect(actions.classes()).toContain('flex');
    expect(actions.classes()).toContain('flex-nowrap');
    expect(actions.classes()).toContain('overflow-x-auto');
    expect(actions.classes()).not.toContain('flex-wrap');
    expect(actionTexts).toEqual(['Subir', 'Bajar', 'Editar', 'Eliminar']);
  });

  it('convierte archivo de imagen local a data URI', async () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    await openAddModal(wrapper);
    await wrapper.get('input[placeholder="Promo apertura"]').setValue('Con archivo');

    const fileInput = wrapper.get('[data-testid="add-item-modal"] input[type="file"]');
    const file = new File(['binary'], 'slide.png', { type: 'image/png' });

    Object.defineProperty(fileInput.element, 'files', {
      value: createFileList(file),
      configurable: true
    });

    await fileInput.trigger('change');
    await flushPromises();

    await wrapper.get('[data-testid="save-add-item-modal"]').trigger('click');

    const payload = wrapper.emitted('update:items')?.at(-1)?.[0] as MultimediaItem[];
    expect(payload[0]?.source.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('permite seleccion multi-destino y evita emisiones redundantes', async () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [],
        monitors: [createMonitor('m1', 'Monitor 1'), createMonitor('m2', 'Monitor 2')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState({ targetMonitorIds: [] }),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    const targetM1 = wrapper.get('[data-testid="playlist-target-monitor-m1"]');
    (targetM1.element as HTMLInputElement).checked = true;
    await targetM1.trigger('change');

    const emissions = wrapper.emitted('update:playbackState') ?? [];
    expect(emissions).toHaveLength(1);
    expect((emissions[0]?.[0] as PlaylistPlaybackState).targetMonitorIds).toEqual(['m1']);

    await wrapper.setProps({ playbackState: createPlaybackState({ targetMonitorIds: ['m1'] }) });
    (targetM1.element as HTMLInputElement).checked = true;
    await targetM1.trigger('change');

    expect(wrapper.emitted('update:playbackState')).toHaveLength(1);

    const targetM2 = wrapper.get('[data-testid="playlist-target-monitor-m2"]');
    (targetM2.element as HTMLInputElement).checked = true;
    await targetM2.trigger('change');

    const latestPlayback = wrapper.emitted('update:playbackState')?.at(-1)?.[0] as PlaylistPlaybackState;
    expect(latestPlayback.targetMonitorIds).toEqual(['m1', 'm2']);
    expect(wrapper.get('[data-testid="playlist-target-summary"]').text()).toContain('1 destino(s)');
  });

  it('muestra feedback operativo de destinos activos y advertencias', () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [],
        monitors: [createMonitor('m1', 'Monitor 1'), createMonitor('m2', 'Monitor 2')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState({ targetMonitorIds: ['m1', 'm2'] }),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    expect(wrapper.get('[data-testid="playlist-target-status"]').text()).toContain('Destinos activos: 1/2');
    expect(wrapper.get('[data-testid="playlist-target-warning"]').text()).toContain('Monitor 2');
  });

  it('usa textos limpios en botones que abren modales', async () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [createImage('a', 'A')],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    expect(wrapper.get('[data-testid="open-add-item-modal"]').text()).toBe('Agregar item');
    expect(wrapper.get('[data-testid="open-edit-item-modal-a"]').text()).toBe('Editar');
    expect(wrapper.text().toLowerCase()).not.toContain('editar en modal');
  });

  it('muestra estrategia de sincronizacion host + clientes cuando recibe plan', () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [createImage('a', 'A')],
        monitors: [createMonitor('m1', 'Monitor 1'), createMonitor('m2', 'Monitor 2')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState({ targetMonitorIds: ['m1'] }),
        videoSyncPlan: createVideoSyncPlan(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    const strategy = wrapper.get('[data-testid="video-sync-strategy"]');
    expect(strategy.text()).toContain('Sync host + clientes');
    expect(strategy.text()).toContain('Host: Monitor 1');
    expect(strategy.text()).toContain('Clientes: 1');
  });

  it('muestra iconos decorativos en botones clave sin perder etiquetas', () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [createImage('a', 'A')],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    const startButton = wrapper.get('button[class*="border-emerald-300"]').get('svg[aria-hidden="true"]');
    const addItemButton = wrapper.get('[data-testid="open-add-item-modal"]');
    const editButton = wrapper.get('[data-testid="open-edit-item-modal-a"]');

    expect(startButton.attributes('aria-hidden')).toBe('true');
    expect(addItemButton.get('svg[aria-hidden="true"]').attributes('aria-hidden')).toBe('true');
    expect(editButton.get('svg[aria-hidden="true"]').attributes('aria-hidden')).toBe('true');
    expect(addItemButton.text()).toBe('Agregar item');
    expect(editButton.text()).toBe('Editar');
  });

  it('integra AppCheckbox en playlist para toggle de autoplay y mute en alta de video', async () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    const autoplayCheckbox = wrapper.get('[data-testid="autoplay-checkbox"]');
    (autoplayCheckbox.element as HTMLInputElement).checked = true;
    await autoplayCheckbox.trigger('change');

    const playbackEmissions = wrapper.emitted('update:playbackState');
    expect(playbackEmissions).toBeTruthy();
    expect((playbackEmissions?.at(-1)?.[0] as PlaylistPlaybackState).autoplay).toBe(true);

    await openAddModal(wrapper);
    await wrapper.get('[data-testid="add-item-modal"] select').setValue('video');
    expect(getLayoutGroupOrder(wrapper, 'add-item-modal')).toEqual(['primary', 'source', 'timing', 'mute']);
    expect(wrapper.get('[data-testid="new-video-muted-help"]').text()).toBe(
      'Evita picos de audio al cargar el video en pantalla.'
    );

    const sourceRow = wrapper
      .get('[data-testid="add-item-modal"]')
      .find('[data-layout-group="source"]');
    expect(sourceRow.find('input[type="text"]').exists()).toBe(true);
    expect(sourceRow.find('input[type="file"]').exists()).toBe(true);

    const timingRow = wrapper
      .get('[data-testid="add-item-modal"]')
      .find('[data-layout-group="timing"]');
    expect(timingRow.text()).toContain('Duracion (ms)');
    expect(timingRow.text()).toContain('Inicio (ms)');
    expect(timingRow.text()).toContain('Fin (ms, opcional)');

    await wrapper.get('input[placeholder="Promo apertura"]').setValue('Video sin mute');
    await wrapper.get('input[placeholder="https://... o data:image/..."]').setValue('https://cdn/video.mp4');

    const mutedCheckbox = wrapper.get('[data-testid="new-video-muted-checkbox"]');
    (mutedCheckbox.element as HTMLInputElement).checked = false;
    await mutedCheckbox.trigger('change');

    await wrapper.get('[data-testid="save-add-item-modal"]').trigger('click');

    const itemsPayload = wrapper.emitted('update:items')?.at(-1)?.[0] as MultimediaItem[];
    const createdVideo = itemsPayload.at(-1);

    expect(createdVideo?.kind).toBe('video');
    if (!createdVideo || createdVideo.kind !== 'video') {
      throw new Error('No se emitio item de video para validar mute.');
    }
    expect(createdVideo.muted).toBe(false);
  });

  it('mantiene orden de grupos y ayuda de mute en modal de edicion para video', async () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [createVideo('vid-1', 'Video 1')],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    await wrapper.get('[data-testid="open-edit-item-modal-vid-1"]').trigger('click');

    expect(getLayoutGroupOrder(wrapper, 'edit-item-modal')).toEqual(['primary', 'source', 'timing', 'mute']);
    expect(wrapper.get('[data-testid="edit-video-muted-help"]').text()).toBe(
      'Silencia el audio durante el inicio para evitar sobresaltos.'
    );

    const sourceRow = wrapper
      .get('[data-testid="edit-item-modal"]')
      .find('[data-layout-group="source"]');
    expect(sourceRow.find('input[type="text"]').exists()).toBe(true);
    expect(sourceRow.find('input[type="file"]').exists()).toBe(true);

    const timingRow = wrapper
      .get('[data-testid="edit-item-modal"]')
      .find('[data-layout-group="timing"]');
    expect(timingRow.text()).toContain('Duracion (ms)');
    expect(timingRow.text()).toContain('Inicio (ms)');
    expect(timingRow.text()).toContain('Fin (ms, opcional)');
  });

  it('incluye boton de cerrar en header de edicion y mantiene guardar/cancelar operativos', async () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [createImage('edit-header', 'Edit Header')],
        monitors: [createMonitor('m1', 'Monitor 1')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState(),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    await wrapper.get('[data-testid="open-edit-item-modal-edit-header"]').trigger('click');
    const closeButton = wrapper.get('[data-testid="close-edit-item-modal-header"]');
    expect(closeButton.attributes('aria-label')).toBe('Cerrar dialogo de edicion');

    await closeButton.trigger('click');
    expect(wrapper.find('[data-testid="edit-item-modal"]').exists()).toBe(false);

    await wrapper.get('[data-testid="open-edit-item-modal-edit-header"]').trigger('click');
    await wrapper.get('[data-testid="cancel-edit-item-modal"]').trigger('click');
    expect(wrapper.find('[data-testid="edit-item-modal"]').exists()).toBe(false);

    await wrapper.get('[data-testid="open-edit-item-modal-edit-header"]').trigger('click');
    const sourceInput = wrapper
      .get('[data-testid="edit-item-modal"]')
      .findAll('input')
      .find((node) => (node.element as HTMLInputElement).type === 'text' && node.element instanceof HTMLInputElement);

    if (!sourceInput) {
      throw new Error('No se encontro input de source para validar guardado en edicion.');
    }

    await sourceInput.setValue('https://cdn/edit-header.png');
    await wrapper.get('[data-testid="save-edit-item-modal"]').trigger('click');

    const emissions = wrapper.emitted('update:items') ?? [];
    expect(emissions.length).toBeGreaterThan(0);
  });
});
