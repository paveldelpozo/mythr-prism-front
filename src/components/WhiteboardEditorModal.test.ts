import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import WhiteboardEditorModal from './WhiteboardEditorModal.vue';

const createRect = (width: number, height: number): DOMRect => ({
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  right: width,
  bottom: height,
  width,
  height,
  toJSON: () => ({})
}) as DOMRect;

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

const setupCanvasGeometry = (wrapper: ReturnType<typeof mountModal>) => {
  const stage = wrapper.get('[data-testid="whiteboard-canvas-stage"]').element as HTMLDivElement;
  const canvas = wrapper.get('[data-testid="whiteboard-canvas"]').element as HTMLCanvasElement;
  stage.getBoundingClientRect = () => createRect(100, 100);
  canvas.getBoundingClientRect = () => createRect(100, 100);
};

const getLastStateChange = (wrapper: ReturnType<typeof mountModal>) => {
  const emissions = wrapper.emitted('stateChange') ?? [];
  const payload = emissions.at(-1);
  expect(payload).toBeDefined();
  const state = payload?.[1];
  expect(state).toBeDefined();
  return state as { strokes: Array<{ points: Array<{ x: number; y: number }> }> };
};

const getLastStrokeEnd = (wrapper: ReturnType<typeof mountModal>) => {
  const state = getLastStateChange(wrapper);
  return state.strokes[0]?.points[1];
};

const queryWidthPopover = () => document.body.querySelector('[data-testid="whiteboard-width-popover"]');

const queryWidthOption = (width: number) =>
  document.body.querySelector(`[data-testid="whiteboard-width-option-${width}"]`) as HTMLButtonElement | null;

