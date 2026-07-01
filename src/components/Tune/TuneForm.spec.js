import { describe, expect, it, afterEach, beforeAll, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

describe('TuneForm', () => {
  let wrapper;
  let TuneForm;
  let TuneTextareaJson;

  beforeAll(async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    });

    TuneForm = (await import('./TuneForm.vue')).default;
    TuneTextareaJson = (await import('./TuneTextareaJson.vue')).default;
  });

  function createComponent(params = {}) {
    wrapper = shallowMount(TuneForm, {
      props: {
        modelValue: params.modelValue || {},
        definition: params.definition,
        error: params.error || {}
      }
    });
  }

  afterEach(() => {
    wrapper.unmount();
  });

  it('renders free-form object fields as JSON textareas', () => {
    const params = { address: '0x0000000000000000000000000000000000000000' };

    createComponent({
      modelValue: { params },
      definition: {
        type: 'object',
        properties: {
          params: {
            type: 'object',
            title: 'Params'
          }
        }
      }
    });

    const textareaJson = wrapper.findComponent(TuneTextareaJson);

    expect(textareaJson.exists()).toBe(true);
    expect(textareaJson.props('modelValue')).toEqual(params);
    expect(textareaJson.props('definition')).toEqual({
      type: 'object',
      title: 'Params'
    });
  });

  it('renders object fields with properties as nested forms', () => {
    createComponent({
      modelValue: { metadata: { name: 'Snapshot' } },
      error: { metadata: {} },
      definition: {
        type: 'object',
        properties: {
          metadata: {
            type: 'object',
            title: 'Metadata',
            properties: {
              name: {
                type: 'string',
                title: 'Name'
              }
            }
          }
        }
      }
    });

    expect(wrapper.findComponent(TuneTextareaJson).exists()).toBe(false);
    expect(wrapper.findAllComponents(TuneForm)).toHaveLength(1);
  });
});
