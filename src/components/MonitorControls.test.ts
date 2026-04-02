import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import MonitorControls from './MonitorControls.vue';
import AppFileDropzone from './ui/AppFileDropzone.vue';
import { createDefaultMonitorState } from '../types/broadcaster';

const createDataTransfer = (file: File): DataTransfer =>
  ({
    items: {
      length: 1,
      [0]: {
        kind: 'file',
        getAsFile: () => file
      }
    },
    files: {
      length: 1,
      item: (index: number) => (index === 0 ? file : null)
    }
  }) as unknown as DataTransfer;

describe('MonitorControls', () => {
  it('abre y cierra modal de edicion de contenido con controles de mover/rotar', async () => {
    const wrapper = mount(MonitorControls, {
      props: {
        monitorId: 'monitor-1',
        state: createDefaultMonitorState(),
        isFileImportBlocked: false,
        fileImportBlockedMessage: 'bloqueado'
      }
    });

    expect(wrapper.find('[data-testid="monitor-content-editor-modal"]').exists()).toBe(false);

    await wrapper.get('[data-testid="monitor-open-content-editor"]').trigger('click');

    expect(wrapper.get('[data-testid="monitor-content-editor-modal"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="monitor-content-rotate-left"]').text()).toContain('Rotar -90');
    expect(wrapper.get('[data-testid="monitor-content-move-up"]').text()).toContain('Arriba');

    await wrapper.get('[data-testid="monitor-content-editor-close"]').trigger('click');
    expect(wrapper.find('[data-testid="monitor-content-editor-modal"]').exists()).toBe(false);

    await wrapper.get('[data-testid="monitor-open-content-editor"]').trigger('click');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="monitor-content-editor-modal"]').exists()).toBe(false);
  });

  it('muestra acciones compactas icon-only con tooltip', async () => {
    const wrapper = mount(MonitorControls, {
      props: {
        monitorId: 'monitor-1',
        state: createDefaultMonitorState(),
        isFileImportBlocked: false,
        fileImportBlockedMessage: 'bloqueado'
      }
    });

    const toolbar = wrapper.get('[data-testid="monitor-action-toolbar"]');
    expect(toolbar.classes()).toContain('monitor-action-toolbar');

    const editButton = wrapper.get('[data-testid="monitor-open-content-editor"]');
    expect(editButton.text().trim()).toBe('');
    expect(editButton.attributes('title')).toBe('Editar contenido');
    expect(editButton.attributes('aria-label')).toBe('Editar contenido');

    const fullscreenButton = wrapper.get('[data-testid="monitor-request-fullscreen"]');
    expect(fullscreenButton.text().trim()).toBe('');
    expect(fullscreenButton.attributes('title')).toBe('Solicitar fullscreen');
    expect(fullscreenButton.attributes('aria-label')).toBe('Solicitar fullscreen');

    const closeButton = wrapper.get('[data-testid="monitor-close-window"]');
    expect(closeButton.text().trim()).toBe('');
    expect(closeButton.attributes('title')).toBe('Cerrar ventana');
    expect(closeButton.attributes('aria-label')).toBe('Cerrar ventana');

    await closeButton.trigger('click');

    expect(wrapper.emitted('closeWindow')).toEqual([['monitor-1']]);
  });

  it('no emite uploadImage al hacer click en el input sin change', async () => {
    const wrapper = mount(MonitorControls, {
      props: {
        monitorId: 'monitor-1',
        state: createDefaultMonitorState(),
        isFileImportBlocked: false,
        fileImportBlockedMessage: 'bloqueado'
      }
    });

    await wrapper.get('[data-testid="monitor-image-select-button"]').trigger('click');

    expect(wrapper.emitted('uploadImage')).toBeUndefined();
  });

  it('emite uploadImage solo cuando change incluye un archivo', async () => {
    const wrapper = mount(MonitorControls, {
      props: {
        monitorId: 'monitor-1',
        state: createDefaultMonitorState(),
        isFileImportBlocked: false,
        fileImportBlockedMessage: 'bloqueado'
      }
    });

    const input = wrapper.get('[data-testid="app-file-dropzone-hidden-input"]').element as HTMLInputElement;
    const imageFile = new File(['image-binary'], 'cover.png', { type: 'image/png' });

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [imageFile]
    });

    await wrapper.get('[data-testid="app-file-dropzone-hidden-input"]').trigger('change');

    expect(wrapper.emitted('uploadImage')).toEqual([['monitor-1', imageFile, 'file-picker']]);
  });

  it('bloquea selector nativo cuando hay fullscreen activo', async () => {
    const wrapper = mount(MonitorControls, {
      props: {
        monitorId: 'monitor-1',
        state: createDefaultMonitorState(),
        isFileImportBlocked: true,
        fileImportBlockedMessage: 'Para importar archivo, sal del fullscreen o usa Drag & Drop / pegar imagen.'
      }
    });

    const button = wrapper.get('[data-testid="monitor-image-select-button"]');
    expect(button.attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="monitor-file-import-blocked-feedback"]').text()).toContain('sal del fullscreen');
  });

  it('acepta drag and drop aunque fullscreen bloquee selector nativo', async () => {
    const wrapper = mount(MonitorControls, {
      props: {
        monitorId: 'monitor-1',
        state: createDefaultMonitorState(),
        isFileImportBlocked: true,
        fileImportBlockedMessage: 'Para importar archivo, sal del fullscreen o usa Drag & Drop / pegar imagen.'
      }
    });

    const imageFile = new File(['img'], 'dropped-fullscreen.png', { type: 'image/png' });
    await wrapper.get('[data-testid="monitor-image-drop-zone"]').trigger('drop', {
      dataTransfer: createDataTransfer(imageFile)
    });

    expect(wrapper.emitted('uploadImage')).toEqual([['monitor-1', imageFile, 'drag-drop']]);
  });

  it('acepta pegado desde portapapeles aunque fullscreen bloquee selector nativo', async () => {
    const wrapper = mount(MonitorControls, {
      props: {
        monitorId: 'monitor-1',
        state: createDefaultMonitorState(),
        isFileImportBlocked: true,
        fileImportBlockedMessage: 'Para importar archivo, sal del fullscreen o usa Drag & Drop / pegar imagen.'
      }
    });

    const imageFile = new File(['img'], 'pasted-fullscreen.png', { type: 'image/png' });
    await wrapper.get('[data-testid="monitor-image-drop-zone"]').trigger('paste', {
      clipboardData: createDataTransfer(imageFile)
    });

    expect(wrapper.emitted('uploadImage')).toEqual([['monitor-1', imageFile, 'paste']]);
  });

  it('soporta import por drag and drop', async () => {
    const wrapper = mount(MonitorControls, {
      props: {
        monitorId: 'monitor-1',
        state: createDefaultMonitorState(),
        isFileImportBlocked: false,
        fileImportBlockedMessage: 'bloqueado'
      }
    });

    const imageFile = new File(['img'], 'dropped.png', { type: 'image/png' });
    const dataTransfer = createDataTransfer(imageFile);

    await wrapper.get('[data-testid="monitor-image-drop-zone"]').trigger('drop', { dataTransfer });

    expect(wrapper.emitted('uploadImage')).toEqual([['monitor-1', imageFile, 'drag-drop']]);
  });

  it('emite clearImage al quitar archivo seleccionado en dropzone', async () => {
    const wrapper = mount(MonitorControls, {
      props: {
        monitorId: 'monitor-1',
        state: createDefaultMonitorState(),
        isFileImportBlocked: false,
        fileImportBlockedMessage: 'bloqueado'
      }
    });

    wrapper.getComponent(AppFileDropzone).vm.$emit('cleared');
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('clearImage')).toEqual([['monitor-1']]);
  });

  it('soporta pegar imagen desde portapapeles', async () => {
    const wrapper = mount(MonitorControls, {
      props: {
        monitorId: 'monitor-1',
        state: createDefaultMonitorState(),
        isFileImportBlocked: false,
        fileImportBlockedMessage: 'bloqueado'
      }
    });

    const imageFile = new File(['img'], 'pasted.png', { type: 'image/png' });
    const clipboardData = createDataTransfer(imageFile);

    await wrapper.get('[data-testid="monitor-image-drop-zone"]').trigger('paste', { clipboardData });

    expect(wrapper.emitted('uploadImage')).toEqual([['monitor-1', imageFile, 'paste']]);
  });

  it('aplica feedback visual durante drag enter/leave', async () => {
    const wrapper = mount(MonitorControls, {
      props: {
        monitorId: 'monitor-1',
        state: createDefaultMonitorState(),
        isFileImportBlocked: false,
        fileImportBlockedMessage: 'bloqueado'
      }
    });

    const dropZone = wrapper.get('[data-testid="monitor-image-drop-zone"]');
    await dropZone.trigger('dragenter', { dataTransfer: createDataTransfer(new File(['img'], 'drag.png', { type: 'image/png' })) });
    expect(dropZone.classes()).toContain('app-file-dropzone--drag-valid');

    await dropZone.trigger('dragleave', { dataTransfer: createDataTransfer(new File(['img'], 'drag.png', { type: 'image/png' })) });
    expect(dropZone.classes()).toContain('app-file-dropzone--idle');
  });

  it('muestra error claro al soltar archivo no valido', async () => {
    const wrapper = mount(MonitorControls, {
      props: {
        monitorId: 'monitor-1',
        state: createDefaultMonitorState(),
        isFileImportBlocked: false,
        fileImportBlockedMessage: 'bloqueado'
      }
    });

    const invalidFile = new File(['txt'], 'nota.txt', { type: 'text/plain' });
    await wrapper.get('[data-testid="monitor-image-drop-zone"]').trigger('drop', {
      dataTransfer: createDataTransfer(invalidFile)
    });

    expect(wrapper.get('[data-testid="monitor-image-import-feedback"]').text()).toContain('Formato no permitido');
    expect(wrapper.emitted('uploadImage')).toBeUndefined();
  });

  it('emite cambios de transicion con clamp de duracion', async () => {
    const state = createDefaultMonitorState();
    state.contentTransition = {
      type: 'cut',
      durationMs: 450
    };

    const wrapper = mount(MonitorControls, {
      props: {
        monitorId: 'monitor-1',
        state,
        isFileImportBlocked: false,
        fileImportBlockedMessage: 'bloqueado'
      }
    });

    await wrapper.get('[data-testid="monitor-open-content-editor"]').trigger('click');
    await wrapper.get('[data-testid="monitor-transition-type"]').setValue('wipe');
    await wrapper.get('[data-testid="monitor-transition-duration"]').setValue('99999');

    expect(wrapper.emitted('setContentTransition')).toEqual([
      ['monitor-1', { type: 'wipe', durationMs: 450 }],
      ['monitor-1', { type: 'cut', durationMs: 5000 }]
    ]);
  });

  it('emite asignacion y controles de URL externa', async () => {
    const wrapper = mount(MonitorControls, {
      props: {
        monitorId: 'monitor-1',
        state: createDefaultMonitorState()
      }
    });

    await wrapper.get('[data-testid="monitor-external-url-input"]').setValue('https://example.com/news');
    await wrapper.get('[data-testid="monitor-external-url-apply"]').trigger('click');

    expect(wrapper.emitted('assignExternalUrl')).toEqual([
      ['monitor-1', 'https://example.com/news']
    ]);
  });

  it('habilita botones de navegacion URL cuando hay URL activa', async () => {
    const state = createDefaultMonitorState();
    state.activeMediaItem = {
      id: 'url-1',
      kind: 'external-url',
      name: 'URL',
      source: 'https://example.com/path'
    };

    const wrapper = mount(MonitorControls, {
      props: {
        monitorId: 'monitor-1',
        state
      }
    });

    const back = wrapper.get('[data-testid="monitor-external-url-back"]');
    const forward = wrapper.get('[data-testid="monitor-external-url-forward"]');
    const reload = wrapper.get('[data-testid="monitor-external-url-reload"]');
    const clear = wrapper.get('[data-testid="monitor-external-url-clear"]');

    expect(back.attributes('disabled')).toBeUndefined();
    expect(forward.attributes('disabled')).toBeUndefined();
    expect(reload.attributes('disabled')).toBeUndefined();
    expect(clear.attributes('disabled')).toBeUndefined();

    await back.trigger('click');
    await forward.trigger('click');
    await reload.trigger('click');
    await clear.trigger('click');

    expect(wrapper.emitted('navigateExternalUrl')).toEqual([
      ['monitor-1', 'back'],
      ['monitor-1', 'forward']
    ]);
    expect(wrapper.emitted('reloadExternalUrl')).toEqual([['monitor-1']]);
    expect(wrapper.emitted('clearExternalUrl')).toEqual([['monitor-1']]);
  });
});
