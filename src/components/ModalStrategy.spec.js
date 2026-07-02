import { beforeAll, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import { ref, computed } from 'vue';

const extendedStrategy = ref(null);
const strategies = ref([{ id: 'voting-proxy' }]);
const flushPromises = () => new Promise(resolve => setTimeout(resolve));

vi.mock('@/composables/useStrategies', () => ({
  useStrategies: () => ({
    filterStrategies: vi.fn(() => strategies.value),
    getStrategies: vi.fn(),
    isLoadingStrategies: ref(false),
    getExtendedStrategy: vi.fn(async name => {
      extendedStrategy.value = {
        id: name,
        schema: {
          $ref: '#/definitions/Strategy',
          definitions: {
            Strategy: {
              type: 'object',
              properties: {
                factory: {
                  type: 'string',
                  title: 'Factory'
                }
              }
            }
          }
        }
      };
    }),
    extendedStrategy,
    strategyDefinition: computed(
      () => extendedStrategy.value?.schema?.definitions?.Strategy || false
    )
  })
}));

vi.mock('@/composables/useNetworksFilter', () => ({
  useNetworksFilter: () => ({
    getNetworksSpacesCount: vi.fn()
  })
}));

vi.mock('@/helpers/validation', () => ({
  validateForm: vi.fn(() => ({}))
}));

describe('ModalStrategy', () => {
  let ModalStrategy;

  beforeAll(async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    });

    ModalStrategy = (await import('./ModalStrategy.vue')).default;
  });

  function createComponent() {
    return shallowMount(ModalStrategy, {
      props: {
        open: true,
        strategy: {
          name: '',
          network: '',
          params: {}
        },
        defaultNetwork: '1'
      },
      global: {
        stubs: {
          BaseModal: {
            template:
              '<div><slot name="header" /><slot /><slot name="footer" /></div>'
          },
          BaseSearch: true,
          BaseStrategyItem: {
            props: ['strategy'],
            emits: ['click'],
            template:
              '<button type="button" @click="$emit(\'click\')">{{ strategy.id }}</button>'
          },
          ButtonPlayground: true,
          ComboboxNetwork: true,
          LoadingRow: true,
          TuneForm: {
            name: 'TuneForm',
            emits: ['update:modelValue'],
            template: '<div />'
          },
          TuneButton: {
            emits: ['click'],
            template:
              '<button type="button" @click="$emit(\'click\')"><slot /></button>'
          }
        },
        mocks: {
          $t: key => key
        }
      }
    });
  }

  it('passes the selected strategy to the playground button', async () => {
    const wrapper = createComponent();

    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });
    await wrapper.find('button').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();
    await wrapper
      .findComponent({ name: 'TuneForm' })
      .vm.$emit('update:modelValue', {
        factory: '0x5afe000000000000000000000000000000000000'
      });
    await wrapper.vm.$nextTick();

    const playground = wrapper.findComponent({ name: 'ButtonPlayground' });

    expect(playground.props()).toMatchObject({
      name: 'voting-proxy',
      network: '1',
      params: {
        factory: '0x5afe000000000000000000000000000000000000'
      }
    });
  });
});
