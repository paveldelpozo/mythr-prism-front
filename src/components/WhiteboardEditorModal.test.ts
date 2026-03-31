import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import WhiteboardEditorModal from './WhiteboardEditorModal.vue';

const mountModal = () =>
  mount(WhiteboardEditorModal, {
    props: {
      monitorId: 'monitor-1',
      monitorLabel: 'Monitor 1',
      monitorResolutionLabel: '1920x1080',
      referenceImageDataUrl: null,
      state: { strokes: [] }
    }
  });

describe('components/WhiteboardEditorModal', () => {
  it('renderiza toolbar visual accesible y permite seleccionar herramienta', async () => {
    const wrapper = mountModal();

    expect(wrapper.get('[data-testid="whiteboard-toolbar"]').attributes('role')).toBe('toolbar');
    expect(wrapper.get('[data-testid="whiteboard-tool-draw"]').attributes('aria-label')).toBe('Lapiz');
    expect(wrapper.get('[data-testid="whiteboard-tool-arrow"]').attributes('aria-label')).toBe('Flecha');
    expect(wrapper.get('[data-testid="whiteboard-tool-circle"]').attributes('aria-label')).toBe('Circulo');
    expect(wrapper.get('[data-testid="whiteboard-tool-rect"]').attributes('aria-label')).toBe('Rectangulo');
    expect(wrapper.get('[data-testid="whiteboard-tool-line"]').attributes('aria-label')).toBe('Linea');
    expect(wrapper.get('[data-testid="whiteboard-undo"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="whiteboard-clear"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="whiteboard-color-input"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="whiteboard-width-input"]').exists()).toBe(true);

    await wrapper.get('[data-testid="whiteboard-tool-arrow"]').trigger('click');

    expect(wrapper.get('[data-testid="whiteboard-tool-arrow"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('[data-testid="whiteboard-tool-draw"]').attributes('aria-pressed')).toBe('false');
  });
});
