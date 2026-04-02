import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppFileDropzone from './AppFileDropzone.vue';

const createFileList = (...files: File[]): FileList => {
  const fileList: Partial<FileList> & { length: number; item: (index: number) => File | null } = {
    length: files.length,
    item: (index: number) => files[index] ?? null
  };

  files.forEach((file, index) => {
    (fileList as Record<number, File>)[index] = file;
  });

  return fileList as FileList;
};

const createDataTransfer = (...files: File[]): DataTransfer =>
  ({
    items: {
      length: files.length,
      ...Object.fromEntries(files.map((file, index) => [index, { kind: 'file', getAsFile: () => file }]))
    },
    files: createFileList(...files)
  }) as unknown as DataTransfer;

describe('components/ui/AppFileDropzone', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((file: Blob) => `blob:${file.size}`)
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn()
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('no abre selector nativo al hacer click en contenedor dentro de label', async () => {
    const Host = defineComponent({
      components: {
        AppFileDropzone
      },
      template: `
        <label class="form-field">
          Archivo local
          <AppFileDropzone data-testid="playlist-add-image-drop-zone" accept="image/*" />
        </label>
      `
    });

    const wrapper = mount(Host);
    const hiddenInput = wrapper.get('[data-testid="app-file-dropzone-hidden-input"]').element as HTMLInputElement;
    const inputClickSpy = vi.spyOn(hiddenInput, 'click');

    await wrapper.get('[data-testid="playlist-add-image-drop-zone"]').trigger('click');

    expect(inputClickSpy).not.toHaveBeenCalled();
  });

  it('activa modo pegado al hacer click en contenedor', async () => {
    const wrapper = mount(AppFileDropzone, {
      props: {
        accept: 'image/*'
      }
    });

    await wrapper.get('[data-testid="app-file-dropzone"]').trigger('click');

    expect(wrapper.get('[data-testid="app-file-dropzone"]').classes()).toContain('app-file-dropzone--paste-active');
    expect(wrapper.emitted('focusPaste')).toHaveLength(1);
  });

  it('abre selector con el boton y emite archivos seleccionados', async () => {
    const wrapper = mount(AppFileDropzone, {
      props: {
        accept: 'image/*',
        pickButtonTestId: 'pick-file-button'
      }
    });

    const hiddenInput = wrapper.get('[data-testid="app-file-dropzone-hidden-input"]').element as HTMLInputElement;
    const inputClickSpy = vi.spyOn(hiddenInput, 'click');

    await wrapper.get('[data-testid="pick-file-button"]').trigger('click');
    expect(inputClickSpy).toHaveBeenCalledTimes(1);

    const image = new File(['binary'], 'a.png', { type: 'image/png' });
    Object.defineProperty(hiddenInput, 'files', {
      configurable: true,
      value: createFileList(image)
    });
    await wrapper.get('[data-testid="app-file-dropzone-hidden-input"]').trigger('change');

    expect(wrapper.emitted('filesSelected')).toEqual([[[image], 'file-picker']]);
  });

  it('aplica estado de drag valido e invalido segun accept', async () => {
    const wrapper = mount(AppFileDropzone, {
      props: {
        accept: 'image/*'
      }
    });

    const dropzone = wrapper.get('[data-testid="app-file-dropzone"]');
    const image = new File(['binary'], 'image.png', { type: 'image/png' });
    const text = new File(['txt'], 'note.txt', { type: 'text/plain' });

    await dropzone.trigger('dragenter', { dataTransfer: createDataTransfer(image) });
    expect(dropzone.classes()).toContain('app-file-dropzone--drag-valid');

    await dropzone.trigger('dragover', { dataTransfer: createDataTransfer(text) });
    expect(dropzone.classes()).toContain('app-file-dropzone--drag-invalid');
  });

  it('rechaza drop multiple cuando multiple=false', async () => {
    const wrapper = mount(AppFileDropzone, {
      props: {
        accept: 'image/*',
        multiple: false
      }
    });

    const one = new File(['1'], 'one.png', { type: 'image/png' });
    const two = new File(['2'], 'two.png', { type: 'image/png' });
    await wrapper.get('[data-testid="app-file-dropzone"]').trigger('drop', {
      dataTransfer: createDataTransfer(one, two)
    });

    expect(wrapper.emitted('filesSelected')).toBeUndefined();
    expect(wrapper.get('[data-testid="app-file-dropzone-error"]').text()).toContain('Solo se permite un archivo');
  });

  it('permite multiples, lista archivos y quita uno', async () => {
    const wrapper = mount(AppFileDropzone, {
      props: {
        multiple: true
      }
    });

    const one = new File(['1'], 'one.txt', { type: 'text/plain' });
    const two = new File(['2'], 'two.txt', { type: 'text/plain' });
    await wrapper.get('[data-testid="app-file-dropzone"]').trigger('drop', {
      dataTransfer: createDataTransfer(one, two)
    });

    expect(wrapper.findAll('[data-testid^="app-file-dropzone-item-"]')).toHaveLength(2);

    await wrapper.get('[data-testid="app-file-dropzone-remove-0"]').trigger('click');
    expect(wrapper.findAll('[data-testid^="app-file-dropzone-item-"]')).toHaveLength(1);
    expect(wrapper.emitted('fileRemoved')).toHaveLength(1);
  });

  it('emite cleared al quitar el ultimo archivo seleccionado', async () => {
    const wrapper = mount(AppFileDropzone, {
      props: {
        multiple: false
      }
    });

    const one = new File(['1'], 'one.txt', { type: 'text/plain' });
    await wrapper.get('[data-testid="app-file-dropzone"]').trigger('drop', {
      dataTransfer: createDataTransfer(one)
    });

    await wrapper.get('[data-testid="app-file-dropzone-remove-0"]').trigger('click');

    expect(wrapper.emitted('fileRemoved')).toHaveLength(1);
    expect(wrapper.emitted('cleared')).toHaveLength(1);
    expect(wrapper.findAll('[data-testid^="app-file-dropzone-item-"]')).toHaveLength(0);
  });

  it('muestra thumbnail para imagen y badge para archivo no imagen', async () => {
    const wrapper = mount(AppFileDropzone, {
      props: {
        accept: 'image/*,.pdf',
        multiple: true
      }
    });

    const image = new File(['img'], 'photo.png', { type: 'image/png' });
    const pdf = new File(['pdf'], 'spec.pdf', { type: 'application/pdf' });

    await wrapper.get('[data-testid="app-file-dropzone"]').trigger('drop', {
      dataTransfer: createDataTransfer(image, pdf)
    });

    expect(wrapper.find('[data-testid="app-file-dropzone-image-preview"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="app-file-dropzone-non-image-preview"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('PDF');
  });
});
