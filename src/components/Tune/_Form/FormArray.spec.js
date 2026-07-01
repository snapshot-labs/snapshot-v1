import { describe, expect, it, afterEach, beforeAll, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

describe('FormArray', () => {
  let wrapper;
  let FormArray;
  let TuneButton;

  beforeAll(async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    });

    FormArray = (await import('./FormArray.vue')).default;
    TuneButton = (await import('../TuneButton.vue')).default;
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  const objectItems = {
    type: 'array',
    title: 'Inner strategies',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        network: { type: 'string' },
        params: { type: 'object' }
      }
    }
  };

  function createComponent(props) {
    wrapper = shallowMount(FormArray, {
      props: { error: {}, ...props }
    });
  }

  function lastModelValue() {
    const events = wrapper.emitted('update:modelValue');
    return events?.[events.length - 1]?.[0];
  }

  it('initializes object array items as an object, not an empty string', () => {
    createComponent({ modelValue: undefined, definition: objectItems });

    // Object items must be objects so their fields can be edited and persisted;
    // an empty string would fail the schema with "Must be object".
    expect(lastModelValue()).toEqual([{}]);
  });

  it('respects items.default when initializing', () => {
    createComponent({
      modelValue: undefined,
      definition: {
        ...objectItems,
        items: {
          ...objectItems.items,
          default: { name: '', network: '1', params: {} }
        }
      }
    });

    expect(lastModelValue()).toEqual([{ name: '', network: '1', params: {} }]);
  });

  it('appends an object when adding an item to an object array', async () => {
    createComponent({
      modelValue: [{ name: 'whitelist' }],
      definition: objectItems
    });

    await wrapper.findComponent(TuneButton).trigger('click');

    expect(lastModelValue()).toEqual([{ name: 'whitelist' }, {}]);
  });

  it('keeps empty-string items for string arrays', () => {
    createComponent({
      modelValue: undefined,
      definition: { type: 'array', title: 'Tokens', items: { type: 'string' } }
    });

    expect(lastModelValue()).toEqual(['']);
  });
});
