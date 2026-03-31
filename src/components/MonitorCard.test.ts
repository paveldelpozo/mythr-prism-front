import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import type { MonitorDescriptor, MonitorRuntimeState, MonitorThumbnailState } from '../types/broadcaster';
import MonitorCard from './MonitorCard.vue';

const monitor: MonitorDescriptor = {
  id: 'monitor-1',
  label: 'Monitor 1',
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
};

const state: MonitorRuntimeState = {
  transform: { rotate: 0, scale: 1, translateX: 0, translateY: 0 },
  imageDataUrl: null,
  activeMediaItem: null,
  isWindowOpen: true,
  isSlaveReady: true,
  isFullscreen: false,
  fullscreenIntentActive: false,
  lostFullscreenUnexpectedly: false,
  lastFullscreenExitAtMs: null,
  requiresFullscreenInteraction: false,
  lastError: null
};

const thumbnail: MonitorThumbnailState = {
  imageDataUrl: 'data:image/png;base64,THUMB',
  capturedAtMs: Date.now()
};

const mountCard = (overrides?: Partial<{ state: MonitorRuntimeState; thumbnail: MonitorThumbnailState }>) =>
  mount(MonitorCard, {
    props: {
      monitor,
      state: overrides?.state ?? state,
      thumbnail: overrides?.thumbnail ?? thumbnail
    },
    global: {
      stubs: {
        MonitorControls: defineComponent({
          name: 'MonitorControls',
          template: '<div data-testid="monitor-controls-stub" />'
        })
      }
    }
  });

describe('MonitorCard', () => {
  it('abre y cierra el popover de Estado con el boton', async () => {
    const wrapper = mountCard();

    expect(wrapper.find('[data-testid="monitor-info-popover"]').exists()).toBe(false);

    await wrapper.get('[data-testid="monitor-info-toggle"]').trigger('click');

    expect(wrapper.get('[data-testid="monitor-info-toggle"]').attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('[data-testid="monitor-info-popover"]').text()).toContain('Handshake: Conectado');

    await wrapper.get('[data-testid="monitor-info-toggle"]').trigger('click');
    expect(wrapper.find('[data-testid="monitor-info-popover"]').exists()).toBe(false);
  });

  it('cierra el popover de Estado al presionar Escape', async () => {
    const wrapper = mountCard();

    await wrapper.get('[data-testid="monitor-info-toggle"]').trigger('click');
    expect(wrapper.find('[data-testid="monitor-info-popover"]').exists()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="monitor-info-popover"]').exists()).toBe(false);
  });

  it('cierra el popover de Estado al hacer click fuera', async () => {
    const wrapper = mountCard();

    await wrapper.get('[data-testid="monitor-info-toggle"]').trigger('click');
    expect(wrapper.find('[data-testid="monitor-info-popover"]').exists()).toBe(true);

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="monitor-info-popover"]').exists()).toBe(false);
  });

  it('renderiza miniatura en vivo con contenedor uniforme y media contain', () => {
    const wrapper = mountCard();

    const preview = wrapper.get('[data-testid="monitor-preview-monitor-1"]');
    const previewImage = wrapper.get('[data-testid="monitor-preview-image-monitor-1"]');

    expect(preview.classes()).toContain('monitor-card-preview');
    expect(previewImage.classes()).toContain('monitor-card-preview-media');
    expect(previewImage.attributes('src')).toContain('THUMB');
  });

  it('muestra boton de editar junto al nombre y no renderiza input inline', () => {
    const wrapper = mountCard();

    expect(wrapper.get('[data-testid="monitor-rename-open"]').text()).toContain('Editar');
    expect(wrapper.find('[data-testid="monitor-rename-input"]').exists()).toBe(false);
  });

  it('abre y cierra modal de renombrado por boton de cierre y Escape', async () => {
    const wrapper = mountCard();

    expect(wrapper.find('[data-testid="monitor-rename-modal"]').exists()).toBe(false);

    await wrapper.get('[data-testid="monitor-rename-open"]').trigger('click');
    expect(wrapper.get('[data-testid="monitor-rename-modal"]').exists()).toBe(true);

    await wrapper.get('[data-testid="monitor-rename-modal-close"]').trigger('click');
    expect(wrapper.find('[data-testid="monitor-rename-modal"]').exists()).toBe(false);

    await wrapper.get('[data-testid="monitor-rename-open"]').trigger('click');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="monitor-rename-modal"]').exists()).toBe(false);
  });

  it('emite renombrado de pantalla al guardar desde modal', async () => {
    const wrapper = mountCard();

    await wrapper.get('[data-testid="monitor-rename-open"]').trigger('click');
    const renameInput = wrapper.get('[data-testid="monitor-rename-modal-input"]');
    await renameInput.setValue('Proyector Sala A');
    await wrapper.get('[data-testid="monitor-rename-modal-save"]').trigger('click');

    expect(wrapper.emitted('renameMonitor')?.[0]).toEqual(['monitor-1', 'Proyector Sala A']);
  });

  it('mantiene accion principal para abrir ventana cuando esta cerrada', async () => {
    const wrapper = mountCard({
      state: {
        ...state,
        isWindowOpen: false
      },
      thumbnail: {
        imageDataUrl: null,
        capturedAtMs: null
      }
    });

    const openButton = wrapper.get('[data-testid="monitor-open-window"]');
    expect(openButton.text()).toContain('Abrir ventana en este monitor');

    await openButton.trigger('click');

    expect(wrapper.emitted('openWindow')?.[0]).toEqual(['monitor-1']);
  });
});