describe('components/WhiteboardEditorModal', () => {
  it('renderiza toolbar compacta en una linea con botones icon-only y tooltips', async () => {
    const wrapper = mountModal();

    const toolbar = wrapper.get('[data-testid="whiteboard-toolbar"]');
    const toolbarTrack = wrapper.get('[data-testid="whiteboard-toolbar-track"]');

    expect(toolbar.attributes('role')).toBe('toolbar');
    expect(toolbar.classes()).toContain('whiteboard-toolbar--single-line');
    expect(toolbarTrack.classes()).toContain('whiteboard-toolbar-track');
    expect(wrapper.get('[data-testid="whiteboard-tool-draw"]').attributes('aria-label')).toBe('Lapiz');
    expect(wrapper.get('[data-testid="whiteboard-tool-arrow"]').attributes('aria-label')).toBe('Flecha');
    expect(wrapper.get('[data-testid="whiteboard-tool-circle"]').attributes('aria-label')).toBe('Circulo');
    expect(wrapper.get('[data-testid="whiteboard-tool-rect"]').attributes('aria-label')).toBe('Rectangulo');
    expect(wrapper.get('[data-testid="whiteboard-tool-line"]').attributes('aria-label')).toBe('Linea');
    expect(wrapper.get('[data-testid="whiteboard-tool-draw"]').attributes('title')).toBe('Lapiz');
    expect(wrapper.get('[data-testid="whiteboard-tool-draw"]').text().trim()).toBe('');
    expect(wrapper.get('[data-testid="whiteboard-undo"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="whiteboard-undo"]').attributes('title')).toBe('Deshacer ultimo trazo');
    expect(wrapper.get('[data-testid="whiteboard-undo"]').text().trim()).toBe('');
    expect(wrapper.get('[data-testid="whiteboard-clear"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="whiteboard-clear"]').attributes('title')).toBe('Limpiar pizarra');
    expect(wrapper.get('[data-testid="whiteboard-clear"]').text().trim()).toBe('');
    expect(wrapper.get('[data-testid="whiteboard-color-input"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="whiteboard-width-toggle"]').exists()).toBe(true);

    await wrapper.get('[data-testid="whiteboard-tool-arrow"]').trigger('click');

    expect(wrapper.get('[data-testid="whiteboard-tool-arrow"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('[data-testid="whiteboard-tool-draw"]').attributes('aria-pressed')).toBe('false');
  });

  it('abre y cierra popover de grosor desde boton, Escape y click fuera', async () => {
    const wrapper = mountModal();
    const widthToggle = wrapper.get('[data-testid="whiteboard-width-toggle"]');

    expect(queryWidthPopover()).toBeNull();

    await widthToggle.trigger('click');
    expect(queryWidthPopover()).not.toBeNull();
    expect(widthToggle.attributes('aria-expanded')).toBe('true');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(queryWidthPopover()).toBeNull();
    expect(widthToggle.attributes('aria-expanded')).toBe('false');

    await widthToggle.trigger('click');
    expect(queryWidthPopover()).not.toBeNull();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await wrapper.vm.$nextTick();

    expect(queryWidthPopover()).toBeNull();
  });

  it('permite seleccionar grosor desde popover y conserva seleccion actual', async () => {
    const wrapper = mountModal();
    setupCanvasGeometry(wrapper);
    const widthToggle = wrapper.get('[data-testid="whiteboard-width-toggle"]');

    expect(widthToggle.attributes('aria-label')).toBe('Grosor actual 6 px');

    await widthToggle.trigger('click');
    const widthOption24 = queryWidthOption(24);
    expect(widthOption24).not.toBeNull();
    widthOption24?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wrapper.vm.$nextTick();

    expect(queryWidthPopover()).toBeNull();
    expect(widthToggle.attributes('aria-label')).toBe('Grosor actual 24 px');

    await wrapper.get('[data-testid="whiteboard-canvas"]').trigger('pointerdown', {
      clientX: 10,
      clientY: 10,
      shiftKey: false
    });
    await wrapper.get('[data-testid="whiteboard-canvas"]').trigger('pointermove', {
      clientX: 40,
      clientY: 40,
      shiftKey: false
    });
    await wrapper.get('[data-testid="whiteboard-canvas"]').trigger('pointerup', {
      clientX: 40,
      clientY: 40,
      shiftKey: false
    });

    const state = getLastStateChange(wrapper);
    expect(state.strokes[0]?.width).toBe(24);
  });

  it.each(['rect', 'circle'] as const)(
    'fuerza proporcion 1:1 con Shift para herramienta %s',
    async (tool) => {
      const wrapper = mountModal();
      setupCanvasGeometry(wrapper);

      await wrapper.get(`[data-testid="whiteboard-tool-${tool}"]`).trigger('click');
      await wrapper.get('[data-testid="whiteboard-canvas"]').trigger('pointerdown', {
        clientX: 10,
        clientY: 10,
        shiftKey: false
      });
      await wrapper.get('[data-testid="whiteboard-canvas"]').trigger('pointermove', {
        clientX: 70,
        clientY: 40,
        shiftKey: true
      });

      const previewState = getLastStateChange(wrapper);
      expect(previewState.strokes[0]?.points[1]).toEqual({ x: 0.7, y: 0.7 });

      await wrapper.get('[data-testid="whiteboard-canvas"]').trigger('pointerup', {
        clientX: 70,
        clientY: 40,
        shiftKey: true
      });

      const finalState = getLastStateChange(wrapper);
      expect(finalState.strokes[0]?.points[1]).toEqual({ x: 0.7, y: 0.7 });
    }
  );

  it('actualiza preview al pulsar o soltar Shift durante el drag', async () => {
    const wrapper = mountModal();
    setupCanvasGeometry(wrapper);

    await wrapper.get('[data-testid="whiteboard-tool-rect"]').trigger('click');
    await wrapper.get('[data-testid="whiteboard-canvas"]').trigger('pointerdown', {
      clientX: 10,
      clientY: 10,
      shiftKey: false
    });
    await wrapper.get('[data-testid="whiteboard-canvas"]').trigger('pointermove', {
      clientX: 70,
      clientY: 40,
      shiftKey: false
    });

    expect(getLastStateChange(wrapper).strokes[0]?.points[1]).toEqual({ x: 0.7, y: 0.4 });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    expect(getLastStateChange(wrapper).strokes[0]?.points[1]).toEqual({ x: 0.7, y: 0.7 });

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
    expect(getLastStateChange(wrapper).strokes[0]?.points[1]).toEqual({ x: 0.7, y: 0.4 });
  });

  it.each(['line', 'arrow'] as const)(
    'ajusta angulo a incrementos de 45° con Shift en %s',
    async (tool) => {
      const wrapper = mountModal();
      setupCanvasGeometry(wrapper);

      await wrapper.get(`[data-testid="whiteboard-tool-${tool}"]`).trigger('click');
      await wrapper.get('[data-testid="whiteboard-canvas"]').trigger('pointerdown', {
        clientX: 10,
        clientY: 10,
        shiftKey: false
      });
      await wrapper.get('[data-testid="whiteboard-canvas"]').trigger('pointermove', {
        clientX: 70,
        clientY: 40,
        shiftKey: true
      });

      const previewEnd = getLastStrokeEnd(wrapper);
      expect(previewEnd?.x).toBeCloseTo(0.57, 2);
      expect(previewEnd?.y).toBeCloseTo(0.57, 2);

      await wrapper.get('[data-testid="whiteboard-canvas"]').trigger('pointerup', {
        clientX: 70,
        clientY: 40,
        shiftKey: true
      });

      const finalEnd = getLastStrokeEnd(wrapper);
      expect(finalEnd?.x).toBeCloseTo(0.57, 2);
      expect(finalEnd?.y).toBeCloseTo(0.57, 2);
    }
  );

  it('no ajusta angulo en line si Shift no esta pulsado', async () => {
    const wrapper = mountModal();
    setupCanvasGeometry(wrapper);

    await wrapper.get('[data-testid="whiteboard-tool-line"]').trigger('click');
    await wrapper.get('[data-testid="whiteboard-canvas"]').trigger('pointerdown', {
      clientX: 10,
      clientY: 10,
      shiftKey: false
    });
    await wrapper.get('[data-testid="whiteboard-canvas"]').trigger('pointermove', {
      clientX: 70,
      clientY: 40,
      shiftKey: false
    });

    expect(getLastStrokeEnd(wrapper)).toEqual({ x: 0.7, y: 0.4 });
  });

  it('recalcula preview de line al pulsar o soltar Shift durante drag', async () => {
    const wrapper = mountModal();
    setupCanvasGeometry(wrapper);

    await wrapper.get('[data-testid="whiteboard-tool-line"]').trigger('click');
    await wrapper.get('[data-testid="whiteboard-canvas"]').trigger('pointerdown', {
      clientX: 10,
      clientY: 10,
      shiftKey: false
    });
    await wrapper.get('[data-testid="whiteboard-canvas"]').trigger('pointermove', {
      clientX: 70,
      clientY: 40,
      shiftKey: false
    });

    expect(getLastStrokeEnd(wrapper)).toEqual({ x: 0.7, y: 0.4 });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    const snappedEnd = getLastStrokeEnd(wrapper);
    expect(snappedEnd?.x).toBeCloseTo(0.57, 2);
    expect(snappedEnd?.y).toBeCloseTo(0.57, 2);

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
    expect(getLastStrokeEnd(wrapper)).toEqual({ x: 0.7, y: 0.4 });
  });
});
