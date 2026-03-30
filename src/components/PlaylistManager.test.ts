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

const clickButtonByText = async (wrapper: ReturnType<typeof mount>, text: string) => {
  for (const button of wrapper.findAll('button')) {
    if (button.text() === text) {
      await button.trigger('click');
      return;
    }
  }

  throw new Error(`No se encontro boton: ${text}`);
};

describe('components/PlaylistManager', () => {
  it('permite alta de item y emite la playlist actualizada', async () => {
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

    await wrapper.get('input[placeholder="Promo apertura"]').setValue('Intro');
    await wrapper.get('input[placeholder="https://... o data:image/..."]').setValue('https://cdn/intro.png');
    await clickButtonByText(wrapper, 'Agregar a playlist');

    const emissions = wrapper.emitted('update:items');
    expect(emissions).toBeTruthy();

    const payload = emissions?.at(-1)?.[0] as MultimediaItem[];
    expect(payload).toHaveLength(1);
    expect(payload[0]?.name).toBe('Intro');
    expect(payload[0]?.kind).toBe('image');
  });

  it('soporta edicion, reordenado y eliminado', async () => {
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

    let firstSourceInput: ReturnType<typeof wrapper.find> | null = null;
    for (const node of wrapper.findAll('input')) {
      const element = node.element as HTMLInputElement;
      if (
        node.attributes('placeholder') === undefined
        && node.attributes('type') === 'text'
        && element.value.startsWith('data:image/png;base64,')
      ) {
        firstSourceInput = node;
        break;
      }
    }
    if (!firstSourceInput) {
      throw new Error('No se encontro input de source para editar item.');
    }
    await firstSourceInput.setValue('https://cdn/new.png');

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
    expect(emissions.length).toBeGreaterThanOrEqual(3);
    const reordered = emissions[1]?.[0] as MultimediaItem[];
    expect(reordered[0]?.id).toBe('b');

    const removed = emissions.at(-1)?.[0] as MultimediaItem[];
    expect(removed).toHaveLength(1);
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

    await wrapper.get('input[placeholder="Promo apertura"]').setValue('Con archivo');

    const fileInput = wrapper.get('input[type="file"]');
    const file = new File(['binary'], 'slide.png', { type: 'image/png' });

    Object.defineProperty(fileInput.element, 'files', {
      value: createFileList(file),
      configurable: true
    });

    await fileInput.trigger('change');
    await flushPromises();

    await clickButtonByText(wrapper, 'Agregar a playlist');

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
});
