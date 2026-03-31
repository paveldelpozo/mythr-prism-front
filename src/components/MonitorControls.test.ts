import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import MonitorControls from './MonitorControls.vue';
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
  it('no emite uploadImage al hacer click en el input sin change', async () => {
const wrapper = mount(MonitorControls, {
      props: {
        monitorId: 'monitor-1',
        state: createDefaultMonitorState(),
        isFileImportBlocked: false,
        fileImportBlockedMessage: 'bloqueado'
      }
    });

    const fileInput = wrapper.get('input[type="file"]');
    await fileInput.trigger('click');

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

    const input = wrapper.get('input[type="file"]').element as HTMLInputElement;
    const imageFile = new File(['image-binary'], 'cover.png', { type: 'image/png' });

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [imageFile]
    });

    await wrapper.get('input[type="file"]').trigger('change');

    expect(wrapper.emitted('uploadImage')).toEqual([['monitor-1', imageFile]]);
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

    const input = wrapper.get('input[type="file"]');
    expect(input.attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="monitor-file-import-blocked-feedback"]').text()).toContain('sal del fullscreen');
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

    expect(wrapper.emitted('uploadImage')).toEqual([['monitor-1', imageFile]]);
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

    expect(wrapper.emitted('uploadImage')).toEqual([['monitor-1', imageFile]]);
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
    expect(dropZone.classes()).toContain('image-drop-zone--active');

    await dropZone.trigger('dragleave', { dataTransfer: createDataTransfer(new File(['img'], 'drag.png', { type: 'image/png' })) });
    expect(dropZone.classes()).not.toContain('image-drop-zone--active');
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

    expect(wrapper.get('[data-testid="monitor-image-import-feedback"]').text()).toContain('no es una imagen valida');
    expect(wrapper.emitted('uploadImage')).toBeUndefined();
  });
});
