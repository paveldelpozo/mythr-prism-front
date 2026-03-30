<script setup lang="ts">
import { computed, getCurrentInstance, useAttrs, useSlots } from 'vue';

defineOptions({
  inheritAttrs: false
});

const props = withDefaults(
  defineProps<{
    modelValue?: boolean;
    id?: string;
    label?: string;
    disabled?: boolean;
    name?: string;
    ariaLabel?: string;
  }>(),
  {
    modelValue: false,
    id: undefined,
    label: undefined,
    disabled: false,
    name: undefined,
    ariaLabel: undefined
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const attrs = useAttrs();
const slots = useSlots();
const uid = getCurrentInstance()?.uid ?? Math.round(Math.random() * 100_000);

const inputId = computed(() => props.id ?? `app-checkbox-${uid}`);
const hasLabel = computed(() => Boolean(props.label) || Boolean(slots.default));
const resolvedAriaLabel = computed(() => props.ariaLabel ?? props.label);

const onChange = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLInputElement).checked);
};
</script>

<template>
  <label
    :for="inputId"
    class="inline-flex min-h-9 items-center gap-2 text-xs text-slate-300"
    :class="disabled ? 'cursor-not-allowed opacity-65' : 'cursor-pointer'"
  >
    <input
      v-bind="attrs"
      :id="inputId"
      :name="name"
      :checked="modelValue"
      :disabled="disabled"
      :aria-label="resolvedAriaLabel"
      type="checkbox"
      class="peer sr-only"
      @change="onChange"
    />

    <span
      class="inline-flex h-4 w-4 items-center justify-center rounded border border-slate-500 bg-slate-900/70 transition-colors duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-300 peer-checked:border-emerald-300 peer-checked:bg-emerald-300/90 peer-disabled:border-slate-600 peer-disabled:bg-slate-800/70"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 16 16"
        class="h-3 w-3 text-slate-950 opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
      >
        <path d="M6.2 11.5L2.7 8l1.1-1.1 2.4 2.4 5.8-5.8L13 4.6z" fill="currentColor" />
      </svg>
    </span>

    <span v-if="hasLabel">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>
