import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PlaylistManager from './PlaylistManager.vue';
import type { MonitorDescriptor, MonitorStateMap } from '../types/broadcaster';
import type { MultimediaItem, PlaylistPlaybackState } from '../types/playlist';

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
  targetMonitorId: null,
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

describe('components/PlaylistManager', () => {
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
    const overlay = wrapper.get('[data-testid="add-item-modal-overlay"]');

    expect(overlay.classes()).toContain('fixed');
    expect(overlay.classes()).toContain('inset-0');
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
    const overlay = wrapper.get('[data-testid="edit-item-modal-overlay"]');

    expect(overlay.classes()).toContain('fixed');
    expect(overlay.classes()).toContain('inset-0');
    expect(document.body.style.overflow).toBe('hidden');

    await wrapper.get('[data-testid="cancel-edit-item-modal"]').trigger('click');

    expect(document.body.style.overflow).toBe(initialOverflow);
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

  it('emite target monitor correcto y evita emisiones redundantes', async () => {
    const wrapper = mount(PlaylistManager, {
      props: {
        items: [],
        monitors: [createMonitor('m1', 'Monitor 1'), createMonitor('m2', 'Monitor 2')],
        monitorStates: createMonitorStates(),
        playbackState: createPlaybackState({ targetMonitorId: null }),
        playbackFeedback: '',
        isPlaying: false
      }
    });

    const select = wrapper.get('select');
    await select.setValue('m1');

    const emissions = wrapper.emitted('update:playbackState') ?? [];
    expect(emissions).toHaveLength(1);
    expect((emissions[0]?.[0] as PlaylistPlaybackState).targetMonitorId).toBe('m1');

    await wrapper.setProps({ playbackState: createPlaybackState({ targetMonitorId: 'm1' }) });
    await select.setValue('m1');

    expect(wrapper.emitted('update:playbackState')).toHaveLength(1);
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
});
