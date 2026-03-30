import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AppHeader from './AppHeader.vue';

describe('AppHeader', () => {
  it('renderiza tablist accesible con Monitores activo por defecto', () => {
    const wrapper = mount(AppHeader, {
      props: {
        activeMainViewTab: 'monitors'
      }
    });

    const tablist = wrapper.get('[role="tablist"]');
    const monitorsTab = wrapper.get('[data-testid="tab-monitors"]');
    const playlistTab = wrapper.get('[data-testid="tab-playlist"]');

    expect(tablist.attributes('aria-label')).toBe('Secciones de trabajo');
    expect(monitorsTab.attributes('aria-selected')).toBe('true');
    expect(playlistTab.attributes('aria-selected')).toBe('false');
    expect(monitorsTab.attributes('aria-controls')).toBe('panel-monitors');
    expect(playlistTab.attributes('aria-controls')).toBe('panel-playlist');
  });

  it('emite update:activeMainViewTab al cambiar de tab', async () => {
    const wrapper = mount(AppHeader, {
      props: {
        activeMainViewTab: 'monitors'
      }
    });

    await wrapper.get('[data-testid="tab-playlist"]').trigger('click');

    expect(wrapper.emitted('update:activeMainViewTab')).toEqual([[ 'playlist' ]]);
  });

  it('renderiza iconos decorativos en las tabs', () => {
    const wrapper = mount(AppHeader, {
      props: {
        activeMainViewTab: 'playlist'
      }
    });

    const icons = wrapper.findAll('button svg[aria-hidden="true"]');
    expect(icons).toHaveLength(2);
  });
});
