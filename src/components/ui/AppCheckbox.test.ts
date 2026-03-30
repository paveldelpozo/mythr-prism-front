import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AppCheckbox from './AppCheckbox.vue';

describe('components/ui/AppCheckbox', () => {
  it('renderiza label y refleja modelValue', () => {
    const wrapper = mount(AppCheckbox, {
      props: {
        modelValue: true,
        label: 'Avance automatico'
      }
    });

    const input = wrapper.get('input[type="checkbox"]');

    expect(wrapper.text()).toContain('Avance automatico');
    expect((input.element as HTMLInputElement).checked).toBe(true);
  });

  it('emite update:modelValue al toggle', async () => {
    const wrapper = mount(AppCheckbox, {
      props: {
        modelValue: false,
        label: 'Iniciar en mute'
      }
    });

    const input = wrapper.get('input[type="checkbox"]');
    (input.element as HTMLInputElement).checked = true;
    await input.trigger('change');

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
  });
});
