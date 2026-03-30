import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { MonitorDescriptor, MonitorStateMap } from '../types/broadcaster';
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
    imageDataUrl: null,
    activeMediaItem: null,
    isWindowOpen: true,
    isSlaveReady: true,
    isFullscreen: false,
    requiresFullscreenInteraction: false,
    lastError: null
  }
};

const mountMonitorList = (canCloseAllWindows: boolean) =>
  mount(MonitorList, {
    props: {
      monitors,
      states,
      showOnlyProjectable: false,
      totalMonitors: 1,
      canCloseAllWindows
    },
    global: {
      stubs: {
        MonitorCard: true
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
});
