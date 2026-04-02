import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import type { MonitorDescriptor, MonitorStateMap, MonitorThumbnailStateMap } from '../types/broadcaster';
import MonitorList from './MonitorList.vue';

const monitors: MonitorDescriptor[] = [
  {
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
  }
];

const states: MonitorStateMap = {
  'monitor-1': {
    transform: { rotate: 0, scale: 1, translateX: 0, translateY: 0 },
    contentTransition: { type: 'cut', durationMs: 450 },
    imageDataUrl: null,
    activeMediaItem: null,
    isWindowOpen: true,
    isSlaveReady: true,
    isFullscreen: false,
    fullscreenIntentActive: false,
    lostFullscreenUnexpectedly: false,
    lastFullscreenExitAtMs: null,
    requiresFullscreenInteraction: false,
    isExternalAppCapturePending: false,
    isExternalAppCaptureActive: false,
    lastError: null
  }
};

const thumbnails: MonitorThumbnailStateMap = {
  'monitor-1': {
    imageDataUrl: null,
    capturedAtMs: null
  }
};

const MonitorCardStub = defineComponent({
  name: 'MonitorCard',
  emits: ['renameMonitor', 'openWhiteboard', 'flashMonitorId'],
  template: `
    <div>
      <button data-testid="monitor-card-rename" @click="$emit('renameMonitor', 'monitor-1', 'Escenario')">rename</button>
      <button data-testid="monitor-card-whiteboard" @click="$emit('openWhiteboard', 'monitor-1')">whiteboard</button>
      <button data-testid="monitor-card-flash-id" @click="$emit('flashMonitorId', 'monitor-1')">flash</button>
    </div>
  `
});

const mountMonitorList = (canCloseAllWindows: boolean) =>
  mount(MonitorList, {
    props: {
      monitors,
      states,
      thumbnails,
      showOnlyProjectable: false,
      totalMonitors: 1,
      canCloseAllWindows,
      layouts: [],
      layoutDraftName: '',
      selectedLayoutId: null,
      layoutFeedback: null,
      mirrorEnabled: false,
      mirrorSourceMonitorId: null,
      mirrorTargetMonitorIds: [],
      mirrorActiveTargetCount: 0,
      mirrorUnavailableTargetIds: [],
      mirrorLastError: null
    },
    global: {
      stubs: {
        MonitorCard: MonitorCardStub
      }
    }
  });

describe('MonitorList', () => {
  it('muestra boton de cierre global en la barra de monitores', () => {
    const wrapper = mountMonitorList(false);

    const closeAllButton = wrapper.get('[data-testid="monitorlist-close-all"]');

    expect(closeAllButton.text()).toContain('Cerrar todas las ventanas');
    expect(closeAllButton.attributes('disabled')).toBeDefined();
  });

  it('habilita boton de cierre global y emite closeAll', async () => {
    const wrapper = mountMonitorList(true);

    const closeAllButton = wrapper.get('[data-testid="monitorlist-close-all"]');

    expect(closeAllButton.attributes('disabled')).toBeUndefined();

    await closeAllButton.trigger('click');

    expect(wrapper.emitted('closeAll')).toHaveLength(1);
  });

  it('emite cambios de modo espejo desde la UI', async () => {
    const wrapper = mountMonitorList(true);

    await wrapper.get('[data-testid="mirror-mode-toggle-btn"]').trigger('click');

    await wrapper.get('[data-testid="mirror-source-select"]').setValue('monitor-1');

    expect(wrapper.emitted('update:mirrorEnabled')?.[0]).toEqual([true]);
    expect(wrapper.emitted('update:mirrorSourceMonitorId')?.[0]).toEqual(['monitor-1']);
  });

  it('muestra boton espejo con texto de accion segun estado', async () => {
    const wrapper = mountMonitorList(true);

    expect(wrapper.get('[data-testid="mirror-mode-toggle-btn"]').text()).toContain('Iniciar espejo');

    await wrapper.setProps({
      mirrorEnabled: true
    });

    expect(wrapper.get('[data-testid="mirror-mode-toggle-btn"]').text()).toContain('Finalizar espejo');
  });

  it('muestra feedback global cuando un monitor pierde fullscreen de forma externa', async () => {
    const wrapper = mountMonitorList(true);

    await wrapper.setProps({
      states: {
        'monitor-1': {
          ...states['monitor-1'],
          lostFullscreenUnexpectedly: true,
          fullscreenIntentActive: true,
          lastFullscreenExitAtMs: Date.now()
        }
      }
    });

    expect(wrapper.get('[data-testid="fullscreen-loss-feedback"]').text()).toContain('Monitor 1');
  });

  it('propaga evento de renombrado desde la tarjeta', async () => {
    const wrapper = mountMonitorList(true);

    await wrapper.get('[data-testid="monitor-card-rename"]').trigger('click');

    expect(wrapper.emitted('renameMonitor')?.[0]).toEqual(['monitor-1', 'Escenario']);
  });

  it('propaga evento para abrir pizarra desde la tarjeta', async () => {
    const wrapper = mountMonitorList(true);

    await wrapper.get('[data-testid="monitor-card-whiteboard"]').trigger('click');

    expect(wrapper.emitted('openWhiteboard')?.[0]).toEqual(['monitor-1']);
  });

  it('propaga evento para identificar monitor desde la tarjeta', async () => {
    const wrapper = mountMonitorList(true);

    await wrapper.get('[data-testid="monitor-card-flash-id"]').trigger('click');

    expect(wrapper.emitted('flashMonitorId')?.[0]).toEqual(['monitor-1']);
  });

  it('mantiene el orden de secciones requerido en el tab Monitores', () => {
    const wrapper = mountMonitorList(true);

    const sectionOrder = wrapper
      .findAll('[data-monitor-section]')
      .map((section) => section.attributes('data-monitor-section'));

    expect(sectionOrder).toEqual(['availability', 'cards', 'mirror', 'layouts']);
  });
});
