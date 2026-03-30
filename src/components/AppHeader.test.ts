import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AppHeader from './AppHeader.vue';

describe('AppHeader', () => {
  it('deshabilita el boton de cierre global cuando no hay ventanas abiertas', () => {
    const wrapper = mount(AppHeader, {
      props: {
        canCloseAllWindows: false
      }
    });

    const closeAllButton = wrapper.get('button');

    expect(closeAllButton.attributes('disabled')).toBeDefined();
  });

  it('habilita el boton y emite closeAll cuando hay ventanas abiertas', async () => {
    const wrapper = mount(AppHeader, {
      props: {
        canCloseAllWindows: true
      }
    });

    const closeAllButton = wrapper.get('button');

    expect(closeAllButton.attributes('disabled')).toBeUndefined();

    await closeAllButton.trigger('click');

    expect(wrapper.emitted('closeAll')).toHaveLength(1);
  });

  it('renderiza icono decorativo en boton principal', () => {
    const wrapper = mount(AppHeader, {
      props: {
        canCloseAllWindows: true
      }
    });

    const icon = wrapper.get('button svg[aria-hidden="true"]');
    expect(icon.attributes('aria-hidden')).toBe('true');
  });
});
