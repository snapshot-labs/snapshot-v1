<script setup lang="ts">
import { getTokenPrices } from '@/helpers/covalent';
import { call, clone } from '@snapshot-labs/snapshot.js/src/utils';
import { JsonRpcProvider } from '@ethersproject/providers';
import { ERC20ABI } from '@/helpers/constants';
import { isAddress } from '@ethersproject/address';
import { shorten } from '@/helpers/utils';

const DEFAULT_TOKEN = {
  name: '',
  logo: '',
  standard: 'ERC-20',
  symbol: '',
  decimals: '18'
};

const emit = defineEmits(['next']);

const { form } = useFormSpaceSettings('setup');
const { t } = useI18n();

const isTokenLoading = ref(false);
const tokenError = ref('');
const network = ref('1');
const contract = ref('');
const token = ref(clone(DEFAULT_TOKEN));

const strategy = computed(() => {
  let name = 'erc20-balance-of';
  if (token.value.standard === 'ERC-721') {
    name = 'erc721';
  } else if (token.value.standard === 'ERC-1155') {
    name = 'erc1155-balance-of';
  }

  return {
    name,
    network: network.value,
    params: {
      network: network.value,
      address: contract.value,
      decimals: token.value.decimals,
      symbol: token.value.symbol
    }
  };
});

const tokenStandards = computed(() => {
  return ['ERC-20', 'ERC-721', 'ERC-1155'].map(name => ({
    value: name
  }));
});

function nextStep() {
  if (!token.value.symbol) return;

  emit('next');

  form.value.strategies = [];
  form.value.strategies.push(strategy.value);
  form.value.symbol = strategy.value.params.symbol;
}

async function getTokenInfo() {
  tokenError.value = '';

  if (!contract.value || !isAddress(contract.value)) {
    tokenError.value = t('errors.invalidAddress');
    token.value = clone(DEFAULT_TOKEN);
    return;
  }

  isTokenLoading.value = true;

  const { data } = await getTokenPrices(contract.value, network.value);

  if (data?.[0]?.contract_name) {
    token.value.name = data[0].contract_name;
    token.value.logo = data[0].logo_url;
    token.value.symbol = data[0].contract_ticker_symbol;
    token.value.decimals = data[0].contract_decimals;
    isTokenLoading.value = false;
  } else {
    try {
      const provider = new JsonRpcProvider(
        `${import.meta.env.VITE_BROVIDER_URL}/${network.value}`
      );
      const tokenInfo = await Promise.all([
        call(provider, ERC20ABI, [contract.value, 'name', []]),
        call(provider, ERC20ABI, [contract.value, 'symbol', []]),
        call(provider, ERC20ABI, [contract.value, 'decimals', []])
      ]);
      token.value.name = tokenInfo[0];
      token.value.symbol = tokenInfo[1];
      token.value.decimals = tokenInfo[2];
    } catch (e) {
      console.log(e);
      tokenError.value = t('setup.strategy.tokenVoting.tokenNotFound');
      if (
        token.value.standard === 'ERC-721' ||
        token.value.standard === 'ERC-1155'
      ) {
        token.value.decimals = '0';
      }
    } finally {
      isTokenLoading.value = false;
    }
  }
}

watch(
  [contract, network],
  async () => {
    await getTokenInfo();
  },
  { deep: true }
);
</script>

<template>
  <div class="mt-4 space-y-4">
    <BaseBlock :title="$t('setup.strategy.blockTitle')">
      <div class="flex md:w-2/3">
        <div class="w-full space-y-3">
          <ComboboxNetwork
            :network="network"
            @select="value => (network = value)"
          />
          <BaseListbox
            v-model="token.standard"
            :items="tokenStandards"
            label="Token standard"
          />
          <div>
            <BaseInput
              v-model.trim="contract"
              title="Token contract"
              placeholder="Enter address"
              :error="{
                message:
                  tokenError !== $t('setup.strategy.tokenVoting.tokenNotFound')
                    ? tokenError
                    : '',
                push: true
              }"
              :loading="isTokenLoading"
              focus-on-mount
            />
          </div>
          <div>
            <BaseInput
              v-if="
                !isTokenLoading &&
                tokenError === $t('setup.strategy.tokenVoting.tokenNotFound')
              "
              v-model.trim="token.symbol"
              title="Symbol"
              placeholder="Enter Symbol"
              :error="{
                message: !token.symbol ? 'Symbol is required' : '',
                push: true
              }"
              focus-on-mount
            />
          </div>
          <div>
            <BaseInput
              v-if="
                !isTokenLoading &&
                tokenError === $t('setup.strategy.tokenVoting.tokenNotFound')
              "
              v-model.trim="token.decimals"
              title="Decimals"
              placeholder="Enter Decimals"
              :error="{
                message: !token.decimals ? 'Decimals is required' : '',
                push: true
              }"
            />
          </div>
        </div>
      </div>
    </BaseBlock>

    <BaseBlock v-if="token.name" class="!mt-3 space-x-1 text-left text-sm">
      <div class="flex justify-between">
        <div class="flex items-center gap-1 truncate">
          <AvatarToken :address="contract" class="mr-1" size="38" />
          <div class="truncate">
            <div class="mr-4 truncate whitespace-nowrap text-skin-link">
              {{ token.name }}
            </div>
            {{ token.symbol }}
          </div>
        </div>
        <div class="flex items-end">
          <BaseLink
            v-if="network == '1'"
            class="text-skin-text hover:text-skin-link"
            :link="`https://etherscan.io/token/${contract}`"
          >
            {{ shorten(contract) }}
          </BaseLink>
        </div>
      </div>
    </BaseBlock>

    <div class="float-right mx-4 md:mx-0">
      <SetupButtonNext
        class="!mt-0"
        :disabled="isTokenLoading"
        @click="nextStep"
      />
    </div>
  </div>
</template>
