<script setup lang="ts">
import mapKeys from 'lodash/fp/mapKeys';
import { getAddress } from '@ethersproject/address';
import getProvider from '@snapshot-labs/snapshot.js/src/utils/provider';
import { getBlockNumber } from '@snapshot-labs/snapshot.js/src/utils/web3';
import { getScores } from '@snapshot-labs/snapshot.js/src/utils';
import { decodeJson, encodeJson } from '@/helpers/b64';

const defaultParams = {
  symbol: 'BAL',
  address: '0xba100000625a3754423978a60c9317c58a424e3D',
  decimals: 18
};

const router = useRouter();
const route = useRoute();
const { query: queryParams } = useRoute();
const { copyToClipboard } = useCopy();
const { t } = useI18n();
const { formatCompactNumber } = useIntl();
const {
  getExtendedStrategy,
  extendedStrategy,
  strategyDefinition,
  getStrategies,
  isLoadingStrategies,
  filterStrategies
} = useStrategies();

const loading = ref(false);
const strategyError = ref(null);
const networkError = ref(false);
const scores = ref(null);
const searchInput = ref('');
const form = ref<{
  params: Record<string, any>;
  space: string;
  network: string;
  snapshot: string;
  addresses: string[];
}>({
  params: {},
  space: '',
  network: '1',
  snapshot: '',
  addresses: []
});

const scoresWithZeroBalanceAddresses = computed(() => {
  if (!scores.value) {
    return null;
  }
  // If an address is not present inside the scoresObject, add it with a zero balance
  const addressesArray = (form.value.addresses ?? []).map(getAddress);
  const scoresObject = mapKeys(getAddress, scores.value[0] ?? {});
  const scoresObjectWithZeroBalances: Record<string, number> =
    addressesArray.reduce((acc, address) => {
      acc[address] = scoresObject[address] || 0;
      return acc;
    }, {});
  // Order scoreObjectWithZeroBalances by score
  return Object.fromEntries(
    Object.entries(scoresObjectWithZeroBalances).sort(
      (a: any, b: any) => b[1] - a[1]
    )
  );
});

const strategyExample = computed(() => {
  if (queryParams.query) {
    try {
      const { params, network, snapshot, addresses, space } = decodeJson(
        queryParams.query
      );
      return {
        ...extendedStrategy.value?.examples?.[0],
        addresses: addresses || extendedStrategy.value?.examples?.[0].addresses,
        network,
        snapshot,
        space,
        strategy: { params }
      };
    } catch (e) {
      return extendedStrategy.value?.examples?.[0];
    }
  }
  return extendedStrategy.value?.examples?.[0];
});

async function loadScores() {
  if (!extendedStrategy.value) return;

  scores.value = null;
  strategyError.value = null;
  loading.value = true;

  try {
    const strategyParams = {
      name: extendedStrategy.value.id,
      params: form.value.params
    };
    scores.value = await getScores(
      form.value.space,
      [strategyParams],
      form.value.network,
      form.value.addresses,
      parseInt(form.value.snapshot),
      `${import.meta.env.VITE_SCORES_URL}/api/scores`
    );
    loading.value = false;
  } catch (e: any) {
    loading.value = false;
    console.log(e);
    strategyError.value = e;
  }
}

function selectStrategy(strategy) {
  router.push({ name: 'playground', params: { name: strategy.id } });
}

async function loadSnapshotBlockNumber() {
  try {
    loading.value = true;
    scores.value = null;
    networkError.value = false;
    const broviderUrl = import.meta.env.VITE_BROVIDER_URL;
    const provider = await getProvider(form.value.network, { broviderUrl });
    const blockNumber = await getBlockNumber(provider);
    form.value.snapshot = blockNumber.toString();
    loading.value = false;
  } catch (e) {
    loading.value = false;
    networkError.value = true;
    console.log(e);
  }
}

async function handleURLUpdate(_, paramName) {
  router.replace({
    query: { query: encodeJson(form.value) },
    params: { retainScrollPosition: 'yes' }
  });

  if (paramName === 'networkUpdate') {
    loadSnapshotBlockNumber();
  }
}

function copyURL() {
  copyToClipboard(
    `${window.location.origin}/#${route.path}?query=${encodeJson(form.value)}`
  );
}

