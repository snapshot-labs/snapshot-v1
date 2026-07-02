<script setup lang="ts">
import { clone } from '@snapshot-labs/snapshot.js/src/utils';
import { validateForm } from '@/helpers/validation';

const defaultParams = {
  symbol: 'DAI',
  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  decimals: 18
};

const props = defineProps<{
  open: boolean;
  strategy: {
    name: string;
    network: string;
    params: Record<string, any>;
  };
  defaultNetwork?: string;
}>();

const emit = defineEmits(['add', 'close']);
const { open } = toRefs(props);
const searchInput = ref('');
const isValidJson = ref(true);
const loading = ref(false);
const input = ref({
  name: '',
  network: '1',
  params: {} as Record<string, any>
});
const formRef = ref();

const {
  filterStrategies,
  getStrategies,
  isLoadingStrategies,
  getExtendedStrategy,
  extendedStrategy,
  strategyDefinition
} = useStrategies();
const strategiesResults = computed(() => filterStrategies(searchInput.value));

const { getNetworksSpacesCount } = useNetworksFilter();

const validationErrors = computed(() => {
  return validateForm(strategyDefinition.value || {}, input.value.params);
});

const isValid = computed(() => {
  return Object.values(validationErrors.value).length === 0;
});

function handleSubmit() {
  if (!isValid.value || !isValidJson.value)
    return formRef?.value?.forceShowError();

  const strategyObj = clone(input.value);
  emit('add', strategyObj);
  emit('close');
}
async function initStrategy(strategyName) {
  loading.value = true;
  await getExtendedStrategy(strategyName);
}
async function selectStrategy(strategyName) {
  input.value.name = strategyName;
  await initStrategy(strategyName);
  const params =
    extendedStrategy.value?.examples?.[0]?.strategy?.params || defaultParams;

  input.value.params = strategyDefinition.value ? {} : params;
  loading.value = false;
}
async function editStrategy(strategyName) {
  input.value = props.strategy;
  await initStrategy(strategyName);
  loading.value = false;
}

watch(open, () => {
  input.value.network = props.defaultNetwork ?? '';
  // compute the spaces count for network ordering.
  getNetworksSpacesCount();
  if (props.open && !props.strategy?.name) getStrategies();
  if (props.strategy?.name) {
    editStrategy(props.strategy.name);
  } else {
    input.value = {
      name: '',
      network: props.defaultNetwork ?? '1',
      params: defaultParams
    };
  }
});
</script>

<template>
  <BaseModal :open="open" @close="$emit('close')">
    <template #header>
      <h3 v-text="input.name ? input.name : $t('settings.addStrategy')" />
    </template>
    <BaseSearch
      v-if="!strategy.name && !input.name"
      v-model="searchInput"
      :placeholder="$t('searchPlaceholder')"
      focus-on-mount
      modal
    />
    <div v-if="input.name" class="m-4">
      <LoadingRow v-if="loading" class="px-0" />
      <div v-else>
        <div class="min-h-[250px] space-y-2">
          <ComboboxNetwork
            :network="input.network"
            @select="value => (input.network = value)"
          />
          <div>
            <TuneForm
              v-if="strategyDefinition"
              ref="formRef"
              v-model="input.params"
              :definition="strategyDefinition"
              :error="validationErrors"
            />
            <TuneTextareaJson
              v-else
              v-model="input.params"
              :placeholder="$t('strategyParameters')"
              @update:is-valid="value => (isValidJson = value)"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="mx-0 my-4 min-h-[300px] md:mx-4">
      <LoadingRow v-if="isLoadingStrategies" block />
      <div v-else class="space-y-3">
        <BaseStrategyItem
          v-for="str in strategiesResults"
          :key="str.id"
          :strategy="str"
          @click="selectStrategy(str.id)"
        />
        <BaseNoResults v-if="strategiesResults.length < 1" />
      </div>
    </div>
    <template v-if="input.name" #footer>
      <ButtonPlayground
        big
        :name="input.name"
        :network="input.network"
        :params="input.params"
      />
      <TuneButton
        :disabled="loading"
        class="mt-2 w-full"
        primary
        @click="handleSubmit"
      >
        {{ strategy.name ? $t('save') : $t('add') }}
      </TuneButton>
    </template>
  </BaseModal>
</template>