watch(
  strategyExample,
  () => {
    form.value.params = strategyExample.value?.strategy.params ?? defaultParams;
    form.value.network = strategyExample.value?.network ?? '1';
    form.value.space = strategyExample.value?.space ?? '';
    form.value.addresses = strategyExample.value?.addresses ?? [];
  },
  { immediate: true }
);

watch(
  () => route.params.name,
  async () => {
    await getStrategies();
    await getExtendedStrategy(route.params.name as string);

    if (queryParams.query && strategyExample.value?.snapshot) {
      form.value.snapshot = strategyExample.value.snapshot;
    } else {
      loadSnapshotBlockNumber();
    }
  },
  { immediate: true }
);

function handleNetworkSelect(value) {
  form.value.network = value;
  handleURLUpdate(null, 'networkUpdate');
}
</script>

<template>
  <TheLayout v-bind="$attrs">
    <template #content-left>
      <div class="mb-3 px-4 md:px-0">
        <ButtonBack
          :name="$t('strategyDetails')"
          @click="
            router.push({
              name: 'strategy',
              params: { name: route.params.name }
            })
          "
        />
      </div>
      <LoadingPage v-if="isLoadingStrategies" />
      <template v-else>
        <BaseBlock title="Strategy" class="mb-3">
          <BaseCombobox
            :label="''"
            :items="
              filterStrategies(searchInput).map(s => ({ id: s.id, name: s.id }))
            "
            :selected-id="route.params.name as string"
            @select="selectStrategy"
            @search="value => (searchInput = value)"
          />
        </BaseBlock>
        <LoadingPage v-if="!extendedStrategy" />
        <div v-else class="space-y-3">
          <BaseBlock :title="$t('settings.header')">
            <div class="space-y-2">
              <ComboboxNetwork
                :network="form.network.toString()"
                @select="handleNetworkSelect"
              />
              <BaseInput
                v-model="form.snapshot"
                :title="$t('snapshot')"
                @update:model-value="handleURLUpdate"
              />
              <BaseInput
                v-model="form.space"
                title="Space"
                @update:model-value="handleURLUpdate"
              />
            </div>
            <BaseBlock
              v-if="networkError"
              class="mt-4"
              style="border-color: red !important"
            >
              <BaseIcon name="warning" class="mr-2 !text-red" />
              <span class="!text-red">{{ $t('networkErrorPlayground') }}</span>
            </BaseBlock>
          </BaseBlock>
          <BaseBlock :title="$t('strategyParams')">
            <FormObjectStrategyParams
              v-if="strategyDefinition"
              v-model="form.params"
              :strategy-name="route.params.name as string"
            />
            <TextareaJson
              v-else
              v-model="form.params"
              is-valid
              :placeholder="$t('strategyParameters')"
              class="input text-left"
              @update:model-value="handleURLUpdate"
            />
            <BaseBlock
              v-if="strategyError"
              class="mt-3 overflow-x-auto"
              style="border-color: red !important"
            >
              <pre class="whitespace-pre-wrap !text-red">
 {{ strategyError }}</pre
              >
            </BaseBlock>
          </BaseBlock>
          <BaseBlock :title="$t('addresses')">
            <TextareaArray
              v-model="form.addresses"
              :placeholder="`0x8C28Cf33d9Fd3D0293f963b1cd27e3FF422B425c\n0xeF8305E140ac520225DAf050e2f71d5fBcC543e7`"
              @update:model-value="handleURLUpdate"
            />
          </BaseBlock>
        </div>
      </template>
    </template>
    <template #sidebar-right>
      <div class="space-y-3">
        <BaseBlock :title="$t('actions')">
          <TuneButton
            :loading="loading"
            :disabled="loading || !extendedStrategy"
            class="flex w-full items-center justify-center"
            primary
            @click="loadScores"
          >
            <i-ho-play class="text-lg" />
          </TuneButton>
          <TuneButton class="mt-2 w-full" @click="copyURL">
            <BaseIcon
              name="insertlink"
              size="18"
              class="mr-1 align-text-bottom"
            />
            {{ t('copyLink') }}
          </TuneButton>
        </BaseBlock>
        <BaseBlock v-if="scores" :title="$t('results')">
          <div
            v-for="(score, address) in scoresWithZeroBalanceAddresses"
            :key="address"
            class="flex justify-between"
          >
            <BaseUser :address="address as string" />
            <span>
              {{ formatCompactNumber(score) }}
              {{ form.params.symbol }}
            </span>
          </div>
        </BaseBlock>
      </div>
    </template>
  </TheLayout>
</template>
